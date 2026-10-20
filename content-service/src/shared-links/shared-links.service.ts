import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { randomBytes } from "crypto";
import { SharedLink, SharedLinkAccessScope } from "./entities/shared-link.entity";
import { CreateSharedLinkDto } from "./dto/create-shared-link.dto";
import { FilesService } from "../files/files.service";
import { StorageClient } from "../storage/storage.client";

interface Requester {
  id: string;
  role: string;
}

const DEFAULT_EXPIRES_IN_MINUTES = 60 * 24 * 7; // 7 días

@Injectable()
export class SharedLinksService {
  constructor(
    @InjectRepository(SharedLink) private readonly linksRepo: Repository<SharedLink>,
    private readonly filesService: FilesService,
    private readonly storageClient: StorageClient,
  ) {}

  // Solo el tutor dueño del archivo (o admin) puede generar un enlace para
  // compartirlo (sección 5.7 del doc).
  async create(fileId: string, requester: Requester, dto: CreateSharedLinkDto) {
    const file = await this.filesService.findOne(fileId);
    if (requester.role !== "admin" && !(requester.role === "tutor" && requester.id === file.tutor_id)) {
      throw new ForbiddenException("Solo el tutor que subió el archivo o un admin pueden compartirlo");
    }

    const expiresAt = new Date(Date.now() + (dto.expiresInMinutes ?? DEFAULT_EXPIRES_IN_MINUTES) * 60_000);
    return this.linksRepo.save(
      this.linksRepo.create({
        file_id: fileId,
        token: randomBytes(24).toString("base64url"),
        access_scope: dto.accessScope ?? SharedLinkAccessScope.SESSION_PARTICIPANTS,
        expires_at: expiresAt,
        created_by: requester.id,
      }),
    );
  }

  listForFile(fileId: string) {
    return this.linksRepo.find({ where: { file_id: fileId }, order: { created_at: "DESC" } });
  }

  // Resuelve un token público (sección 5.7: "shared_links... access_scope").
  // - access_scope = private: el token por sí solo autoriza, sin login
  //   (enlace "secreto", clásico de los sistemas de compartir archivos).
  // - access_scope = session_participants: además del token válido y no
  //   vencido, quien lo abre debe estar autenticado Y ser el mismo
  //   estudiante/tutor de la sesión -- el enlace es un atajo, no una forma
  //   de saltarse el control de acceso normal.
  async resolve(token: string, requester: Requester | null) {
    const link = await this.linksRepo.findOne({ where: { token } });
    if (!link || link.expires_at.getTime() < Date.now()) {
      throw new NotFoundException("Enlace no encontrado o vencido");
    }

    const file = await this.filesService.findOne(link.file_id);

    if (link.access_scope === SharedLinkAccessScope.SESSION_PARTICIPANTS) {
      if (!requester) {
        throw new ForbiddenException("Este enlace requiere iniciar sesión");
      }
      const isParticipant =
        requester.role === "admin" ||
        (requester.role === "tutor" && requester.id === file.tutor_id) ||
        (requester.role === "student" && requester.id === file.student_id);
      if (!isParticipant) {
        throw new ForbiddenException("Este enlace es solo para los participantes de la sesión");
      }
    }

    const url = await this.storageClient.getSignedUrl(file.storage_key);
    return {
      file: { id: file.id, fileName: file.file_name, mimeType: file.mime_type, sizeBytes: file.size_bytes },
      available: Boolean(url),
      url,
      message: url ? undefined : "El almacenamiento externo no está configurado en este entorno (modo simulado).",
    };
  }

  // Purga de enlaces vencidos (sección 5.7: "índice sobre
  // shared_links.expires_at para la purga de enlaces vencidos"). No hay
  // infraestructura de jobs programados en este proyecto (ningún otro
  // microservicio la tiene), así que queda como una acción manual de
  // admin en vez de un cron; el índice ya está creado en el entity.
  async purgeExpired(requester: Requester) {
    if (requester.role !== "admin") {
      throw new ForbiddenException("Solo un administrador puede purgar enlaces vencidos");
    }
    const result = await this.linksRepo.delete({ expires_at: LessThan(new Date()) });
    return { purged: result.affected ?? 0 };
  }
}
