import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Request body for POST /admin/campaigns/:id/reconcile-balance.
 *
 * `force` is REQUIRED. The endpoint refuses to write a corrected
 * `Campaign.raisedAmount` unless the admin explicitly acknowledges that
 * a non-readonly mutation is being performed. This is the audit gate that
 * the issue (#1) asked us to add in place of the silent write.
 *
 * `reason` is optional human-readable text captured in the AuditLog row.
 */
export class ReconcileBalanceDto {
  @IsBoolean()
  force!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
