import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { DataRecord, RecordSchema } from './schemas/record.schema';
import { DatabasesModule } from '../apps/databasesModule';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DataRecord.name, schema: RecordSchema }]),
    DatabasesModule, // provides Database model for ApiTokenGuard
  ],
  providers: [RecordsService],
  controllers: [RecordsController],
})
export class RecordsModule {}

