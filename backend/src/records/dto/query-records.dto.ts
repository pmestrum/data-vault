import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryRecordsDto {
  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsIn(['and', 'or'])
  logic?: 'and' | 'or';

  // JSON array string: [{"field":"json.status","op":"eq","value":"active"}]
  @IsOptional()
  @IsString()
  filters?: string;

  // JSON array string: [{"field":"createdAt","dir":"desc"}]
  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

