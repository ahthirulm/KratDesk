// Browser-only helper that seals a backup file with a password, and opens one
// again. Nothing here runs on the server, so it is imported lazily.
const text = new TextEncoder();
const ITERATIONS = 210000;

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return btoa(out);
}

function fromBase64(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function keyFrom(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', text.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export type BackupEnvelope = {
  app: 'KaratDesk';
  encrypted: true;
  algo: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
};

export async function encryptBackup(contents: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt);
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    text.encode(contents),
  );
  const envelope: BackupEnvelope = {
    app: 'KaratDesk',
    encrypted: true,
    algo: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(sealed)),
  };
  return JSON.stringify(envelope);
}

export async function decryptBackup(contents: string, password: string): Promise<string> {
  const envelope = JSON.parse(contents) as BackupEnvelope;
  if (envelope.app !== 'KaratDesk' || envelope.encrypted !== true) throw new Error('This is not an encrypted KaratDesk backup');
  const key = await keyFrom(password, fromBase64(envelope.salt));
  try {
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) as unknown as BufferSource },
      key,
      fromBase64(envelope.data) as unknown as BufferSource,
    );
    return new TextDecoder().decode(opened);
  } catch {
    throw new Error('That password does not open this backup');
  }
}
