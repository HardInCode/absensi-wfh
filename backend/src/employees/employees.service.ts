import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from '../common/constants/app.constants';
import { Role } from '../common/enums/role.enum';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    await this.assertUnique(dto.nik, dto.email);

    const entity = this.repo.create({
      nik: dto.nik,
      fullName: dto.fullName,
      email: dto.email,
      position: dto.position,
      role: dto.role ?? Role.EMPLOYEE,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS),
    });

    try {
      const saved = await this.repo.save(entity);
      return this.findOne(saved.id);
    } catch (error) {
      this.translateDbError(error);
    }
  }

  async findAll(query: QueryEmployeeDto): Promise<PaginatedResult<Employee>> {
    const { page, limit, search, role, is_active } = query;

    const qb = this.repo.createQueryBuilder('e');

    if (search) {
      const keyword = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('e.fullName LIKE :keyword')
            .orWhere('e.nik LIKE :keyword')
            .orWhere('e.email LIKE :keyword');
        }),
      ).setParameter('keyword', keyword);
    }
    if (role) {
      qb.andWhere('e.role = :role', { role });
    }
    if (is_active !== undefined) {
      qb.andWhere('e.isActive = :isActive', { isActive: is_active });
    }

    const [data, total] = await qb
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.fullName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Employee> {
    const employee = await this.repo.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException('Karyawan tidak ditemukan');
    }
    return employee;
  }

  /** Dipakai JwtStrategy: token milik akun nonaktif/terhapus otomatis ditolak. */
  findActiveById(id: string): Promise<Employee | null> {
    return this.repo.findOne({ where: { id, isActive: true } });
  }

  /** Dipakai login: satu-satunya tempat passwordHash ikut di-select. */
  findByEmailWithPassword(email: string): Promise<Employee | null> {
    return this.repo
      .createQueryBuilder('e')
      .addSelect('e.passwordHash')
      .where('e.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    currentUserId: string,
  ): Promise<Employee> {
    await this.findOne(id);

    if (id === currentUserId) {
      if (dto.isActive === false) {
        throw new BadRequestException('Anda tidak dapat menonaktifkan akun sendiri');
      }
      if (dto.role && dto.role !== Role.ADMIN_HRD) {
        throw new BadRequestException('Anda tidak dapat menurunkan role akun sendiri');
      }
    }

    await this.assertUnique(dto.nik, dto.email, id);

    const changes: Partial<Employee> = {};
    if (dto.nik !== undefined) changes.nik = dto.nik;
    if (dto.fullName !== undefined) changes.fullName = dto.fullName;
    if (dto.email !== undefined) changes.email = dto.email;
    if (dto.position !== undefined) changes.position = dto.position;
    if (dto.role !== undefined) changes.role = dto.role;
    if (dto.isActive !== undefined) changes.isActive = dto.isActive;
    if (dto.password) {
      changes.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    }

    if (Object.keys(changes).length > 0) {
      try {
        await this.repo.update(id, changes);
      } catch (error) {
        this.translateDbError(error);
      }
    }
    return this.findOne(id);
  }

  /** Soft delete: is_active = false. Data dan riwayat absensi tetap utuh. */
  async remove(id: string, currentUserId: string): Promise<Employee> {
    await this.findOne(id);

    if (id === currentUserId) {
      throw new BadRequestException('Anda tidak dapat menonaktifkan akun sendiri');
    }

    await this.repo.update(id, { isActive: false });
    return this.findOne(id);
  }

  private async assertUnique(
    nik?: string,
    email?: string,
    excludeId?: string,
  ): Promise<void> {
    const conditions: Array<{ nik?: string; email?: string }> = [];
    if (nik) conditions.push({ nik });
    if (email) conditions.push({ email });
    if (conditions.length === 0) return;

    const found = (
      await this.repo.find({
        where: conditions,
        select: { id: true, nik: true, email: true },
      })
    ).filter((e) => e.id !== excludeId);

    if (nik && found.some((e) => e.nik.toLowerCase() === nik.toLowerCase())) {
      throw new ConflictException('NIK sudah terdaftar');
    }
    if (email && found.some((e) => e.email.toLowerCase() === email.toLowerCase())) {
      throw new ConflictException('Email sudah terdaftar');
    }
  }

  /** Pengaman race condition: unique constraint DB tetap jadi penjaga terakhir. */
  private translateDbError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { code?: string }).code === 'ER_DUP_ENTRY'
    ) {
      throw new ConflictException('NIK atau email sudah terdaftar');
    }
    throw error;
  }
}

