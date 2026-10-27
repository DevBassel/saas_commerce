import { Test } from '@nestjs/testing';
import { EmailOtpController } from '../email-otp.controller';
import { AuthService } from '../../auth/auth.service';
import { RequestOtpDto } from '../dto/request-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { OtpPurpose } from '../constants/otp-purpose.enum';

const mockAuthService = {
  requestEmailOtp: jest.fn(),
  verifyEmailOtp: jest.fn(),
};

describe('EmailOtpController', () => {
  let controller: EmailOtpController;
  let authService: typeof mockAuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EmailOtpController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = moduleRef.get(EmailOtpController);
    authService = moduleRef.get(AuthService);
    jest.clearAllMocks();
  });

  describe('request', () => {
    it('delegates to AuthService.requestEmailOtp with dto', async () => {
      const dto: RequestOtpDto = {
        email: 'test@test.dev',
        purpose: OtpPurpose.EMAIL_VERIFICATION,
      };
      const expected = { success: true };
      authService.requestEmailOtp.mockResolvedValue(expected);

      const result = await controller.request(dto);

      expect(authService.requestEmailOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('verify', () => {
    it('delegates to AuthService.verifyEmailOtp with dto', async () => {
      const dto: VerifyOtpDto = {
        email: 'test@test.dev',
        code: '123456',
        purpose: OtpPurpose.EMAIL_VERIFICATION,
      };
      const expected = {
        challenge: { id: 'ch_1' },
        user: { id: 1, email: 'test@test.dev' },
      };
      authService.verifyEmailOtp.mockResolvedValue(expected);

      const result = await controller.verify(dto);

      expect(authService.verifyEmailOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });
});
