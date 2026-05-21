import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { App, AppDocument } from './schemas/app.schema';
import { CreateAppDto } from './dto/create-app.dto';

@Injectable()
export class AppsService {
  constructor(@InjectModel(App.name) private appModel: Model<AppDocument>) {}

  async create(dto: CreateAppDto): Promise<AppDocument> {
    const app = new this.appModel({
      ...dto,
      apiToken: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
    });
    return app.save();
  }

  async findAll(): Promise<AppDocument[]> {
    return this.appModel.find().sort({ createdAt: -1 }).exec();
  }

  async getToken(id: string): Promise<{ apiToken: string }> {
    const app = await this.appModel.findById(id).exec();
    if (!app) throw new NotFoundException('App not found');
    return { apiToken: app.apiToken };
  }

  async delete(id: string): Promise<void> {
    const result = await this.appModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('App not found');
  }
}

