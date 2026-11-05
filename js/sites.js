/*
 * rbx transfer — sites.js
 * Площадки продаж (Starvell, FunPay, Playerok, GGSell, Plati.market) и выбор площадки в формах.
 * Файл собран из исходника src/sites.tsx.
 */

// =====================================================================
// Площадки продаж: Starvell, FunPay, Playerok, GGSell, Plati.market
// ---------------------------------------------------------------------
// У каждой продажи можно отметить площадку — по ней строится
// отдельная вкладка «Прибыль» в админке.
// =====================================================================
import { useState } from "./vendor/react.js?v=0208e316";
import { Dropdown } from "./ui.js?v=0208e316";
export const SITES = [
  { id: "starvell", label: "Starvell" },
  { id: "funpay", label: "FunPay" },
  { id: "playerok", label: "Playerok" },
  { id: "ggsell", label: "GGSell" },
  { id: "plati", label: "Plati.market" },
];
export const siteLabel = (id) => SITES.find((s) => s.id === id)?.label || "—";
const KEY = "rbx-last-site";
/** Выбранная площадка; запоминается, чтобы не выбирать каждый раз заново. */
export function useSite() {
  const [site, setSiteS] = useState(() => {
    try {
      return localStorage.getItem(KEY) || "";
    } catch {
      return "";
    }
  });
  const setSite = (v) => {
    setSiteS(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };
  return [site, setSite];
}
/** Выпадающий список «Площадка» для форм записи продаж. */
export function SitePicker({ value, onChange }) {
  return React.createElement(
    "div",
    { className: "fld site-pick" },
    React.createElement("span", { className: "cap" }, "Площадка"),
    React.createElement(Dropdown, {
      value: value,
      onChange: (v) => onChange(v),
      options: [{ value: "", label: "не указана" }, ...SITES.map((s) => ({ value: s.id, label: s.label }))],
    }),
  );
}
