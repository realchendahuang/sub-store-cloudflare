import { utf8ByteLength } from "./read";

export const MAX_API_BODY_BYTES = 4 * 1024 * 1024;
export const MAX_REMOTE_SOURCE_URLS = 8;
export const MAX_REMOTE_SOURCE_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_REMOTE_SOURCE_TOTAL_BYTES = 12 * 1024 * 1024;
export const MAX_FLOW_RESPONSE_BYTES = 64 * 1024;
export const MAX_DOH_RESPONSE_BYTES = 64 * 1024;
// D1 rejects strings and rows larger than ~2,000,000 bytes, so stay below that.
export const MAX_D1_TEXT_BYTES = 1_900_000;

export class PayloadTooLargeError extends Error {}

export function assertD1TextSize(value: string, label: string) {
  if (utf8ByteLength(value) > MAX_D1_TEXT_BYTES) {
    throw new PayloadTooLargeError(`${label} exceeds the ${MAX_D1_TEXT_BYTES} byte storage limit`);
  }
}
