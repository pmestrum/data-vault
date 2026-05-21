import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppsService } from './apps.service';
import { AppsController } from './apps.controller';
import { App, AppSchema } from './schemas/app.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: App.name, schema: AppSchema }])],
  providers: [AppsService],
  controllers: [AppsController],
  exports: [MongooseModule],
})
export class AppsModule {}

