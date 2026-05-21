import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { DataRecord, RecordSchema } from './schemas/record.schema';
import { AppsModule } from '../apps/apps.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DataRecord.name, schema: RecordSchema }]),
    AppsModule, // provides App model for ApiTokenGuard
  ],
  providers: [RecordsService],
  controllers: [RecordsController],
})
export class RecordsModule {}

