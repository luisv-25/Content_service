import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
// Marca un endpoint como restringido a uno o más roles (student/tutor/admin).
// Si no se usa este decorador, JwtRolesGuard solo exige un token válido,
// sin importar el rol (ver sección 11.3 del documento: RBAC vía payload del JWT).
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
