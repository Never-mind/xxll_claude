import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  it('allows the initial admin account', () => {
    const service = new AuthService();

    expect(service.login({ username: 'admin', password: 'admin' })).toEqual({
      username: 'admin',
      token: 'local-admin-session',
    });
  });

  it('rejects invalid credentials', () => {
    const service = new AuthService();

    expect(() => service.login({ username: 'admin', password: 'wrong' })).toThrow('用户名或密码错误');
  });
});
