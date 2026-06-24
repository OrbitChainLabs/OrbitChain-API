import { BadRequestException } from '@nestjs/common';
import { AcceptedAssetInput } from '../dto/accepted-asset-input.dto';

// Extract the function for testing — adjust path if needed
import { parseAcceptedAssets } from '../campaigns.service';

describe('parseAcceptedAssets', () => {
  const makeAsset = (value: string): AcceptedAssetInput => {
    const asset = new AcceptedAssetInput();
    asset.value = value;
    return asset;
  };

  it('should return empty array for undefined input', () => {
    expect(parseAcceptedAssets(undefined)).toEqual([]);
  });

  it('should return empty array for empty array input', () => {
    expect(parseAcceptedAssets([])).toEqual([]);
  });

  it('should parse valid XLM as native', () => {
    expect(parseAcceptedAssets([makeAsset('XLM')])).toEqual([
      { assetType: 'native' },
    ]);
  });

  it('should parse XLM case-insensitively', () => {
    expect(parseAcceptedAssets([makeAsset('xlm')])).toEqual([
      { assetType: 'native' },
    ]);
  });

  it('should parse valid credit asset', () => {
    const issuer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    expect(parseAcceptedAssets([makeAsset(`USDC:${issuer}`)])).toEqual([
      { assetType: 'credit', code: 'USDC', issuer },
    ]);
  });

  it('should handle multiple valid assets', () => {
    const issuer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    const result = parseAcceptedAssets([
      makeAsset('XLM'),
      makeAsset(`USDC:${issuer}`),
    ]);
    expect(result).toHaveLength(2);
  });

  it('should throw on empty asset value', () => {
    expect(() => parseAcceptedAssets([makeAsset('')])).toThrow(
      BadRequestException,
    );
  });

  it('should throw on whitespace-only value', () => {
    expect(() => parseAcceptedAssets([makeAsset('   ')])).toThrow(
      BadRequestException,
    );
  });

  it('should throw on missing issuer (USDC:)', () => {
    expect(() => parseAcceptedAssets([makeAsset('USDC:')])).toThrow(
      BadRequestException,
    );
  });

  it('should throw on missing code (:ISSUER)', () => {
    expect(() =>
      parseAcceptedAssets([
        makeAsset(':GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
      ]),
    ).toThrow(BadRequestException);
  });

  it('should throw on missing colon separator (USDC only)', () => {
    expect(() => parseAcceptedAssets([makeAsset('USDC')])).toThrow(
      BadRequestException,
    );
  });

  it('should throw on too many colons', () => {
    expect(() => parseAcceptedAssets([makeAsset('USDC:GBBD47:extra')])).toThrow(
      BadRequestException,
    );
  });

  it('should throw if array exceeds 10 entries', () => {
    const assets = Array.from({ length: 11 }, () => makeAsset('XLM'));
    expect(() => parseAcceptedAssets(assets)).toThrow(BadRequestException);
  });

  it('should fail fast on first invalid asset in mixed array', () => {
    expect(() =>
      parseAcceptedAssets([makeAsset('XLM'), makeAsset('USDC:')]),
    ).toThrow(BadRequestException);
  });
});
