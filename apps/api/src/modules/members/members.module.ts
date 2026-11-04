import { Module } from "@nestjs/common";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { MemberSessionGuard } from "./member-session.guard";

@Module({
  controllers: [MembersController],
  providers: [MembersService, MemberSessionGuard],
  exports: [MembersService, MemberSessionGuard],
})
export class MembersModule {}
