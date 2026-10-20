import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import { FileMetadata } from "./entities/file-metadata.entity";
import { SessionServiceClient } from "./session-service.client";
import { BookingServiceClient } from "./booking-service.client";
import { CatalogServiceClient } from "./catalog-service.client";
import { StorageClient } from "../storage/storage.client";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

interface Requester {
  id: string;
  role: string;
}

interface ResolvedParticipants {
  studentId: string;
  tutorUserId: string;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileMetadata) private readonly filesRepo: Repository<FileMetadata>,
    private readonly sessionServiceClient: SessionServiceClient,
    private readonly bookingServiceClient: BookingServiceClient,
    private readonly catalogServiceClient: CatalogServiceClient,
    private readonly storageClient: StorageClient,
  ) {}

  // Encadena Session -> Booking -> Catalog (sección 4.3/5.7 del doc) para
  // saber quién es el estudiante y el tutor (como user.id real, no como
  // tutor_profiles.id) de una sesión concreta. Se llama UNA vez al subir
  // el archivo; de ahí en adelante se usa lo ya guardado en
  // files_metadata (ver la nota en el entity).
  private async resolveSessionParticipants(sessionId: string): Promise<ResolvedParticipants> {
    const room = await this.sessionServiceClient.getRoom(sessionId);
    const booking = await this.bookingServiceClient.getBooking(room.booking_id);
    const tutorProfile = await this.catalogServiceClient.getTutorProfile(booking.tutor_id);
    const tutorUserId = tutorProfile?.user?.id;
    if (!tutorUserId) {
      throw new BadRequestException(`No se pudo resolver el tutor dueño de la sesión ${sessionId}`);
    }
    return { studentId: booking.student_id, tutorUserId };
  }

  private assertCanAccess(file: FileMetadata, requester: Requester) {
    if (requester.role === "admin") return;
    if (requester.role === "tutor" && requester.id === file.tutor_id) return;
    if (requester.role === "student" && requester.id === file.student_id) return;
    throw new ForbiddenException("No tienes acceso a este archivo");
  }

  // Permiso de tutor: subir material de apoyo (sección 5.7 del doc). Solo
  // el tutor asignado a esa sesión puede subir, nunca cualquier tutor.
  async upload(
    requester: Requester,
    sessionId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!file) throw new BadRequestException("Falta el archivo (campo 'file')");
    if (file.size <= 0) throw new BadRequestException("El archivo está vacío");
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`El archivo supera el máximo permitido (${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`);
    }

    const { studentId, tutorUserId } = await this.resolveSessionParticipants(sessionId);
    if (requester.role !== "admin" && requester.id !== tutorUserId) {
      throw new ForbiddenException("Solo el tutor asignado a esta sesión puede subir material");
    }

    const key = `sessions/${sessionId}/${randomUUID()}-${file.originalname}`;
    const uploadResult = await this.storageClient.upload(key, file.buffer, file.mimetype);
    this.logger.log(
      `Archivo ${uploadResult.isMock ? "SIMULADO (sin bucket configurado)" : "subido a Supabase Storage"} para sesión ${sessionId}`,
    );

    return this.filesRepo.save(
      this.filesRepo.create({
        session_id: sessionId,
        student_id: studentId,
        tutor_id: tutorUserId,
        file_name: file.originalname,
        mime_type: file.mimetype,
        storage_key: uploadResult.storageKey,
        size_bytes: file.size,
      }),
    );
  }

  async findOne(id: string) {
    const file = await this.filesRepo.findOne({ where: { id } });
    if (!file) throw new NotFoundException(`Archivo ${id} no encontrado`);
    return file;
  }

  async findOneForRequester(id: string, requester: Requester) {
    const file = await this.findOne(id);
    this.assertCanAccess(file, requester);
    return file;
  }

  // GET /files?sessionId=X: si no hay archivos para esa sesión, no hay
  // nada que proteger y se devuelve vacío sin gastar una llamada
  // síncrona; si hay, se autoriza contra lo ya resuelto en el primer
  // registro (todos comparten la misma sesión -> mismos participantes).
  async findForSession(sessionId: string, requester: Requester) {
    const files = await this.filesRepo.find({ where: { session_id: sessionId }, order: { created_at: "DESC" } });
    if (files.length === 0) return [];
    this.assertCanAccess(files[0], requester);
    return files;
  }

  async getDownloadUrl(id: string, requester: Requester) {
    const file = await this.findOneForRequester(id, requester);
    const url = await this.storageClient.getSignedUrl(file.storage_key);
    if (!url) {
      return {
        available: false,
        message: "El almacenamiento externo no está configurado en este entorno (modo simulado).",
      };
    }
    return { available: true, url, expiresInSeconds: 300 };
  }

  // Tutor dueño o admin pueden borrar (mismo criterio de ownership que el
  // resto de los servicios).
  async remove(id: string, requester: Requester) {
    const file = await this.findOne(id);
    if (requester.role !== "admin" && !(requester.role === "tutor" && requester.id === file.tutor_id)) {
      throw new ForbiddenException("Solo el tutor que subió el archivo o un admin pueden eliminarlo");
    }
    await this.storageClient.delete(file.storage_key);
    await this.filesRepo.delete({ id });
    return { deleted: true };
  }
}
