import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { SharedLinkAccessScope } from "../entities/shared-link.entity";

export class CreateSharedLinkDto {
  @IsOptional()
  @IsEnum(SharedLinkAccessScope)
  accessScope?: SharedLinkAccessScope; // default: session_participants (el entity ya lo pone)

  // Minutos hasta que el enlace expira. Default razonable: 7 días.
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60 * 24 * 30) // máx. 30 días
  expiresInMinutes?: number;
}
