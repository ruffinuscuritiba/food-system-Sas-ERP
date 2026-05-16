import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
} from "@nestjs/common";

import { CashService } from "./cash.service";

@Controller("cash")
export class CashController {

  constructor(
    private readonly service: CashService,
  ) {}

  @Get("current")
  current() {

    return this.service.current();
  }

  @Post("open")
  open(
    @Body()
    body: any,
  ) {

    return this.service.open(
      body.openingValue,
      body.companyId,
    );
  }

  @Post("movement")
  movement(
    @Body()
    body: any,
  ) {

    return this.service.movement(
      body.type,
      body.value,
    );
  }

  @Patch("close")
  close() {

    return this.service.close();
  }
}