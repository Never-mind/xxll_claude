import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { LoginDto, LoginResult } from '../../../shared/api.interface.js';

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'admin';
const SESSION_TOKEN = 'local-admin-session';

@Injectable()
export class AuthService {
  login(credentials: LoginDto): LoginResult {
    const username = process.env.ADMIN_USERNAME || DEFAULT_USERNAME;
    const password = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
    if (credentials.username !== username || credentials.password !== password) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return {
      username,
      token: SESSION_TOKEN,
    };
  }
}
