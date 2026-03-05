import type { SecretCipherPayload } from "./types.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBytes = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

const importAesKey = async (rawBase64Key: string) => {
  const keyBytes = toBytes(rawBase64Key.trim());
  if (keyBytes.byteLength !== 32) {
    throw new Error("LIVE_SECRET_ENCRYPTION_KEY must be base64 for exactly 32 bytes.");
  }
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const encryptSecret = async (plaintext: string, rawBase64Key: string): Promise<string> => {
  if (!plaintext.trim()) throw new Error("Secret value cannot be empty.");
  const key = await importAesKey(rawBase64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plaintext)
  );
  const payload: SecretCipherPayload = {
    alg: "A256GCM",
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
    createdAt: new Date().toISOString()
  };
  return JSON.stringify(payload);
};

export const decryptSecret = async (cipherPayloadText: string, rawBase64Key: string): Promise<string> => {
  const payload = JSON.parse(cipherPayloadText) as SecretCipherPayload;
  if (!payload?.iv || !payload?.ciphertext || payload.alg !== "A256GCM") {
    throw new Error("Malformed encrypted secret payload.");
  }
  const key = await importAesKey(rawBase64Key);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBytes(payload.iv) },
    key,
    toBytes(payload.ciphertext)
  );
  return textDecoder.decode(decrypted);
};

