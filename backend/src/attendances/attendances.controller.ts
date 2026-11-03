import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AttendancesService } from './attendances.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import {
  AttendanceResponseDto,
  PaginatedAttendanceResponseDto,
} from './dto/attendance-response.dto';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
} from './attendances.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { Employee } from '../employees/entities/employee.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('attendances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary', description: 'JPG/PNG/WEBP, maks 3 MB' },
        notes: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_SIZE_BYTES, files: 1 },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Foto harus berformat JPG, PNG, atau WEBP'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  create(
    @CurrentUser() user: Employee,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendancesService.create(user, photo, dto);
  }

  @Get('me')
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: PaginatedAttendanceResponseDto })
  findMine(
    @CurrentUser() user: Employee,
    @Query() query: PaginationQueryDto,
  ) {
    return this.attendancesService.findMine(user, query);
  }

  @Get()
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: PaginatedAttendanceResponseDto })
  findAll(@Query() query: QueryAttendanceDto) {
    return this.attendancesService.findAll(query);
  }

  @Get(':id/photo')
  @Roles(Role.EMPLOYEE, Role.ADMIN_HRD)
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary gambar bukti absen' })
  async getPhoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: Employee,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mime, size } = await this.attendancesService.getPhoto(id, user);

    res.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
    });

    return new StreamableFile(stream, { type: mime, length: size });
  }
}

