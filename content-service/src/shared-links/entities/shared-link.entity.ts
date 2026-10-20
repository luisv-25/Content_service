import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum SharedLinkAccessScope {
  PRIVATE = "private",
  SESSION_PARTICIPANTS = "session_participants",
}

// Sección 5.7 del documento de arquitectura. file_id -> files_metadata.id
// es FK real (misma base content_db), a diferencia de las referencias
// lógicas de files_metadata hacia otras bases.
@Entity("shared_links")
@Check(`"access_scope" IN ('private','session_participants')`)
export class SharedLink {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "uuid" })
  file_id: string;

  // Token opaco que va en la URL pública (/shared-links/:token). No es el
  // id del registro a propósito: así un id de shared_link filtrado por
  // error (p. ej. en un log) no sirve por sí solo para abrir el archivo.
  @Column({ unique: true })
  token: string;

  @Column({ type: "enum", enum: SharedLinkAccessScope, default: SharedLinkAccessScope.SESSION_PARTICIPANTS })
  access_scope: SharedLinkAccessScope;

  // Índice para la purga de enlaces vencidos (sección 5.7, "Índices").
  @Index()
  @Column({ type: "timestamptz" })
  expires_at: Date;

  // Referencia LÓGICA a user_db.users.id: quién generó el enlace.
  @Column({ type: "uuid" })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;
}
