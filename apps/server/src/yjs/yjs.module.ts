import { Module } from "@nestjs/common";
import { YjsService } from "./yjs.service.js";

@Module({
  providers: [YjsService],
  exports: [YjsService],
})
export class YjsModule {}
