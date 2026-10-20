import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

export interface UploadResult {
  storageKey: string;
  isMock: boolean;
}

// Sección 5.7 del documento: "la base solo persiste metadatos, nunca el
// binario" -- el archivo real tiene que vivir en un bucket externo.
// Esta entrega usa Supabase Storage (plan gratuito, API REST simple vía
// Bearer token, sin necesidad de firmar peticiones a mano). Si no hay
// credenciales configuradas, el servicio sigue funcionando en modo
// SIMULADO: acepta la subida y guarda los metadatos, pero no hay bytes en
// ningún lado y la descarga lo dice explícitamente -- mismo criterio que
// DailyClient en session-service (nunca una URL inventada que parezca real
// sin serlo). Queda aislada en esta clase para que cambiar de proveedor
// (Cloudinary, S3, etc.) sea un cambio de una sola pieza.
@Injectable()
export class StorageClient {
  private readonly logger = new Logger(StorageClient.name);
  private readonly baseUrl = process.env.SUPABASE_URL;
  private readonly serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  private readonly bucket = process.env.SUPABASE_BUCKET || "educonecta-content";

  constructor(private readonly http: HttpService) {}

  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.serviceRoleKey);
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
    if (!this.isConfigured) {
      this.logger.warn(
        "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas: archivo aceptado en modo SIMULADO (no se guarda ningún byte).",
      );
      return { storageKey: `mock-file-${key}`, isMock: true };
    }

    try {
      await firstValueFrom(
        this.http.put(`${this.baseUrl}/storage/v1/object/${this.bucket}/${key}`, buffer, {
          headers: {
            Authorization: `Bearer ${this.serviceRoleKey}`,
            "Content-Type": mimeType,
            "x-upsert": "true",
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 15000,
        }),
      );
      return { storageKey: key, isMock: false };
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.error(`Fallo al subir a Supabase Storage: ${axiosErr.message}`);
      throw err;
    }
  }

  // URL firmada y temporal (sección 5.7 implícita: nunca se expone el
  // bucket como público sin control). expiresInSeconds por defecto: 5 min,
  // suficiente para iniciar la descarga sin dejar un enlace de larga vida
  // flotando fuera de shared_links (que sí tiene su propio expires_at).
  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string | null> {
    if (!this.isConfigured || key.startsWith("mock-file-")) return null;

    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/storage/v1/object/sign/${this.bucket}/${key}`,
          { expiresIn: expiresInSeconds },
          { headers: { Authorization: `Bearer ${this.serviceRoleKey}` }, timeout: 5000 },
        ),
      );
      return `${this.baseUrl}/storage/v1${data.signedURL}`;
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.error(`Fallo al firmar URL de descarga: ${axiosErr.message}`);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConfigured || key.startsWith("mock-file-")) return;
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/storage/v1/object/${this.bucket}/${key}`, {
          headers: { Authorization: `Bearer ${this.serviceRoleKey}` },
          timeout: 5000,
        }),
      );
    } catch (err) {
      const axiosErr = err as AxiosError;
      // No crítico: el metadato ya se va a borrar de todas formas.
      this.logger.warn(`No se pudo borrar ${key} en Supabase Storage: ${axiosErr.message}`);
    }
  }
}
