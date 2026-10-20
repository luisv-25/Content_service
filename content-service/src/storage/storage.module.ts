import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { StorageClient } from "./storage.client";

@Module({
  imports: [HttpModule],
  providers: [StorageClient],
  exports: [StorageClient],
})
export class StorageModule {}
