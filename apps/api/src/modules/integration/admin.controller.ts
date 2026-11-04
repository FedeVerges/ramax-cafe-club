import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CloudAdminService } from "./admin.service";
import { AdjustPointsDto, ChangeMemberStatusDto, SetPointRuleDto } from "./dto/admin.dto";
import { ServiceTokenGuard } from "./service-token.guard";

@Controller("integration/admin")
@UseGuards(ServiceTokenGuard)
export class CloudAdminController {
  constructor(private readonly admin: CloudAdminService) {}

  @Get("members")
  members() {
    return this.admin.listMembers();
  }

  @Get("members/:id")
  member(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.memberAccount(id);
  }

  @Post("members/:id/status")
  status(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: ChangeMemberStatusDto,
  ) {
    return this.admin.changeStatus(id, key, body);
  }

  @Post("members/:id/points")
  adjust(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: AdjustPointsDto,
  ) {
    return this.admin.adjustPoints(id, key, body);
  }

  @Post("point-rule")
  rule(
    @Headers("idempotency-key") key: string,
    @Body() body: SetPointRuleDto,
  ) {
    return this.admin.setRule(key, body);
  }
}
