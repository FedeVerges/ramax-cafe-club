import { Module } from "@nestjs/common";
import { MembersModule } from "../members/members.module";
import { PointsController } from "./points.controller";
import { PointsService } from "./points.service";

@Module({
  imports: [MembersModule],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
