/*
 * rbx transfer — ui.js
 * Общие элементы интерфейса: выпадающий список, иконка R$, счётчики, уведомления.
 * Файл собран из исходника src/ui.ts*.
 */

import { useEffect, useRef, useState } from "./vendor/react.js?v=3ace7ab5";
export function Dropdown({ id, value, options, onChange, placeholder = "—", big }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const root = useRef(null);
  const cur = options.find((o) => o.value === value);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (root.current && !root.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (open)
      setHi(
        Math.max(
          0,
          options.findIndex((o) => o.value === value),
        ),
      );
  }, [open]);
  function key(e) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const d = e.key === "ArrowDown" ? 1 : -1;
      setHi((h) => (h + d + options.length) % Math.max(1, options.length));
    }
    if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      const o = options[hi];
      if (o && !o.disabled) {
        onChange(o.value);
        setOpen(false);
      }
    }
  }
  return React.createElement(
    "div",
    { className: "dd" + (open ? " open" : "") + (big ? " big" : ""), ref: root },
    React.createElement(
      "button",
      {
        type: "button",
        id: id,
        className: "dd-btn",
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        onClick: () => options.length && setOpen(!open),
        onKeyDown: key,
      },
      React.createElement(
        "span",
        { className: "dd-val" },
        cur
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement("b", null, cur.label),
              cur.hint && React.createElement("em", null, cur.hint),
            )
          : React.createElement("span", { className: "dd-ph" }, placeholder),
      ),
      React.createElement(
        "svg",
        { className: "dd-chev", width: "14", height: "14", viewBox: "0 0 24 24", "aria-hidden": "true" },
        React.createElement("path", {
          d: "M6 9l6 6 6-6",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2.2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      ),
    ),
    open &&
      React.createElement(
        "ul",
        { className: "dd-list", role: "listbox" },
        options.map((o, i) =>
          React.createElement(
            "li",
            {
              key: o.value,
              role: "option",
              "aria-selected": o.value === value,
              "aria-disabled": o.disabled,
              className:
                (o.value === value ? "sel " : "") + (i === hi ? "hi " : "") + (o.disabled ? "dis" : ""),
              style: { animationDelay: Math.min(i, 8) * 18 + "ms" },
              onMouseEnter: () => setHi(i),
              onClick: () => {
                if (!o.disabled) {
                  onChange(o.value);
                  setOpen(false);
                }
              },
            },
            React.createElement("b", null, o.label),
            o.hint && React.createElement("em", null, o.hint),
            o.value === value &&
              React.createElement(
                "svg",
                { width: "14", height: "14", viewBox: "0 0 24 24", "aria-hidden": "true" },
                React.createElement("path", {
                  d: "M5 12.5l4.5 4.5L19 7.5",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2.4",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }),
              ),
          ),
        ),
      ),
  );
}
// ---------- Значок робуксов (собственная монета, не официальный логотип) ----------
export function Rbx({ size = "1em" }) {
  return React.createElement(
    "svg",
    { className: "rbx-ic", width: size, height: size, viewBox: "0 0 24 24", "aria-label": "R$", role: "img" },
    React.createElement("path", { d: "M12 1.8 21 7v10l-9 5.2L3 17V7z", fill: "var(--accent)" }),
    React.createElement("path", {
      d: "M12 5.4 17.8 8.7v6.6L12 18.6l-5.8-3.3V8.7z",
      fill: "none",
      stroke: "var(--accent-ink)",
      strokeWidth: "1.7",
    }),
    React.createElement("path", {
      d: "M10.2 9.2h2.4a1.7 1.7 0 0 1 0 3.4h-2.4zM10.2 12.6v2.6M12.6 12.6l1.5 2.6",
      fill: "none",
      stroke: "var(--accent-ink)",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );
}
// ---------- Плавный счётчик чисел ----------
export function useCountUp(target, ms = 600) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now(),
      a = from.current,
      b = target;
    if (
      a === b ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      setV(b);
      from.current = b;
      return;
    }
    let raf = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms),
        e = 1 - Math.pow(1 - k, 3);
      const x = a + (b - a) * e;
      setV(x);
      from.current = x;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
export function Num({ value, fmt }) {
  const v = useCountUp(value);
  return React.createElement(React.Fragment, null, fmt(v));
}
export function ToastView({ t }) {
  if (!t) return null;
  return React.createElement(
    "div",
    { key: t.id, className: "toast " + t.kind, role: t.kind === "err" ? "alert" : "status" },
    React.createElement(
      "span",
      { className: "toast-ic", "aria-hidden": "true" },
      t.kind === "err"
        ? React.createElement(
            "svg",
            { width: "16", height: "16", viewBox: "0 0 24 24" },
            React.createElement("path", {
              d: "M12 7v6M12 16.5v.5",
              stroke: "currentColor",
              strokeWidth: "2.4",
              strokeLinecap: "round",
            }),
            React.createElement("circle", {
              cx: "12",
              cy: "12",
              r: "9.5",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
            }),
          )
        : React.createElement(
            "svg",
            { width: "16", height: "16", viewBox: "0 0 24 24" },
            React.createElement("path", {
              d: "M5 12.5l4.5 4.5L19 7.5",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2.4",
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }),
          ),
    ),
    t.text,
  );
}
