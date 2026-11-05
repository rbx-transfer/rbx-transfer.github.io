/*
 * rbx transfer — MsPanel.js
 * Раздел «Донат паки (Microsoft)»: наборы, корзина, активация кодов, почты, журнал.
 * Файл собран из исходника src/MsPanel.ts*.
 */

import { useEffect, useMemo, useState } from "./vendor/react.js?v=1aac96d1";
import { supabase, errText } from "./supabase.js?v=1aac96d1";
import { Dropdown, Num, Rbx } from "./ui.js?v=1aac96d1";
import { useRoute, go, href } from "./router.js?v=1aac96d1";
import { noFill } from "./VaultUI.js?v=1aac96d1";
const PACKS = [
  { r: 80, usd: 0.99 },
  { r: 500, usd: 4.99 },
  { r: 1000, usd: 9.99 },
  { r: 2000, usd: 19.99 },
];
const price = (r) => PACKS.find((p) => p.r === r)?.usd || 0;
const n = (x) => Math.round(x).toLocaleString("ru-RU");
const usd = (x) => "$" + (Math.round(x * 100) / 100).toFixed(2);
const dt = (x) =>
  new Date(x).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const tm = (x) => new Date(x).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const today = (x) => new Date(x).toDateString() === new Date().toDateString();
const sum = (items) => items.reduce((s, i) => s + price(i.r) * i.q, 0);
const sumR = (items) => items.reduce((s, i) => s + i.r * i.q, 0);
function lsGet(k, d) {
  try {
    return localStorage.getItem(k) || d;
  } catch {
    return d;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function useMs(say) {
  const [accs, setAccs] = useState([]);
  const [buys, setBuys] = useState([]);
  const [tops, setTops] = useState([]);
  const [evs, setEvs] = useState([]);
  const [errs, setErrs] = useState([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    const [a, b, t, e, r] = await Promise.all([
      supabase.from("ms_accounts").select("*").order("balance", { ascending: false }),
      supabase.from("ms_purchases").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("ms_topups").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("ms_events").select("*").order("at", { ascending: false }).limit(300),
      supabase.from("ms_errors").select("*").order("code"),
    ]);
    const bad = [a, b, t, e, r].find((x) => x.error);
    if (bad?.error) say(errText(bad.error), "err");
    setAccs((a.data || []).map((x) => ({ ...x, balance: Number(x.balance) })));
    setBuys((b.data || []).map((x) => ({ ...x, amount: Number(x.amount) })));
    setTops((t.data || []).map((x) => ({ ...x, amount: Number(x.amount) })));
    setEvs(e.data || []);
    setErrs(r.data || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  return { accs, buys, tops, evs, errs, loading, load };
}
export function MsPanel({ say }) {
  const ms = useMs(say);
  // Вкладка раздела берётся из адреса: #/packs/<вкладка>
  const route = useRoute();
  const tab = ["packs", "code", "accounts", "log"].includes(route[1]) ? route[1] : "packs";
  const setTab = (t) => go("packs/" + t);
  const [accId, setAccIdS] = useState(() => lsGet("rbx-ms-acc", ""));
  const setAccId = (v) => {
    setAccIdS(v);
    lsSet("rbx-ms-acc", v);
  };
  const acc = ms.accs.find((a) => a.id === accId) || null;
  useEffect(() => {
    if (!acc && ms.accs.length) setAccId(ms.accs[0].id);
  }, [acc, ms.accs.length]);
  const total = ms.accs.reduce((s, a) => s + a.balance, 0);
  const [cart, setCart] = useState({});
  const [bump, setBump] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [fromCart, setFromCart] = useState(false);
  const items = PACKS.filter((p) => cart[p.r]).map((p) => ({ r: p.r, q: cart[p.r] }));
  const add = (r) => {
    setCart((c) => ({ ...c, [r]: Math.min(50, (c[r] || 0) + 1) }));
    setBump((b) => b + 1);
  };
  const dec = (r) =>
    setCart((c) => {
      const x = { ...c };
      const v = (x[r] || 0) - 1;
      if (v > 0) x[r] = v;
      else delete x[r];
      return x;
    });
  function tryPay(list, cartPay = false) {
    if (!acc) {
      say("Сначала добавь аккаунт Microsoft во вкладке «Аккаунты».", "err");
      return false;
    }
    const t = sum(list);
    if (t > acc.balance + 1e-9) {
      say(`Недостаточно денег: на ${acc.email} ${usd(acc.balance)}, нужно ${usd(t)}`, "err");
      return false;
    }
    setFromCart(cartPay);
    setConfirm(list);
    return true;
  }
  async function pay(list) {
    if (!acc) return;
    const { data, error } = await supabase.rpc("ms_buy", { p_account: acc.id, p_items: list });
    if (error) {
      say(errText(error), "err");
      return;
    }
    const p = data;
    say(`Заказ ${p.order_no}: ${n(p.robux)} R$ за ${usd(Number(p.amount))}`);
    setConfirm(null);
    if (fromCart) {
      setCart({});
      setDrawer(false);
    }
    ms.load();
  }
  const accOpts = ms.accs.map((a) => ({ value: a.id, label: a.email, hint: usd(a.balance) }));
  return React.createElement(
    "section",
    { className: "ms" },
    React.createElement(
      "nav",
      { className: "tabs ms-tabs", role: "tablist" },
      [
        ["packs", "Наборы Robux"],
        ["code", "Активация"],
        ["accounts", "Аккаунты", String(ms.accs.length)],
        ["log", "Журнал"],
      ].map(([k, t, c]) =>
        React.createElement(
          "a",
          {
            key: k,
            role: "tab",
            "aria-selected": tab === k,
            className: "tab-link" + (tab === k ? " on" : ""),
            href: href("packs/" + k),
          },
          t,
          c && React.createElement("sup", null, c),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "ms-bar" },
      React.createElement(
        "div",
        { className: "ms-work" },
        React.createElement("span", null, "Работаем с"),
        React.createElement(Dropdown, {
          id: "ms-working",
          value: acc?.id || "",
          onChange: setAccId,
          options: accOpts,
          placeholder: "аккаунтов нет — добавь во вкладке «Аккаунты»",
        }),
      ),
      React.createElement("span", { className: "ms-sep" }),
      React.createElement(
        "span",
        { className: "ms-kv" },
        React.createElement("span", null, "Баланс"),
        React.createElement("b", null, React.createElement(Num, { value: acc?.balance || 0, fmt: usd })),
      ),
      React.createElement(
        "span",
        { className: "ms-kv" },
        React.createElement("span", null, "Всего на ", ms.accs.length, " аккаунтах"),
        React.createElement("b", null, React.createElement(Num, { value: total, fmt: usd })),
      ),
    ),
    React.createElement(
      "div",
      { className: "view-in", key: tab },
      tab === "packs" &&
        React.createElement(Packs, {
          ms: ms,
          acc: acc,
          total: total,
          cart: cart,
          add: add,
          onBuy: (r) => tryPay([{ r, q: 1 }]),
          openCart: () => setDrawer(true),
          say: say,
        }),
      tab === "code" &&
        React.createElement(Codes, { ms: ms, acc: acc, accOpts: accOpts, setAccId: setAccId, say: say }),
      tab === "accounts" &&
        React.createElement(MsAccounts, { ms: ms, accId: accId, setAccId: setAccId, say: say }),
      tab === "log" && React.createElement(MsLog, { ms: ms }),
    ),
    tab === "packs" &&
      items.length > 0 &&
      !drawer &&
      React.createElement(
        "button",
        { key: bump, className: "cart-fab", onClick: () => setDrawer(true), "aria-label": "Открыть корзину" },
        React.createElement(
          "svg",
          { width: "20", height: "20", viewBox: "0 0 24 24", "aria-hidden": "true" },
          React.createElement("path", {
            d: "M3 4h2.2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L21 8H6.3",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }),
          React.createElement("circle", { cx: "9.5", cy: "20", r: "1.4", fill: "currentColor" }),
          React.createElement("circle", { cx: "17", cy: "20", r: "1.4", fill: "currentColor" }),
        ),
        React.createElement(
          "span",
          { className: "cf-t" },
          React.createElement(
            "b",
            null,
            "Корзина · ",
            items.reduce((s, i) => s + i.q, 0),
          ),
          React.createElement("em", null, n(sumR(items)), " R$ · ", usd(sum(items))),
        ),
      ),
    drawer &&
      React.createElement(CartDrawer, {
        items: items,
        acc: acc,
        accOpts: accOpts,
        setAccId: setAccId,
        add: add,
        dec: dec,
        onClear: () => {
          setCart({});
          setDrawer(false);
        },
        onClose: () => setDrawer(false),
        onPay: () => tryPay(items, true),
      }),
    confirm &&
      acc &&
      React.createElement(ConfirmBuy, {
        items: confirm,
        acc: acc,
        onCancel: () => setConfirm(null),
        onOk: () => pay(confirm),
      }),
  );
}
function Head({ title, text, action }) {
  return React.createElement(
    "div",
    { className: "ms-head" },
    React.createElement(
      "div",
      null,
      React.createElement("h1", null, title),
      React.createElement("p", null, text),
    ),
    action,
  );
}
function useEsc(fn) {
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") fn();
    };
    document.addEventListener("keydown", k);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", k);
      document.body.classList.remove("modal-open");
    };
  }, []);
}
function PayLines({ acc, total }) {
  const after = acc.balance - total;
  return React.createElement(
    "dl",
    { className: "modal-list" },
    React.createElement(
      "div",
      null,
      React.createElement("dt", null, "Оплата с аккаунта"),
      React.createElement("dd", null, acc.email),
    ),
    React.createElement(
      "div",
      null,
      React.createElement("dt", null, "Баланс сейчас"),
      React.createElement("dd", { className: "num" }, usd(acc.balance)),
    ),
    React.createElement(
      "div",
      null,
      React.createElement("dt", null, "К оплате"),
      React.createElement("dd", { className: "num" }, "−", usd(total)),
    ),
    React.createElement(
      "div",
      { className: after < 0 ? "neg" : "pos" },
      React.createElement("dt", null, "Баланс после оплаты"),
      React.createElement("dd", { className: "num" }, usd(after)),
    ),
  );
}
function CartDrawer({ items, acc, accOpts, setAccId, add, dec, onClear, onClose, onPay }) {
  useEsc(onClose);
  const t = sum(items);
  return React.createElement(
    "div",
    {
      className: "drawer-back",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
    },
    React.createElement(
      "aside",
      { className: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Корзина" },
      React.createElement(
        "div",
        { className: "drawer-h" },
        React.createElement("h2", null, "Корзина"),
        React.createElement("button", { className: "ghost", onClick: onClose, "aria-label": "Закрыть" }, "✕"),
      ),
      !items.length
        ? React.createElement("div", { className: "empty" }, "Корзина пуста. Добавь наборы плюсом.")
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "ul",
              { className: "cart-list" },
              items.map((i) =>
                React.createElement(
                  "li",
                  { key: i.r },
                  React.createElement(
                    "span",
                    { className: "ci-r" },
                    React.createElement(Rbx, null),
                    React.createElement("b", { className: "num" }, n(i.r)),
                  ),
                  React.createElement(
                    "span",
                    { className: "ms-qty" },
                    React.createElement(
                      "button",
                      { className: "mini-btn", onClick: () => dec(i.r), "aria-label": "Убрать один" },
                      "−",
                    ),
                    React.createElement("b", { className: "num" }, i.q),
                    React.createElement(
                      "button",
                      { className: "mini-btn", onClick: () => add(i.r), "aria-label": "Добавить один" },
                      "+",
                    ),
                  ),
                  React.createElement("span", { className: "num ci-p" }, usd(price(i.r) * i.q)),
                ),
              ),
            ),
            React.createElement(
              "div",
              { className: "cart-total" },
              React.createElement("span", null, "Итого"),
              React.createElement(
                "b",
                { className: "num" },
                n(sumR(items)),
                " ",
                React.createElement(Rbx, null),
                " · ",
                usd(t),
              ),
            ),
            React.createElement(
              "div",
              { className: "drawer-acc" },
              React.createElement("span", { className: "cap" }, "Оплата с аккаунта"),
              React.createElement(Dropdown, {
                value: acc?.id || "",
                onChange: setAccId,
                options: accOpts,
                placeholder: "нет аккаунтов",
              }),
            ),
            acc && React.createElement(PayLines, { acc: acc, total: t }),
            React.createElement(
              "div",
              { className: "drawer-actions" },
              React.createElement("button", { className: "ghost", onClick: onClear }, "Очистить"),
              React.createElement("button", { className: "primary big", onClick: onPay }, "Оформить"),
            ),
          ),
    ),
  );
}
function ConfirmBuy({ items, acc, onCancel, onOk }) {
  const [busy, setBusy] = useState(false);
  useEsc(onCancel);
  const t = sum(items);
  return React.createElement(
    "div",
    {
      className: "modal-back",
      onClick: (e) => {
        if (e.target === e.currentTarget) onCancel();
      },
    },
    React.createElement(
      "div",
      { className: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "buy-title" },
      React.createElement("div", { className: "modal-badge" }, "Microsoft · наборы Robux"),
      React.createElement("h2", { id: "buy-title" }, "Подтвердите заказ"),
      React.createElement(
        "div",
        { className: "modal-sum num" },
        n(sumR(items)),
        " ",
        React.createElement(Rbx, null),
      ),
      React.createElement(
        "dl",
        { className: "modal-list" },
        items.map((i) =>
          React.createElement(
            "div",
            { key: i.r },
            React.createElement("dt", null, n(i.r), " R$ × ", i.q),
            React.createElement("dd", { className: "num" }, usd(price(i.r) * i.q)),
          ),
        ),
      ),
      React.createElement(PayLines, { acc: acc, total: t }),
      React.createElement(
        "div",
        { className: "modal-actions" },
        React.createElement("button", { type: "button", className: "ghost", onClick: onCancel }, "Отмена"),
        React.createElement(
          "button",
          {
            type: "button",
            className: "primary big",
            autoFocus: true,
            disabled: busy,
            onClick: async () => {
              setBusy(true);
              await onOk();
              setBusy(false);
            },
          },
          busy ? "Оплачиваю…" : `Оплатить ${usd(t)}`,
        ),
      ),
    ),
  );
}
function Packs({ ms, acc, total, cart, add, onBuy, openCart, say }) {
  const [logs, setLogs] = useState(true);
  const [all, setAll] = useState(false);
  const [allH, setAllH] = useState(false);
  const [hist, setHist] = useState(true);
  const [ref, setRef] = useState(false);
  const [open, setOpen] = useState(null);
  const ok = ms.buys.filter((b) => b.status === "ok" && today(b.created_at));
  const robuxToday = ok.reduce((s, b) => s + b.robux, 0),
    spentToday = ok.reduce((s, b) => s + b.amount, 0);
  const errCount = ms.buys.filter((b) => b.status === "error").length;
  const items = PACKS.filter((p) => cart[p.r]).map((p) => ({ r: p.r, q: cart[p.r] }));
  const evs = all ? ms.evs : ms.evs.slice(0, 6);
  const rows = hist ? ms.buys.slice(0, allH ? 200 : 5) : [];
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Head, {
      title: "Покупка наборов Robux",
      text: "«Купить» — оплата одного набора с выбранного аккаунта. Плюсом соберите несколько наборов в корзину и оплатите одним заказом.",
    }),
    React.createElement(
      "div",
      { className: "ms-stats stagger" },
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Выдано сегодня"),
        React.createElement(
          "span",
          { className: "v accent" },
          React.createElement(Num, { value: robuxToday, fmt: n }),
          " ",
          React.createElement(Rbx, null),
        ),
        React.createElement("span", { className: "h" }, "за ", ok.length, " покупок"),
      ),
      React.createElement(
        "div",
        { className: "cart-tile" },
        React.createElement("span", { className: "k" }, "Корзина"),
        React.createElement(
          "span",
          { className: "v" },
          items.length
            ? React.createElement(React.Fragment, null, n(sumR(items)), " ", React.createElement(Rbx, null))
            : "пусто",
        ),
        React.createElement(
          "span",
          { className: "h" },
          items.length ? usd(sum(items)) : "наберите наборы плюсом",
        ),
        React.createElement(
          "button",
          { className: "primary small cart-go", disabled: !items.length, onClick: openCart },
          "Оформить корзину →",
        ),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Потрачено сегодня"),
        React.createElement(
          "span",
          { className: "v" },
          React.createElement(Num, { value: spentToday, fmt: usd }),
        ),
        React.createElement("span", { className: "h" }, "последняя ", ok[0] ? tm(ok[0].created_at) : "—"),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Баланс текущего аккаунта"),
        React.createElement(
          "span",
          { className: "v" },
          React.createElement(Num, { value: acc?.balance || 0, fmt: usd }),
        ),
        React.createElement("span", { className: "h" }, acc?.email || "аккаунт не выбран"),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Общий баланс всех почт"),
        React.createElement(
          "span",
          { className: "v accent" },
          React.createElement(Num, { value: total, fmt: usd }),
        ),
        React.createElement(
          "span",
          { className: "h" },
          ms.accs.length,
          " аккаунтов · баланс отмечается вручную",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "card ms-card" },
      React.createElement("div", { className: "ms-card-h" }, React.createElement("h2", null, "Наборы")),
      React.createElement(
        "div",
        { className: "ms-packs stagger" },
        PACKS.map((p) =>
          React.createElement(
            "div",
            { key: p.r, className: "ms-pack" + (cart[p.r] ? " in" : "") },
            cart[p.r] ? React.createElement("span", { className: "pk-badge num" }, "×", cart[p.r]) : null,
            React.createElement(
              "div",
              { className: "pk-ic", "aria-hidden": "true" },
              React.createElement(Rbx, null),
            ),
            React.createElement(
              "div",
              { className: "pk-r num" },
              n(p.r),
              React.createElement("span", null, "R$"),
            ),
            React.createElement("div", { className: "pk-usd num" }, usd(p.usd)),
            React.createElement(
              "div",
              { className: "ms-pack-bot" },
              React.createElement("button", { className: "primary", onClick: () => onBuy(p.r) }, "Купить"),
              React.createElement(
                "button",
                {
                  className: "mini-btn plus-btn",
                  "aria-label": `Добавить ${p.r} R$ в корзину`,
                  onClick: () => add(p.r),
                },
                "+",
              ),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "card ms-card" },
      React.createElement(
        "div",
        { className: "ms-card-h" },
        React.createElement("h2", null, "Логи"),
        React.createElement("span", { className: "tag" + (errCount ? " errc" : "") }, errCount, " ошибок"),
        React.createElement("span", { className: "grow" }),
        React.createElement(
          "button",
          {
            className: "small",
            onClick: () => {
              setLogs(true);
              setAll(!all);
            },
          },
          all ? "Свернуть" : "Развернуть",
        ),
        React.createElement(
          "button",
          {
            className: "small",
            onClick: () => download("logs.txt", ms.evs.map((e) => `${dt(e.at)}  ${e.text}`).join("\n")),
          },
          "Сохранить файлом",
        ),
        React.createElement(
          "button",
          { className: "small", onClick: () => setLogs(!logs) },
          logs ? "Скрыть" : "Показать",
        ),
      ),
      logs &&
        (!ms.evs.length
          ? React.createElement(
              "div",
              { className: "empty" },
              "Логов пока нет. Здесь появятся заказы, пополнения и ошибки.",
            )
          : React.createElement(
              "ul",
              { className: "ev-list" },
              evs.map((e) =>
                React.createElement(
                  "li",
                  { key: e.id, className: e.kind },
                  React.createElement("span", { className: "num" }, tm(e.at)),
                  React.createElement("i", null),
                  e.text,
                ),
              ),
            )),
      logs &&
        ms.evs.length > evs.length &&
        React.createElement(
          "div",
          { className: "more" },
          React.createElement(
            "button",
            { onClick: () => setAll(true) },
            "Показать ещё ",
            ms.evs.length - evs.length,
          ),
        ),
      React.createElement(
        "button",
        { className: "ref-toggle", onClick: () => setRef(!ref), "aria-expanded": ref },
        "Коды ошибок Microsoft ",
        React.createElement("span", null, ref ? "▴" : "▾"),
      ),
      ref &&
        React.createElement(
          "div",
          { className: "err-ref" },
          ms.errs.map((e) =>
            React.createElement(
              "div",
              { key: e.code },
              React.createElement("b", { className: "num" }, e.code),
              React.createElement("span", null, React.createElement("strong", null, e.title), e.hint),
            ),
          ),
        ),
    ),
    React.createElement(
      "div",
      { className: "card ms-card" },
      React.createElement(
        "div",
        { className: "ms-card-h" },
        React.createElement("h2", null, "История покупок"),
        React.createElement(
          "span",
          { className: "tag" },
          "последние ",
          Math.min(ms.buys.length, all ? 200 : 5),
          " из ",
          ms.buys.length,
        ),
        React.createElement("span", { className: "grow" }),
        React.createElement(
          "button",
          {
            className: "small",
            onClick: () => {
              setHist(true);
              setAllH(!allH);
            },
          },
          allH ? "Свернуть" : "Развернуть",
        ),
        React.createElement(
          "button",
          { className: "small", onClick: () => setHist(!hist) },
          hist ? "Скрыть" : "Показать",
        ),
      ),
      hist &&
        React.createElement(
          "div",
          { className: "tbl" },
          React.createElement(
            "table",
            null,
            React.createElement(
              "thead",
              null,
              React.createElement(
                "tr",
                null,
                React.createElement("th", null, "Заказ"),
                React.createElement("th", null, "Дата и время"),
                React.createElement("th", { className: "n" }, "Robux"),
                React.createElement("th", { className: "n" }, "Сумма"),
                React.createElement("th", null, "Аккаунт"),
                React.createElement("th", null, "Статус"),
                React.createElement("th", null),
              ),
            ),
            React.createElement(
              "tbody",
              null,
              !rows.length
                ? React.createElement(
                    "tr",
                    null,
                    React.createElement("td", { colSpan: 7, className: "empty-cell" }, "Покупок пока нет."),
                  )
                : rows.map((b) =>
                    React.createElement(
                      "tr",
                      { key: b.id },
                      React.createElement(
                        "td",
                        { className: "num" },
                        React.createElement("b", null, b.order_no),
                      ),
                      React.createElement("td", { className: "num" }, dt(b.created_at)),
                      React.createElement("td", { className: "n num accent" }, n(b.robux)),
                      React.createElement("td", { className: "n num" }, usd(b.amount)),
                      React.createElement("td", { className: "tag" }, b.account_email || "—"),
                      React.createElement(
                        "td",
                        null,
                        b.status === "ok"
                          ? React.createElement("span", { className: "pill ok" }, "выдано")
                          : React.createElement("span", { className: "pill bad" }, "ошибка ", b.error_code),
                      ),
                      React.createElement(
                        "td",
                        { className: "actions" },
                        React.createElement(
                          "button",
                          { className: "small", onClick: () => setOpen(b) },
                          "Открыть",
                        ),
                      ),
                    ),
                  ),
            ),
          ),
        ),
    ),
    open &&
      React.createElement(OrderModal, {
        p: open,
        errs: ms.errs,
        onClose: () => setOpen(null),
        onDone: () => {
          setOpen(null);
          ms.load();
        },
        say: say,
      }),
  );
}
function OrderModal({ p, errs, onClose, onDone, say }) {
  useEsc(onClose);
  const [code, setCode] = useState("412");
  const e = errs.find((x) => x.code === p.error_code);
  async function mark() {
    const { error } = await supabase.rpc("ms_mark_error", { p_purchase: p.id, p_code: Number(code) });
    if (error) {
      say(errText(error), "err");
      return;
    }
    say(`Заказ ${p.order_no} отмечен ошибкой ${code}, ${usd(p.amount)} вернулись на аккаунт`);
    onDone();
  }
  return React.createElement(
    "div",
    {
      className: "modal-back",
      onClick: (x) => {
        if (x.target === x.currentTarget) onClose();
      },
    },
    React.createElement(
      "div",
      { className: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "ord-title" },
      React.createElement("div", { className: "modal-badge" }, p.status === "ok" ? "выдано" : "ошибка"),
      React.createElement("h2", { id: "ord-title" }, p.order_no),
      React.createElement(
        "div",
        { className: "modal-sum num" },
        n(p.robux),
        " ",
        React.createElement(Rbx, null),
      ),
      React.createElement(
        "dl",
        { className: "modal-list" },
        p.items.map((i) =>
          React.createElement(
            "div",
            { key: i.r },
            React.createElement("dt", null, n(i.r), " R$ × ", i.q),
            React.createElement("dd", { className: "num" }, usd(price(i.r) * i.q)),
          ),
        ),
        React.createElement(
          "div",
          null,
          React.createElement("dt", null, "Сумма"),
          React.createElement("dd", { className: "num" }, usd(p.amount)),
        ),
        React.createElement(
          "div",
          null,
          React.createElement("dt", null, "Аккаунт"),
          React.createElement("dd", null, p.account_email || "—"),
        ),
        React.createElement(
          "div",
          null,
          React.createElement("dt", null, "Время"),
          React.createElement("dd", { className: "num" }, dt(p.created_at)),
        ),
        e &&
          React.createElement(
            "div",
            { className: "neg" },
            React.createElement("dt", null, "Ошибка ", e.code),
            React.createElement("dd", null, e.title),
          ),
      ),
      e && React.createElement("div", { className: "msg" }, e.hint),
      p.status === "ok" &&
        React.createElement(
          "div",
          { className: "mark-err" },
          React.createElement(
            "span",
            { className: "cap" },
            "Если покупка не прошла — отметь ошибку, деньги вернутся на аккаунт",
          ),
          React.createElement(
            "div",
            { className: "ms-row" },
            React.createElement(Dropdown, {
              value: code,
              onChange: setCode,
              options: errs.map((x) => ({ value: String(x.code), label: String(x.code), hint: x.title })),
            }),
            React.createElement("button", { className: "danger", onClick: mark }, "Отметить ошибку"),
          ),
        ),
      React.createElement(
        "div",
        { className: "modal-actions" },
        React.createElement("button", { className: "primary big", onClick: onClose }, "Закрыть"),
      ),
    ),
  );
}
const MS_CODE = /[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}|(?<![A-Z0-9])[A-Z0-9]{25}(?![A-Z0-9])/;
const ANY_CODE = /[A-Z0-9][A-Z0-9-]{7,63}/;
const AMT_SIGN =
  /\$\s*(\d{1,4}(?:[.,]\d{1,2})?)|(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:\$|usd\b|долл|dollars?\b|бакс)/i;
const AMT_PLAIN = /(?:^|[\s;,|:=\t])(\d{1,4}(?:[.,]\d{1,2})?)(?=$|[\s;,|])/;
function parseCodes(text) {
  const out = [];
  const seen = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.toUpperCase();
    let m = line.match(MS_CODE) || line.match(ANY_CODE);
    if (!m) continue;
    let code = m[0];
    if (/^[A-Z0-9]{25}$/.test(code)) code = code.match(/.{5}/g).join("-");
    if (!/[A-Z]/.test(code) && !/-/.test(code)) continue; // чисто число — это не код
    const key = code.replace(/-/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const rest = " " + raw.slice(0, m.index) + " " + raw.slice((m.index || 0) + m[0].length) + " ";
    const a = rest.match(AMT_SIGN);
    let amount = null;
    if (a) amount = Number((a[1] || a[2]).replace(",", "."));
    else {
      const p = rest.match(AMT_PLAIN);
      if (p) amount = Number(p[1].replace(",", "."));
    }
    if (amount !== null && !(amount > 0 && amount <= 1000)) amount = null;
    out.push({ code, key, amount });
  }
  return out;
}
function Codes({ ms, acc, accOpts, setAccId, say }) {
  const [codes, setCodes] = useState("");
  const [manual, setManual] = useState({});
  const [busy, setBusy] = useState(false);
  const known = useMemo(() => new Set(ms.tops.map((t) => t.code.replace(/-/g, "").toUpperCase())), [ms.tops]);
  const parsed = useMemo(() => parseCodes(codes), [codes]);
  const rows = parsed.map((p) => ({ ...p, dup: known.has(p.key), value: p.amount ?? manual[p.key] ?? null }));
  const fresh = rows.filter((r) => !r.dup);
  const missing = fresh.filter((r) => r.value === null);
  const sum = fresh.reduce((a, r) => a + (r.value || 0), 0);
  async function go() {
    if (!acc) {
      say("Сначала добавь аккаунт Microsoft.", "err");
      return;
    }
    if (!fresh.length) {
      say("Новых кодов нет: все эти коды уже вносились.", "err");
      return;
    }
    if (missing.length) {
      say(`У ${missing.length} код(ов) не найдена сумма — выбери её в строке кода.`, "err");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("ms_topup_items", {
      p_account: acc.id,
      p_items: fresh.map((r) => ({ code: r.code, amount: r.value })),
    });
    setBusy(false);
    if (error) {
      say(errText(error), "err");
      return;
    }
    const res = data;
    if (!res.count) say("Новых кодов нет: все эти коды уже вносились.", "err");
    else {
      say(`Зачислено ${res.count} код(ов): +${usd(Number(res.sum))} на ${acc.email}`);
      setCodes("");
      setManual({});
      ms.load();
    }
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Head, {
      title: "Пополнение баланса Microsoft",
      text: "Вставьте коды как есть — сайт сам найдёт код и его сумму в строке ($25, 25$, 25 usd или «код 25»). Каждый код вносится один раз, повторы отсекаются.",
    }),
    React.createElement(
      "div",
      { className: "ms-split" },
      React.createElement(
        "div",
        { className: "card ms-card ms-form" },
        React.createElement(
          "div",
          { className: "ms-card-h" },
          React.createElement("h2", null, "Внести коды"),
        ),
        React.createElement(
          "div",
          { className: "fld" },
          React.createElement("span", { className: "cap" }, "Почта Microsoft"),
          React.createElement(Dropdown, {
            value: acc?.id || "",
            onChange: setAccId,
            options: accOpts,
            placeholder: "нет аккаунтов",
          }),
        ),
        React.createElement(
          "label",
          null,
          "Коды, по одному в строке",
          React.createElement("textarea", {
            rows: 6,
            value: codes,
            onChange: (e) => setCodes(e.target.value),
            placeholder: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX $25\nXXXXX-XXXXX-XXXXX-XXXXX-XXXXX 10$",
            spellCheck: false,
            autoComplete: "off",
          }),
        ),
        rows.length > 0 &&
          React.createElement(
            "div",
            { className: "code-list" },
            rows.map((r) =>
              React.createElement(
                "div",
                {
                  key: r.key,
                  className: "code-row row-in" + (r.dup ? " dup" : r.value === null ? " need" : ""),
                },
                React.createElement("span", { className: "mono cr-code" }, r.code),
                r.dup
                  ? React.createElement("span", { className: "pill idle" }, "уже вносился")
                  : r.amount !== null
                    ? React.createElement(
                        "span",
                        { className: "cr-amt" },
                        usd(r.amount),
                        React.createElement("small", null, "найдено"),
                      )
                    : React.createElement(
                        "span",
                        { className: "cr-pick" },
                        React.createElement("small", null, "сумма?"),
                        [10, 25, 50, 100].map((v) =>
                          React.createElement(
                            "button",
                            {
                              key: v,
                              type: "button",
                              className: "chip-btn sm" + (manual[r.key] === v ? " on" : ""),
                              onClick: () => setManual({ ...manual, [r.key]: v }),
                            },
                            "$",
                            v,
                          ),
                        ),
                      ),
              ),
            ),
          ),
        React.createElement(
          "span",
          { className: "tag" },
          rows.length
            ? React.createElement(
                React.Fragment,
                null,
                "Новых кодов: ",
                React.createElement("b", null, fresh.length),
                " · к зачислению ",
                React.createElement("b", { className: "accent" }, usd(sum)),
                missing.length
                  ? React.createElement(
                      React.Fragment,
                      null,
                      " · без суммы: ",
                      React.createElement("b", { className: "bad" }, missing.length),
                    )
                  : null,
              )
            : "Можно вставить сразу пачку.",
        ),
        React.createElement(
          "span",
          { className: "ms-row" },
          React.createElement(
            "button",
            { className: "primary", disabled: !fresh.length || busy || !!missing.length, onClick: go },
            busy ? "Зачисляю…" : "Внести и зачислить",
          ),
          React.createElement(
            "button",
            {
              className: "small",
              disabled: !codes,
              onClick: () => {
                setCodes("");
                setManual({});
              },
            },
            "Очистить",
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "card ms-card" },
        React.createElement(
          "div",
          { className: "ms-card-h" },
          React.createElement("h2", null, "История пополнений"),
          React.createElement("span", { className: "grow" }),
          React.createElement("span", { className: "ms-pill" }, ms.tops.length, " зачислено"),
        ),
        React.createElement(
          "div",
          { className: "tbl" },
          React.createElement(
            "table",
            null,
            React.createElement(
              "thead",
              null,
              React.createElement(
                "tr",
                null,
                React.createElement("th", null, "Код"),
                React.createElement("th", { className: "n" }, "Сумма"),
                React.createElement("th", null, "Аккаунт"),
                React.createElement("th", null, "Время"),
                React.createElement("th", null, "Статус"),
              ),
            ),
            React.createElement(
              "tbody",
              null,
              !ms.tops.length
                ? React.createElement(
                    "tr",
                    null,
                    React.createElement(
                      "td",
                      { colSpan: 5, className: "empty-cell" },
                      "Пополнений пока нет.",
                    ),
                  )
                : ms.tops.map((t) =>
                    React.createElement(
                      "tr",
                      { key: t.id },
                      React.createElement("td", { className: "num mono" }, t.code),
                      React.createElement("td", { className: "n num accent" }, usd(t.amount)),
                      React.createElement("td", { className: "tag" }, t.account_email || "—"),
                      React.createElement("td", { className: "num" }, dt(t.created_at)),
                      React.createElement(
                        "td",
                        null,
                        React.createElement("span", { className: "pill ok" }, "зачислено"),
                      ),
                    ),
                  ),
            ),
          ),
        ),
      ),
    ),
  );
}
function MsAccounts({ ms, accId, setAccId, say }) {
  const [add, setAdd] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("bal");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [only, setOnly] = useState("");
  let list = ms.accs.filter(
    (a) =>
      (!q || a.email.toLowerCase().includes(q.toLowerCase())) &&
      (from === "" || a.balance >= Number(from)) &&
      (to === "" || a.balance <= Number(to)) &&
      (only !== "money" || a.balance > 0) &&
      (only !== "empty" || a.balance <= 0),
  );
  list = [...list].sort((a, b) =>
    sort === "bal"
      ? b.balance - a.balance
      : sort === "email"
        ? a.email.localeCompare(b.email)
        : +new Date(b.created_at) - +new Date(a.created_at),
  );
  const shownSum = list.reduce((s, a) => s + a.balance, 0);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Head, {
      title: "Аккаунты Microsoft",
      text: "Все почты профиля. «Работаем с» выбирает аккаунт, с которого идёт оплата наборов.",
      action: React.createElement(
        "button",
        { className: "primary", onClick: () => setAdd(true) },
        "Добавить аккаунт",
      ),
    }),
    React.createElement(
      "div",
      { className: "card ms-card" },
      React.createElement(
        "div",
        { className: "ms-filters" },
        React.createElement(
          "span",
          { className: "ms-row" },
          React.createElement("span", { className: "ms-pill" }, "Баланс отмечается вручную"),
          React.createElement("span", { className: "ms-chip" }, ms.accs.length, " аккаунтов"),
          React.createElement(
            "span",
            { className: "ms-chip" },
            "С паролем: ",
            ms.accs.filter((a) => a.password).length,
          ),
        ),
        React.createElement(
          "div",
          { className: "ms-row grow-row" },
          React.createElement("input", {
            type: "search",
            placeholder: "Поиск по почте",
            value: q,
            onChange: (e) => setQ(e.target.value),
            ...noFill("mssearch"),
          }),
          React.createElement(
            "div",
            { className: "sort-dd" },
            React.createElement(Dropdown, {
              value: sort,
              onChange: setSort,
              options: [
                { value: "bal", label: "Сначала с балансом" },
                { value: "new", label: "Сначала новые" },
                { value: "email", label: "По почте" },
              ],
            }),
          ),
          React.createElement(
            "span",
            { className: "tag" },
            "Показано ",
            list.length,
            " из ",
            ms.accs.length,
            " · ",
            React.createElement("b", { className: "accent" }, usd(shownSum)),
          ),
        ),
        React.createElement(
          "div",
          { className: "ms-row" },
          React.createElement("span", { className: "tag up" }, "Баланс, $"),
          React.createElement("input", {
            className: "w-num",
            type: "number",
            placeholder: "от",
            value: from,
            onChange: (e) => setFrom(e.target.value),
          }),
          React.createElement("span", { className: "tag" }, "—"),
          React.createElement("input", {
            className: "w-num",
            type: "number",
            placeholder: "до",
            value: to,
            onChange: (e) => setTo(e.target.value),
          }),
          React.createElement(
            "button",
            {
              className: "small" + (only === "money" ? " on" : ""),
              onClick: () => setOnly(only === "money" ? "" : "money"),
            },
            "Только с деньгами",
          ),
          React.createElement(
            "button",
            {
              className: "small" + (only === "empty" ? " on" : ""),
              onClick: () => setOnly(only === "empty" ? "" : "empty"),
            },
            "Только пустые",
          ),
          React.createElement(
            "button",
            {
              className: "small",
              onClick: () => {
                setQ("");
                setFrom("");
                setTo("");
                setOnly("");
                setSort("bal");
              },
            },
            "Сбросить",
          ),
        ),
      ),
      !ms.accs.length
        ? React.createElement(
            "div",
            { className: "empty" },
            "Аккаунтов Microsoft пока нет. Нажмите «Добавить аккаунт».",
          )
        : !list.length
          ? React.createElement("div", { className: "empty" }, "По фильтрам ничего не найдено.")
          : React.createElement(
              "div",
              { className: "msa-grid stagger" },
              list.map((a) =>
                React.createElement(MsAccCard, {
                  key: a.id,
                  a: a,
                  cur: a.id === accId,
                  onCur: () => setAccId(a.id),
                  reload: ms.load,
                  say: say,
                }),
              ),
            ),
    ),
    add &&
      React.createElement(AddMsAcc, {
        onClose: () => setAdd(false),
        onDone: (id) => {
          setAdd(false);
          ms.load();
          if (!accId) setAccId(id);
        },
        say: say,
      }),
  );
}
function MsAccCard({ a, cur, onCur, reload, say }) {
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(false);
  const [bal, setBal] = useState(String(a.balance));
  const [del, setDel] = useState(false);
  async function copy(t, w) {
    try {
      await navigator.clipboard.writeText(t);
      say(`${w} скопирован`);
    } catch {
      say("Не удалось скопировать", "err");
    }
  }
  async function saveBal() {
    const v = Number(bal);
    if (!(v >= 0)) {
      say("Баланс должен быть числом от 0", "err");
      return;
    }
    const { error } = await supabase
      .from("ms_accounts")
      .update({ balance: Math.round(v * 100) / 100 })
      .eq("id", a.id);
    if (error) {
      say(errText(error), "err");
      return;
    }
    await supabase
      .from("ms_events")
      .insert({ kind: "info", text: `Баланс ${a.email} изменён вручную: ${usd(a.balance)} → ${usd(v)}` });
    setEdit(false);
    say("Баланс сохранён");
    reload();
  }
  async function remove() {
    const { error } = await supabase.from("ms_accounts").delete().eq("id", a.id);
    if (error) {
      say(errText(error), "err");
      return;
    }
    await supabase.from("ms_events").insert({ kind: "info", text: `Удалён аккаунт ${a.email}` });
    say("Аккаунт удалён");
    reload();
  }
  return React.createElement(
    "div",
    { className: "msa" + (cur ? " cur" : "") },
    React.createElement(
      "div",
      { className: "msa-strip" },
      cur
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement("span", { className: "dot" }),
            "Работаем с этим аккаунтом",
          )
        : React.createElement(
            "button",
            { className: "link-btn", onClick: onCur },
            "Запасной — сделать основным",
          ),
    ),
    React.createElement(
      "div",
      { className: "msa-row" },
      React.createElement("span", { className: "msa-email mono", title: a.email }, a.email),
      React.createElement(
        "button",
        { className: "icon-btn", onClick: () => copy(a.email, "Почта"), "aria-label": "Скопировать почту" },
        "⧉",
      ),
    ),
    React.createElement(
      "div",
      { className: "msa-row" },
      React.createElement(
        "span",
        { className: "mono pw" },
        a.password
          ? show
            ? a.password
            : "••••••••"
          : React.createElement("span", { className: "tag" }, "пароль не задан"),
      ),
      a.password &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "button",
            { className: "icon-btn", onClick: () => setShow(!show), "aria-label": "Показать пароль" },
            show ? "◡" : "◉",
          ),
          React.createElement(
            "button",
            {
              className: "icon-btn",
              onClick: () => copy(a.password, "Пароль"),
              "aria-label": "Скопировать пароль",
            },
            "⧉",
          ),
        ),
    ),
    a.note && React.createElement("div", { className: "tag msa-note" }, a.note),
    React.createElement(
      "div",
      { className: "msa-bal" },
      edit
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement("input", {
              type: "number",
              min: "0",
              step: "0.01",
              value: bal,
              onChange: (e) => setBal(e.target.value),
              autoFocus: true,
              ...noFill("msbal"),
            }),
            React.createElement("button", { className: "primary small", onClick: saveBal }, "OK"),
            React.createElement("button", { className: "small", onClick: () => setEdit(false) }, "✕"),
          )
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "b",
              { className: "num" },
              React.createElement(Num, { value: a.balance, fmt: usd }),
            ),
            React.createElement(
              "button",
              {
                className: "icon-btn",
                onClick: () => {
                  setBal(String(a.balance));
                  setEdit(true);
                },
                "aria-label": "Изменить баланс",
              },
              "✎",
            ),
          ),
    ),
    React.createElement(
      "div",
      { className: "msa-actions" },
      del
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement("button", { className: "danger", onClick: remove }, "Удалить навсегда"),
            React.createElement("button", { onClick: () => setDel(false) }, "Нет"),
          )
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "button",
              { onClick: onCur, disabled: cur },
              cur ? "Основной" : "Работать с ним",
            ),
            React.createElement(
              "button",
              { className: "danger-text", onClick: () => setDel(true) },
              "Удалить",
            ),
          ),
    ),
  );
}
function AddMsAcc({ onClose, onDone, say }) {
  useEsc(onClose);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [bal, setBal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      say("Введи почту Microsoft целиком", "err");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("ms_accounts")
      .insert({
        email: em,
        password: pw || null,
        balance: Math.round((Number(bal) || 0) * 100) / 100,
        note: note.trim() || null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      say(/duplicate/i.test(error.message) ? "Такая почта уже добавлена" : errText(error), "err");
      return;
    }
    await supabase.from("ms_events").insert({ kind: "info", text: `Добавлен аккаунт ${em}` });
    say("Аккаунт добавлен");
    onDone(data.id);
  }
  return React.createElement(
    "div",
    {
      className: "modal-back",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
    },
    React.createElement(
      "form",
      {
        className: "modal acc-modal",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "ms-add-title",
        onSubmit: save,
        autoComplete: "off",
        "data-lpignore": "true",
        "data-form-type": "other",
      },
      React.createElement(
        "div",
        { className: "acc-modal-h" },
        React.createElement(
          "span",
          { className: "ms-logo", "aria-hidden": "true" },
          React.createElement(
            "svg",
            { width: "20", height: "20", viewBox: "0 0 24 24" },
            React.createElement("rect", {
              x: "3",
              y: "5",
              width: "18",
              height: "14",
              rx: "2.5",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.8",
            }),
            React.createElement("path", {
              d: "M4 7l8 6 8-6",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.8",
              strokeLinejoin: "round",
            }),
          ),
        ),
        React.createElement(
          "div",
          null,
          React.createElement("h2", { id: "ms-add-title" }, "Новый аккаунт"),
          React.createElement("span", { className: "tag" }, "Microsoft Account"),
        ),
        React.createElement(
          "button",
          { type: "button", className: "ghost close-x", onClick: onClose, "aria-label": "Закрыть" },
          "✕",
        ),
      ),
      React.createElement(
        "label",
        null,
        "Почта Microsoft",
        React.createElement("input", {
          value: email,
          onChange: (e) => setEmail(e.target.value),
          placeholder: "example@outlook.com",
          ...noFill("msmail"),
          autoFocus: true,
        }),
      ),
      React.createElement(
        "label",
        null,
        "Пароль",
        React.createElement(
          "span",
          { className: "pw" },
          React.createElement("input", {
            className: show ? "" : "masked",
            type: "text",
            value: pw,
            onChange: (e) => setPw(e.target.value),
            placeholder: "необязательно",
            ...noFill("mspw"),
          }),
          React.createElement(
            "button",
            { type: "button", className: "ghost mini", onClick: () => setShow(!show) },
            show ? "скрыть" : "показать",
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "two" },
        React.createElement(
          "label",
          null,
          "Баланс, $",
          React.createElement("input", {
            type: "number",
            min: "0",
            step: "0.01",
            value: bal,
            onChange: (e) => setBal(e.target.value),
            placeholder: "0.00",
            ...noFill("msb"),
          }),
        ),
        React.createElement(
          "label",
          null,
          "Заметка",
          React.createElement("input", {
            value: note,
            onChange: (e) => setNote(e.target.value),
            placeholder: "необязательно",
            maxLength: 200,
            ...noFill("msn"),
          }),
        ),
      ),
      React.createElement(
        "div",
        { className: "modal-actions" },
        React.createElement("button", { type: "button", className: "ghost", onClick: onClose }, "Отмена"),
        React.createElement(
          "button",
          { className: "primary big", disabled: busy },
          busy ? "Сохраняю…" : "Добавить",
        ),
      ),
    ),
  );
}
function MsLog({ ms }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Head, {
      title: "Журнал действий",
      text: "Заказы, пополнения, изменения балансов и аккаунтов. Записи не стираются.",
      action: React.createElement(
        "button",
        { onClick: () => download("journal.txt", ms.evs.map((e) => `${dt(e.at)}  ${e.text}`).join("\n")) },
        "Сохранить файлом",
      ),
    }),
    React.createElement(
      "div",
      { className: "card ms-card" },
      !ms.evs.length
        ? React.createElement("div", { className: "empty" }, "Записей пока нет.")
        : React.createElement(
            "ul",
            { className: "ev-list full" },
            ms.evs.map((e) =>
              React.createElement(
                "li",
                { key: e.id, className: e.kind },
                React.createElement("span", { className: "num" }, dt(e.at)),
                React.createElement("i", null),
                e.text,
              ),
            ),
          ),
    ),
  );
}
