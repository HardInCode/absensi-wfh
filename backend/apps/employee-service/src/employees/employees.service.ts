import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Brackets, FindOptionsWhere, In, QueryFailedError, Repository } from 'typeorm';
import {
  CreateEmployeeDto,
  EmployeeBrief,
  EmployeeView,
  PaginatedResult,
  QueryEmployeesDto,
  Role,
  UpdateEmployeeDto,
} from '@app/common';
import { toEmployeeView } from './employee.mapper';
import { Employee } from './entities/employee.entity';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private readonly repo: Repository<Employee>,
    private readonly config: ConfigService,
  ) {}

  private get rounds(): number {
    return this.config.getOrThrow<number>('BCRYPT_ROUNDS');
  }

  async create(dto: CreateEmployeeDto): Promise<EmployeeView> {
    const nik = dto.nik.trim();
    const email = dto.email.trim().toLowerCase();
    await this.assertUnique({ nik, email });

    const passwordHash = await bcrypt.hash(dto.password, this.rounds);
    try {
      const saved = await this.repo.save(
        this.repo.create({
          nik,
          fullName: dto.fullName,
          email,
          passwordHash,
          position: dto.position,
          role: dto.role,
          isActive: dto.isActive ?? true,
        }),
      );
      return toEmployeeView(saved);
    } catch (e) {
      throw this.translateDbError(e);
    }
  }

  async findAll(query: QueryEmployeesDto): Promise<PaginatedResult<EmployeeView>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const qb = this.repo.createQueryBuilder('e');
    if (query.search) {
      const like = `%${escapeLike(query.search)}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('e.fullName LIKE :like', { like })
            .orWhere('e.nik LIKE :like')
            .orWhere('e.email LIKE :like')
            .orWhere('e.position LIKE :like');
        }),
      );
    }
    if (query.position) {
      const posLike = `%${escapeLike(query.position)}%`;
      qb.andWhere('e.position LIKE :posLike', { posLike });
    }
    if (query.role) qb.andWhere('e.role = :role', { role: query.role });
    if (query.isActive !== undefined) {
      qb.andWhere('e.isActive = :isActive', { isActive: query.isActive });
    }

    const [rows, total] = await qb
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows.map(toEmployeeView),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<EmployeeView> {
    return toEmployeeView(await this.getEntity(id));
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeView> {
    const employee = await this.getEntity(id);

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== employee.email) {
        await this.assertUnique({ email }, id);
        employee.email = email;
      }
    }
    if (dto.fullName !== undefined) employee.fullName = dto.fullName;
    if (dto.position !== undefined) employee.position = dto.position;
    if (dto.role !== undefined) employee.role = dto.role;
    if (dto.isActive !== undefined) employee.isActive = dto.isActive;
    if (dto.password !== undefined) {
      employee.passwordHash = await bcrypt.hash(dto.password, this.rounds);
    }

    try {
      return toEmployeeView(await this.repo.save(employee));
    } catch (e) {
      throw this.translateDbError(e);
    }
  }

  /** Soft delete: isActive = false. */
  async remove(id: string): Promise<EmployeeView> {
    const employee = await this.getEntity(id);
    employee.isActive = false;
    return toEmployeeView(await this.repo.save(employee));
  }

  // ---- dipakai AuthService (bukan endpoint RPC) ----

  findByEmailWithPassword(email: string): Promise<Employee | null> {
    return this.repo
      .createQueryBuilder('e')
      .addSelect('e.passwordHash')
      .where('e.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  findEntityOrNull(id: string): Promise<Employee | null> {
    return this.repo.findOneBy({ id });
  }

  // ---- dipakai attendance lewat gateway (Fase 5B) ----

  /** ID karyawan (aktif maupun nonaktif) yang nama, NIK, atau jabatannya cocok. */
  async searchIds(search: string, limit: number): Promise<string[]> {
    const like = `%${escapeLike(search.trim())}%`;
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.id', 'id')
      .where('e.fullName LIKE :like', { like })
      .orWhere('e.nik LIKE :like')
      .orWhere('e.position LIKE :like')
      .orderBy('e.id', 'ASC')
      .limit(limit)
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  /** Batch lookup satu query (bukan N+1). Tanpa filter isActive. */
  async findBriefsByIds(ids: string[]): Promise<EmployeeBrief[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({
      where: { id: In(ids) },
      select: { id: true, nik: true, fullName: true },
    });
    return rows.map((r) => ({ id: r.id, nik: r.nik, fullName: r.fullName }));
  }

  // ---- dipakai summary harian lewat gateway (Fase 5.5) ----

  /**
   * Populasi yang wajib absen: aktif DAN role EMPLOYEE (ADMIN_HRD tidak dihitung).
   * Satu query, terurut menurut nama.
   */
  async findActiveStaff(): Promise<EmployeeBrief[]> {
    const rows = await this.repo.find({
      where: { isActive: true, role: Role.EMPLOYEE },
      select: { id: true, nik: true, fullName: true },
      order: { fullName: 'ASC', id: 'ASC' },
    });
    return rows.map((r) => ({ id: r.id, nik: r.nik, fullName: r.fullName }));
  }

  // ---- private ----

  private async getEntity(id: string): Promise<Employee> {
    const employee = await this.repo.findOneBy({ id });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async assertUnique(
    fields: { nik?: string; email?: string },
    excludeId?: string,
  ): Promise<void> {
    const where: FindOptionsWhere<Employee>[] = [];
    if (fields.nik) where.push({ nik: fields.nik });
    if (fields.email) where.push({ email: fields.email });
    if (where.length === 0) return;

    const found = await this.repo.find({
      where,
      select: { id: true, nik: true, email: true },
    });
    for (const f of found) {
      if (f.id === excludeId) continue;
      if (fields.nik && f.nik.toLowerCase() === fields.nik.toLowerCase()) {
        throw new ConflictException('NIK already registered');
      }
      if (fields.email && f.email.toLowerCase() === fields.email.toLowerCase()) {
        throw new ConflictException('Email already registered');
      }
    }
  }

  private translateDbError(e: unknown): unknown {
    if (
      e instanceof QueryFailedError &&
      (e.driverError as { code?: string } | undefined)?.code === 'ER_DUP_ENTRY'
    ) {
      return new ConflictException('NIK or email already registered');
    }
    return e;
  }
}
