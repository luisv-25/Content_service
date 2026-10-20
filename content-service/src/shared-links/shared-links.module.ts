import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SharedLink } from "./entities/shared-link.entity";
import { SharedLinksService } from "./shared-links.service";
import { SharedLinksController } from "./shared-links.controller";
import { FilesModule } from "../files/files.module";
import { StorageModule } from "../storage/storage.module";
import { JwtConfigModule } from "../common/jwt-config.module";

@Module({
  imports: [TypeOrmModule.forFeature([SharedLink]), FilesModule, StorageModule, JwtConfigModule],
  providers: [SharedLinksService],
  controllers: [SharedLinksController],
})
export class SharedLinksModule {}
