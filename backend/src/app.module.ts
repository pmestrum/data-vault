import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DatabasesModule } from './apps/databasesModule';
import { RecordsModule } from './records/records.module';
import { CertificateModule } from './certificate/certificate.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI ?? 'mongodb://localhost:27017/datavault'),
    UsersModule,
    AuthModule,
    DatabasesModule,
    RecordsModule,
    CertificateModule,
  ],
  providers: [
    // Apply JWT guard globally; routes opt-out with @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

