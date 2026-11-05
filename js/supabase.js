/*
 * rbx transfer — supabase.js
 * Подключение к базе Supabase, мгновенный выход по сигналу админа, понятные тексты ошибок.
 * Файл собран из исходника src/supabase.ts*.
 */

import { createClient } from "./vendor/supabase.js?v=3ace7ab5";
const url = window.RBX_CONFIG?.SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const key = window.RBX_CONFIG?.SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder");
let kickCh = null;
const kickSubs = new Set();
function kickChannel() {
  if (kickCh) return kickCh;
  kickCh = supabase.channel("rbx-kick", { config: { broadcast: { self: false } } });
  kickCh.on("broadcast", { event: "check" }, () => kickSubs.forEach((f) => f()));
  kickCh.subscribe();
  return kickCh;
}
/** Подписка: fn вызывается, когда админ кого-то заблокировал или удалил. */
export function onKick(fn) {
  kickChannel();
  kickSubs.add(fn);
  return () => {
    kickSubs.delete(fn);
  };
}
/** Админ: попросить все открытые вкладки сайта сразу перепроверить свой статус. */
export async function kickBroadcast() {
  const ch = kickChannel();
  for (let i = 0; i < 30 && ch.state !== "joined"; i++) await new Promise((r) => setTimeout(r, 100));
  try {
    await ch.send({ type: "broadcast", event: "check", payload: {} });
  } catch {
    /* опрос раз в 4 с всё равно сработает */
  }
}
export function errText(e) {
  const m = e?.message || String(e);
  if (/BLACKLISTED|User is banned/i.test(m)) return "Доступ к сайту для этой почты закрыт администратором.";
  if (/BAD_AMOUNT/i.test(m)) return "У кода неверная сумма: нужно от $0.01 до $1000.";
  if (/NO_USER/i.test(m)) return "Пользователь не найден (возможно, уже удалён).";
  if (/BAD_EMAIL/i.test(m)) return "Неверная почта.";
  if (/INVITE_|Database error saving new user/i.test(m))
    return "Регистрация не прошла: код приглашения неверный, уже использован или отключён, либо эта почта заблокирована. Попроси у администратора новый код.";
  if (/INSUFFICIENT_FUNDS/i.test(m)) return "Недостаточно денег на аккаунте Microsoft.";
  if (/NO_ACCOUNT/i.test(m)) return "Сначала выбери аккаунт Microsoft.";
  if (/EMPTY_CART/i.test(m)) return "Корзина пуста.";
  if (/ALREADY_ERROR/i.test(m)) return "Этот заказ уже отмечен ошибкой.";
  if (/Invalid login credentials/i.test(m)) return "Неверная почта или пароль.";
  if (/Email not confirmed/i.test(m))
    return "Почта не подтверждена. Открой письмо от Supabase и перейди по ссылке.";
  if (/User already registered/i.test(m))
    return "Такая почта уже зарегистрирована. Войди или восстанови пароль.";
  if (/Password should be at least/i.test(m)) return "Пароль слишком короткий: нужно не меньше 6 символов.";
  if (/row-level security|permission denied/i.test(m)) return "Нет прав на это действие.";
  if (/duplicate key/i.test(m)) return "Такая запись уже есть.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Нет связи с сервером. Проверь интернет.";
  return m;
}
