import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AppErrorCode, CurrentUserDto, LoginResponseDto } from '@epms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const COOKIE_NAME = 'refreshToken';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: [VERSION_NEUTRAL, '1'] })
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';
  }

  private setRefreshCookie(res: Response, token: string, expires: Date): void {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
      expires,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login via work email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account locked' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    const result = await this.authService.login(dto, userAgent, ip);

    this.setRefreshCookie(res, result.rawRefreshToken, result.expiresAt);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue a fresh access token' })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or reused token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ): Promise<LoginResponseDto> {
    const rawToken = req.cookies?.[COOKIE_NAME] || (req.body?.refreshToken as string);

    if (!rawToken) {
      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'No refresh token provided.',
      });
    }

    const userAgent = req.headers['user-agent'] as string | undefined;
    const result = await this.authService.refresh(rawToken, userAgent, ip);

    this.setRefreshCookie(res, result.newRawRefreshToken, result.expiresAt);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Log out current session device' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ): Promise<{ success: boolean; message: string }> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    await this.authService.logout(user.familyId, user.id, userAgent, ip);
    this.clearRefreshCookie(res);

    return { success: true, message: 'Logged out successfully.' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Log out all sessions across all devices' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ): Promise<{ success: boolean; message: string }> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    await this.authService.logoutAll(user.id, userAgent, ip);
    this.clearRefreshCookie(res);

    return { success: true, message: 'All sessions revoked.' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Change password (required when mustChangePassword is true)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<{ success: boolean; message: string }> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.changePassword(user.id, dto, userAgent, ip);
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current authenticated employee profile, roles, and permissions' })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserDto> {
    return this.authService.getMe(user.id);
  }
}
