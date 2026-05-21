import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRecordDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  tableId: string;

  @IsObject()
  json: Record<string, any>;

  @IsString()
  createdBy: string;
}

