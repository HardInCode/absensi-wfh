import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmOptions(
  config: ConfigService,
  entities: NonNullable<TypeOrmModuleOptions['entities']>,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_NAME'),
    entities,
    synchronize: config.getOrThrow<boolean>('DB_SYNCHRONIZE'),
    timezone: '+07:00',
    charset: 'utf8mb4',
  };
}

