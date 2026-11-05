/*
 * rbx transfer — vault.js
 * Генерация кодов 2FA (TOTP) прямо в браузере.
 * Файл собран из исходника src/vault.ts*.
 */

// Шифрование паролей и ключей 2FA аккаунтов Roblox в браузере.
// Мастер-пароль никуда не отправляется: из него выводится AES-ключ (PBKDF2), в базу уходит только шифротекст.
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 310000;
const CHECK = "rbx-transfer-vault-v1";
export function b64(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}
export function unb64(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
export async function deriveKey(password, saltB64) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: unb64(saltB64), iterations: ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}
export async function encryptJson(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  return { iv: b64(iv), ct: b64(ct) };
}
export async function decryptJson(key, iv, ct) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
  return JSON.parse(dec.decode(pt));
}
export async function createVault(password) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(password, salt);
  const { iv, ct } = await encryptJson(key, CHECK);
  return { key, row: { salt, check_iv: iv, check_ct: ct } };
}
export async function unlockVault(password, row) {
  try {
    const key = await deriveKey(password, row.salt);
    const v = await decryptJson(key, row.check_iv, row.check_ct);
    return v === CHECK ? key : null;
  } catch {
    return null;
  }
}
// Ключ живёт только в этой вкладке: в памяти + sessionStorage (стирается при закрытии вкладки).
const SS = "rbx-vault-key";
export async function rememberKey(userId, key) {
  try {
    const raw = await crypto.subtle.exportKey("raw", key);
    sessionStorage.setItem(SS + ":" + userId, b64(raw));
  } catch {
    /* ignore */
  }
}
export async function restoreKey(userId) {
  try {
    const s = sessionStorage.getItem(SS + ":" + userId);
    if (!s) return null;
    return await crypto.subtle.importKey("raw", unb64(s), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  } catch {
    return null;
  }
}
export function forgetKey(userId) {
  try {
    sessionStorage.removeItem(SS + ":" + userId);
  } catch {
    /* ignore */
  }
}
// ---------- TOTP (RFC 6238), как в 2fa.live ----------
export function cleanSecret(s) {
  return s.replace(/[\s-]/g, "").toUpperCase().replace(/=+$/, "");
}
export function base32ToBytes(secret) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const s = cleanSecret(secret);
  if (!s || /[^A-Z2-7]/.test(s)) return null;
  let bits = 0,
    val = 0;
  const out = [];
  for (const c of s) {
    val = (val << 5) | A.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return out.length ? new Uint8Array(out) : null;
}
export async function totp(secret, at = Date.now(), step = 30, digits = 6) {
  const keyBytes = base32ToBytes(secret);
  if (!keyBytes) throw new Error("bad secret");
  let counter = Math.floor(at / 1000 / step);
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    msg[i] = counter & 255;
    counter = Math.floor(counter / 256);
  }
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
  const o = h[h.length - 1] & 15;
  const bin = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}
export async function verifyTotp(secret, code) {
  const c = code.replace(/\s/g, "");
  for (const d of [-1, 0, 1]) {
    if ((await totp(secret, Date.now() + d * 30000)) === c) return true;
  }
  return false;
}
