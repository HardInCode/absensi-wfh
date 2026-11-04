import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Employee } from '../../employees/entities/employee.entity';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Employee => {
    const request = ctx.switchToHttp().getRequest<{ user: Employee }>();
    return request.user;
  },
);

