import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { SyncEventDto } from "./dto/sync-event.dto";
import { IntegrationService } from "./integration.service";
import { ServiceTokenGuard } from "./service-token.guard";

@Controller("integration")
@UseGuards(ServiceTokenGuard)
export class IntegrationController {
  constructor(private readonly integration: IntegrationService) {}

  @Get("members/:number")
  member(@Param("number") number: string) {
    return this.integration.lookup(number);
  }

  @Get("point-rule")
  rule() {
    return this.integration.currentRule();
  }

  @Post("events")
  receive(@Body() body: SyncEventDto) {
    return this.integration.receive(body);
  }
}
