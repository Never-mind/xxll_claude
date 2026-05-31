import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class WriteAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configuredToken = process.env.WRITE_AUTH_TOKEN;
    if (!configuredToken) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const actual = request.headers['x-auth-token'];
    if (actual === configuredToken) return true;
    throw new UnauthorizedException('Missing or invalid write token');
  }
}
