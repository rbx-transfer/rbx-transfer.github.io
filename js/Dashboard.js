/*
 * rbx transfer — Dashboard.js
 * Главный экран: вкладки, аккаунты Roblox, лимиты, запись переводов, админка.
 * Файл собран из исходника src/Dashboard.ts*.
 */

import { useEffect, useRef, useState } from "./vendor/react.js?v=1aac96d1";
import { supabase, errText, kickBroadcast } from "./supabase.js?v=1aac96d1";
import { kindOf, calcAccount, fmt, fmtDate, dur, toLocalInput, DAY } from "./calc.js?v=1aac96d1";
import { useTeamData } from "./useTeamData.js?v=1aac96d1";
import { SendPanel, Buyers } from "./SendPanel.js?v=1aac96d1";
import { PlusField, PlusBadge } from "./Plus.js?v=1aac96d1";
import { MsPanel } from "./MsPanel.js?v=1aac96d1";
import { DirectPanel } from "./DirectPanel.js?v=1aac96d1";
import { useRoute, go, href } from "./router.js?v=1aac96d1";
import { InviteCodes, Blacklist, UserStats } from "./Admin.js?v=1aac96d1";
import { Num, Rbx, ToastView } from "./ui.js?v=1aac96d1";
import { SecretFields, emptySecret, sealSecrets, AccessPanel, noFill } from "./VaultUI.js?v=1aac96d1";
function ls(k, d) {
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
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}
export function Dashboard({ email, userId }) {
  return React.createElement(DashboardInner, { email: email, userId: userId });
}
function DashboardInner({ email, userId }) {
  const data = useTeamData(userId);
  const now = useNow();
  // Страница определяется адресом: #/раздел/... (см. router.ts)
  const route = useRoute();
  const section = route[0] === "packs" || route[0] === "direct" || route[0] === "admin" ? route[0] : "gift";
  const mode = route[1] === "gamepass" ? "gamepass" : "transfer";
  const tab = ["send", "accounts", "journal", "buyers"].includes(route[2]) ? route[2] : "send";
  const setTab = (v) => go(`gift/${mode}/${v}`);
  // последняя страница сайта (не админки) — сюда ведёт кнопка «К сайту»
  if (section !== "admin") lsSet("rbx-last-site", route.join("/") || "gift/transfer/send");
  const siteBack = ls("rbx-last-site", "gift/transfer/send");
  const [jq, setJq] = useState("");
  const [toast, setToast] = useState(null);
  const tRef = useRef(0);
  const say = (
    t,
    kind = /недостаточно|не хватает|ошибк|нельзя|не удалось|неверн/i.test(t) ? "err" : "ok",
  ) => {
    const id = Date.now();
    setToast({ id, text: t, kind });
    window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(
      () => setToast((x) => (x && x.id === id ? null : x)),
      kind === "err" ? 5000 : 3500,
    );
  };
  const admin = section === "admin";
  if (data.loading)
    return React.createElement(
      Shell,
      { email: email },
      React.createElement("div", { className: "empty" }, "Загружаю…"),
    );
  const ready = data.accounts.filter((a) => a.status === "ready");
  let total = 0,
    sendNow = 0;
  let next = null;
  ready.forEach((a) => {
    const r = calcAccount(a, data.transfers, data.settings, now, mode);
    total += r.balance;
    sendNow += r.sendable;
    const n = r.dayReleases[0];
    if (mode === "transfer" && n && r.balance > r.sendable && (!next || n.at < next.at))
      next = { ...n, name: a.name };
  });
  const nx = next;
  return React.createElement(
    Shell,
    {
      email: email,
      clock: now,
      isAdmin: data.isAdmin,
      admin: admin,
      adminHref: href(admin ? siteBack : "admin"),
    },
    data.error && React.createElement("div", { className: "notice" }, "Ошибка загрузки: ", data.error),
    admin && data.isAdmin
      ? React.createElement(
          "div",
          { className: "view-in", key: "admin" },
          React.createElement(AdminView, {
            me: userId,
            say: say,
            statId: route[1] === "user" ? route[2] : undefined,
            backHref: href(siteBack),
          }),
        )
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "nav",
            { className: "tabs sections", role: "tablist" },
            [
              ["packs", "Донат паки (Microsoft)"],
              ["gift", "Донат гифт"],
              ["direct", "Донат напрямую (геймпасс)"],
            ].map(([k, t]) =>
              React.createElement(
                "a",
                {
                  key: k,
                  role: "tab",
                  "aria-selected": section === k,
                  className: "tab-link" + (section === k ? " on" : ""),
                  href: href(k === "gift" ? `gift/${mode}/${tab}` : k),
                },
                t,
              ),
            ),
          ),
          section === "packs" &&
            React.createElement(
              "div",
              { className: "view-in", key: "packs" },
              React.createElement(MsPanel, { say: say }),
            ),
          section === "direct" &&
            React.createElement(
              "div",
              { className: "view-in", key: "direct" },
              React.createElement(DirectPanel, { say: say }),
            ),
          section === "gift" &&
            React.createElement(
              "div",
              { className: "view-in", key: "gift-" + mode },
              React.createElement(
                "nav",
                { className: "tabs modes", role: "tablist" },
                [
                  ["gamepass", "Геймпасс"],
                  ["transfer", "Трансфер"],
                ].map(([k, t]) =>
                  React.createElement(
                    "a",
                    {
                      key: k,
                      role: "tab",
                      "aria-selected": mode === k,
                      className: "tab-link" + (mode === k ? " on" : ""),
                      href: href(`gift/${k}/${tab}`),
                    },
                    t,
                  ),
                ),
              ),
              React.createElement(
                "section",
                { className: "summary" },
                React.createElement(
                  "div",
                  { className: "hero" },
                  React.createElement(
                    "span",
                    { className: "k" },
                    mode === "gamepass" ? "Баланс для геймпассов" : "Доступно для трансфера",
                  ),
                  React.createElement(
                    "span",
                    { className: "v" },
                    React.createElement(Num, { value: sendNow, fmt: fmt }),
                  ),
                  React.createElement(
                    "span",
                    { className: "h" },
                    nx
                      ? React.createElement(
                          React.Fragment,
                          null,
                          "ближайший возврат ",
                          React.createElement("b", { className: "num" }, "+", fmt(nx.amount)),
                          " через ",
                          dur(nx.at - now),
                          " · ",
                          nx.name,
                        )
                      : mode === "gamepass"
                        ? "общий баланс всех аккаунтов"
                        : "доступно сегодня со всех аккаунтов",
                  ),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "k" }, "rbx total"),
                  React.createElement(
                    "span",
                    { className: "v" },
                    React.createElement(Num, { value: total, fmt: fmt }),
                  ),
                  React.createElement("span", { className: "h" }, "баланс на аккаунтах (общий)"),
                ),
              ),
              React.createElement(
                "nav",
                { className: "tabs main", role: "tablist" },
                [
                  ["send", "Отправка"],
                  ["accounts", "Аккаунты"],
                  ["journal", "Журнал"],
                  ["buyers", "Покупатели"],
                ].map(([k, t]) =>
                  React.createElement(
                    "a",
                    {
                      key: k,
                      role: "tab",
                      "aria-selected": tab === k,
                      className: "tab-link" + (tab === k ? " on" : ""),
                      href: href(`gift/${mode}/${k}`),
                    },
                    t,
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "view-in", key: tab },
                tab === "send" &&
                  React.createElement(SendPanel, {
                    key: mode,
                    mode: mode,
                    accounts: data.accounts,
                    transfers: data.transfers,
                    settings: data.settings,
                    now: now,
                    say: say,
                  }),
                tab === "buyers" &&
                  React.createElement(Buyers, {
                    accounts: data.accounts,
                    transfers: data.transfers.filter((t) => kindOf(t) === mode),
                    now: now,
                    onOpen: (b) => {
                      setJq(b);
                      setTab("journal");
                    },
                  }),
                tab === "accounts" &&
                  React.createElement(Accounts, {
                    mode: mode,
                    accounts: data.accounts,
                    transfers: data.transfers,
                    settings: data.settings,
                    now: now,
                    say: say,
                  }),
                tab === "journal" &&
                  React.createElement(Journal, {
                    mode: mode,
                    accounts: data.accounts,
                    transfers: data.transfers.filter((t) => kindOf(t) === mode),
                    now: now,
                    say: say,
                    q: jq,
                    setQ: setJq,
                  }),
              ),
            ),
        ),
    React.createElement(ToastView, { t: toast }),
  );
}
function Shell({ email, clock, children, isAdmin, admin, adminHref }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "header",
      { className: "topbar" },
      React.createElement(
        "div",
        { className: "topbar-in" },
        React.createElement(
          "a",
          { className: "brandrow", href: href("gift/transfer/send"), title: "На главную" },
          React.createElement(Mark, null),
          React.createElement(
            "span",
            { className: "wordmark" },
            "rbx",
            React.createElement("b", null, "transfer"),
          ),
        ),
        clock &&
          React.createElement(
            "div",
            { className: "clock num" },
            new Date(clock).toLocaleString("ru-RU", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          ),
        React.createElement(
          "div",
          { className: "who" },
          isAdmin &&
            React.createElement(
              "a",
              { className: "admin-btn" + (admin ? " on" : ""), href: adminHref, title: "Админка" },
              React.createElement(
                "svg",
                { width: "15", height: "15", viewBox: "0 0 24 24", "aria-hidden": "true" },
                React.createElement("path", {
                  d: "M12 2.5 20 6v6c0 4.6-3.3 8.3-8 9.5-4.7-1.2-8-4.9-8-9.5V6z",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2",
                  strokeLinejoin: "round",
                }),
                React.createElement("path", {
                  d: "M8.5 12l2.4 2.4 4.6-4.8",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }),
              ),
              admin ? "К сайту" : "Админка",
            ),
          React.createElement("span", { title: email }, email),
          React.createElement(
            "button",
            { className: "ghost", onClick: () => supabase.auth.signOut() },
            "Выйти",
          ),
        ),
      ),
    ),
    React.createElement("div", { className: "wrap" }, children),
  );
}
export function Mark({ size = 26 }) {
  return React.createElement("span", { className: "mark" }, React.createElement(Rbx, { size: size }));
}
function Meter({ label, sent, limit, segments, now, children }) {
  const full = sent >= limit;
  const segs = segments && segments.length ? segments : sent > 0 ? [{ at: 0, amount: sent }] : [];
  return React.createElement(
    "div",
    { className: "meter" },
    React.createElement(
      "div",
      { className: "m-top" },
      React.createElement("span", { className: "m-label" }, label),
      React.createElement(
        "span",
        { className: "m-count num" },
        React.createElement("b", null, fmt(sent)),
        " / ",
        fmt(limit),
      ),
    ),
    React.createElement(
      "div",
      {
        className: "bar" + (full ? " full" : ""),
        role: "img",
        "aria-label": `${label}: использовано ${fmt(sent)} из ${fmt(limit)}`,
      },
      segs.map((x, i) =>
        React.createElement("i", {
          key: i,
          style: { width: Math.min(100, (x.amount / limit) * 100) + "%" },
          title: x.at && now ? `${fmt(x.amount)} вернётся через ${dur(x.at - now)}` : undefined,
        }),
      ),
    ),
    React.createElement("div", { className: "m-left" }, children),
  );
}
function Releases({ items, now, empty, max }) {
  if (!items.length)
    return React.createElement("div", { className: "releases" }, React.createElement("div", null, empty));
  return React.createElement(
    "div",
    { className: "releases" },
    items
      .slice(0, max)
      .map((x, i) =>
        React.createElement(
          "div",
          { className: "r", key: i },
          React.createElement("span", null, "через ", dur(x.at - now), " · ", fmtDate(x.at)),
          React.createElement("b", null, "+", fmt(x.amount)),
        ),
      ),
    items.length > max && React.createElement("div", null, "и ещё ", items.length - max),
  );
}
function Accounts({ mode, accounts, transfers, settings, now, say }) {
  const ready = accounts.filter((a) => a.status === "ready");
  const idle = accounts.filter((a) => a.status !== "ready");
  const [adding, setAdding] = useState(false);
  if (!accounts.length)
    return React.createElement(
      "section",
      { className: "card onboarding" },
      React.createElement("h2", null, "Добавь первый аккаунт Roblox"),
      React.createElement(
        "p",
        null,
        "Укажи логин, пароль и ключ 2FA аккаунта и сколько робуксов на нём сейчас. Дальше записывай переводы, и сайт сам посчитает лимиты и будет показывать коды 2FA.",
      ),
      React.createElement(AddAccount, { onClose: () => {}, say: say, nextOrder: 0, inline: true }),
    );
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "section",
      { className: "accounts" },
      !ready.length &&
        React.createElement(
          "div",
          { className: "empty" },
          "Активных аккаунтов нет. Добавь аккаунт или активируй один из списка ниже.",
        ),
      ready.map((a) =>
        React.createElement(AccountCard, {
          key: a.id,
          mode: mode,
          acc: a,
          transfers: transfers,
          settings: settings,
          now: now,
          say: say,
        }),
      ),
    ),
    adding
      ? React.createElement(AddAccount, {
          onClose: () => setAdding(false),
          say: say,
          nextOrder: accounts.length,
        })
      : React.createElement("button", { onClick: () => setAdding(true) }, "+ Добавить аккаунт"),
  );
}
function AddAccount({ onClose, say, nextOrder, inline }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [plus, setPlus] = useState(null);
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
    const { error } = await supabase
      .from("accounts")
      .insert({
        name: name.trim(),
        base_balance: Number(balance) || 0,
        plus_since: plus,
        sort_order: nextOrder,
        status: "ready",
        ...sealed,
      });
    setBusy(false);
    if (error) setErr(errText(error));
    else {
      say("Аккаунт добавлен");
      setName("");
      setBalance("");
      setPlus(null);
      setSec(emptySecret);
      onClose();
    }
  }
  return React.createElement(
    "form",
    {
      className: (inline ? "" : "card ") + "add-acc",
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
          id: "new-acc-name",
          type: "text",
          required: true,
          placeholder: "ник аккаунта",
          ...noFill("login"),
          value: name,
          onChange: (e) => setName(e.target.value),
        }),
      ),
      React.createElement(SecretFields, {
        id: "new-acc",
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
            id: "new-acc-balance",
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
      React.createElement(PlusField, { id: "new-acc", value: plus, onChange: setPlus }),
      React.createElement(
        "div",
        { className: "aa-actions" },
        !inline &&
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
function AccountCard({ mode, acc, transfers, settings, now, say }) {
  const r = calcAccount(acc, transfers, settings, now, mode);
  const gp = mode === "gamepass";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  return React.createElement(
    "article",
    { className: "acc" },
    React.createElement(
      "div",
      { className: "acc-head" },
      React.createElement("div", { className: "acc-name" }, acc.name),
      React.createElement("span", { className: "pill " + r.status.cls }, r.status.text),
      React.createElement("span", { className: "grow" }),
      React.createElement(
        "div",
        { className: "sendable" },
        React.createElement("div", { className: "k" }, gp ? "баланс" : "доступно сейчас"),
        React.createElement("div", { className: "v" }, fmt(r.sendable)),
      ),
      React.createElement(
        "button",
        { className: open ? "" : "primary", onClick: () => setOpen(!open) },
        open ? "Скрыть" : gp ? "Записать продажу" : "Записать перевод",
      ),
    ),
    React.createElement(
      "div",
      { className: "meters" + (gp ? " gp" : "") },
      !gp &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "div",
            { className: "col" },
            React.createElement(
              Meter,
              {
                label: "Сутки (24 ч)",
                sent: r.daySent,
                limit: settings.daily_limit,
                segments: r.dayReleases,
                now: now,
              },
              React.createElement("span", null, "свободно"),
              React.createElement("b", { className: "num" }, fmt(r.dayLeft)),
            ),
            React.createElement(Releases, {
              items: r.dayReleases,
              now: now,
              empty: "Лимит полностью свободен",
              max: 3,
            }),
          ),
          React.createElement(
            "div",
            { className: "col" },
            React.createElement(
              Meter,
              {
                label: settings.month_mode === "calendar" ? "Месяц (календарный)" : "Месяц (30 дней)",
                sent: r.monSent,
                limit: settings.monthly_limit,
                segments: r.monReleases,
                now: now,
              },
              React.createElement("span", null, "свободно"),
              React.createElement("b", { className: "num" }, fmt(r.monLeft)),
            ),
            settings.month_mode === "calendar" && r.monthReset
              ? React.createElement(
                  "div",
                  { className: "releases" },
                  React.createElement(
                    "div",
                    null,
                    "сброс ",
                    new Date(r.monthReset).toLocaleDateString("ru-RU"),
                    " · через ",
                    dur(r.monthReset - now),
                  ),
                )
              : React.createElement(Releases, {
                  items: r.monReleases,
                  now: now,
                  empty: "Переводов за 30 дней не было",
                  max: 2,
                }),
          ),
        ),
      React.createElement(
        "div",
        { className: "balance-box" },
        React.createElement("span", null, "Баланс"),
        React.createElement("span", { className: "bv" }, fmt(r.balance)),
        !gp && React.createElement(PlusBadge, { since: acc.plus_since, now: now }),
        React.createElement(
          "button",
          {
            type: "button",
            className: "edit-btn" + (editing ? " on" : ""),
            "aria-expanded": editing,
            onClick: () => setEditing(!editing),
          },
          React.createElement(
            "svg",
            { width: "14", height: "14", viewBox: "0 0 24 24", "aria-hidden": "true" },
            editing
              ? React.createElement("path", {
                  d: "M6 6l12 12M18 6 6 18",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2.2",
                  strokeLinecap: "round",
                })
              : React.createElement("path", {
                  d: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2",
                  strokeLinejoin: "round",
                }),
          ),
          editing ? "Закрыть" : "Изменить",
        ),
      ),
    ),
    React.createElement(AccessPanel, { acc: acc, now: now, say: say, onSetup: () => setEditing(true) }),
    editing &&
      React.createElement(EditAccount, {
        gp: gp,
        acc: acc,
        balance: r.balance,
        transfers: transfers,
        say: say,
        onClose: () => setEditing(false),
      }),
    open &&
      React.createElement(TransferForm, {
        mode: mode,
        acc: acc,
        transfers: transfers,
        settings: settings,
        say: say,
        onDone: () => setOpen(false),
        sendable: r.sendable,
      }),
  );
}
function EditAccount({ gp, acc, balance, transfers, say, onClose }) {
  const [bal, setBal] = useState(String(Math.round(balance)));
  const [plus, setPlus] = useState(acc.plus_since ?? null);
  const [confirmDel, setConfirmDel] = useState(false);
  const hasSecret = !!(acc.roblox_password && acc.totp_secret);
  const [chg, setChg] = useState(!hasSecret);
  const [sec, setSec] = useState(emptySecret);
  const [err, setErr] = useState("");
  async function save(e) {
    e.preventDefault();
    setErr("");
    const sent = transfers.filter((t) => t.account_id === acc.id).reduce((s, t) => s + t.amount, 0);
    const patch = { base_balance: Number(bal) || 0, sent_at_base: sent, plus_since: plus };
    if (chg && (sec.password || sec.secret || sec.code)) {
      const sealed = await sealSecrets(sec);
      if ("error" in sealed) {
        setErr(sealed.error);
        return;
      }
      Object.assign(patch, sealed);
    }
    const { error } = await supabase.from("accounts").update(patch).eq("id", acc.id);
    if (error) setErr(errText(error));
    else {
      say("Сохранено");
      onClose();
    }
  }
  async function del() {
    const { error } = await supabase.from("accounts").delete().eq("id", acc.id);
    if (error) say(errText(error));
    else say("Аккаунт удалён");
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
          id: "bal-" + acc.id,
          type: "number",
          min: "0",
          ...noFill("bal"),
          value: bal,
          onChange: (e) => setBal(e.target.value),
        }),
      ),
      !gp && React.createElement(PlusField, { id: "plus-" + acc.id, value: plus, onChange: setPlus }),
    ),
    chg &&
      React.createElement(
        "div",
        { className: "edit-secret" },
        React.createElement(SecretFields, {
          id: "edit-" + acc.id,
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
              "Удалить вместе с переводами",
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
function TransferForm({ mode, acc, transfers, settings, say, onDone, sendable }) {
  const [amount, setAmount] = useState(sendable ? String(sendable) : "");
  const [at, setAt] = useState(toLocalInput(Date.now()));
  const [buyer, setBuyer] = useState("");
  const [warn, setWarn] = useState(null);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const amt = Math.round(Number(amount));
    const t = new Date(at).getTime();
    if (!(amt > 0) || !isFinite(t)) {
      setWarn({ cls: "bad", text: "Укажи сумму и время." });
      return;
    }
    const r = calcAccount(acc, transfers, settings, Math.max(t, Date.now()));
    if (mode === "transfer" && !r.plus) {
      say(`Нельзя записать трансфер: на ${acc.name} нет активной подписки Roblox Plus`, "err");
      return;
    }
    if (amt > r.balance) {
      say(`Недостаточно робуксов: на ${acc.name} ${fmt(r.balance)}, нужно ${fmt(amt)}`, "err");
      return;
    }
    if (!force && mode === "transfer" && (amt > r.dayLeft || amt > r.monLeft)) {
      setWarn({
        cls: "warn",
        text: `Это больше лимита: в сутки свободно ${fmt(r.dayLeft)}, в месяц ${fmt(r.monLeft)}. Нажми «Записать» ещё раз, чтобы всё равно записать.`,
      });
      setForce(true);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("transfers")
      .insert({
        account_id: acc.id,
        amount: amt,
        buyer: buyer.trim() || null,
        kind: mode,
        sent_at: new Date(t).toISOString(),
      });
    setBusy(false);
    if (error) say(errText(error));
    else {
      say(`Записано: ${fmt(amt)} с ${acc.name}`);
      onDone();
    }
  }
  return React.createElement(
    "form",
    { className: "tx-form", onSubmit: submit },
    React.createElement(
      "div",
      { className: "tx-head" },
      React.createElement("b", null, mode === "gamepass" ? "Новая продажа" : "Новый перевод"),
      React.createElement(
        "span",
        { className: "tag" },
        "доступно сейчас ",
        React.createElement("b", { className: "num" }, fmt(sendable)),
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
        "Сумма",
        React.createElement(
          "span",
          { className: "suffix-in" },
          React.createElement("input", {
            id: "amt-" + acc.id,
            type: "number",
            min: "1",
            step: "1",
            required: true,
            value: amount,
            onChange: (e) => {
              setAmount(e.target.value);
              setForce(false);
              setWarn(null);
            },
            autoFocus: true,
          }),
          React.createElement("span", { className: "sfx" }, React.createElement(Rbx, null)),
        ),
      ),
      React.createElement(
        "label",
        null,
        "Покупатель",
        React.createElement("input", {
          id: "buyer-" + acc.id,
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
          id: "at-" + acc.id,
          type: "datetime-local",
          required: true,
          value: at,
          onChange: (e) => {
            setAt(e.target.value);
            setForce(false);
            setWarn(null);
          },
        }),
      ),
    ),
    warn && React.createElement("div", { className: "msg " + warn.cls }, warn.text),
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
function Journal({ mode, accounts, transfers, now, say, q, setQ }) {
  const [filter, setFilter] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [limit, setLimit] = useState(100);
  const name = (id) => accounts.find((a) => a.id === id)?.name || "—";
  const ql = q.trim().toLowerCase();
  const rows = transfers
    .filter(
      (t) => (!filter || t.account_id === filter) && (!ql || (t.buyer || "").toLowerCase().includes(ql)),
    )
    .sort((a, b) => +new Date(b.sent_at) - +new Date(a.sent_at));
  async function del(id) {
    const { error } = await supabase.from("transfers").delete().eq("id", id);
    if (error) say(errText(error));
    else {
      say("Запись удалена");
      setConfirm(null);
    }
  }
  return React.createElement(
    "section",
    { className: "card journal" },
    React.createElement(
      "div",
      { className: "journal-head" },
      React.createElement("h2", null, mode === "gamepass" ? "Журнал · геймпасс" : "Журнал · трансфер"),
      React.createElement("input", {
        id: "journal-q",
        type: "search",
        placeholder: "Ник покупателя",
        value: q,
        onChange: (e) => setQ(e.target.value),
        "aria-label": "Поиск по нику покупателя",
        autoComplete: "off",
      }),
      React.createElement(
        "select",
        {
          id: "journal-filter",
          value: filter,
          onChange: (e) => setFilter(e.target.value),
          "aria-label": "Фильтр по аккаунту",
        },
        React.createElement("option", { value: "" }, "Все аккаунты"),
        accounts.map((a) => React.createElement("option", { key: a.id, value: a.id }, a.name)),
      ),
    ),
    !rows.length
      ? React.createElement("div", { className: "empty" }, "Записей пока нет.")
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
                React.createElement("th", null, "Покупатель"),
                React.createElement("th", { className: "n" }, "Сумма"),
                mode === "transfer" && React.createElement("th", null, "Вернётся в суточный лимит"),
                React.createElement("th", null),
              ),
            ),
            React.createElement(
              "tbody",
              null,
              rows.slice(0, limit).map((t) => {
                const back = new Date(t.sent_at).getTime() + DAY;
                return React.createElement(
                  "tr",
                  { key: t.id },
                  React.createElement("td", { className: "num" }, fmtDate(new Date(t.sent_at).getTime())),
                  React.createElement("td", null, name(t.account_id)),
                  React.createElement(
                    "td",
                    null,
                    t.buyer || React.createElement("span", { className: "tag" }, "—"),
                  ),
                  React.createElement("td", { className: "n num" }, fmt(t.amount)),
                  mode === "transfer" &&
                    React.createElement(
                      "td",
                      null,
                      back > now
                        ? "через " + dur(back - now)
                        : React.createElement("span", { className: "okc" }, "вернулось"),
                    ),
                  React.createElement(
                    "td",
                    { className: "actions" },
                    confirm === t.id
                      ? React.createElement(
                          React.Fragment,
                          null,
                          React.createElement(
                            "button",
                            { className: "danger", onClick: () => del(t.id) },
                            "Удалить",
                          ),
                          " ",
                          React.createElement(
                            "button",
                            { className: "ghost", onClick: () => setConfirm(null) },
                            "Нет",
                          ),
                        )
                      : React.createElement(
                          "button",
                          {
                            className: "ghost",
                            "aria-label": "Удалить запись",
                            onClick: () => setConfirm(t.id),
                          },
                          "✕",
                        ),
                  ),
                );
              }),
            ),
          ),
        ),
    rows.length > limit &&
      React.createElement(
        "div",
        { className: "more" },
        React.createElement("button", { onClick: () => setLimit(limit + 200) }, "Показать ещё"),
      ),
  );
}
function SettingsForm({ settings, userId, say }) {
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  async function save(e) {
    e.preventDefault();
    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: userId,
        daily_limit: Math.round(s.daily_limit),
        monthly_limit: Math.round(s.monthly_limit),
        month_mode: s.month_mode,
      });
    if (error) say(errText(error));
    else say("Настройки сохранены");
  }
  return React.createElement(
    "form",
    { className: "card form settings", onSubmit: save },
    React.createElement(
      "label",
      null,
      "Суточный лимит",
      React.createElement("input", {
        id: "set-day",
        type: "number",
        min: "1",
        value: s.daily_limit,
        onChange: (e) => setS({ ...s, daily_limit: Number(e.target.value) }),
      }),
    ),
    React.createElement(
      "label",
      null,
      "Месячный лимит",
      React.createElement("input", {
        id: "set-month",
        type: "number",
        min: "1",
        value: s.monthly_limit,
        onChange: (e) => setS({ ...s, monthly_limit: Number(e.target.value) }),
      }),
    ),
    React.createElement(
      "label",
      null,
      "Как считать месяц",
      React.createElement(
        "select",
        { id: "set-mode", value: s.month_mode, onChange: (e) => setS({ ...s, month_mode: e.target.value }) },
        React.createElement("option", { value: "rolling" }, "Последние 30 дней"),
        React.createElement("option", { value: "calendar" }, "Календарный месяц"),
      ),
    ),
    React.createElement("button", { className: "primary", type: "submit" }, "Сохранить"),
  );
}
const Ic = {
  stats: React.createElement(
    "svg",
    { width: "14", height: "14", viewBox: "0 0 24 24", "aria-hidden": "true" },
    React.createElement("path", {
      d: "M4 20V10M10 20V4M16 20v-7M22 20H2",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
    }),
  ),
  ban: React.createElement(
    "svg",
    { width: "14", height: "14", viewBox: "0 0 24 24", "aria-hidden": "true" },
    React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "8.5",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
    }),
    React.createElement("path", {
      d: "M6 6l12 12",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
    }),
  ),
  unban: React.createElement(
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
  del: React.createElement(
    "svg",
    { width: "14", height: "14", viewBox: "0 0 24 24", "aria-hidden": "true" },
    React.createElement("path", {
      d: "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.1",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  ),
};
export function AdminPanel({ me, say, rev = 0, onChange = () => {} }) {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(null);
  async function load() {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      say(errText(error), "err");
      setUsers([]);
    } else setUsers(data);
  }
  useEffect(() => {
    load();
  }, [rev]);
  async function act(u, fn, args, ok, kick) {
    setBusy(u.id);
    const { error } = await supabase.rpc(fn, args);
    if (!error && kick) await kickBroadcast();
    setBusy(null);
    setConfirm(null);
    if (error) say(errText(error), "err");
    else {
      say(ok);
      onChange();
    }
  }
  const ban = (u) =>
    act(
      u,
      "admin_blacklist_add",
      { p_email: u.email, p_reason: null },
      `${u.email} в чёрном списке — выкинут с сайта`,
      true,
    );
  const unban = (u) =>
    act(u, "admin_blacklist_remove", { p_email: u.email }, `${u.email} разблокирован`, false);
  const del = (u) =>
    act(
      u,
      "admin_delete_user",
      { target: u.id },
      `${u.email} удалён и выкинут с сайта, почта в чёрном списке`,
      true,
    );
  const list = (users || []).filter((u) => !q || u.email.toLowerCase().includes(q.toLowerCase()));
  const total = users?.length || 0,
    confirmed = users?.filter((u) => u.confirmed).length || 0,
    blocked = users?.filter((u) => u.blocked).length || 0;
  return React.createElement(
    "section",
    { className: "card journal admin" },
    React.createElement(
      "div",
      { className: "journal-head" },
      React.createElement("h2", null, "Пользователи"),
      React.createElement("button", { className: "ghost", onClick: load }, "Обновить"),
    ),
    React.createElement(
      "div",
      { className: "admin-stats" },
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Всего"),
        React.createElement("span", { className: "v num" }, total),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Подтвердили почту"),
        React.createElement("span", { className: "v num" }, confirmed),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "В чёрном списке"),
        React.createElement("span", { className: "v num" }, blocked),
      ),
    ),
    React.createElement(
      "div",
      { className: "admin-search" },
      React.createElement("input", {
        id: "admin-search",
        type: "search",
        placeholder: "Поиск по почте",
        value: q,
        onChange: (e) => setQ(e.target.value),
        "aria-label": "Поиск по почте",
      }),
    ),
    users === null
      ? React.createElement("div", { className: "empty" }, "Загружаю…")
      : !list.length
        ? React.createElement("div", { className: "empty" }, "Никого не найдено.")
        : React.createElement(
            "div",
            { className: "tbl" },
            React.createElement(
              "table",
              { className: "users-tbl" },
              React.createElement(
                "thead",
                null,
                React.createElement(
                  "tr",
                  null,
                  React.createElement("th", null, "Почта"),
                  React.createElement("th", null, "Статус"),
                  React.createElement("th", { className: "act-h" }, "Действия"),
                ),
              ),
              React.createElement(
                "tbody",
                null,
                list.map((u) =>
                  React.createElement(
                    "tr",
                    { key: u.id, className: "row-in" + (u.blocked ? " is-blocked" : "") },
                    React.createElement(
                      "td",
                      { className: "u-mail" },
                      React.createElement("span", { title: u.email }, u.email),
                      u.id === me && React.createElement("span", { className: "tag" }, " (ты)"),
                      u.is_admin &&
                        React.createElement(
                          "span",
                          { className: "pill ok", style: { marginLeft: 8 } },
                          "админ",
                        ),
                    ),
                    React.createElement(
                      "td",
                      null,
                      u.blocked
                        ? React.createElement("span", { className: "pill blk" }, "в ЧС")
                        : u.confirmed
                          ? React.createElement("span", { className: "pill ok" }, "подтверждён")
                          : React.createElement("span", { className: "pill warn" }, "ждёт письма"),
                    ),
                    React.createElement(
                      "td",
                      { className: "u-act" },
                      confirm === u.id
                        ? React.createElement(
                            "span",
                            { className: "act-row confirm-in" },
                            React.createElement("span", { className: "act-q" }, "Удалить навсегда?"),
                            React.createElement(
                              "button",
                              { className: "act act-del", disabled: busy === u.id, onClick: () => del(u) },
                              busy === u.id ? "Удаляю…" : "Да, удалить",
                            ),
                            React.createElement(
                              "button",
                              { className: "act act-ghost", onClick: () => setConfirm(null) },
                              "Нет",
                            ),
                          )
                        : React.createElement(
                            "span",
                            { className: "act-row" },
                            React.createElement(
                              "a",
                              { className: "act act-stat", href: href("admin/user/" + u.id) },
                              Ic.stats,
                              "Статистика",
                            ),
                            u.id !== me &&
                              !u.is_admin &&
                              React.createElement(
                                React.Fragment,
                                null,
                                u.blocked
                                  ? React.createElement(
                                      "button",
                                      {
                                        className: "act act-unban",
                                        disabled: busy === u.id,
                                        onClick: () => unban(u),
                                      },
                                      Ic.unban,
                                      "Разблок.",
                                    )
                                  : React.createElement(
                                      "button",
                                      {
                                        className: "act act-ban",
                                        disabled: busy === u.id,
                                        onClick: () => ban(u),
                                      },
                                      Ic.ban,
                                      "В ЧС",
                                    ),
                                React.createElement(
                                  "button",
                                  {
                                    className: "act act-del",
                                    disabled: busy === u.id,
                                    onClick: () => setConfirm(u.id),
                                  },
                                  Ic.del,
                                  "Удалить",
                                ),
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
function AdminView({ me, say, statId, backHref }) {
  const [rev, setRev] = useState(0);
  const bump = () => setRev((r) => r + 1);
  // Статистика пользователя — отдельная страница #/admin/user/<id>
  if (statId)
    return React.createElement(
      "div",
      { className: "view-in", key: "st-" + statId },
      React.createElement(UserStats, { user: { id: statId, email: "" }, say: say, backHref: href("admin") }),
    );
  return React.createElement(
    "section",
    { className: "admin-view" },
    React.createElement(
      "div",
      { className: "ms-head" },
      React.createElement(
        "div",
        null,
        React.createElement("h1", null, "Админка"),
        React.createElement(
          "p",
          null,
          "Коды приглашений, пользователи и чёрный список. Видно только администратору.",
        ),
      ),
      React.createElement("a", { className: "btn", href: backHref }, "← Вернуться на сайт"),
    ),
    React.createElement(InviteCodes, { say: say }),
    React.createElement(AdminPanel, { me: me, say: say, rev: rev, onChange: bump }),
    React.createElement(Blacklist, { say: say, rev: rev, onChange: bump }),
  );
}
