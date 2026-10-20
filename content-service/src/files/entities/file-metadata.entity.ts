import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Sección 5.7 del documento de arquitectura.
@Entity("files_metadata")
@Check(`"size_bytes" > 0`)
export class FileMetadata {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Referencia LÓGICA a session_db.rooms.id (sección 5.10: sin FK física
  // entre bases distintas). Es el "session_id" del documento.
  @Index()
  @Column({ type: "uuid" })
  session_id: string;

  // student_id/tutor_id: referencias LÓGICAS a user_db.users.id,
  // desnormalizadas al momento de subir el archivo (resueltas una sola vez
  // encadenando Session -> Booking -> Catalog, ver FilesService.resolveSessionParticipants).
  // Sin esto, cada GET tendría que repetir esa cadena de 3 llamadas
  // síncronas solo para decidir si el estudiante que pregunta puede ver el
  // archivo -- mismo criterio que transactions.tutor_id en payment-service.
  @Index()
  @Column({ type: "uuid", nullable: true })
  student_id: string | null;

  @Index()
  @Column({ type: "uuid" })
  tutor_id: string;

  @Column()
  file_name: string;

  @Column()
  mime_type: string;

  // Identifica el objeto en el bucket externo (sección 5.7: "la base solo
  // persiste metadatos, nunca el binario"). Ver StorageClient.
  @Column()
  storage_key: string;

  @Column({ type: "bigint" })
  size_bytes: number;

  @CreateDateColumn()
  created_at: Date;
}
