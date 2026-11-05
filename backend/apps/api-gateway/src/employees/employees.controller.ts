import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CreateEmployeeDto,
  EmployeeListResponseDto,
  EmployeeResponseDto,
  QueryEmployeesDto,
  Role,
  UpdateEmployeeDto,
} from '@app/common';
import { EmployeeServiceClient } from '../clients/employee-service.client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('employees')
@ApiBearerAuth()
@Roles(Role.ADMIN_HRD)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeeServiceClient) {}

  @Get()
  @ApiOkResponse({ type: EmployeeListResponseDto })
  findAll(@Query() query: QueryEmployeesDto) {
    return this.employees.findAll(query);
  }

  @Post()
  @ApiCreatedResponse({ type: EmployeeResponseDto })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: EmployeeResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: EmployeeResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    if (id === user.id) {
      if ((dto.role !== undefined && dto.role !== Role.ADMIN_HRD) || dto.isActive === false) {
        throw new BadRequestException('Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri.');
      }
    }
    return this.employees.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: EmployeeResponseDto, description: 'Soft delete (isActive=false)' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (id === user.id) {
      throw new BadRequestException('Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri.');
    }
    return this.employees.remove(id);
  }
}

