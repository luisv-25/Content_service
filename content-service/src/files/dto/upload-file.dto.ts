import { IsUUID } from "class-validator";

// El archivo en sí llega por multipart/form-data (campo "file"), no por
// JSON -- este DTO valida únicamente el campo de texto que lo acompaña.
export class UploadFileDto {
  @IsUUID()
  sessionId: string;
}
