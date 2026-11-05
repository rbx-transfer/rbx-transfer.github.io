/*
 * rbx transfer — SendPanel.js
 * Вкладка «Отправка»: работа с аккаунтом, заказ, подтверждение, покупатели.
 * Файл собран из исходника src/SendPanel.ts*.
 */

import { useEffect, useState } from "./vendor/react.js";
import { supabase, errText } from "./supabase.js";
import { calcAccount, fmt, dur, fmtDate, DAY } from "./calc.js";
import { AccessPanel, noFill } from "./VaultUI.js";
import { PlusBadge } from "./Plus.js";
import { Dropdown } from "./ui.js";
const LS = "rbx-working-account";
// ---------- Отправка: «Работаю с…» + заказ + «Отправил» ----------
export function SendPanel({ accounts, transfers, settings, now, say, mode = "transfer" }) {
  const gp = mode === "gamepass";
  const LSK = LS + (gp ? "-gp" : "");
  const ready = accounts.filter((a) => a.status === "ready");
  const [accId, setAccId] = useState(() => {
    try {
      return localStorage.getItem(LSK) || "";
    } catch {
      return "";
    }
  });
  const [buyer, setBuyer] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [force, setForce] = useState(false);
  const [ask, setAsk] = useState(false);
  const [last, setLast] = useState(null);
  const acc = ready.find((a) => a.id === accId) || null;
  useEffect(() => {
    if (!acc && ready.length) setAccId(ready[0].id);
  }, [acc, ready.length]);
  useEffect(() => {
    try {
      if (accId) localStorage.setItem(LSK, accId);
    } catch {
      /* ignore */
    }
  }, [accId]);
  if (!ready.length)
    return React.createElement(
      "section",
      { className: "card onboarding" },
      React.createElement("h2", null, gp ? "Продажа" : "Отправка"),
      React.createElement("p", null, "Сначала добавь аккаунт Roblox во вкладке «Аккаунты»."),
    );
  const r = acc ? calcAccount(acc, transfers, settings, now, mode) : null;
  const amt = Math.round(Number(amount));
  const soldTx = acc
    ? transfers.filter(
        (t) => t.account_id === acc.id && t.kind === "gamepass" && +new Date(t.sent_at) > now - DAY,
      )
    : [];
  const soldToday = soldTx.reduce((x, t) => x + t.amount, 0),
    soldCount = soldTx.length;
  const others = ready
    .filter((a) => a.id !== accId)
    .map((a) => ({ a, r: calcAccount(a, transfers, settings, now, mode) }))
    .filter((x) => x.r.sendable > 0)
    .sort((x, y) => y.r.sendable - x.r.sendable);
  let warn = null;
  if (r && !gp && !r.plus)
    warn = {
      cls: "bad",
      text: "Нет активной подписки Roblox Plus — трансфер с этого аккаунта записать нельзя. Отметь Plus в «Аккаунтах».",
    };
  else if (r && amt > 0) {
    if (amt > r.balance) warn = { cls: "bad", text: `На аккаунте только ${fmt(r.balance)}.` };
    else if (gp) {
      /* у геймпасса лимитов нет */
    } else if (amt > r.dayLeft) {
      const need = amt - r.dayLeft;
      let acc2 = 0,
        when = 0;
      for (const x of r.dayReleases) {
        acc2 += x.amount;
        if (acc2 >= need) {
          when = x.at;
          break;
        }
      }
      warn = {
        cls: "warn",
        text:
          `Сегодня свободно только ${fmt(r.dayLeft)}.` +
          (when ? ` Нужная сумма освободится через ${dur(when - now)}.` : ""),
      };
    } else if (amt > r.monLeft)
      warn = { cls: "warn", text: `До месячного лимита осталось только ${fmt(r.monLeft)}.` };
  }
  const fitting = amt > 0 ? others.filter((x) => x.r.sendable >= amt) : [];
  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      say(`${what} скопирован`);
    } catch {
      say("Не удалось скопировать: выдели и скопируй вручную");
    }
  }
  async function sent(e) {
    e.preventDefault();
    if (!acc || !r) return;
    const b = buyer.trim();
    if (!b) {
      say("Укажи ник покупателя");
      return;
    }
    if (!(amt > 0)) {
      say("Укажи сумму");
      return;
    }
    if (mode === "transfer" && !r.plus) {
      say(`Нельзя записать трансфер: на ${acc.name} нет активной подписки Roblox Plus`, "err");
      return;
    }
    if (amt > r.balance) {
      say(`Недостаточно робуксов: на ${acc.name} ${fmt(r.balance)}, нужно ${fmt(amt)}`, "err");
      return;
    }
    setAsk(true);
  }
  async function confirmSent() {
    if (!acc || !r) return;
    const b = buyer.trim();
    setBusy(true);
    const { error } = await supabase
      .from("transfers")
      .insert({ account_id: acc.id, amount: amt, buyer: b, kind: mode, sent_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      say(errText(error));
      return;
    }
    setLast({ buyer: b, amount: amt, acc: acc.name });
    setBuyer("");
    setAmount("");
    setForce(false);
    setAsk(false);
    say(`Записано: ${fmt(amt)} → ${b} с ${acc.name}`);
  }
  return React.createElement(
    "section",
    { className: "send" },
    React.createElement(
      "div",
      { className: "card send-head" },
      React.createElement(
        "div",
        { className: "send-top" },
        React.createElement(
          "div",
          { className: "working" },
          React.createElement("span", null, "Работаю с"),
          React.createElement(Dropdown, {
            id: "working-account",
            big: true,
            value: accId,
            onChange: (v) => {
              setAccId(v);
              setForce(false);
            },
            options: ready.map((a) => {
              const x = calcAccount(a, transfers, settings, now, mode);
              return { value: a.id, label: a.name, hint: "баланс " + fmt(x.balance) };
            }),
          }),
        ),
        acc && !gp && React.createElement(PlusBadge, { since: acc.plus_since, now: now }),
      ),
      r &&
        React.createElement(
          "div",
          { className: "send-stats" },
          gp
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  "div",
                  { className: "lead" },
                  React.createElement("span", { className: "k" }, "Баланс"),
                  React.createElement("span", { className: "v num" }, fmt(r.balance)),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "k" }, "Продано за 24 ч"),
                  React.createElement("span", { className: "v num" }, fmt(soldToday)),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "k" }, "Продаж за 24 ч"),
                  React.createElement("span", { className: "v num" }, soldCount),
                ),
              )
            : React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  "div",
                  { className: "lead" },
                  React.createElement("span", { className: "k" }, "Доступно сейчас"),
                  React.createElement("span", { className: "v num" }, fmt(r.sendable)),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "k" }, "Баланс"),
                  React.createElement("span", { className: "v num" }, fmt(r.balance)),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "k" }, "Доступно сегодня"),
                  React.createElement("span", { className: "v num" }, fmt(r.dayLeft)),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "k" }, "Доступно в этом месяце"),
                  React.createElement("span", { className: "v num" }, fmt(r.monLeft)),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "k" }, "Ближайший возврат"),
                  React.createElement(
                    "span",
                    { className: "v num sm" },
                    r.dayReleases[0]
                      ? React.createElement(
                          React.Fragment,
                          null,
                          "+",
                          fmt(r.dayReleases[0].amount),
                          " ",
                          React.createElement("em", null, "через ", dur(r.dayReleases[0].at - now)),
                        )
                      : "—",
                  ),
                ),
              ),
        ),
      acc &&
        React.createElement(AccessPanel, {
          acc: acc,
          now: now,
          say: say,
          onSetup: () => say("Добавь пароль и 2FA во вкладке «Аккаунты» → изменить"),
        }),
    ),
    React.createElement(
      "form",
      {
        className: "card send-form",
        onSubmit: sent,
        autoComplete: "off",
        "data-lpignore": "true",
        "data-form-type": "other",
      },
      React.createElement("h2", null, gp ? "Заказ · геймпасс" : "Заказ · трансфер"),
      React.createElement(
        "div",
        { className: "send-fields" },
        React.createElement(
          "label",
          null,
          "Ник покупателя",
          React.createElement(
            "span",
            { className: "pw" },
            React.createElement("input", {
              id: "buyer-nick",
              type: "text",
              ...noFill("buyer"),
              value: buyer,
              onChange: (e) => {
                setBuyer(e.target.value);
                setForce(false);
              },
              placeholder: "nickname",
            }),
            React.createElement(
              "button",
              {
                type: "button",
                className: "ghost mini",
                disabled: !buyer.trim(),
                onClick: () => copy(buyer.trim(), "Ник"),
              },
              "копировать",
            ),
          ),
        ),
        React.createElement(
          "label",
          null,
          gp ? "Цена геймпасса, rbx" : "Сумма rbx",
          React.createElement(
            "span",
            { className: "pw" },
            React.createElement("input", {
              id: "buyer-amount",
              type: "number",
              min: "1",
              step: "1",
              inputMode: "numeric",
              ...noFill("amount"),
              value: amount,
              onChange: (e) => {
                setAmount(e.target.value);
                setForce(false);
              },
              placeholder: r ? String(r.sendable) : "",
            }),
            React.createElement(
              "button",
              {
                type: "button",
                className: "ghost mini",
                disabled: !(amt > 0),
                onClick: () => copy(String(amt), "Сумма"),
              },
              "копировать",
            ),
          ),
        ),
        React.createElement(
          "button",
          { className: "primary big", type: "submit", disabled: busy },
          "Отправил",
        ),
      ),
      warn && React.createElement("div", { className: "msg " + warn.cls }, warn.text),
      fitting.length > 0 &&
        warn &&
        React.createElement(
          "div",
          { className: "suggest" },
          "Хватит на: ",
          fitting.slice(0, 4).map((x) =>
            React.createElement(
              "button",
              {
                key: x.a.id,
                type: "button",
                className: "chip",
                onClick: () => {
                  setAccId(x.a.id);
                  setForce(false);
                },
              },
              x.a.name,
              " · ",
              fmt(x.r.sendable),
            ),
          ),
        ),
      gp
        ? React.createElement(
            "ol",
            { className: "steps" },
            React.createElement(
              "li",
              null,
              "Войди в этот аккаунт в приложении Roblox: логин, пароль и код 2FA копируются выше.",
            ),
            React.createElement("li", null, "Открой геймпасс покупателя с этой ценой и купи его."),
            React.createElement(
              "li",
              null,
              "Нажми «Отправил»: продажа запишется в журнал, баланс уменьшится и в трансфере тоже.",
            ),
          )
        : React.createElement(
            "ol",
            { className: "steps" },
            React.createElement(
              "li",
              null,
              "Войди в этот аккаунт в приложении Roblox: логин, пароль и код 2FA копируются выше.",
            ),
            React.createElement("li", null, "Профиль покупателя → Send Robux → сумма → подтвердить."),
            React.createElement(
              "li",
              null,
              "Нажми «Отправил»: перевод запишется в журнал, лимиты пересчитаются.",
            ),
          ),
      last &&
        React.createElement(
          "div",
          { className: "msg ok" },
          "Последний: ",
          fmt(last.amount),
          " → ",
          last.buyer,
          " с ",
          last.acc,
        ),
    ),
    ask &&
      acc &&
      r &&
      React.createElement(ConfirmOrder, {
        gp: gp,
        acc: acc.name,
        buyer: buyer.trim(),
        amount: amt,
        after: Math.max(0, r.balance - amt),
        warn: warn,
        busy: busy,
        onCancel: () => setAsk(false),
        onOk: confirmSent,
      }),
  );
}
// ---------- Подтверждение заказа на весь экран ----------
function ConfirmOrder({ gp, acc, buyer, amount, after, warn, busy, onCancel, onOk }) {
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", k);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", k);
      document.body.classList.remove("modal-open");
    };
  }, []);
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
      { className: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "confirm-title" },
      React.createElement("div", { className: "modal-badge" }, gp ? "Геймпасс" : "Трансфер"),
      React.createElement("h2", { id: "confirm-title" }, "Заказ выполнен?"),
      React.createElement(
        "div",
        { className: "modal-sum num" },
        fmt(amount),
        " ",
        React.createElement("span", null, "rbx"),
      ),
      React.createElement(
        "dl",
        { className: "modal-list" },
        React.createElement(
          "div",
          null,
          React.createElement("dt", null, "Покупатель"),
          React.createElement("dd", null, buyer),
        ),
        React.createElement(
          "div",
          null,
          React.createElement("dt", null, "С аккаунта"),
          React.createElement("dd", null, acc),
        ),
        React.createElement(
          "div",
          null,
          React.createElement("dt", null, "Баланс после"),
          React.createElement("dd", { className: "num" }, fmt(after)),
        ),
      ),
      warn && React.createElement("div", { className: "msg " + warn.cls }, warn.text),
      React.createElement(
        "div",
        { className: "modal-actions" },
        React.createElement("button", { type: "button", className: "ghost", onClick: onCancel }, "Отмена"),
        React.createElement(
          "button",
          { type: "button", className: "primary big", autoFocus: true, disabled: busy, onClick: onOk },
          busy ? "Записываю…" : "Да, выполнил",
        ),
      ),
    ),
  );
}
// ---------- История по покупателям ----------
export function Buyers({ accounts, transfers, now, onOpen }) {
  const [q, setQ] = useState("");
  const map = new Map();
  for (const t of transfers) {
    const b = (t.buyer || "").trim();
    if (!b) continue;
    const k = b.toLowerCase();
    const at = new Date(t.sent_at).getTime();
    const e = map.get(k) || { name: b, total: 0, count: 0, last: 0, accs: new Set(), today: 0 };
    e.total += t.amount;
    e.count++;
    if (at > e.last) {
      e.last = at;
      e.name = b;
    }
    e.accs.add(t.account_id);
    if (at > now - DAY) e.today += t.amount;
    map.set(k, e);
  }
  const name = (id) => accounts.find((a) => a.id === id)?.name || "—";
  const list = [...map.values()]
    .filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.last - a.last);
  return React.createElement(
    "section",
    { className: "card journal" },
    React.createElement(
      "div",
      { className: "journal-head" },
      React.createElement("h2", null, "Покупатели"),
      React.createElement("span", { className: "tag" }, map.size, " чел."),
    ),
    React.createElement(
      "div",
      { className: "admin-search" },
      React.createElement("input", {
        id: "buyers-search",
        type: "search",
        ...noFill("search"),
        placeholder: "Поиск по нику",
        value: q,
        onChange: (e) => setQ(e.target.value),
        "aria-label": "Поиск по нику",
      }),
    ),
    !list.length
      ? React.createElement(
          "div",
          { className: "empty" },
          map.size ? "Никого не найдено." : "Пока пусто. Покупатели появятся после записей через «Отправка».",
        )
      : React.createElement(
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
                React.createElement("th", null, "Ник"),
                React.createElement("th", { className: "n" }, "Всего rbx"),
                React.createElement("th", { className: "n" }, "Переводов"),
                React.createElement("th", { className: "n" }, "За 24 ч"),
                React.createElement("th", null, "Последний"),
                React.createElement("th", null, "С аккаунтов"),
                React.createElement("th", null),
              ),
            ),
            React.createElement(
              "tbody",
              null,
              list.map((x) =>
                React.createElement(
                  "tr",
                  { key: x.name },
                  React.createElement("td", null, x.name),
                  React.createElement("td", { className: "n num" }, fmt(x.total)),
                  React.createElement("td", { className: "n num" }, x.count),
                  React.createElement("td", { className: "n num" }, x.today ? fmt(x.today) : "—"),
                  React.createElement("td", { className: "num" }, fmtDate(x.last)),
                  React.createElement("td", { className: "tag" }, [...x.accs].map(name).join(", ")),
                  React.createElement(
                    "td",
                    { className: "actions" },
                    React.createElement(
                      "button",
                      { className: "ghost", onClick: () => onOpen(x.name) },
                      "в журнале",
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
  );
}
