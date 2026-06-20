import { parseAllowedOrigins } from './notifications.gateway';

describe('parseAllowedOrigins', () => {
  it('returns an empty allowlist when the env var is missing', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });

  it('splits and trims comma-separated origins', () => {
    expect(
      parseAllowedOrigins('http://localhost:3000, https://app.example.com ,'),
    ).toEqual(['http://localhost:3000', 'https://app.example.com']);
  });
});
