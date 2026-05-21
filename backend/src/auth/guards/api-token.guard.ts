import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { App, AppDocument } from '../../apps/schemas/app.schema';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(@InjectModel(App.name) private appModel: Model<AppDocument>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-api-token'];
    const appId = request.headers['x-app-id'];

    if (!token || !appId) {
      throw new UnauthorizedException('x-api-token and x-app-id headers are required');
    }

    const app = await this.appModel.findById(appId).exec();
    if (!app || app.apiToken !== token) {
      throw new UnauthorizedException('Invalid API token or app ID');
    }

    request.appId = appId;
    return true;
  }
}

