/** Represents an on-chain asset balance for a Stellar account */
export class AssetBalanceDto {
  assetCode: string;
  assetIssuer?: string;
  balance: string;
  isNative: boolean;
}

/**
 * Per-asset projection used for a deterministic reconciliation figure.
 * `grossOnChain` is the raw on-chain balance for one asset. `released` is
 * the sum of APPROVED/RELEASED FundRelease amounts denominated in the same
 * asset (XLM releases map to native; non-native asset releases require an
 * issuer+code match). `netAvailable` is `grossOnChain + released` since
 * released funds have already been moved off the contract account.
 */
export class PerAssetBalanceDto {
  assetCode: string;
  assetIssuer?: string;
  isNative: boolean;
  grossOnChain: string;
  released: string;
  netAvailable: string;
}

export class ContractBalanceResponseDto {
  contractId: string;
  balances: AssetBalanceDto[];
  perAsset: PerAssetBalanceDto[];
  /**
   * Canonical campaign balance in XLM (the only denomination
   * `Campaign.raisedAmount` is stored in). Equals the sum of `perAsset[*].netAvailable`
   * for native (XLM) assets only. Non-XLM asset contributions are reported in
   * `perAsset` but NEVER folded into this figure.
   */
  netAvailableByAssetTotal: string;
  /**
   * Native (XLM) on-chain balance, summed across the contract's XLM balances.
   * Provided for backwards-compatibility with the original endpoint shape.
   */
  onChainTotal: string;
  /**
   * Sum of APPROVED/RELEASED FundRelease amounts for native (XLM) releases
   * only. Per-asset non-XLM release amounts are reported in `perAsset`.
   */
  netReleasedAmount: string;
  /**
   * True iff the difference between `netAvailableByAssetTotal` and the
   * stored `Campaign.raisedAmount` exceeds 0.0001. The handler MUST NOT
   * silently persist a correction — see `/admin/campaigns/:id/reconcile-balance`.
   */
  discrepancyDetected: boolean;
  storedRaisedAmount: string;
}
