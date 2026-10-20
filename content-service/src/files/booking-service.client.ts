import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

@Injectable()
export class BookingServiceClient {
  private readonly logger = new Logger(BookingServiceClient.name);
  private readonly baseUrl = process.env.BOOKING_SERVICE_URL || "http://localhost:3003";

  // Comunicación SÍNCRONA hacia Booking Service: segundo eslabón de la
  // cadena session_id -> booking_id -> {student_id, tutor_id (profile)}.
  async getBooking(bookingId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/api/v1/bookings/${bookingId}`, { timeout: 3000 }),
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(`Reserva ${bookingId} no existe en Booking Service`);
      }
      this.logger.error(`Fallo al consultar Booking Service para ${bookingId}: ${axiosErr.message}`);
      throw err;
    }
  }

  constructor(private readonly http: HttpService) {}
}
