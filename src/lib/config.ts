import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { db } from '@/lib/db';

const CACHE_TTL_MS = 30_000;
const ENCRYPTION_KEY_NAME = 'SETTINGS_ENCRYPTION_KEY';

const SECRET_SETTING_KEYS = new Set([
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'MAILCHIMP_API_KEY',
  'SMTP_PASSWORD',
  'GA_API_SECRET',
  'FACEBOOK_ACCESS_TOKEN',
  'FACEBOOK_CONVERSION_API_TOKEN',
  'INSTAGRAM_ACCESS_TOKEN',
  'AYRSHARE_API_KEY',
  'EASYPOST_API_KEY',
  'PINTEREST_ACCESS_TOKEN',
  'GOOGLE_CLIENT_SECRET',
  'HUBSPOT_API_KEY',
  'SALESFORCE_CLIENT_SECRET',
  'SALESFORCE_PASSWORD',
  'SALESFORCE_SECURITY_TOKEN',
]);

type CachedSetting = {
  expiresAt: number;
  value: string | undefined;
};

type SiteSettingRecord = {
  key: string;
  value: string;
  encrypted: boolean;
};

const settingCache = new Map<string, CachedSetting>();

function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}

function settingClient() {
  return (db as any).siteSetting;
}

function parseEncryptionKey(): Buffer {
  const rawKey = process.env[ENCRYPTION_KEY_NAME];
  if (!rawKey) {
    throw new Error(`${ENCRYPTION_KEY_NAME} is required before saving encrypted settings`);
  }

  const candidates = [
    Buffer.from(rawKey, 'base64'),
    Buffer.from(rawKey, 'hex'),
    Buffer.from(rawKey, 'utf8'),
  ];
  const key = candidates.find((candidate) => candidate.length === 32);
  if (!key) {
    throw new Error(`${ENCRYPTION_KEY_NAME} must be 32 bytes as base64, hex, or utf8`);
  }
  return key;
}

function encryptValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', parseEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptValue(payload: string): string {
  const [version, ivBase64, tagBase64, ciphertextBase64] = payload.split(':');
  if (version !== 'v1' || !ivBase64 || !tagBase64 || !ciphertextBase64) {
    throw new Error('Invalid encrypted setting payload');
  }

  const decipher = createDecipheriv('aes-256-gcm', parseEncryptionKey(), Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function readEnvFallback(key: string): string | undefined {
  const value = process.env[key];
  return value === '' ? undefined : value;
}

function cacheSetting(key: string, value: string | undefined): void {
  settingCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function isSecretSettingKey(key: string): boolean {
  return SECRET_SETTING_KEYS.has(normalizeKey(key));
}

export function maskSecret(value: string | undefined): 'configured' | 'not_set' {
  return value ? 'configured' : 'not_set';
}

export function clearConfigCache(key?: string): void {
  if (key) {
    settingCache.delete(normalizeKey(key));
    return;
  }
  settingCache.clear();
}

export async function getConfig(key: string): Promise<string | undefined> {
  const normalizedKey = normalizeKey(key);
  const cached = settingCache.get(normalizedKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const setting = await settingClient().findUnique({
      where: { key: normalizedKey },
    }) as SiteSettingRecord | null;

    if (setting) {
      const value = setting.encrypted ? decryptValue(setting.value) : setting.value;
      cacheSetting(normalizedKey, value || undefined);
      return value || undefined;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Falling back to environment for ${normalizedKey}:`, error);
    }
  }

  const fallback = readEnvFallback(normalizedKey);
  cacheSetting(normalizedKey, fallback);
  return fallback;
}

export async function getConfigBool(key: string): Promise<boolean> {
  const value = await getConfig(key);
  return ['1', 'true', 'yes', 'on'].includes((value || '').toLowerCase());
}

export async function getConfigMany(keys: string[]): Promise<Record<string, string | undefined>> {
  const entries = await Promise.all(keys.map(async (key) => [normalizeKey(key), await getConfig(key)] as const));
  return Object.fromEntries(entries);
}

export async function setConfig(key: string, value: string, options: { encrypt?: boolean } = {}): Promise<void> {
  const normalizedKey = normalizeKey(key);
  const shouldEncrypt = options.encrypt ?? isSecretSettingKey(normalizedKey);
  const storedValue = shouldEncrypt ? encryptValue(value) : value;

  await settingClient().upsert({
    where: { key: normalizedKey },
    create: { key: normalizedKey, value: storedValue, encrypted: shouldEncrypt },
    update: { value: storedValue, encrypted: shouldEncrypt },
  });

  clearConfigCache(normalizedKey);
}

export async function deleteConfig(key: string): Promise<void> {
  const normalizedKey = normalizeKey(key);
  await settingClient().delete({ where: { key: normalizedKey } }).catch(() => undefined);
  clearConfigCache(normalizedKey);
}