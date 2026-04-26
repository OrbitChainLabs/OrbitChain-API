import { IsString, IsNumber, IsOptional, IsEnum, IsObject } from 'class-validator';

export enum WebhookEventType {
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_PENDING = 'payment.pending',
  TRANSACTION_CONFIRMED = 'transaction.confirmed',
}

export class WebhookDto {
  @IsString()
  id!: string;

  @IsEnum(WebhookEventType)
  type!: WebhookEventType;

  @IsString()
  transactionHash!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  assetCode!: string;

  @IsOptional()
  @IsString()
  assetIssuer?: string;

  @IsString()
  projectId!: string;

  @IsString()
  donorId!: string;

  @IsString()
  walletAddress!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsString()
  timestamp!: string;

  @IsOptional()
  @IsString()
  signature?: string;
}
