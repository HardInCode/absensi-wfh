import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { EmployeesService } from './employees.service';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN_HRD)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Tambah karyawan baru (ADMIN_HRD)' })
  create(@Body() dto: CreateEmployeeDto): Promise<Employee> {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar karyawan + paginasi & pencarian (ADMIN_HRD)' })
  findAll(@Query() query: QueryEmployeeDto): Promise<PaginatedResult<Employee>> {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail karyawan (ADMIN_HRD)' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Employee> {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah data karyawan (ADMIN_HRD)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() currentUser: Employee,
  ): Promise<Employee> {
    return this.employeesService.update(id, dto, currentUser.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Nonaktifkan karyawan / soft delete (ADMIN_HRD)' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: Employee,
  ): Promise<Employee> {
    return this.employeesService.remove(id, currentUser.id);
  }
}

