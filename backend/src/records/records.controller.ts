import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { QueryRecordsDto } from './dto/query-records.dto';
import { ApiTokenGuard } from '../auth/guards/api-token.guard';
import { Public } from '../auth/decorators/public.decorator';

// All routes in this controller use the API-token guard, not JWT.
@Public()
@UseGuards(ApiTokenGuard)
@Controller('records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateRecordDto) {
    return this.recordsService.create(req.appId, dto);
  }

  @Get()
  async query(@Request() req: any, @Query() query: QueryRecordsDto) {
    const records = await this.recordsService.query(req.appId, query);
    return records.map((record) => this.toExternalRecord(record));
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') recordId: string) {
    const record = await this.recordsService.findOne(req.appId, recordId);
    return this.toExternalRecord(record);
  }

  private toExternalRecord(record: any) {
    const plain = record?.toObject ? record.toObject() : record;
    const { _id, appId, __v, ...rest } = plain;
    return rest;
  }

  @Put(':id')
  replace(@Request() req: any, @Param('id') recordId: string, @Body() dto: UpdateRecordDto) {
    return this.recordsService.replace(req.appId, recordId, dto);
  }

  @Patch(':id')
  patch(@Request() req: any, @Param('id') recordId: string, @Body() dto: UpdateRecordDto) {
    return this.recordsService.patch(req.appId, recordId, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') recordId: string) {
    return this.recordsService.remove(req.appId, recordId);
  }
}

