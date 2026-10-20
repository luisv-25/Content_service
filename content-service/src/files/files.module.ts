import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { FileMetadata } from "./entities/file-metadata.entity";
import { FilesService } from "./files.service";
import { FilesController } from "./files.controller";
import { SessionServiceClient } from "./session-service.client";
import { BookingServiceClient } from "./booking-service.client";
import { CatalogServiceClient } from "./catalog-service.client";
import { StorageModule } from "../storage/storage.module";
import { JwtConfigModule } from "../common/jwt-config.module";

@Module({
  imports: [TypeOrmModule.forFeature([FileMetadata]), HttpModule, StorageModule, JwtConfigModule],
  providers: [FilesService, SessionServiceClient, BookingServiceClient, CatalogServiceClient],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
