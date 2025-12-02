import { SHA256 } from "crypto-es";

export function generateFingerprintHash(rawString) {
  return SHA256(rawString).toString();
}
