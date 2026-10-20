import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { SharedLinksService } from "./shared-links.service";
import { CreateSharedLinkDto } from "./dto/create-shared-link.dto";
import { JwtRolesGuard } from "../common/jwt-roles.guard";
import { Roles } from "../common/roles.decorator";

@Controller()
export class SharedLinksController {
  constructor(
    private readonly sharedLinksService: SharedLinksService,
    private readonly jwtService: JwtService,
  ) {}

  @Post("files/:fileId/shared-links")
  @UseGuards(JwtRolesGuard)
  @Roles("tutor", "admin")
  create(@Param("fileId") fileId: string, @Body() dto: CreateSharedLinkDto, @Req() req: any) {
    return this.sharedLinksService.create(fileId, req.user, dto);
  }

  @Get("files/:fileId/shared-links")
  @UseGuards(JwtRolesGuard)
  @Roles("tutor", "admin")
  listForFile(@Param("fileId") fileId: string) {
    return this.sharedLinksService.listForFile(fileId);
  }

  // Endpoint PÚBLICO a propósito (sección 5.7: un shared_link existe
  // justamente para abrirse sin pasar por el flujo normal autenticado
  // cuando access_scope = private). El JWT es OPCIONAL aquí -- si viene,
  // se decodifica para el caso access_scope = session_participants; si no
  // viene o no es válido, se trata como anónimo (nunca lanza 401, deja
  // que SharedLinksService decida según el access_scope del enlace).
  @Get("shared-links/:token")
  async resolve(@Param("token") token: string, @Req() req: any) {
    const authHeader: string | undefined = req.headers["authorization"];
    let requester: { id: string; role: string } | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = this.jwtService.verify(authHeader.slice("Bearer ".length), {
          secret: process.env.JWT_SECRET || "dev_secret_change_me",
        });
        requester = { id: payload.sub, role: payload.role };
      } catch {
        // Token inválido/vencido en un endpoint público: se ignora, no se
        // rechaza la petición -- equivale a no haber mandado token.
      }
    }
    return this.sharedLinksService.resolve(token, requester);
  }

  @Delete("shared-links/expired")
  @UseGuards(JwtRolesGuard)
  @Roles("admin")
  purgeExpired(@Req() req: any) {
    return this.sharedLinksService.purgeExpired(req.user);
  }
}
