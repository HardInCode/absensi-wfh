import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../app.module';
import {
  APP_TIMEZONE,
  BCRYPT_SALT_ROUNDS,
} from '../../common/constants/app.constants';
import { Role } from '../../common/enums/role.enum';
import { Employee } from '../../employees/entities/employee.entity';

const DEMO_ACCOUNTS = [
  {
    nik: '1000000001',
    fullName: 'Admin HRD',
    email: 'admin@company.test',
    password: 'Admin123!',
    position: 'HRD Manager',
    role: Role.ADMIN_HRD,
  },
  {
    nik: '2000000001',
    fullName: 'Hirdan',
    email: 'hirdan@company.test',
    password: 'Karyawan123!',
    position: 'Software Developer',
    role: Role.EMPLOYEE,
  },
];

async function seed() {
  process.env.TZ = APP_TIMEZONE;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const repo = app.get<Repository<Employee>>(getRepositoryToken(Employee));

    for (const account of DEMO_ACCOUNTS) {
      const exists = await repo.findOne({ where: { email: account.email } });
      if (exists) {
        console.log(`[seed] Lewati (sudah ada): ${account.email}`);
        continue;
      }

      await repo.save(
        repo.create({
          nik: account.nik,
          fullName: account.fullName,
          email: account.email,
          position: account.position,
          role: account.role,
          isActive: true,
          passwordHash: await bcrypt.hash(account.password, BCRYPT_SALT_ROUNDS),
        }),
      );
      console.log(`[seed] Dibuat: ${account.email} (${account.role})`);
    }
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error('[seed] Gagal:', error);
  process.exit(1);
});

