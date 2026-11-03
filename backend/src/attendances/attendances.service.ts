import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { createReadStream, ReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { Attendance } from './entities/attendance.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Role } from '../common/enums/role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { UPLOAD_DIR } from './attendances.constants';
import { toJakartaDateString } from './utils/date.util';
import {
  detectImageType,
  ImageExt,
  MIME_BY_EXT,
} from './utils/image-type.util';

export interface AttendanceView {
  id: string;
  employeeId: string;
  checkInAt: Date;
  attendanceDate: string;
  notes: string | null;
  createdAt: Date;
  photoUrl: string;
  employee?: Employee;
}

export interface PhotoStream {
  stream: ReadStream;
  mime: string;
  size: number;
}

const ALREADY_CHECKED_IN_MESSAGE = 'Anda sudah melakukan absen hari ini';

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
  ) {}

  async create(
    employee: Employee,
    file: Express.Multer.File | undefined,
    dto: CreateAttendanceDto,
  ): Promise<AttendanceView> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Foto bukti wajib diunggah (field: photo)');
    }

    // Validasi isi file (magic bytes), bukan hanya mimetype dari client.
    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        'File harus berupa gambar JPG, PNG, atau WEBP yang valid',
      );
    }

    // Waktu SELALU dari server. Milidetik dibuang agar konsisten dengan DATETIME MySQL
    // (menghindari pembulatan yang bisa menggeser tanggal di tengah malam).
    const checkInAt = new Date();
    checkInAt.setMilliseconds(0);
    const attendanceDate = toJakartaDateString(checkInAt);

    const alreadyCheckedIn = await this.attendanceRepo.count({
      where: { employeeId: employee.id, attendanceDate },
    });
    if (alreadyCheckedIn > 0) {
      throw new ConflictException(ALREADY_CHECKED_IN_MESSAGE);
    }

    // Nama file dibuat ulang (UUID); nama asli dari client diabaikan.
    const filename = `${randomUUID()}.${detected.ext}`;
    const fullPath = join(UPLOAD_DIR, filename);

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(fullPath, file.buffer, { flag: 'wx' });

    try {
      const entity = this.attendanceRepo.create({
        employeeId: employee.id,
        checkInAt,
        attendanceDate,
        photoPath: filename,
        notes: dto.notes ? dto.notes : null,
      });
      const saved = await this.attendanceRepo.save(entity);
      return this.toView(saved);
    } catch (error) {
      // Rollback file agar tidak ada file yatim.
      await unlink(fullPath).catch(() => undefined);

      // Race condition: dua request bersamaan lolos pengecekan, dicegah oleh UNIQUE constraint.
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(ALREADY_CHECKED_IN_MESSAGE);
      }
      throw error;
    }
  }

  async findMine(
    employee: Employee,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<AttendanceView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [rows, total] = await this.attendanceRepo.findAndCount({
      where: { employeeId: employee.id },
      order: { checkInAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((row) => this.toView(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(
    query: QueryAttendanceDto,
  ): Promise<PaginatedResult<AttendanceView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    if (query.date_from && query.date_to && query.date_from > query.date_to) {
      throw new BadRequestException(
        'date_from tidak boleh lebih besar dari date_to',
      );
    }

    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoin('a.employee', 'e')
      .addSelect(['e.id', 'e.nik', 'e.fullName', 'e.email', 'e.position']);

    if (query.date_from) {
      qb.andWhere('a.attendanceDate >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      qb.andWhere('a.attendanceDate <= :dateTo', { dateTo: query.date_to });
    }
    if (query.employee_name) {
      const escaped = query.employee_name.replace(/[\\%_]/g, '\\$&');
      qb.andWhere('e.fullName LIKE :name', { name: `%${escaped}%` });
    }

    qb.orderBy('a.checkInAt', 'DESC')
      .addOrderBy('a.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((row) => this.toView(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPhoto(id: string, user: Employee): Promise<PhotoStream> {
    const attendance = await this.attendanceRepo.findOne({ where: { id } });
    if (!attendance) {
      throw new NotFoundException('Data absensi tidak ditemukan');
    }

    const isOwner = attendance.employeeId === user.id;
    const isAdmin = user.role === Role.ADMIN_HRD;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Anda tidak berhak mengakses foto ini');
    }

    // basename() mencegah path traversal seandainya photo_path pernah termanipulasi.
    const filename = basename(attendance.photoPath);
    const fullPath = join(UPLOAD_DIR, filename);

    let size: number;
    try {
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) throw new Error('not a file');
      size = fileStat.size;
    } catch {
      throw new NotFoundException('File foto tidak ditemukan di server');
    }

    const ext = extname(filename).slice(1).toLowerCase() as ImageExt;
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';

    return { stream: createReadStream(fullPath), mime, size };
  }

  private toView(attendance: Attendance): AttendanceView {
    return {
      id: attendance.id,
      employeeId: attendance.employeeId,
      checkInAt: attendance.checkInAt,
      attendanceDate: attendance.attendanceDate,
      notes: attendance.notes,
      createdAt: attendance.createdAt,
      photoUrl: `/api/attendances/${attendance.id}/photo`,
      ...(attendance.employee ? { employee: attendance.employee } : {}),
    };
  }
}

