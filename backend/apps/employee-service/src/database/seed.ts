import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '@app/common';
import { EmployeeServiceModule } from '../employee-service.module';
import { Employee } from '../employees/entities/employee.entity';

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
    fullName: 'Budi Santoso',
    email: 'budi@company.test',
    password: 'Karyawan123!',
    position: 'Software Engineer',
    role: Role.EMPLOYEE,
  },
];

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(EmployeeServiceModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const repo = app.get<Repository<Employee>>(getRepositoryToken(Employee));
    const rounds = app.get(ConfigService).getOrThrow<number>('BCRYPT_ROUNDS');

    for (const acc of DEMO_ACCOUNTS) {
      const exists = await repo.findOne({
        where: { email: acc.email },
        select: { id: true, email: true, passwordHash: true },
      });
      if (exists) {
        if (!exists.passwordHash || exists.passwordHash.length < 20) {
          exists.passwordHash = await bcrypt.hash(acc.password, rounds);
          await repo.save(exists);
          logger.log(`Password demo diperbarui: ${acc.email}`);
        } else {
          logger.log(`Lewati (sudah ada): ${acc.email}`);
        }
        continue;
      }
      await repo.save(
        repo.create({
          nik: acc.nik,
          fullName: acc.fullName,
          email: acc.email,
          passwordHash: await bcrypt.hash(acc.password, rounds),
          position: acc.position,
          role: acc.role,
          isActive: true,
        }),
      );
      logger.log(`Dibuat: ${acc.email} (${acc.role})`);
    }
  } finally {
    await app.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

