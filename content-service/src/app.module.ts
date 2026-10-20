import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FilesModule } from "./files/files.module";
import { SharedLinksModule } from "./shared-links/shared-links.module";
import { FileMetadata } from "./files/entities/file-metadata.entity";
import { SharedLink } from "./shared-links/entities/shared-link.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5439, // 5438 ya lo usa feedback-service en local
      username: process.env.DB_USER || "content_svc",
      password: process.env.DB_PASSWORD || "content_svc_pw",
      database: process.env.DB_NAME || "content_db",
      // Mismo apagador que el resto de los servicios para el despliegue en
      // Neon: se corre el DDL a mano y se despliega con
      // DB_SYNCHRONIZE=false; sobre una base nueva y vacía, true no tiene
      // riesgo para el primer deploy.
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      entities: [FileMetadata, SharedLink],
      synchronize: process.env.DB_SYNCHRONIZE !== "false",
    }),
    FilesModule,
    SharedLinksModule,
  ],
})
export class AppModule {}
