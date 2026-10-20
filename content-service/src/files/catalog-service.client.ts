import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

@Injectable()
export class CatalogServiceClient {
  private readonly logger = new Logger(CatalogServiceClient.name);
  private readonly baseUrl = process.env.CATALOG_SERVICE_URL || "http://localhost:3002";

  // Comunicación SÍNCRONA hacia Catalog Service (sección 4.3 del doc):
  // booking.tutor_id (que devuelve Booking Service) es en realidad
  // tutor_profiles.id, no user_db.users.id. Content necesita el user.id
  // real para guardar files_metadata.tutor_id de forma consistente con
  // student_id, y para poder comparar directo contra req.user.id (el JWT
  // trae el user.id del tutor, no el id de su perfil en Catalog).
  async getTutorProfile(tutorProfileId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/v1/tutors/${tutorProfileId}/profile`, {
          timeout: 3000,
        }),
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(`Tutor ${tutorProfileId} no existe en Catalog Service`);
      }
      this.logger.error(`Fallo al consultar Catalog Service para ${tutorProfileId}: ${axiosErr.message}`);
      throw err;
    }
  }

  constructor(private readonly http: HttpService) {}
}
