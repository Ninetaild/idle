const SAVE_VERSION = 1;
const PBKDF2_ITERATIONS = 120_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt).buffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSave<T>(payload: T, passphrase: string): Promise<string> {
  if (passphrase.trim().length < 8) {
    throw new Error('암호는 8자 이상 입력해 주세요.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return ['MIKO', SAVE_VERSION, toBase64Url(salt), toBase64Url(iv), toBase64Url(new Uint8Array(encrypted))].join('.');
}

export async function decryptSave<T>(code: string, passphrase: string): Promise<T> {
  const [magic, version, saltText, ivText, dataText, extra] = code.trim().split('.');
  if (magic !== 'MIKO' || version !== String(SAVE_VERSION) || !saltText || !ivText || !dataText || extra) {
    throw new Error('저장 코드 형식이 올바르지 않거나 지원하지 않는 버전입니다.');
  }
  try {
    const key = await deriveKey(passphrase, fromBase64Url(saltText));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(fromBase64Url(ivText)).buffer },
      key,
      fromBase64Url(dataText)
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch {
    throw new Error('암호가 틀렸거나 저장 코드가 손상되었습니다.');
  }
}
