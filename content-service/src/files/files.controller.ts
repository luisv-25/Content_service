import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { FilesService } from "./files.service";
import { UploadFileDto } from "./dto/upload-file.dto";
import { JwtRolesGuard } from "../common/jwt-roles.guard";
import { Roles } from "../common/roles.decorator";

@Controller("files")
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseGuards(JwtRolesGuard)
  @Roles("tutor", "admin")
  // Límite a nivel de multer (defensa en profundidad); FilesService valida
  // el mismo máximo de nuevo contra file.size por si el cliente miente en
  // el header. Sin "storage"/"dest" explícitos, multer guarda en memoria
  // (file.buffer), que es justo lo que StorageClient.upload espera.
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadFileDto, @Req() req: any) {
    if (!file) throw new BadRequestException("Falta el archivo (campo 'file')");
    return this.filesService.upload(req.user, dto.sessionId, file);
  }

  @Get()
  @UseGuards(JwtRolesGuard)
  findForSession(@Query("sessionId") sessionId: string, @Req() req: any) {
    if (!sessionId) throw new BadRequestException("Falta el parámetro sessionId");
    return this.filesService.findForSession(sessionId, req.user);
  }

  @Get(":id")
  @UseGuards(JwtRolesGuard)
  findOne(@Param("id") id: string, @Req() req: any) {
    return this.filesService.findOneForRequester(id, req.user);
  }

  @Get(":id/download")
  @UseGuards(JwtRolesGuard)
  download(@Param("id") id: string, @Req() req: any) {
    return this.filesService.getDownloadUrl(id, req.user);
  }

  @Delete(":id")
  @UseGuards(JwtRolesGuard)
  @Roles("tutor", "admin")
  remove(@Param("id") id: string, @Req() req: any) {
    return this.filesService.remove(id, req.user);
  }
}
