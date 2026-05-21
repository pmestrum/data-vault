import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDatabaseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

