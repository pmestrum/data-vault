import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Database, DatabaseDocument } from './schemas/databaseSchema';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';

@Injectable()
export class DatabasesService {
  constructor(@InjectModel(Database.name) private appModel: Model<DatabaseDocument>) {}

  async create(dto: CreateDatabaseDto): Promise<DatabaseDocument> {
    const app = new this.appModel({
      ...dto,
      apiTokenCurrent: this.generateApiToken(),
      apiTokenPrevious: null,
      tokenRotatedAt: null,
    });
    const saved = await app.save();
    return this.findPublicById(saved._id.toString());
  }

  async findAll(): Promise<DatabaseDocument[]> {
    return this.appModel
      .find({}, { apiTokenCurrent: 0, apiTokenPrevious: 0, apiToken: 0, tokenRotatedAt: 0 })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(id: string, dto: UpdateDatabaseDto): Promise<DatabaseDocument> {
    const app = await this.appModel
      .findByIdAndUpdate(id, { $set: dto }, { runValidators: true })
      .exec();
    if (!app) throw new NotFoundException('Database not found');
    return this.findPublicById(id);
  }

  async getToken(id: string): Promise<{ apiToken: string; previousTokenPreview?: string }> {
    const app = await this.findByIdWithTokens(id);
    const response: { apiToken: string; previousTokenPreview?: string } = {
      apiToken: this.resolveCurrentToken(app),
    };
    if (app.apiTokenPrevious) {
      response.previousTokenPreview = this.getTokenPreview(app.apiTokenPrevious);
    }
    return response;
  }

  async rotateToken(id: string): Promise<{ apiToken: string; previousTokenPreview?: string }> {
    const app = await this.findByIdWithTokens(id);
    const nextToken = this.generateApiToken();
    const currentToken = this.resolveCurrentToken(app);

    app.apiTokenPrevious = currentToken;
    app.apiTokenCurrent = nextToken;
    app.tokenRotatedAt = new Date();
    app.apiToken = undefined;

    await app.save();
    const response: { apiToken: string; previousTokenPreview?: string } = { apiToken: nextToken };
    response.previousTokenPreview = this.getTokenPreview(currentToken);
    return response;
  }

  async findByIdWithTokens(id: string): Promise<DatabaseDocument> {
    const app = await this.appModel
      .findById(id)
      .select('+apiTokenCurrent +apiTokenPrevious +apiToken +tokenRotatedAt')
      .exec();
    if (!app) throw new NotFoundException('Database not found');
    return app;
  }

  resolveCurrentToken(app: DatabaseDocument): string {
    return app.apiTokenCurrent || app.apiToken || '';
  }

  resolveValidTokens(app: DatabaseDocument): string[] {
    return [app.apiTokenCurrent, app.apiTokenPrevious, app.apiToken]
      .filter((token): token is string => !!token);
  }

  async delete(id: string): Promise<void> {
    const result = await this.appModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Database not found');
  }

  private generateApiToken(): string {
    return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  }

  private getTokenPreview(token: string): string {
    if (token.length <= 16) return token;
    const start = token.substring(0, 8);
    const end = token.substring(token.length - 8);
    const middleLength = token.length - 16;
    return `${start}${'•'.repeat(Math.min(middleLength, 8))}${end}`;
  }

  private async findPublicById(id: string): Promise<DatabaseDocument> {
    const app = await this.appModel
      .findById(id, { apiTokenCurrent: 0, apiTokenPrevious: 0, apiToken: 0, tokenRotatedAt: 0 })
      .exec();
    if (!app) throw new NotFoundException('Database not found');
    return app;
  }
}
