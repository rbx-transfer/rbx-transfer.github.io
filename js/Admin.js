/*
 * rbx transfer — Admin.js
 * Админка: коды приглашений, чёрный список, статистика пользователя.
 * Файл собран из исходника src/Admin.ts*.
 */

import { useEffect, useState } from "./vendor/react.js?v=1aac96d1";
import { supabase, errText, kickBroadcast } from "./supabase.js?v=1aac96d1";
import { Num, Rbx } from "./ui.js?v=1aac96d1";
const d = (x) =>
  x
    ? new Date(x).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
// ---------- Одноразовые коды приглашений ----------
export function InviteCodes({ say }) {
  const [list, setList] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null);
  const [filter, setFilter] = useState("all");
  async function load() {
    const { data, error } = await supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      say(errText(error), "err");
      setList([]);
    } else setList(data);
  }
  useEffect(() => {
    load();
  }, []);
  async function create() {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_invite", { p_note: note || null });
    setBusy(false);
    if (error) {
      say(errText(error), "err");
      return;
    }
    setFresh(data);
    setNote("");
    load();
    try {
      await navigator.clipboard.writeText(data);
      say("Код создан и скопирован");
    } catch {
      say("Код создан");
    }
  }
  async function revoke(c) {
    const { error } = await supabase
      .from("invite_codes")
      .update({ revoked: true })
      .eq("code", c)
      .is("used_at", null);
    if (error) say(errText(error), "err");
    else {
      say("Код отключён");
      load();
    }
  }
  async function copy(c) {
    try {
      await navigator.clipboard.writeText(c);
      say("Скопировано");
    } catch {
      say("Не удалось скопировать", "err");
    }
  }
  const all = list || [];
  const free = all.filter((c) => !c.used_at && !c.revoked),
    used = all.filter((c) => c.used_at);
  const shown = filter === "free" ? free : filter === "used" ? used : all;
  return React.createElement(
    "section",
    { className: "card ms-card invites" },
    React.createElement(
      "div",
      { className: "ms-card-h" },
      React.createElement("h2", null, "Коды приглашений"),
      React.createElement("span", { className: "tag" }, "один код — одна регистрация"),
    ),
    React.createElement(
      "div",
      { className: "inv-new" },
      React.createElement(
        "label",
        { className: "inv-note" },
        "Пометка (кому)",
        React.createElement("input", {
          id: "inv-note",
          value: note,
          onChange: (e) => setNote(e.target.value),
          placeholder: "необязательно",
          maxLength: 80,
          autoComplete: "off",
        }),
      ),
      React.createElement(
        "button",
        { className: "primary big", onClick: create, disabled: busy },
        busy ? "Создаю…" : "Сгенерировать код",
      ),
      fresh &&
        React.createElement(
          "button",
          { type: "button", className: "inv-fresh", onClick: () => copy(fresh), title: "Скопировать" },
          React.createElement("span", null, "новый код"),
          React.createElement("b", null, fresh),
        ),
    ),
    React.createElement(
      "div",
      { className: "admin-stats" },
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Свободных"),
        React.createElement("span", { className: "v num" }, free.length),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Использовано"),
        React.createElement("span", { className: "v num" }, used.length),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Всего"),
        React.createElement("span", { className: "v num" }, all.length),
      ),
    ),
    React.createElement(
      "div",
      { className: "inv-filter tabs" },
      [
        ["all", "Все"],
        ["free", "Свободные"],
        ["used", "Использованные"],
      ].map(([k, t]) =>
        React.createElement(
          "button",
          { key: k, className: filter === k ? "on" : "", onClick: () => setFilter(k) },
          t,
        ),
      ),
    ),
    list === null
      ? React.createElement("div", { className: "empty" }, "Загружаю…")
      : !shown.length
        ? React.createElement("div", { className: "empty" }, "Кодов пока нет. Нажми «Сгенерировать код».")
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
                  React.createElement("th", null, "Код"),
                  React.createElement("th", null, "Пометка"),
                  React.createElement("th", null, "Создан"),
                  React.createElement("th", null, "Статус"),
                  React.createElement("th", null),
                ),
              ),
              React.createElement(
                "tbody",
                null,
                shown.map((c) =>
                  React.createElement(
                    "tr",
                    { key: c.code },
                    React.createElement(
                      "td",
                      null,
                      React.createElement(
                        "button",
                        { className: "code-chip", onClick: () => copy(c.code), title: "Скопировать" },
                        c.code,
                      ),
                    ),
                    React.createElement("td", { className: "tag" }, c.note || "—"),
                    React.createElement("td", { className: "num" }, d(c.created_at)),
                    React.createElement(
                      "td",
                      null,
                      c.used_at
                        ? React.createElement(
                            "span",
                            { className: "pill idle" },
                            "использован · ",
                            c.used_email,
                            " · ",
                            d(c.used_at),
                          )
                        : c.revoked
                          ? React.createElement("span", { className: "pill bad" }, "отключён")
                          : React.createElement("span", { className: "pill ok" }, "активен"),
                    ),
                    React.createElement(
                      "td",
                      { className: "actions" },
                      !c.used_at &&
                        !c.revoked &&
                        React.createElement(
                          "button",
                          { className: "ghost", onClick: () => revoke(c.code) },
                          "Отключить",
                        ),
                    ),
                  ),
                ),
              ),
            ),
          ),
  );
}
export function Blacklist({ say, rev, onChange }) {
  const [list, setList] = useState(null);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  async function load() {
    const { data, error } = await supabase.rpc("admin_blacklist_list");
    if (error) {
      say(errText(error), "err");
      setList([]);
    } else setList(data);
  }
  useEffect(() => {
    load();
  }, [rev]);
  async function add(e) {
    e?.preventDefault();
    const m = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) {
      say("Неверная почта", "err");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_blacklist_add", { p_email: m, p_reason: reason || null });
    if (!error) await kickBroadcast();
    setBusy(false);
    if (error) say(errText(error), "err");
    else {
      say(`${m} в чёрном списке, выкинут с сайта`);
      setEmail("");
      setReason("");
      onChange();
    }
  }
  async function remove(m) {
    const { error } = await supabase.rpc("admin_blacklist_remove", { p_email: m });
    if (error) say(errText(error), "err");
    else {
      say(`${m} убран из чёрного списка`);
      onChange();
    }
  }
  const all = list || [];
  const shown = all.filter((b) => !q || b.email.includes(q.toLowerCase()));
  return React.createElement(
    "section",
    { className: "card ms-card invites blacklist" },
    React.createElement(
      "div",
      { className: "ms-card-h" },
      React.createElement("h2", null, "Чёрный список"),
      React.createElement(
        "span",
        { className: "tag" },
        "почта из списка не может войти и зарегистрироваться",
      ),
    ),
    React.createElement(
      "form",
      { className: "inv-new", onSubmit: add },
      React.createElement(
        "label",
        { className: "inv-note" },
        "Почта",
        React.createElement("input", {
          id: "bl-email",
          type: "email",
          value: email,
          onChange: (e) => setEmail(e.target.value),
          placeholder: "user@mail.com",
          autoComplete: "off",
        }),
      ),
      React.createElement(
        "label",
        { className: "inv-note" },
        "Причина",
        React.createElement("input", {
          id: "bl-reason",
          value: reason,
          onChange: (e) => setReason(e.target.value),
          placeholder: "необязательно",
          maxLength: 120,
          autoComplete: "off",
        }),
      ),
      React.createElement(
        "button",
        { className: "danger big", type: "submit", disabled: busy },
        busy ? "Блокирую…" : "Заблокировать",
      ),
    ),
    React.createElement(
      "div",
      { className: "admin-stats" },
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "В списке"),
        React.createElement("span", { className: "v num" }, all.length),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "С аккаунтом на сайте"),
        React.createElement("span", { className: "v num" }, all.filter((b) => b.has_user).length),
      ),
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "k" }, "Удалены"),
        React.createElement("span", { className: "v num" }, all.filter((b) => !b.has_user).length),
      ),
    ),
    all.length > 5 &&
      React.createElement(
        "div",
        { className: "admin-search" },
        React.createElement("input", {
          type: "search",
          placeholder: "Поиск по почте",
          value: q,
          onChange: (e) => setQ(e.target.value),
          "aria-label": "Поиск в чёрном списке",
        }),
      ),
    list === null
      ? React.createElement("div", { className: "empty" }, "Загружаю…")
      : !shown.length
        ? React.createElement("div", { className: "empty" }, "Чёрный список пуст.")
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
                  React.createElement("th", null, "Почта"),
                  React.createElement("th", null, "Причина"),
                  React.createElement("th", null, "Добавлен"),
                  React.createElement("th", null, "Аккаунт"),
                  React.createElement("th", null),
                ),
              ),
              React.createElement(
                "tbody",
                null,
                shown.map((b) =>
                  React.createElement(
                    "tr",
                    { key: b.email, className: "row-in" },
                    React.createElement("td", null, b.email),
                    React.createElement("td", { className: "tag" }, b.reason || "—"),
                    React.createElement("td", { className: "num" }, d(b.created_at)),
                    React.createElement(
                      "td",
                      null,
                      b.has_user
                        ? React.createElement("span", { className: "pill bad" }, "заблокирован")
                        : React.createElement("span", { className: "pill idle" }, "удалён"),
                    ),
                    React.createElement(
                      "td",
                      { className: "actions" },
                      React.createElement(
                        "button",
                        { className: "ghost", onClick: () => remove(b.email) },
                        "Разблокировать",
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
  );
}
const n0 = (x) => Math.round(Number(x) || 0).toLocaleString("ru-RU");
const usd = (x) => "$" + (Number(x) || 0).toFixed(2);
function Tile({ k, v, h, accent }) {
  return React.createElement(
    "div",
    { className: "st-tile" + (accent ? " lead" : "") },
    React.createElement("span", { className: "k" }, k),
    React.createElement("span", { className: "v num" }, v),
    h && React.createElement("span", { className: "h" }, h),
  );
}
export function UserStats({ user, say, backHref }) {
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem("rbx-stat-tab") || "gift";
    } catch {
      return "gift";
    }
  });
  const pick = (t) => {
    setTab(t);
    try {
      localStorage.setItem("rbx-stat-tab", t);
    } catch {
      /* ignore */
    }
  };
  const [err, setErr] = useState("");
  async function load() {
    const { data, error } = await supabase.rpc("admin_user_stats", { target: user.id });
    if (error) {
      setErr(errText(error));
      say(errText(error), "err");
    } else {
      setErr("");
      setSt(data);
    }
  }
  useEffect(() => {
    load();
  }, [user.id]);
  const accs = st?.accounts || [];
  const totalBal = accs.reduce((a, x) => a + Number(x.balance), 0);
  const part = tab === "gp" ? st?.gamepass : st?.transfer;
  const accRows = accs;
  return React.createElement(
    "section",
    { className: "admin-view stats-page" },
    React.createElement(
      "div",
      { className: "ms-head" },
      React.createElement(
        "div",
        null,
        React.createElement("h1", null, "Статистика"),
        React.createElement(
          "p",
          { className: "st-mail" },
          st?.email || user.email,
          st?.blocked &&
            React.createElement("span", { className: "pill blk", style: { marginLeft: 8 } }, "в ЧС"),
        ),
      ),
      React.createElement(
        "span",
        { className: "ms-row" },
        React.createElement("button", { className: "ghost", onClick: load }, "Обновить"),
        React.createElement("a", { className: "btn", href: backHref }, "← К пользователям"),
      ),
    ),
    err && !st
      ? React.createElement("div", { className: "notice" }, err)
      : !st
        ? React.createElement("div", { className: "empty" }, "Загружаю…")
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "div",
              { className: "st-grid stagger" },
              React.createElement(Tile, {
                k: "Аккаунтов Roblox",
                v: React.createElement(Num, { value: accs.length, fmt: n0 }),
                h: `готовых ${accs.filter((a) => a.status === "ready").length}`,
              }),
              React.createElement(Tile, {
                k: "Баланс на аккаунтах",
                v: React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(Num, { value: totalBal, fmt: n0 }),
                  " ",
                  React.createElement(Rbx, null),
                ),
                h: "общий для геймпасса и трансфера",
                accent: true,
              }),
              React.createElement(Tile, {
                k: "Передано всего",
                v: React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(Num, {
                    value: Number(st.gamepass.sum) + Number(st.transfer.sum),
                    fmt: n0,
                  }),
                  " ",
                  React.createElement(Rbx, null),
                ),
                h: `${n0(Number(st.gamepass.count) + Number(st.transfer.count))} переводов`,
              }),
              React.createElement(Tile, {
                k: "Microsoft",
                v: usd(st.ms.balance),
                h: `${n0(st.ms.accounts)} почт · куплено ${n0(st.ms.robux)} R$`,
              }),
            ),
            React.createElement(
              "div",
              { className: "card st-meta" },
              React.createElement(
                "span",
                null,
                React.createElement("span", { className: "k" }, "Код приглашения"),
                st.invite_code
                  ? React.createElement("span", { className: "code-chip sm" }, st.invite_code)
                  : "—",
              ),
              React.createElement(
                "span",
                null,
                React.createElement("span", { className: "k" }, "Регистрация"),
                d(st.created_at),
              ),
              React.createElement(
                "span",
                null,
                React.createElement("span", { className: "k" }, "Последний вход"),
                d(st.last_sign_in_at),
              ),
            ),
            React.createElement(
              "nav",
              { className: "tabs st-tabs", role: "tablist" },
              [
                ["gift", "Донат гифт · трансфер"],
                ["gp", "Донат гифт · геймпасс"],
                ["ms", "Донат паки (Microsoft)"],
              ].map(([k, t]) =>
                React.createElement(
                  "button",
                  {
                    key: k,
                    role: "tab",
                    "aria-selected": tab === k,
                    className: tab === k ? "on" : "",
                    onClick: () => pick(k),
                  },
                  t,
                ),
              ),
            ),
            React.createElement(
              "div",
              { className: "view-in", key: "st-" + tab },
              tab !== "ms" && part
                ? React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      "div",
                      { className: "st-grid stagger" },
                      React.createElement(Tile, {
                        k: "Переводов",
                        v: React.createElement(Num, { value: Number(part.count), fmt: n0 }),
                        h: part.last ? `последний ${d(part.last)}` : "ещё не было",
                      }),
                      React.createElement(Tile, {
                        k: "Передано робуксов",
                        v: React.createElement(
                          React.Fragment,
                          null,
                          React.createElement(Num, { value: Number(part.sum), fmt: n0 }),
                          " ",
                          React.createElement(Rbx, null),
                        ),
                        accent: true,
                      }),
                      React.createElement(Tile, {
                        k: "За 24 часа",
                        v: React.createElement(
                          React.Fragment,
                          null,
                          React.createElement(Num, { value: Number(part.day), fmt: n0 }),
                          " ",
                          React.createElement(Rbx, null),
                        ),
                      }),
                      React.createElement(Tile, {
                        k: "За 30 дней",
                        v: React.createElement(
                          React.Fragment,
                          null,
                          React.createElement(Num, { value: Number(part.month), fmt: n0 }),
                          " ",
                          React.createElement(Rbx, null),
                        ),
                        h: `покупателей ${n0(part.buyers)}`,
                      }),
                    ),
                    React.createElement(
                      "div",
                      { className: "card ms-card" },
                      React.createElement(
                        "div",
                        { className: "ms-card-h" },
                        React.createElement("h2", null, "Загруженные аккаунты"),
                        React.createElement("span", { className: "tag" }, accRows.length),
                      ),
                      !accRows.length
                        ? React.createElement("div", { className: "empty" }, "Аккаунтов Roblox нет.")
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
                                  React.createElement("th", null, "Аккаунт"),
                                  React.createElement("th", null, "Статус"),
                                  React.createElement("th", { className: "n" }, "Баланс"),
                                  React.createElement("th", { className: "n" }, "Переводов"),
                                  React.createElement("th", { className: "n" }, "Передано"),
                                  React.createElement("th", null, "Последний перевод"),
                                  React.createElement("th", null, "Добавлен"),
                                ),
                              ),
                              React.createElement(
                                "tbody",
                                null,
                                accRows.map((a) => {
                                  const c = tab === "gp" ? a.gp_count : a.tr_count,
                                    sm = tab === "gp" ? a.gp_sum : a.tr_sum;
                                  return React.createElement(
                                    "tr",
                                    { key: a.name, className: "row-in" },
                                    React.createElement(
                                      "td",
                                      null,
                                      React.createElement("b", null, a.name),
                                      tab === "gift" &&
                                        a.plus_since &&
                                        React.createElement(
                                          "span",
                                          { className: "pill ok", style: { marginLeft: 6 } },
                                          "Plus",
                                        ),
                                    ),
                                    React.createElement(
                                      "td",
                                      null,
                                      a.status === "ready"
                                        ? React.createElement("span", { className: "pill ok" }, "готов")
                                        : React.createElement(
                                            "span",
                                            { className: "pill idle" },
                                            "не создан",
                                          ),
                                    ),
                                    React.createElement(
                                      "td",
                                      { className: "n num" },
                                      n0(a.balance),
                                      " ",
                                      React.createElement(Rbx, null),
                                    ),
                                    React.createElement("td", { className: "n num" }, n0(c)),
                                    React.createElement(
                                      "td",
                                      { className: "n num accent" },
                                      n0(sm),
                                      " ",
                                      React.createElement(Rbx, null),
                                    ),
                                    React.createElement("td", { className: "num nowrap" }, d(a.last_at)),
                                    React.createElement("td", { className: "num nowrap" }, d(a.created_at)),
                                  );
                                }),
                              ),
                            ),
                          ),
                    ),
                  )
                : React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      "div",
                      { className: "st-grid stagger" },
                      React.createElement(Tile, {
                        k: "Почт Microsoft",
                        v: React.createElement(Num, { value: Number(st.ms.accounts), fmt: n0 }),
                        h: `баланс ${usd(st.ms.balance)}`,
                      }),
                      React.createElement(Tile, {
                        k: "Куплено робуксов",
                        v: React.createElement(
                          React.Fragment,
                          null,
                          React.createElement(Num, { value: Number(st.ms.robux), fmt: n0 }),
                          " ",
                          React.createElement(Rbx, null),
                        ),
                        h: `${n0(st.ms.purchases)} заказов`,
                        accent: true,
                      }),
                      React.createElement(Tile, {
                        k: "Потрачено",
                        v: usd(st.ms.spent),
                        h: `ошибок ${n0(st.ms.errors)}`,
                      }),
                      React.createElement(Tile, {
                        k: "Пополнений кодами",
                        v: React.createElement(Num, { value: Number(st.ms.topups), fmt: n0 }),
                        h: `на ${usd(st.ms.topup_sum)}`,
                      }),
                    ),
                    React.createElement(
                      "div",
                      { className: "card ms-card" },
                      React.createElement(
                        "div",
                        { className: "ms-card-h" },
                        React.createElement("h2", null, "Загруженные почты Microsoft"),
                        React.createElement("span", { className: "tag" }, st.ms.list.length),
                      ),
                      !st.ms.list.length
                        ? React.createElement("div", { className: "empty" }, "Почт Microsoft нет.")
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
                                  React.createElement("th", null, "Почта"),
                                  React.createElement("th", { className: "n" }, "Баланс"),
                                  React.createElement("th", { className: "n" }, "Заказов"),
                                  React.createElement("th", { className: "n" }, "Куплено"),
                                  React.createElement("th", null, "Добавлена"),
                                ),
                              ),
                              React.createElement(
                                "tbody",
                                null,
                                st.ms.list.map((m) =>
                                  React.createElement(
                                    "tr",
                                    { key: m.email, className: "row-in" },
                                    React.createElement("td", null, m.email),
                                    React.createElement("td", { className: "n num accent" }, usd(m.balance)),
                                    React.createElement("td", { className: "n num" }, n0(m.purchases)),
                                    React.createElement(
                                      "td",
                                      { className: "n num" },
                                      n0(m.robux),
                                      " ",
                                      React.createElement(Rbx, null),
                                    ),
                                    React.createElement("td", { className: "num nowrap" }, d(m.created_at)),
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
