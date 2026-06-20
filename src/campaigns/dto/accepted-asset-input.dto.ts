import { IsString, MaxLength, Matches } from 'class-validator';

export class AcceptedAssetInput {
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Z0-9]{1,12}(:[A-Z2-7A-Z0-9]{56})?$|^XLM$/i, {
    message:
      'value must be "XLM" or "CODE:ISSUER" where CODE is 1–12 alphanumeric chars and ISSUER is a valid Stellar public key',
  })
  value!: string;
}
