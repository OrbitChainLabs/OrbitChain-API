export class AssetBalanceDto {
  assetCode: string;
  assetIssuer?: string;
  balance: string;
  isNative: boolean;
}

export class ContractBalanceResponseDto {
  contractId: string;
  balances: AssetBalanceDto[];
  totalValueInXlm?: string;
  discrepancyDetected: boolean;
  storedRaisedAmount: string;
  onChainTotal: string;
}
