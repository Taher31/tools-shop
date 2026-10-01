import { loadEnvFiles } from './config/env';

// Must run before any module is imported: some module definitions read process.env.
loadEnvFiles();

// Safety net: an unmapped BigInt (Rial amounts) must never crash JSON serialization.
// Domain mappers convert explicitly; this only prevents a 500 if one is missed.
Object.defineProperty(BigInt.prototype, 'toJSON', {
  value(this: bigint) {
    return this <= BigInt(Number.MAX_SAFE_INTEGER) && this >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(this)
      : this.toString();
  },
  configurable: true,
  writable: true,
});
