import 'reflect-metadata';
import { validate } from './env.validation';

describe('ConfigValidation', () => {
  it('should throw error if JWT_SECRET is missing', () => {
    const config = {
      NODE_ENV: 'development',
      STELLAR_RPC_URL: 'http://localhost:8000',
      STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    };
    expect(() => validate(config)).toThrow(/JWT_SECRET/);
  });

  it('should throw error if JWT_SECRET is too short', () => {
    const config = {
      NODE_ENV: 'development',
      JWT_SECRET: 'short',
      STELLAR_RPC_URL: 'http://localhost:8000',
      STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    };
    expect(() => validate(config)).toThrow(/at least 32 characters/);
  });

  it('should pass if all config is valid', () => {
    const config = {
      NODE_ENV: 'development',
      JWT_SECRET: 'a'.repeat(32),
      STELLAR_RPC_URL: 'http://localhost:8000',
      STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    };
    expect(() => validate(config)).not.toThrow();
    const validated = validate(config);
    expect(validated.JWT_SECRET).toBe('a'.repeat(32));
  });

  it('should throw error if other required vars are missing', () => {
    const config = {
      NODE_ENV: 'development',
      JWT_SECRET: 'a'.repeat(32),
    };
    expect(() => validate(config)).toThrow(/STELLAR_RPC_URL/);
    expect(() => validate(config)).toThrow(/STELLAR_NETWORK_PASSPHRASE/);
    expect(() => validate(config)).toThrow(/REDIS_URL/);
    expect(() => validate(config)).toThrow(/DATABASE_URL/);
  });
});
