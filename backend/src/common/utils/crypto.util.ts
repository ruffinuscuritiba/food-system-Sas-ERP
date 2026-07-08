import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';

function deriveKey(): Buffer {
  const secret = process.env.FISCAL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'FISCAL_ENCRYPTION_KEY não configurada — obrigatória para salvar/ler credenciais fiscais.',
    );
  }
  return scryptSync(secret, 'foodsaas-fiscal-salt', 32);
}

// Formato: iv(hex).authTag(hex).ciphertext(hex)
export function encryptSecret(plainText: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const key = deriveKey();
  const [ivHex, authTagHex, dataHex] = payload.split('.');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Payload criptografado em formato inválido.');
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
