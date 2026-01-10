import { describe, it, expect } from 'vitest';
import { createRng, randomFromSeed } from '@hop/engine/rng';

describe('RNG determinism', () => {
  it('createRng produces consistent sequence for same seed', () => {
    const a = createRng('test-seed');
    const b = createRng('test-seed');

    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];

    expect(seqA).toEqual(seqB);
  });

  it('randomFromSeed is stable for seed+counter', () => {
    const v1 = randomFromSeed('the-seed', 0);
    const v2 = randomFromSeed('the-seed', 0);
    const v3 = randomFromSeed('the-seed', 1);
    expect(v1).toEqual(v2);
    expect(v1).not.toEqual(v3);
  });
});
