import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class BaseEnv {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';
}

class DbEnv extends BaseEnv {
  @IsString() @IsNotEmpty() DB_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) DB_PORT: number = 3306;
  @IsString() @IsNotEmpty() DB_NAME: string;
  @IsString() @IsNotEmpty() DB_USER: string;
  @IsString() @IsNotEmpty() DB_PASSWORD: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE: boolean = false;
}

export class GatewayEnv extends BaseEnv {
  @IsString() @MinLength(32) JWT_SECRET: string;

  @IsString() @IsNotEmpty() EMPLOYEE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) EMPLOYEE_SERVICE_PORT: number = 3001;
  @IsString() @IsNotEmpty() ATTENDANCE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) ATTENDANCE_SERVICE_PORT: number = 3002;

  @IsInt() @Min(1) @Max(65535) GATEWAY_PORT: number = 3000;
  @IsString() @IsNotEmpty() FRONTEND_URL: string = 'http://localhost:5173';
  @IsInt() @Min(100) RPC_TIMEOUT_MS: number = 5000;
  @IsString() @IsNotEmpty() UPLOAD_DIR: string = './uploads';
}

export class EmployeeServiceEnv extends DbEnv {
  @IsString() @MinLength(32) JWT_SECRET: string;
  @IsString() @IsNotEmpty() EMPLOYEE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) EMPLOYEE_SERVICE_PORT: number = 3001;
  @IsInt() @Min(60) JWT_EXPIRES_IN_SECONDS: number = 28800;
  @IsInt() @Min(4) @Max(15) BCRYPT_ROUNDS: number = 10;
}

export class AttendanceServiceEnv extends DbEnv {
  @IsString() @IsNotEmpty() ATTENDANCE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) ATTENDANCE_SERVICE_PORT: number = 3002;
}

function createEnvValidator<T extends object>(cls: new () => T) {
  return (config: Record<string, unknown>): T => {
    const validated = plainToInstance(cls, config, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });
    const errors = validateSync(validated);
    if (errors.length > 0) {
      const detail = errors
        .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n');
      throw new Error(`Konfigurasi environment tidak valid:\n${detail}`);
    }
    return validated;
  };
}

export const validateGatewayEnv = createEnvValidator(GatewayEnv);
export const validateEmployeeServiceEnv = createEnvValidator(EmployeeServiceEnv);
export const validateAttendanceServiceEnv = createEnvValidator(AttendanceServiceEnv);
