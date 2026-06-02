import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type StellarAcceptedAsset =
  | { assetType: 'native' }
  | { assetType: 'credit'; code: string; issuer: string };

export interface VerifyDonationTxInput {
  txHash: string;
  destination: string;
  amount?: string;
  asset: StellarAcceptedAsset;
  acceptedAssets: StellarAcceptedAsset[];
}

export interface VerifiedDonationTx {
  txHash: string;
  paymentOperationId: string;
  sourceAccount?: string;
  destination: string;
  amount: string;
  asset: StellarAcceptedAsset;
  ledger: number;
}

@Injectable()
export class StellarTransactionsService {
  private readonly horizonUrl: string;

  constructor(private readonly config: ConfigService) {
    this.horizonUrl =
      this.config.get<string>('STELLAR_HORIZON_URL') ??
      'https://horizon-testnet.stellar.org';
  }

  async verifyDonationTransaction(
    input: VerifyDonationTxInput,
  ): Promise<VerifiedDonationTx> {
    const tx = await this.fetchTransactionWithRetry(input.txHash);

    if (!tx?.successful || typeof tx.ledger !== 'number') {
      throw new NotFoundException('Transaction not yet confirmed');
    }

    const operations = await this.fetchTransactionOperationsWithRetry(
      input.txHash,
    );

    const paymentOps = operations.filter((op) => op?.type === 'payment');
    if (paymentOps.length === 0) {
      throw new BadRequestException('Transaction has no payment operation');
    }

    const matchingPayment = paymentOps.find((op) => {
      const to = String(op.to ?? '');
      if (to !== input.destination) return false;
      if (!this.assetMatchesOperation(input.asset, op)) return false;
      if (!this.assetAccepted(input.acceptedAssets, input.asset)) return false;
      if (input.amount && !amountEquals(String(op.amount ?? ''), input.amount)) {
        return false;
      }
      return true;
    });

    if (!matchingPayment) {
      const destinationMatch = paymentOps.some(
        (op) => String(op.to ?? '') === input.destination,
      );
      if (!destinationMatch) {
        throw new BadRequestException(
          'Payment destination does not match campaign contract',
        );
      }

      const assetMatch = paymentOps.some((op) =>
        this.assetMatchesOperation(input.asset, op),
      );
      if (!assetMatch) {
        throw new BadRequestException('Payment asset does not match request');
      }

      if (!this.assetAccepted(input.acceptedAssets, input.asset)) {
        throw new BadRequestException('Asset not accepted by campaign');
      }

      throw new BadRequestException('No matching payment operation found');
    }

    const resolvedAsset = assetFromOperation(matchingPayment);
    if (!resolvedAsset) {
      throw new BadRequestException('Unsupported payment asset');
    }

    return {
      txHash: input.txHash,
      paymentOperationId: String(matchingPayment.id),
      sourceAccount:
        tx.source_account ? String(tx.source_account) : undefined,
      destination: String(matchingPayment.to),
      amount: String(matchingPayment.amount),
      asset: resolvedAsset,
      ledger: tx.ledger,
    };
  }

  async fetchTransactionWithRetry(txHash: string) {
    return withRetries(
      3,
      async () => {
        const res = await fetch(
          `${this.horizonUrl}/transactions/${encodeURIComponent(txHash)}`,
          { headers: { accept: 'application/json' } },
        );

        if (res.status === 404) {
          throw new NotFoundException('Transaction not found');
        }
        if (res.status >= 500 || res.status === 429) {
          throw new ServiceUnavailableException('Horizon unavailable');
        }
        if (!res.ok) {
          throw new BadRequestException(
            `Horizon error fetching transaction (${res.status})`,
          );
        }
        return (await res.json()) as any;
      },
      (err) => err instanceof NotFoundException || err instanceof ServiceUnavailableException,
    );
  }

  async fetchTransactionOperationsWithRetry(txHash: string) {
    return withRetries(
      3,
      async () => {
        const res = await fetch(
          `${this.horizonUrl}/transactions/${encodeURIComponent(
            txHash,
          )}/operations?limit=200`,
          { headers: { accept: 'application/json' } },
        );

        if (res.status === 404) {
          throw new NotFoundException('Transaction not found');
        }
        if (res.status >= 500 || res.status === 429) {
          throw new ServiceUnavailableException('Horizon unavailable');
        }
        if (!res.ok) {
          throw new BadRequestException(
            `Horizon error fetching operations (${res.status})`,
          );
        }

        const json = (await res.json()) as any;
        const records = json?._embedded?.records;
        if (!Array.isArray(records)) {
          throw new BadRequestException('Invalid Horizon operations response');
        }
        return records as any[];
      },
      (err) => err instanceof NotFoundException || err instanceof ServiceUnavailableException,
    );
  }

  private assetAccepted(
    accepted: StellarAcceptedAsset[],
    asset: StellarAcceptedAsset,
  ): boolean {
    return accepted.some((a) => assetsEqual(a, asset));
  }

  private assetMatchesOperation(asset: StellarAcceptedAsset, op: any): boolean {
    const opAsset = assetFromOperation(op);
    if (!opAsset) return false;
    return assetsEqual(asset, opAsset);
  }

  /**
   * Fetch on-chain asset balances for a Stellar account (contract or wallet).
   * Queries Horizon for the account's native and issued asset balances.
   */
  async getContractBalances(
    contractId: string,
  ): Promise<{ assetCode: string; assetIssuer?: string; balance: string; isNative: boolean }[]> {
    const res = await fetch(
      `${this.horizonUrl}/accounts/${encodeURIComponent(contractId)}`,
      { headers: { accept: 'application/json' } },
    );

    if (res.status === 404) {
      return []; // account not yet funded — zero balance
    }

    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Horizon error fetching account ${contractId} (${res.status})`,
      );
    }

    const account = (await res.json()) as any;
    const balances = account?.balances ?? [];

    return balances.map((b: any) => {
      const assetType = String(b.asset_type ?? '');
      if (assetType === 'native') {
        return {
          assetCode: 'XLM',
          balance: String(b.balance ?? '0'),
          isNative: true,
        };
      }
      return {
        assetCode: String(b.asset_code ?? ''),
        assetIssuer: String(b.asset_issuer ?? ''),
        balance: String(b.balance ?? '0'),
        isNative: false,
      };
    });
  }
}

async function withRetries<T>(
  maxAttempts: number,
  fn: () => Promise<T>,
  shouldRetry: (err: unknown) => boolean,
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      await sleep(backoffMs(attempt));
    }
  }
  throw lastErr;
}

function backoffMs(attempt: number): number {
  const base = 300;
  return base * Math.pow(2, attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assetsEqual(a: StellarAcceptedAsset, b: StellarAcceptedAsset): boolean {
  if (a.assetType === 'native' && b.assetType === 'native') return true;
  if (a.assetType === 'credit' && b.assetType === 'credit') {
    return (
      a.code.toUpperCase() === b.code.toUpperCase() &&
      a.issuer === b.issuer
    );
  }
  return false;
}

function assetFromOperation(op: any): StellarAcceptedAsset | null {
  const assetType = String(op.asset_type ?? '');
  if (assetType === 'native') {
    return { assetType: 'native' };
  }

  const code = op.asset_code ? String(op.asset_code) : '';
  const issuer = op.asset_issuer ? String(op.asset_issuer) : '';
  if (!code || !issuer) return null;
  return { assetType: 'credit', code, issuer };
}

function normalizeAmount(amount: string): string {
  const trimmed = amount.trim();
  if (trimmed === '') return '';
  const negative = trimmed.startsWith('-');
  const raw = negative ? trimmed.slice(1) : trimmed;
  const [intPartRaw, fracRaw = ''] = raw.split('.');
  const intPart = String(Number(intPartRaw || '0'));
  const frac = fracRaw.replace(/0+$/g, '');
  const normalized = frac.length > 0 ? `${intPart}.${frac}` : intPart;
  return negative ? `-${normalized}` : normalized;
}

function amountEquals(a: string, b: string): boolean {
  return normalizeAmount(a) === normalizeAmount(b);
}

