/*
 * rbx transfer — calc.js
 * Расчёт балансов и лимитов (сутки / 30 дней), форматирование чисел и дат.
 * Файл собран из исходника src/calc.ts*.
 */

export const HOUR = 3600e3;
export const DAY = 24 * HOUR;
export const kindOf = (t) => (t.kind === "gamepass" ? "gamepass" : "transfer");
export const DEFAULT_SETTINGS = {
  daily_limit: 5000,
  monthly_limit: 10000,
  month_mode: "rolling",
  ready_ratio: 0.7,
};
const ts = (t) => new Date(t.sent_at).getTime();
export function monthStart(now) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
export function nextMonthStart(now) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}
export function calcAccount(acc, transfers, s, now, mode = "transfer") {
  const all = transfers.filter((t) => t.account_id === acc.id);
  // баланс общий для трансфера и геймпасса: вычитаются все записи
  const sentAll = all.reduce((sum, t) => sum + t.amount, 0);
  const balance = Math.max(0, acc.base_balance - (sentAll - acc.sent_at_base));
  // лимиты считаются только по трансферу
  const tx = all.filter((t) => kindOf(t) === "transfer");
  const dayTx = tx.filter((t) => ts(t) > now - DAY && ts(t) <= now).sort((a, b) => ts(a) - ts(b));
  const daySent = dayTx.reduce((sum, t) => sum + t.amount, 0);
  const dayLeft = Math.max(0, s.daily_limit - daySent);
  let monTx;
  let monthReset = null;
  if (s.month_mode === "calendar") {
    const ms = monthStart(now);
    monTx = tx.filter((t) => ts(t) >= ms && ts(t) <= now);
    monthReset = nextMonthStart(now);
  } else {
    monTx = tx.filter((t) => ts(t) > now - 30 * DAY && ts(t) <= now).sort((a, b) => ts(a) - ts(b));
  }
  const monSent = monTx.reduce((sum, t) => sum + t.amount, 0);
  const monLeft = Math.max(0, s.monthly_limit - monSent);
  // Трансфер возможен только с активной подпиской Roblox Plus
  const until = plusUntil(acc.plus_since);
  const plus = until !== null && until > now;
  const sendable =
    mode === "gamepass" ? balance : plus ? Math.max(0, Math.min(balance, dayLeft, monLeft)) : 0;
  let status;
  if (balance <= 0) status = { cls: "idle", text: "пусто" };
  else if (mode === "gamepass") status = { cls: "ok", text: "можно продавать" };
  else if (!plus) status = { cls: "bad", text: "нет Plus" };
  else if (monLeft <= 0) status = { cls: "bad", text: "месячный лимит" };
  else if (dayLeft <= 0) status = { cls: "warn", text: "суточный лимит" };
  else status = { cls: "ok", text: "можно отправлять" };
  return {
    balance,
    daySent,
    dayLeft,
    dayReleases: dayTx.map((t) => ({ at: ts(t) + DAY, amount: t.amount })),
    monSent,
    monLeft,
    monReleases:
      s.month_mode === "rolling" ? monTx.map((t) => ({ at: ts(t) + 30 * DAY, amount: t.amount })) : [],
    monthReset,
    sendable,
    status,
    plus,
  };
}
export const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
export const fmtDate = (t) =>
  new Date(t).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export function dur(ms) {
  if (ms <= 0) return "сейчас";
  const m = Math.ceil(ms / 60e3),
    d = Math.floor(m / 1440),
    h = Math.floor((m % 1440) / 60),
    mm = m % 60;
  return (d ? d + " д " : "") + (h ? h + " ч " : "") + (d ? "" : mm + " мин");
}
export function toLocalInput(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// ---------- Roblox Plus: действует один календарный месяц с даты покупки ----------
export function plusUntil(since) {
  if (!since) return null;
  const d = new Date(since);
  if (isNaN(+d)) return null;
  const e = new Date(d);
  e.setMonth(e.getMonth() + 1);
  if (e.getDate() !== d.getDate()) e.setDate(0); // 31 янв → 28/29 фев
  return +e;
}
