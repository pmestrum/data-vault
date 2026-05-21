import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabasesService } from './databases.service';
import { DatabasesController } from './databasesController';
import { Database, DatabaseSchema } from './schemas/databaseSchema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Database.name, schema: DatabaseSchema }])],
  providers: [DatabasesService],
  controllers: [DatabasesController],
  exports: [MongooseModule, DatabasesService],
})
export class DatabasesModule {}

