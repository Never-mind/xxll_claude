import { Body, Controller, Inject, Post } from '@nestjs/common';
import type { LoginDto } from '../../../shared/api.interface.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }
}
