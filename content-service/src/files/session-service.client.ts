import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

@Injectable()
export class SessionServiceClient {
  private readonly logger = new Logger(SessionServiceClient.name);
  private readonly baseUrl = process.env.SESSION_SERVICE_URL || "http://localhost:3004";

  // Comunicación SÍNCRONA hacia Session Service: resuelve session_id
  // (rooms.id) -> booking_id, primer eslabón de la cadena que necesita
  // Content para saber quién puede ver un archivo (sección 5.7 del doc).
  async getRoom(sessionId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/v1/sessions/${sessionId}`, { timeout: 3000 }),
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(`Sesión ${sessionId} no existe en Session Service`);
      }
      this.logger.error(`Fallo al consultar Session Service para ${sessionId}: ${axiosErr.message}`);
      throw err;
    }
  }

  constructor(private readonly http: HttpService) {}
}
