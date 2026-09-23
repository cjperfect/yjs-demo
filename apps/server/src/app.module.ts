import { Module } from "@nestjs/common";
import { YjsModule } from "./yjs/yjs.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { InfoController } from "./info/info.controller.js";

@Module({
  imports: [
    YjsModule,
    DocumentsModule,
  ],
  controllers: [InfoController],
})
export class AppModule {}
