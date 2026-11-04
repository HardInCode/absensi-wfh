import { Role } from '../enums/role.enum';

export interface JwtPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}

/** Dipasang ke req.user oleh gateway (selalu hasil cek DB terbaru). */
export interface AuthUser {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    nik: string;
    fullName: string;
    email: string;
    position: string;
    role: Role;
  };
}

