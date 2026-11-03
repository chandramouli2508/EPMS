import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

describe('Logout cookie clearing', () => {
  it.each(['development', 'production'])('revokes the session and expires the matching cookie in %s', async (env) => {
    const service = { logout: jest.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(
      service as unknown as AuthService,
      { get: () => env } as unknown as ConfigService,
    );
    const response = { clearCookie: jest.fn() };
    await controller.logout(
      { id: 'employee-1', familyId: 'family-1' } as AuthenticatedUser,
      { headers: { 'user-agent': 'test' } } as Request,
      response as unknown as Response,
      '127.0.0.1',
    );
    expect(service.logout).toHaveBeenCalledWith('family-1', 'employee-1', 'test', '127.0.0.1');
    expect(response.clearCookie).toHaveBeenCalledWith('refreshToken', {
      httpOnly: true, secure: env === 'production', sameSite: 'lax', path: '/api/v1/auth',
    });
  });
});
