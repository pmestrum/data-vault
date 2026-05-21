import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabasesService } from '../../apps/databases.service';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly databasesService: DatabasesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tokenHeader = request.headers['x-api-token'];
    const databaseIdHeader = request.headers['x-database-id'];

    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    const databaseId = Array.isArray(databaseIdHeader) ? databaseIdHeader[0] : databaseIdHeader;

    if (!token || !databaseId) {
      throw new UnauthorizedException('x-api-token and x-database-id headers are required');
    }

    try {
      const database = await this.databasesService.findByIdWithTokens(databaseId);
      const validTokens = this.databasesService.resolveValidTokens(database);
      if (!validTokens.includes(token)) {
        throw new UnauthorizedException('Invalid API token or database ID');
      }
    } catch {
      throw new UnauthorizedException('Invalid API token or database ID');
    }

    request.databaseId = databaseId;
    return true;
  }
}

