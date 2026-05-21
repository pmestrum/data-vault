import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateRecordDto {
  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsObject()
  json?: Record<string, any>;
}

