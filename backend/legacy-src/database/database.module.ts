import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_UTC_OFFSET } from '../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const synchronize =
          config.get<string>('DB_SYNCHRONIZE') === 'true' && !isProduction;

        return {
          type: 'mysql' as const,
          host: config.getOrThrow<string>('DB_HOST'),
          port: Number(config.get('DB_PORT') ?? 3306),
          username: config.getOrThrow<string>('DB_USERNAME'),
          password: config.getOrThrow<string>('DB_PASSWORD'),
          database: config.getOrThrow<string>('DB_DATABASE'),
          charset: 'utf8mb4',
          // Zona waktu koneksi: konversi Date <-> DATETIME memakai WIB.
          timezone: APP_UTC_OFFSET,
          autoLoadEntities: true,
          synchronize,
          logging: isProduction ? ['error' as const] : ['error' as const, 'warn' as const],
        };
      },
    }),
  ],
})
export class DatabaseModule {}

