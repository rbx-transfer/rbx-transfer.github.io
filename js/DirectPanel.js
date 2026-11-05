/*
 * rbx transfer — DirectPanel.js
 * Раздел «Донат напрямую (геймпасс)»: свои аккаунты, прогрев, баланс × 0,7, журнал трат.
 * Файл собран из исходника src/DirectPanel.tsx.
 */

// =====================================================================
// Раздел «Донат напрямую (геймпасс)»
// ---------------------------------------------------------------------
// Свои аккаунты, отдельные от «Донат гифт» и «Донат паки».
// Никаких лимитов и Roblox Plus — только:
//   • баланс аккаунта и доступный к продаже баланс (баланс × 0,7);
//   • прогрев: рычажок запускает таймер, копится наигранное время;
//   • логин, пароль и код 2FA, как в других разделах;
//   • журнал трат: «потрачено робуксов» и «куплено геймпассов на» (× 0,7).
// =====================================================================
import { useCallback, useEffect, useState } from "./vendor/react.js?v=0208e316";
import { supabase, errText } from "./supabase.js?v=0208e316";
import { fmt } from "./calc.js?v=0208e316";
import { Num, Rbx } from "./ui.js?v=0208e316";
import { useRoute, href } from "./router.js?v=0208e316";
import { SitePicker, useSite, siteLabel } from "./sites.js?v=0208e316";
import { SecretFields, emptySecret, sealSecrets, AccessPanel, noFill } from "./VaultUI.js?v=0208e316";
/** Доля баланса, которая реально доходит до продажи через геймпасс. */
export const DIRECT_RATE = 0.7;
// ---------- Расчёты ----------
/** Сколько робуксов уже потрачено с аккаунта (все записи журнала). */
function spentOf(acc, spends) {
  return spends.filter((s) => s.account_id === acc.id).reduce((sum, s) => sum + s.robux, 0);
}
/** Текущий баланс: введённый вручную минус траты после ввода. */
function balanceOf(acc, spends) {
  return Math.max(0, acc.base_balance - (spentOf(acc, spends) - acc.spent_at_base));
}
/** Доступно к продаже: баланс × 0,7, округлено вниз. */
const sellable = (balance) => Math.floor(balance * DIRECT_RATE);
/** Наигранное время в секундах с учётом идущего прямо сейчас прогрева. */
function playedSec(acc, now) {
  const running =
    acc.warm_on && acc.warm_started_at
      ? Math.max(0, Math.floor((now - new Date(acc.warm_started_at).getTime()) / 1000))
      : 0;
  return Number(acc.warm_total_sec) + running;
}
/** 3725 → «1 ч 02 мин 05 с»; без секунд, если таймер стоит. */
function fmtPlayed(sec, withSeconds) {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  const p = (n) => String(n).padStart(2, "0");
  if (h > 0) return withSeconds ? `${h} ч ${p(m)} мин ${p(s)} с` : `${h} ч ${p(m)} мин`;
  return withSeconds ? `${m} мин ${p(s)} с` : `${m} мин`;
}
const dt = (x) =>
  new Date(x).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
function toLocalInput(t) {
  const d = new Date(t),
    p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// ---------- Загрузка данных ----------
function useDirect() {
  const [accs, setAccs] = useState([]);
  const [spends, setSpends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [a, s] = await Promise.all([
      supabase.from("direct_accounts").select("*").order("sort_order").order("created_at"),
      supabase.from("direct_spends").select("*").order("spent_at", { ascending: false }).limit(2000),
    ]);
    if (a.error || s.error) setError(errText(a.error || s.error));
    else {
      setAccs(a.data || []);
      setSpends(s.data || []);
      setError("");
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { accs, spends, loading, error, load };
}
/** Секундный тик, чтобы таймер прогрева шёл на глазах. */
function useTick() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}
// ---------- Раздел целиком ----------
export function DirectPanel({ say }) {
  const data = useDirect();
  const now = useTick();
  // Вкладка раздела берётся из адреса: #/direct/<вкладка>
  const route = useRoute();
  const tab = route[1] === "journal" ? "journal" : "accounts";
  if (data.loading) return React.createElement("div", { className: "empty" }, "Загружаю…");
  const totalBalance = data.accs.reduce((s, a) => s + balanceOf(a, data.spends), 0);
  const totalSpent = data.spends.reduce((s, x) => s + x.robux, 0);
  const warming = data.accs.filter((a) => a.warm_on).length;
  return React.createElement(
    "section",
    { className: "direct" },
    data.error && React.createElement("div", { className: "notice" }, "Ошибка загрузки: ", data.error),
    React.createElement(
      "section",
      { className: "summary direct-sum" },
      React.createElement(
        "div",
        { className: "hero" },
        React.createElement("span", { className: "k" }, "Доступно к продаже"),
        React.createElement(
          "span",
          { className: "v" },
          React.createElement(Num, { value: sellable(totalBalance), fmt: fmt }),
        ),
        React.createElement("span", { className: "h" }, "баланс × 0,7 со всех аккаунтов"),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Баланс"),
        React.createElement(
          "span",
          { className: "v" },
          React.createElement(Num, { value: totalBalance, fmt: fmt }),
        ),
        React.createElement(
          "span",
          { className: "h" },
          data.accs.length,
          " аккаунтов · в прогреве ",
          warming,
        ),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Потрачено робуксов"),
        React.createElement(
          "span",
          { className: "v" },
          React.createElement(Num, { value: totalSpent, fmt: fmt }),
        ),
        React.createElement(
          "span",
          { className: "h" },
          "куплено геймпассов на ",
          React.createElement("b", { className: "num" }, fmt(Math.floor(totalSpent * DIRECT_RATE))),
        ),
      ),
    ),
    React.createElement(
      "nav",
      { className: "tabs", role: "tablist" },
      React.createElement(
        "a",
        {
          role: "tab",
          "aria-selected": tab === "accounts",
          className: "tab-link" + (tab === "accounts" ? " on" : ""),
          href: href("direct/accounts"),
        },
        "Аккаунты",
      ),
      React.createElement(
        "a",
        {
          role: "tab",
          "aria-selected": tab === "journal",
          className: "tab-link" + (tab === "journal" ? " on" : ""),
          href: href("direct/journal"),
        },
        "Журнал",
      ),
    ),
    React.createElement(
      "div",
      { className: "view-in", key: tab },
      tab === "accounts"
        ? React.createElement(DirectAccounts, { data: data, now: now, say: say })
        : React.createElement(DirectJournal, { data: data, say: say }),
    ),
  );
}
// ---------- Вкладка «Аккаунты» ----------
function DirectAccounts({ data, now, say }) {
  const [adding, setAdding] = useState(false);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "section",
      { className: "accounts" },
      !data.accs.length &&
        React.createElement(
          "div",
          { className: "empty" },
          "Аккаунтов пока нет. Добавь первый — они не пересекаются с другими разделами.",
        ),
      data.accs.map((a) =>
        React.createElement(DirectCard, { key: a.id, acc: a, data: data, now: now, say: say }),
      ),
    ),
    adding
      ? React.createElement(AddDirect, { onClose: () => setAdding(false), data: data, say: say })
      : React.createElement("button", { onClick: () => setAdding(true) }, "+ Добавить аккаунт"),
  );
}
/** Карточка одного аккаунта: прогрев, баланс, доступ, трата. */
function DirectCard({ acc, data, now, say }) {
  const [spending, setSpending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const bal = balanceOf(acc, data.spends);
  const sec = playedSec(acc, now);
  /** Рычажок прогрева: включить — старт таймера, выключить — время копится в итог. */
  async function toggleWarm() {
    setBusy(true);
    const patch = acc.warm_on
      ? { warm_on: false, warm_started_at: null, warm_total_sec: playedSec(acc, Date.now()) }
      : { warm_on: true, warm_started_at: new Date().toISOString() };
    const { error } = await supabase.from("direct_accounts").update(patch).eq("id", acc.id);
    setBusy(false);
    if (error) say(errText(error), "err");
    else {
      say(acc.warm_on ? `Прогрев ${acc.name} остановлен` : `Прогрев ${acc.name} запущен`);
      data.load();
    }
  }
  return React.createElement(
    "article",
    { className: "acc direct-acc" + (acc.warm_on ? " warming" : "") },
    React.createElement(
      "div",
      { className: "acc-head" },
      React.createElement("div", { className: "acc-name" }, acc.name),
      React.createElement(
        "span",
        { className: "pill " + (acc.warm_on ? "warn" : bal > 0 ? "ok" : "idle") },
        acc.warm_on ? "прогрев" : bal > 0 ? "готов" : "пусто",
      ),
      React.createElement("span", { className: "grow" }),
      React.createElement(
        "div",
        { className: "sendable" },
        React.createElement("div", { className: "k" }, "к продаже"),
        React.createElement("div", { className: "v" }, fmt(sellable(bal))),
      ),
      React.createElement(
        "button",
        { className: spending ? "" : "primary", onClick: () => setSpending(!spending) },
        spending ? "Скрыть" : "Записать трату",
      ),
    ),
    React.createElement(
      "div",
      { className: "direct-row" },
      React.createElement(
        "div",
        { className: "warm-box" + (acc.warm_on ? " on" : "") },
        React.createElement(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": acc.warm_on,
            className: "warm-toggle",
            disabled: busy,
            onClick: toggleWarm,
          },
          React.createElement(
            "span",
            { className: "sw", "aria-hidden": "true" },
            React.createElement("i", null),
          ),
          React.createElement("span", null, acc.warm_on ? "Прогрев идёт" : "Прогрев выключен"),
        ),
        React.createElement(
          "div",
          { className: "warm-time" },
          React.createElement("span", { className: "k" }, "наиграно"),
          React.createElement("b", { className: "num" }, fmtPlayed(sec, acc.warm_on)),
        ),
      ),
      React.createElement(
        "div",
        { className: "direct-bal" },
        React.createElement(
          "div",
          null,
          React.createElement("span", { className: "k" }, "Баланс"),
          React.createElement("span", { className: "v num" }, fmt(bal), " ", React.createElement(Rbx, null)),
        ),
        React.createElement(
          "div",
          null,
          React.createElement("span", { className: "k" }, "Доступно к продаже"),
          React.createElement(
            "span",
            { className: "v num accent" },
            fmt(sellable(bal)),
            " ",
            React.createElement(Rbx, null),
          ),
        ),
        React.createElement(
          "button",
          {
            type: "button",
            className: "edit-btn" + (editing ? " on" : ""),
            onClick: () => setEditing(!editing),
          },
          editing ? "Закрыть" : "Изменить",
        ),
      ),
    ),
    React.createElement(AccessPanel, { acc: acc, now: now, say: say, onSetup: () => setEditing(true) }),
    editing &&
      React.createElement(EditDirect, {
        acc: acc,
        balance: bal,
        data: data,
        say: say,
        onClose: () => setEditing(false),
      }),
    spending &&
      React.createElement(SpendForm, {
        acc: acc,
        balance: bal,
        data: data,
        say: say,
        onDone: () => setSpending(false),
      }),
  );
}
/** Запись траты: сколько робуксов ушло. «Куплено геймпассов на» считается само (× 0,7). */
function SpendForm({ acc, balance, data, say, onDone }) {
  const [amount, setAmount] = useState("");
  const [buyer, setBuyer] = useState("");
  const [at, setAt] = useState(toLocalInput(Date.now()));
  const [busy, setBusy] = useState(false);
  const [site, setSite] = useSite();
  const amt = Math.round(Number(amount)) || 0;
  async function submit(e) {
    e.preventDefault();
    if (!(amt > 0)) {
      say("Укажи, сколько робуксов потрачено", "err");
      return;
    }
    if (amt > balance) {
      say(`Недостаточно робуксов: на ${acc.name} ${fmt(balance)}, нужно ${fmt(amt)}`, "err");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("direct_spends").insert({
      account_id: acc.id,
      robux: amt,
      buyer: buyer.trim() || null,
      site: site || null,
      spent_at: new Date(at).toISOString(),
    });
    setBusy(false);
    if (error) say(errText(error), "err");
    else {
      say(`Записано: потрачено ${fmt(amt)}, геймпассов на ${fmt(Math.floor(amt * DIRECT_RATE))}`);
      data.load();
      onDone();
    }
  }
  return React.createElement(
    "form",
    { className: "tx-form", onSubmit: submit },
    React.createElement(
      "div",
      { className: "tx-head" },
      React.createElement("b", null, "Новая трата"),
      React.createElement(
        "span",
        { className: "tag" },
        "на аккаунте ",
        React.createElement("b", { className: "num" }, fmt(balance)),
        " ",
        React.createElement(Rbx, null),
      ),
    ),
    React.createElement(
      "div",
      { className: "tx-grid" },
      React.createElement(
        "label",
        null,
        "Потрачено робуксов",
        React.createElement(
          "span",
          { className: "suffix-in" },
          React.createElement("input", {
            type: "number",
            min: "1",
            step: "1",
            required: true,
            autoFocus: true,
            value: amount,
            onChange: (e) => setAmount(e.target.value),
          }),
          React.createElement("span", { className: "sfx" }, React.createElement(Rbx, null)),
        ),
      ),
      React.createElement(
        "label",
        null,
        "Покупатель",
        React.createElement("input", {
          type: "text",
          ...noFill("buyer"),
          value: buyer,
          onChange: (e) => setBuyer(e.target.value),
          placeholder: "ник, необязательно",
        }),
      ),
      React.createElement(
        "label",
        null,
        "Когда",
        React.createElement("input", {
          type: "datetime-local",
          required: true,
          value: at,
          onChange: (e) => setAt(e.target.value),
        }),
      ),
      React.createElement(SitePicker, { value: site, onChange: setSite }),
    ),
    React.createElement(
      "div",
      { className: "spend-calc" },
      "Куплено геймпассов на ",
      React.createElement("b", { className: "num" }, fmt(Math.floor(amt * DIRECT_RATE))),
      " ",
      React.createElement(Rbx, null),
      React.createElement("span", { className: "tag" }, " (потрачено × 0,7)"),
    ),
    React.createElement(
      "div",
      { className: "tx-actions" },
      React.createElement("button", { type: "button", className: "ghost", onClick: onDone }, "Отмена"),
      React.createElement(
        "button",
        { className: "primary", type: "submit", disabled: busy },
        busy ? "Записываю…" : "Записать",
      ),
    ),
  );
}
/** Правка: баланс, смена пароля/2FA, удаление. */
function EditDirect({ acc, balance, data, say, onClose }) {
  const [bal, setBal] = useState(String(balance));
  const hasSecret = !!(acc.roblox_password && acc.totp_secret);
  const [chg, setChg] = useState(!hasSecret);
  const [sec, setSec] = useState(emptySecret);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");
  async function save(e) {
    e.preventDefault();
    setErr("");
    const patch = {
      base_balance: Math.max(0, Math.round(Number(bal)) || 0),
      spent_at_base: spentOf(acc, data.spends),
    };
    if (chg && (sec.password || sec.secret || sec.code)) {
      const sealed = await sealSecrets(sec);
      if ("error" in sealed) {
        setErr(sealed.error);
        return;
      }
      Object.assign(patch, sealed);
    }
    const { error } = await supabase.from("direct_accounts").update(patch).eq("id", acc.id);
    if (error) setErr(errText(error));
    else {
      say("Сохранено");
      data.load();
      onClose();
    }
  }
  async function del() {
    const { error } = await supabase.from("direct_accounts").delete().eq("id", acc.id);
    if (error) say(errText(error), "err");
    else {
      say("Аккаунт удалён");
      data.load();
    }
  }
  return React.createElement(
    "form",
    {
      className: "form edit-form",
      onSubmit: save,
      autoComplete: "off",
      "data-lpignore": "true",
      "data-form-type": "other",
    },
    React.createElement(
      "div",
      { className: "edit-grid" },
      React.createElement(
        "label",
        { className: "bal-field" },
        "Баланс, rbx",
        React.createElement("input", {
          type: "number",
          min: "0",
          ...noFill("bal"),
          value: bal,
          onChange: (e) => setBal(e.target.value),
        }),
      ),
    ),
    chg &&
      React.createElement(
        "div",
        { className: "edit-secret" },
        React.createElement(SecretFields, {
          id: "dedit-" + acc.id,
          value: sec,
          onChange: setSec,
          required: false,
          login: acc.name,
        }),
      ),
    React.createElement(
      "div",
      { className: "edit-actions" },
      React.createElement("button", { className: "primary", type: "submit" }, "Сохранить"),
      !chg &&
        React.createElement(
          "button",
          { type: "button", className: "ghost", onClick: () => setChg(true) },
          "Сменить пароль или 2FA",
        ),
      React.createElement("span", { className: "grow" }),
      confirmDel
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "button",
              { type: "button", className: "danger", onClick: del },
              "Удалить вместе с тратами",
            ),
            React.createElement(
              "button",
              { type: "button", className: "ghost", onClick: () => setConfirmDel(false) },
              "Нет",
            ),
          )
        : React.createElement(
            "button",
            { type: "button", className: "ghost danger-text", onClick: () => setConfirmDel(true) },
            "Удалить аккаунт",
          ),
    ),
    err && React.createElement("div", { className: "msg bad" }, err),
  );
}
/** Добавление аккаунта: логин, пароль, ключ 2FA с проверкой кода, баланс. */
function AddDirect({ onClose, data, say }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [sec, setSec] = useState(emptySecret);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const sealed = await sealSecrets(sec);
    if ("error" in sealed) {
      setBusy(false);
      setErr(sealed.error);
      return;
    }
    const { error } = await supabase.from("direct_accounts").insert({
      name: name.trim(),
      base_balance: Math.max(0, Math.round(Number(balance)) || 0),
      sort_order: data.accs.length,
      ...sealed,
    });
    setBusy(false);
    if (error) setErr(errText(error));
    else {
      say("Аккаунт добавлен");
      data.load();
      onClose();
    }
  }
  return React.createElement(
    "form",
    {
      className: "card add-acc",
      onSubmit: submit,
      autoComplete: "off",
      "data-lpignore": "true",
      "data-form-type": "other",
    },
    React.createElement(
      "div",
      { className: "aa-grid" },
      React.createElement(
        "label",
        { className: "aa-login" },
        "Логин Roblox",
        React.createElement("input", {
          type: "text",
          required: true,
          placeholder: "ник аккаунта",
          ...noFill("login"),
          value: name,
          onChange: (e) => setName(e.target.value),
        }),
      ),
      React.createElement(SecretFields, {
        id: "new-direct",
        value: sec,
        onChange: setSec,
        required: true,
        login: name,
      }),
      React.createElement(
        "label",
        { className: "aa-bal" },
        "Баланс",
        React.createElement(
          "span",
          { className: "suffix-in" },
          React.createElement("input", {
            type: "number",
            min: "0",
            placeholder: "0",
            ...noFill("bal"),
            value: balance,
            onChange: (e) => setBalance(e.target.value),
          }),
          React.createElement("span", { className: "sfx" }, React.createElement(Rbx, null)),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "aa-foot" },
      React.createElement(
        "span",
        { className: "tag" },
        "Доступно к продаже будет считаться как баланс × 0,7.",
      ),
      React.createElement(
        "div",
        { className: "aa-actions" },
        React.createElement("button", { type: "button", className: "ghost", onClick: onClose }, "Отмена"),
        React.createElement(
          "button",
          { className: "primary", type: "submit", disabled: busy },
          busy ? "Проверяю код…" : "Добавить аккаунт",
        ),
      ),
    ),
    err && React.createElement("div", { className: "msg bad" }, err),
  );
}
// ---------- Вкладка «Журнал» ----------
function DirectJournal({ data, say }) {
  const [q, setQ] = useState("");
  const name = (id) => data.accs.find((a) => a.id === id)?.name || "—";
  const rows = data.spends.filter(
    (s) =>
      !q ||
      name(s.account_id).toLowerCase().includes(q.toLowerCase()) ||
      (s.buyer || "").toLowerCase().includes(q.toLowerCase()),
  );
  const spent = rows.reduce((sum, s) => sum + s.robux, 0);
  async function del(id) {
    const { error } = await supabase.from("direct_spends").delete().eq("id", id);
    if (error) say(errText(error), "err");
    else {
      say("Запись удалена");
      data.load();
    }
  }
  return React.createElement(
    "section",
    { className: "card journal" },
    React.createElement(
      "div",
      { className: "journal-head" },
      React.createElement("h2", null, "Журнал трат"),
      React.createElement("input", {
        type: "search",
        placeholder: "Аккаунт или покупатель",
        value: q,
        onChange: (e) => setQ(e.target.value),
        "aria-label": "Поиск",
      }),
    ),
    React.createElement(
      "div",
      { className: "admin-stats" },
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Потрачено робуксов"),
        React.createElement("span", { className: "v num" }, fmt(spent)),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Куплено геймпассов на"),
        React.createElement("span", { className: "v num accent" }, fmt(Math.floor(spent * DIRECT_RATE))),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Записей"),
        React.createElement("span", { className: "v num" }, rows.length),
      ),
    ),
    !rows.length
      ? React.createElement("div", { className: "empty" }, "Трат пока нет.")
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
                React.createElement("th", null, "Когда"),
                React.createElement("th", null, "Аккаунт"),
                React.createElement("th", null, "Площадка"),
                React.createElement("th", null, "Покупатель"),
                React.createElement("th", { className: "n" }, "Потрачено"),
                React.createElement("th", { className: "n" }, "Куплено геймпассов на"),
                React.createElement("th", null),
              ),
            ),
            React.createElement(
              "tbody",
              null,
              rows.map((s) =>
                React.createElement(
                  "tr",
                  { key: s.id },
                  React.createElement("td", { className: "num nowrap" }, dt(s.spent_at)),
                  React.createElement("td", null, React.createElement("b", null, name(s.account_id))),
                  React.createElement("td", { className: "tag" }, siteLabel(s.site)),
                  React.createElement("td", { className: "tag" }, s.buyer || "—"),
                  React.createElement("td", { className: "n num" }, fmt(s.robux)),
                  React.createElement(
                    "td",
                    { className: "n num accent" },
                    fmt(Math.floor(s.robux * DIRECT_RATE)),
                  ),
                  React.createElement(
                    "td",
                    { className: "actions" },
                    React.createElement(
                      "button",
                      { className: "ghost small", onClick: () => del(s.id) },
                      "Удалить",
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
  );
}
