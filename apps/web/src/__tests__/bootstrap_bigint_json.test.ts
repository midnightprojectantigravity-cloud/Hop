import { afterEach, describe, expect, it } from 'vitest';
import { ensureBigIntJsonSerialization } from '../app/bootstrap-bigint-json';

const originalDescriptor = Object.getOwnPropertyDescriptor(BigInt.prototype, 'toJSON');

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(BigInt.prototype, 'toJSON', originalDescriptor);
    return;
  }

  delete (BigInt.prototype as { toJSON?: () => string }).toJSON;
});

describe('ensureBigIntJsonSerialization', () => {
  it('allows JSON.stringify to serialize bigint values as strings', () => {
    delete (BigInt.prototype as { toJSON?: () => string }).toJSON;

    expect(() => JSON.stringify({ value: 1n })).toThrow();

    ensureBigIntJsonSerialization();

    expect(JSON.stringify({ value: 1n })).toBe('{"value":"1"}');
  });

  it('does not replace an existing bigint toJSON implementation', () => {
    const existing = () => 'custom';
    Object.defineProperty(BigInt.prototype, 'toJSON', {
      value: existing,
      configurable: true,
      writable: true,
    });

    ensureBigIntJsonSerialization();

    expect((BigInt.prototype as { toJSON?: () => string }).toJSON).toBe(existing);
  });
});
