import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { StorageClient } from "../../src/storage/storage.client";
import { SessionServiceClient } from "../../src/files/session-service.client";
import { BookingServiceClient } from "../../src/files/booking-service.client";
import { CatalogServiceClient } from "../../src/files/catalog-service.client";
import { createTestApp, tokenFor } from "../helpers/test-app";

// Prueba de INTEGRACIÓN: HTTP -> controlador -> servicio -> PostgreSQL real.
// Se reemplazan por falsos: el storage (Supabase) y los clientes de Session/Booking/Catalog.
const SESION = "11111111-1111-4111-8111-111111111111";
const ESTUDIANTE = "22222222-2222-4222-8222-222222222222";
const TUTOR = "33333333-3333-4333-8333-333333333333";
const OTRO_TUTOR = "44444444-4444-4444-8444-444444444444";
const OTRO_ESTUDIANTE = "55555555-5555-4555-8555-555555555555";

// Storage en memoria: guarda los "bytes" y entrega URLs firmadas falsas.
class FakeStorage {
  objetos = new Map<string, Buffer>();
  async upload(key: string, buffer: Buffer) {
    this.objetos.set(key, buffer);
    return { storageKey: key, isMock: false };
  }
  async getSignedUrl(key: string) {
    return this.objetos.has(key) ? `https://storage.fake/${key}?firma=abc` : null;
  }
  async delete(key: string) {
    this.objetos.delete(key);
  }
}

describe("Integración: material de apoyo (subir, listar, descargar, compartir y eliminar)", () => {
  let app: INestApplication;
  const storage = new FakeStorage();
  const auth = (id: string, role: "student" | "tutor" | "admin") => ({ Authorization: `Bearer ${tokenFor(id, role)}` });

  beforeAll(async () => {
    app = await createTestApp(
      [AppModule],
      [
        { provide: StorageClient, useValue: storage },
        { provide: SessionServiceClient, useValue: { getRoom: async () => ({ booking_id: "b1" }) } },
        { provide: BookingServiceClient, useValue: { getBooking: async () => ({ student_id: ESTUDIANTE, tutor_id: "perfil-1" }) } },
        { provide: CatalogServiceClient, useValue: { getTutorProfile: async () => ({ user: { id: TUTOR } }) } },
      ],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("el tutor sube un PDF, se lista y descarga con URL firmada, se comparte y se elimina; se rechazan los casos inválidos", async () => {
    const http = request(app.getHttpServer());
    const pdf = Buffer.from("%PDF-1.4 contenido de prueba");

    // Reglas de rechazo al subir
    await http.post("/api/v1/files").field("sessionId", SESION).attach("file", pdf, "guia.pdf").expect(401); // sin token
    await http.post("/api/v1/files").set(auth(ESTUDIANTE, "student")).field("sessionId", SESION).attach("file", pdf, "guia.pdf").expect(403); // rol
    await http.post("/api/v1/files").set(auth(OTRO_TUTOR, "tutor")).field("sessionId", SESION).attach("file", pdf, "guia.pdf").expect(403); // tutor ajeno
    await http.post("/api/v1/files").set(auth(TUTOR, "tutor")).field("sessionId", SESION).expect(400); // sin archivo
    await http.post("/api/v1/files").set(auth(TUTOR, "tutor")).field("sessionId", SESION).attach("file", Buffer.alloc(0), "vacio.pdf").expect(400); // vacío
    await http.post("/api/v1/files").set(auth(TUTOR, "tutor")).field("sessionId", "no-uuid").attach("file", pdf, "guia.pdf").expect(400); // DTO
    expect(storage.objetos.size).toBe(0); // nada llegó al storage

    // SUBIR
    const subido = await http.post("/api/v1/files").set(auth(TUTOR, "tutor")).field("sessionId", SESION).attach("file", pdf, { filename: "guia.pdf", contentType: "application/pdf" }).expect(201);
    const id = subido.body.id;
    expect(subido.body).toMatchObject({ session_id: SESION, student_id: ESTUDIANTE, tutor_id: TUTOR, file_name: "guia.pdf", mime_type: "application/pdf" });
    expect(storage.objetos.has(subido.body.storage_key)).toBe(true);

    // LISTAR: participantes sí, ajenos no
    const lista = await http.get(`/api/v1/files?sessionId=${SESION}`).set(auth(ESTUDIANTE, "student")).expect(200);
    expect(lista.body.map((f: any) => f.id)).toEqual([id]);
    await http.get(`/api/v1/files?sessionId=${SESION}`).set(auth(OTRO_ESTUDIANTE, "student")).expect(403);
    await http.get("/api/v1/files").set(auth(TUTOR, "tutor")).expect(400); // falta sessionId

    // DESCARGAR: URL firmada para el estudiante de la sesión; 403 para otro
    const descarga = await http.get(`/api/v1/files/${id}/download`).set(auth(ESTUDIANTE, "student")).expect(200);
    expect(descarga.body).toMatchObject({ available: true, expiresInSeconds: 300 });
    expect(descarga.body.url).toContain("https://storage.fake/");
    await http.get(`/api/v1/files/${id}/download`).set(auth(OTRO_ESTUDIANTE, "student")).expect(403);

    // COMPARTIR: enlace de participantes (exige login y ser participante) y privado (token basta)
    await http.post(`/api/v1/files/${id}/shared-links`).set(auth(ESTUDIANTE, "student")).send({}).expect(403);
    await http.post(`/api/v1/files/${id}/shared-links`).set(auth(TUTOR, "tutor")).send({ expiresInMinutes: 1 }).expect(400); // mínimo 5
    const enlace = await http.post(`/api/v1/files/${id}/shared-links`).set(auth(TUTOR, "tutor")).send({}).expect(201);
    await http.get(`/api/v1/shared-links/${enlace.body.token}`).expect(403);
    await http.get(`/api/v1/shared-links/${enlace.body.token}`).set(auth(OTRO_ESTUDIANTE, "student")).expect(403);
    const viaEnlace = await http.get(`/api/v1/shared-links/${enlace.body.token}`).set(auth(ESTUDIANTE, "student")).expect(200);
    expect(viaEnlace.body).toMatchObject({ available: true, file: { id, fileName: "guia.pdf" } });
    const privado = await http.post(`/api/v1/files/${id}/shared-links`).set(auth(TUTOR, "tutor")).send({ accessScope: "private" }).expect(201);
    await http.get(`/api/v1/shared-links/${privado.body.token}`).expect(200);
    await http.get("/api/v1/shared-links/token-inexistente").expect(404);

    // ELIMINAR: el estudiante no puede; otro tutor tampoco; el tutor dueño sí (y se borra del storage)
    await http.delete(`/api/v1/files/${id}`).set(auth(ESTUDIANTE, "student")).expect(403);
    await http.delete(`/api/v1/files/${id}`).set(auth(OTRO_TUTOR, "tutor")).expect(403);
    await http.delete(`/api/v1/files/${id}`).set(auth(TUTOR, "tutor")).expect(200);
    expect(storage.objetos.size).toBe(0);
    await http.get(`/api/v1/files/${id}`).set(auth(TUTOR, "tutor")).expect(404);
  });
});
