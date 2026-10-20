import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ROLES_KEY } from "./roles.decorator";

// Verifica el JWT emitido por User Service (mismo JWT_SECRET compartido
// entre los 4 microservicios) y, si el endpoint declara @Roles(...), exige
// que el rol del payload esté en esa lista. Deja `req.user = {id, role}`
// disponible para las validaciones de "dueño del recurso" en cada service
// (por ejemplo, que un tutor solo acepte/rechace sus propias reservas).
@Injectable()
export class JwtRolesGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Falta el token de autenticación");
    }
    const token = authHeader.slice("Bearer ".length);
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || "dev_secret_change_me",
      });
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException("Token inválido o expirado");
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length && !requiredRoles.includes(req.user.role)) {
      throw new ForbiddenException(`Se requiere rol: ${requiredRoles.join(" o ")}`);
    }
    return true;
  }
}
