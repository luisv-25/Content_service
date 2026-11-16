import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { FilesService } from "../../src/files/files.service";
import { SharedLinksService } from "../../src/shared-links/shared-links.service";
import { SharedLinkAccessScope } from "../../src/shared-links/entities/shared-link.entity";

// Pruebas UNITARIAS: BD (repositorios), clientes de otros microservicios y Supabase Storage son mocks.
describe("Content Service (unitarias, con mocks)", () => {
  const filesRepo = { create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: "f1", ...x })), findOne: jest.fn() };
  const sessionClient = { getRoom: jest.fn().mockResolvedValue({ booking_id: "b1" }) };
  const bookingClient = { getBooking: jest.fn().mockResolvedValue({ student_id: "est-1", tutor_id: "perfil-1" }) };
  const catalogClient = { getTutorProfile: jest.fn().mockResolvedValue({ user: { id: "tutor-1" } }) };
  const storage = {
    upload: jest.fn().mockResolvedValue({ storageKey: "sessions/s/x.pdf", isMock: false }),
    getSignedUrl: jest.fn().mockResolvedValue("https://storage.test/firmada"),
  };
  const filesService = new FilesService(
    filesRepo as any,
    sessionClient as any,
    bookingClient as any,
    catalogClient as any,
    storage as any,
  );
  const pdf = (size: number) => ({ buffer: Buffer.from("%PDF"), originalname: "guia.pdf", mimetype: "application/pdf", size });

  beforeEach(() => jest.clearAllMocks());

  it("Unitaria 1: subir material rechaza archivo vacío, mayor a 25 MB o de un tutor no asignado a la sesión; el válido se guarda", async () => {
    await expect(filesService.upload({ id: "tutor-1", role: "tutor" }, "s1", pdf(0))).rejects.toBeInstanceOf(BadRequestException);
    await expect(filesService.upload({ id: "tutor-1", role: "tutor" }, "s1", pdf(25 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // otro tutor que no es el de la sesión
    await expect(filesService.upload({ id: "tutor-otro", role: "tutor" }, "s1", pdf(1000))).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(filesRepo.save).not.toHaveBeenCalled();

    const ok = await filesService.upload({ id: "tutor-1", role: "tutor" }, "s1", pdf(1000));
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(ok).toMatchObject({ session_id: "s1", student_id: "est-1", tutor_id: "tutor-1", size_bytes: 1000 });
  });

  it("Unitaria 2: enlace compartido vencido -> 404; con alcance de participantes exige sesión y ser estudiante/tutor del archivo", async () => {
    const linksRepo = { findOne: jest.fn() };
    const filesSvcMock = { findOne: jest.fn().mockResolvedValue({ id: "f1", tutor_id: "tutor-1", student_id: "est-1", storage_key: "k", file_name: "a.pdf", mime_type: "application/pdf", size_bytes: 10 }) };
    const service = new SharedLinksService(linksRepo as any, filesSvcMock as any, storage as any);
    const futuro = new Date(Date.now() + 60_000);

    linksRepo.findOne.mockResolvedValue({ file_id: "f1", access_scope: SharedLinkAccessScope.SESSION_PARTICIPANTS, expires_at: new Date(Date.now() - 1000) });
    await expect(service.resolve("t", null)).rejects.toBeInstanceOf(NotFoundException);

    linksRepo.findOne.mockResolvedValue({ file_id: "f1", access_scope: SharedLinkAccessScope.SESSION_PARTICIPANTS, expires_at: futuro });
    await expect(service.resolve("t", null)).rejects.toBeInstanceOf(ForbiddenException); // anónimo
    await expect(service.resolve("t", { id: "est-2", role: "student" })).rejects.toBeInstanceOf(ForbiddenException); // otro estudiante
    const okEst = await service.resolve("t", { id: "est-1", role: "student" });
    expect(okEst).toMatchObject({ available: true, url: "https://storage.test/firmada" });

    // alcance privado: el token basta, sin login
    linksRepo.findOne.mockResolvedValue({ file_id: "f1", access_scope: SharedLinkAccessScope.PRIVATE, expires_at: futuro });
    await expect(service.resolve("t", null)).resolves.toMatchObject({ available: true });
  });
});
