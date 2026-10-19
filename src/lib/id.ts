/** 全局唯一 ID。跨设备合并时不能依赖自增整数，必须用 UUID。 */
export function createId(): string {
  const subtleCrypto = globalThis.crypto;
  // crypto.randomUUID 在非安全上下文（例如 http://局域网 IP）不可用，需要兜底
  if (subtleCrypto?.randomUUID) return subtleCrypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (subtleCrypto?.getRandomValues) {
    subtleCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
