import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

/**
 * Seals API keys saved from the settings page with AES-256-GCM. Without SECRETS_KEY the value is stored
 * as-is (prefixed `plain:`) and the settings page warns about it.
 */
export class SecretBox {
  private readonly key: Buffer | null;

  constructor(secret: string | undefined) {
    this.key = secret ? createHash('sha256').update(secret).digest() : null;
  }

  get encrypted(): boolean { return this.key !== null; }

  seal(value: string): string {
    if (!this.key) return `plain:${value}`;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
  }

  /** Returns null when the value was sealed with another key (or SECRETS_KEY was removed). */
  open(sealed: string): string | null {
    if (sealed.startsWith('plain:')) return sealed.slice(6);
    if (!sealed.startsWith(PREFIX) || !this.key) return null;
    try {
      const raw = Buffer.from(sealed.slice(PREFIX.length), 'base64');
      const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
