import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AppsService } from './apps.service';
import { CreateAppDto } from './dto/create-app.dto';

@Controller('apps')
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Post()
  create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto);
  }

  @Get()
  findAll() {
    return this.appsService.findAll();
  }

  @Get(':id/token')
  getToken(@Param('id') id: string) {
    return this.appsService.getToken(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.appsService.delete(id);
  }
}

