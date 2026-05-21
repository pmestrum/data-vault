import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DatabasesService } from './databases.service';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';

@Controller('databases')
export class DatabasesController {
  constructor(private readonly databasesService: DatabasesService) {}

  @Post()
  create(@Body() dto: CreateDatabaseDto) {
    return this.databasesService.create(dto);
  }

  @Get()
  findAll() {
    return this.databasesService.findAll();
  }

  @Get(':id/token')
  getToken(@Param('id') id: string) {
    return this.databasesService.getToken(id);
  }

  @Post(':id/token/rotate')
  rotateToken(@Param('id') id: string) {
    return this.databasesService.rotateToken(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDatabaseDto) {
    return this.databasesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.databasesService.delete(id);
  }
}

