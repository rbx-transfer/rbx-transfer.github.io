/*
 * rbx transfer — Plus.js
 * Roblox Plus: переключатель с датой покупки и значок срока.
 * Файл собран из исходника src/Plus.ts*.
 */

import { DAY, dur, plusUntil } from "./calc.js?v=3ace7ab5";
// ---------- Roblox Plus ----------
function dayInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function PlusField({ id, value, onChange }) {
  const on = !!value;
  const until = plusUntil(value);
  return React.createElement(
    "div",
    { className: "plus-wrap" },
    React.createElement("span", { className: "cap" }, "Roblox Plus"),
    React.createElement(
      "div",
      { className: "plus-field" + (on ? " on" : "") },
      React.createElement(
        "button",
        {
          type: "button",
          id: id + "-plus",
          role: "switch",
          "aria-checked": on,
          className: "plus-toggle",
          onClick: () => onChange(on ? null : new Date().toISOString()),
        },
        React.createElement(
          "span",
          { className: "sw", "aria-hidden": "true" },
          React.createElement("i", null),
        ),
        React.createElement("span", { className: "pt" }, on ? "Подписка куплена" : "Подписки нет"),
      ),
      on &&
        React.createElement(
          "label",
          { className: "plus-date" },
          React.createElement("span", null, "куплен"),
          React.createElement("input", {
            id: id + "-plus-date",
            type: "date",
            value: dayInput(value),
            max: dayInput(new Date().toISOString()),
            onChange: (e) => {
              if (e.target.value) {
                const [y, m, d] = e.target.value.split("-").map(Number);
                onChange(new Date(y, m - 1, d, 12).toISOString());
              }
            },
          }),
        ),
    ),
    on &&
      until &&
      React.createElement(
        "span",
        { className: "plus-till" },
        "действует до ",
        React.createElement("b", null, new Date(until).toLocaleDateString("ru-RU")),
      ),
  );
}
export function PlusBadge({ since, now }) {
  const until = plusUntil(since);
  if (!until) return React.createElement("span", { className: "plus off" }, "Plus нет");
  const left = until - now;
  if (left <= 0)
    return React.createElement(
      "span",
      { className: "plus bad" },
      "Plus закончился ",
      new Date(until).toLocaleDateString("ru-RU"),
    );
  return React.createElement(
    "span",
    {
      className: "plus " + (left < 3 * DAY ? "warn" : "ok"),
      title: "куплен " + new Date(since).toLocaleDateString("ru-RU"),
    },
    "Plus до ",
    new Date(until).toLocaleDateString("ru-RU"),
    " · осталось ",
    dur(left),
  );
}
