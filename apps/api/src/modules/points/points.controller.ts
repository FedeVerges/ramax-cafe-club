import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { HistoryPageDto } from "../members/dto/history-page.dto";
import {
  MemberSessionGuard,
  type MemberRequest,
} from "../members/member-session.guard";
import { PointsService } from "./points.service";

@Controller("club/points")
@UseGuards(MemberSessionGuard)
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get()
  account(@Req() request: MemberRequest, @Query() query: HistoryPageDto) {
    return this.points.account(request.ramaxMember!.id, query.page);
  }
}
