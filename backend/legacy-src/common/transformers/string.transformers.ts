import { TransformFnParams } from 'class-transformer';

export const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

export const trimLowerCase = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

