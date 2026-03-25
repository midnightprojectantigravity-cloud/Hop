export const ensureBigIntJsonSerialization = (): void => {
  if (typeof BigInt === 'undefined') return;

  const prototype = BigInt.prototype as typeof BigInt.prototype & {
    toJSON?: () => string;
  };

  if (typeof prototype.toJSON === 'function') return;

  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value(this: bigint) {
      return this.toString();
    },
    configurable: true,
    writable: true,
  });
};
