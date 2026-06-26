import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let configValues: Record<string, string>;
  let sendMailMock: jest.Mock;

  const buildConfigService = (): ConfigService => {
    return {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        return key in configValues ? configValues[key] : defaultValue;
      }),
    } as unknown as ConfigService;
  };

  const createService = async (overrides: Record<string, string> = {}) => {
    configValues = {
      EMAIL_FROM: 'noreply@orbitchain.io',
      APP_BASE_URL: 'http://localhost:3000',
      NODE_ENV: 'development',
      ...overrides,
    };

    sendMailMock = jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      message: JSON.stringify({
        to: 'donor@example.com',
        subject: 'New Donation Received! 💰',
        html: '<strong>John Doe</strong> just donated <strong>500 USDC</strong> to "Save the Rainforest"',
      }),
    });

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();

    return module.get<EmailService>(EmailService);
  };

  let logSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    debugSpy.mockRestore();
    errorSpy.mockRestore();
  });

  const allLoggedStrings = () => {
    const calls = [
      ...logSpy.mock.calls,
      ...debugSpy.mock.calls,
      ...errorSpy.mock.calls,
    ];
    return calls.map((call) => String(call[0]));
  };

  it('never logs the raw HTML body, even when jsonTransport returns it on info.message', async () => {
    service = await createService(); // EMAIL_PREVIEW unset -> defaults off
    await service.send({
      to: 'donor@example.com',
      subject: 'New Donation Received! 💰',
      html: '<strong>John Doe</strong> just donated <strong>500 USDC</strong> to "Save the Rainforest"',
    });

    const logged = allLoggedStrings();
    for (const entry of logged) {
      expect(entry).not.toContain('John Doe');
      expect(entry).not.toContain('500 USDC');
      expect(entry).not.toContain('<strong>');
    }
  });

  it('does not log a body preview by default (EMAIL_PREVIEW unset)', async () => {
    service = await createService();
    await service.send({
      to: 'donor@example.com',
      subject: 'Milestone Unlocked! 🏆',
      html: '<p>secret donor info</p>',
    });

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('masks the recipient email in the success log line', async () => {
    service = await createService();
    await service.send({
      to: 'donor@example.com',
      subject: 'New Donation Received! 💰',
      html: '<p>hi</p>',
    });

    const logged = allLoggedStrings();
    expect(logged.some((entry) => entry.includes('do***@example.com'))).toBe(
      true,
    );
    expect(logged.some((entry) => entry.includes('donor@example.com'))).toBe(
      false,
    );
  });

  it('masks the recipient email in the error log line on send failure', async () => {
    service = await createService();
    sendMailMock.mockRejectedValueOnce(new Error('SMTP timeout'));

    await expect(
      service.send({
        to: 'donor@example.com',
        subject: 'New Donation Received! 💰',
        html: '<p>hi</p>',
      }),
    ).rejects.toThrow('SMTP timeout');

    const logged = allLoggedStrings();
    expect(logged.some((entry) => entry.includes('do***@example.com'))).toBe(
      true,
    );
    expect(logged.some((entry) => entry.includes('donor@example.com'))).toBe(
      false,
    );
  });

  it('logs a subject/recipient-only preview when EMAIL_PREVIEW=1 in non-production', async () => {
    service = await createService({
      NODE_ENV: 'development',
      EMAIL_PREVIEW: '1',
    });

    await service.send({
      to: 'donor@example.com',
      subject: 'New Donation Received! 💰',
      html: '<strong>John Doe</strong> donated 500 USDC',
    });

    expect(debugSpy).toHaveBeenCalledTimes(1);
    const previewLine = String(debugSpy.mock.calls[0][0]);
    expect(previewLine).toContain('New Donation Received! 💰');
    expect(previewLine).toContain('do***@example.com');
    expect(previewLine).not.toContain('John Doe');
    expect(previewLine).not.toContain('500 USDC');
  });

  it('never enables the preview when NODE_ENV=production, even if EMAIL_PREVIEW=1', async () => {
    service = await createService({
      NODE_ENV: 'production',
      EMAIL_PREVIEW: '1',
    });

    await service.send({
      to: 'donor@example.com',
      subject: 'New Donation Received! 💰',
      html: '<strong>John Doe</strong> donated 500 USDC',
    });

    expect(debugSpy).not.toHaveBeenCalled();
  });
});