/*
 * rbx transfer — VaultUI.js
 * Поля пароля и 2FA, блок доступа с кодом 2FA в карточке аккаунта.
 * Файл собран из исходника src/VaultUI.ts*.
 */

import { useEffect, useState } from "./vendor/react.js";
import { supabase, errText } from "./supabase.js";
import { totp, verifyTotp, base32ToBytes, cleanSecret } from "./vault.js";
// Отключает автозаполнение браузера и менеджеров паролей (Chrome, Edge, Яндекс, LastPass, 1Password, Bitwarden).
// Поле пароля намеренно type="text": к type="password" браузер всегда предлагает сохранённые пароли.
export const noFill = (name) => ({
  name: "rbx-" + name + "-" + Math.random().toString(36).slice(2, 8),
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
});
export const emptySecret = { password: "", secret: "", code: "" };
export function SecretFields({ id, value, onChange, required }) {
  const [show, setShow] = useState(false);
  const bad = value.secret && !base32ToBytes(value.secret);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "label",
      { className: "sf-pw" },
      "Пароль Roblox",
      React.createElement(
        "span",
        { className: "pw" },
        React.createElement("input", {
          id: id + "-pw",
          type: "text",
          ...noFill("secret"),
          className: show ? "" : "masked",
          required: required,
          value: value.password,
          onChange: (e) => onChange({ ...value, password: e.target.value }),
        }),
        React.createElement(
          "button",
          {
            type: "button",
            className: "pw-eye",
            onClick: () => setShow(!show),
            "aria-label": show ? "Скрыть пароль" : "Показать пароль",
            title: show ? "Скрыть" : "Показать",
          },
          show
            ? React.createElement(
                "svg",
                { width: "17", height: "17", viewBox: "0 0 24 24", "aria-hidden": "true" },
                React.createElement("path", {
                  d: "M3 3l18 18M10.6 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9 5.5 9.5 7-.3.9-1.5 2.9-3.4 4.6M6.4 6.6C4.3 8 2.9 10.4 2.5 12c.5 1.5 4 7 9.5 7 1.6 0 3-.4 4.2-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }),
              )
            : React.createElement(
                "svg",
                { width: "17", height: "17", viewBox: "0 0 24 24", "aria-hidden": "true" },
                React.createElement("path", {
                  d: "M2.5 12C3 10.5 6.5 5 12 5s9 5.5 9.5 7c-.5 1.5-4 7-9.5 7s-9-5.5-9.5-7z",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2",
                  strokeLinejoin: "round",
                }),
                React.createElement("circle", {
                  cx: "12",
                  cy: "12",
                  r: "3",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2",
                }),
              ),
        ),
      ),
    ),
    React.createElement(
      "label",
      { className: "sf-key" },
      "Ключ 2FA",
      React.createElement("input", {
        id: id + "-2fa",
        ...noFill("key"),
        required: required,
        placeholder: "JBSWY3DPEHPK3PXP",
        value: value.secret,
        onChange: (e) => onChange({ ...value, secret: e.target.value }),
        className: bad ? "invalid" : "",
      }),
    ),
    React.createElement(
      "label",
      { className: "sf-code" },
      "Текущий код 2FA",
      React.createElement("input", {
        id: id + "-code",
        inputMode: "numeric",
        ...noFill("otp"),
        maxLength: 8,
        required: required || !!value.secret,
        placeholder: "6 цифр",
        value: value.code,
        onChange: (e) => onChange({ ...value, code: e.target.value.replace(/\D/g, "") }),
      }),
    ),
  );
}
// Проверка пароля и ключа 2FA; возвращает текст ошибки или поля для записи
export async function sealSecrets(v) {
  if (!v.password) return { error: "Укажи пароль Roblox." };
  if (!base32ToBytes(v.secret))
    return { error: "Ключ 2FA выглядит неверно: только латинские буквы A–Z и цифры 2–7." };
  if (!(await verifyTotp(v.secret, v.code)))
    return { error: "Код 2FA не совпал. Проверь ключ и введи код, который сейчас показывает приложение." };
  return { roblox_password: v.password, totp_secret: cleanSecret(v.secret) };
}
// ---------- Блок доступа в карточке аккаунта ----------
export function AccessPanel({ acc, now, say, onSetup }) {
  const [code, setCode] = useState("······");
  const [showPw, setShowPw] = useState(false);
  const step = Math.floor(now / 30000);
  useEffect(() => {
    if (acc.totp_secret)
      totp(acc.totp_secret)
        .then(setCode)
        .catch(() => setCode("ошибка"));
  }, [acc.totp_secret, step]);
  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      say(`${what} скопирован`);
    } catch {
      say("Не удалось скопировать: выдели и скопируй вручную");
    }
  }
  const left = 30 - Math.floor((now / 1000) % 30);
  const login = React.createElement(
    "div",
    { className: "acc-field" },
    React.createElement("span", { className: "k" }, "Логин"),
    React.createElement("span", { className: "val num" }, acc.name),
    React.createElement(
      "button",
      { className: "ghost mini", onClick: () => copy(acc.name, "Логин") },
      "копировать",
    ),
  );
  if (!acc.roblox_password || !acc.totp_secret)
    return React.createElement(
      "div",
      { className: "access none" },
      login,
      React.createElement(
        "div",
        { className: "acc-field wide" },
        React.createElement("span", { className: "msg warn" }, "Пароль и 2FA не заданы."),
        React.createElement("button", { className: "ghost mini", onClick: onSetup }, "добавить"),
      ),
    );
  return React.createElement(
    "div",
    { className: "access" },
    login,
    React.createElement(
      "div",
      { className: "acc-field" },
      React.createElement("span", { className: "k" }, "Пароль"),
      React.createElement("span", { className: "val num" }, showPw ? acc.roblox_password : "••••••••••"),
      React.createElement(
        "button",
        { className: "ghost mini", onClick: () => setShowPw(!showPw) },
        showPw ? "скрыть" : "показать",
      ),
      React.createElement(
        "button",
        { className: "ghost mini", onClick: () => copy(acc.roblox_password, "Пароль") },
        "копировать",
      ),
    ),
    React.createElement(
      "div",
      { className: "acc-field code" },
      React.createElement("span", { className: "k" }, "Код 2FA"),
      React.createElement(
        "span",
        { className: "val totp num", "aria-live": "polite" },
        code.slice(0, 3),
        " ",
        code.slice(3),
      ),
      React.createElement(
        "span",
        { className: "ring", style: { ["--p"]: String(left / 30) }, title: `обновится через ${left} с` },
        React.createElement("span", null, left),
      ),
      React.createElement(
        "button",
        { className: "ghost mini", onClick: () => copy(code, "Код") },
        "копировать",
      ),
    ),
  );
}
export function InvitesPanel({ say }) {
  const [list, setList] = useState(null);
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState(null);
  async function load() {
    const { data, error } = await supabase.rpc("admin_list_invites");
    if (error) {
      say(errText(error));
      setList([]);
    } else setList(data);
  }
  useEffect(() => {
    load();
  }, []);
  async function add(e) {
    e.preventDefault();
    const { error } = await supabase.from("invites").insert({ email: email.trim().toLowerCase() });
    if (error) say(errText(error));
    else {
      say("Приглашение добавлено. Пусть зарегистрируется на сайте с этой почтой.");
      setEmail("");
      load();
    }
  }
  async function del(em) {
    const { error } = await supabase.from("invites").delete().eq("email", em);
    if (error) say(errText(error));
    else {
      setConfirm(null);
      load();
    }
  }
  return React.createElement(
    "section",
    { className: "card journal" },
    React.createElement(
      "div",
      { className: "journal-head" },
      React.createElement("h2", null, "Приглашения"),
      React.createElement("span", { className: "tag" }, "регистрация только для этих почт"),
    ),
    React.createElement(
      "form",
      { className: "form", onSubmit: add },
      React.createElement(
        "label",
        null,
        "Почта",
        React.createElement("input", {
          id: "invite-email",
          type: "email",
          required: true,
          value: email,
          onChange: (e) => setEmail(e.target.value),
          placeholder: "name@mail.ru",
        }),
      ),
      React.createElement("button", { className: "primary", type: "submit" }, "Пригласить"),
    ),
    list === null
      ? React.createElement("div", { className: "empty" }, "Загружаю…")
      : !list.length
        ? React.createElement("div", { className: "empty" }, "Приглашений нет.")
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
                  React.createElement("th", null, "Статус"),
                  React.createElement("th", null, "Добавлено"),
                  React.createElement("th", null),
                ),
              ),
              React.createElement(
                "tbody",
                null,
                list.map((i) =>
                  React.createElement(
                    "tr",
                    { key: i.email },
                    React.createElement("td", null, i.email),
                    React.createElement(
                      "td",
                      null,
                      i.registered
                        ? React.createElement("span", { className: "pill ok" }, "зарегистрирован")
                        : React.createElement("span", { className: "pill idle" }, "ещё не заходил"),
                    ),
                    React.createElement(
                      "td",
                      { className: "num" },
                      new Date(i.invited_at).toLocaleDateString("ru-RU"),
                    ),
                    React.createElement(
                      "td",
                      { className: "actions" },
                      confirm === i.email
                        ? React.createElement(
                            React.Fragment,
                            null,
                            React.createElement(
                              "button",
                              { className: "danger", onClick: () => del(i.email) },
                              "Отозвать",
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
                            { className: "ghost", onClick: () => setConfirm(i.email) },
                            "Отозвать",
                          ),
                    ),
                  ),
                ),
              ),
            ),
          ),
    React.createElement(
      "div",
      { className: "msg", style: { padding: "0 18px 14px" } },
      "Отзыв приглашения не удаляет уже зарегистрированного пользователя: для этого есть кнопка «Удалить» в списке ниже.",
    ),
  );
}
