/*
 * rbx transfer — Auth.js
 * Экран входа, регистрации по коду приглашения и восстановления пароля.
 * Файл собран из исходника src/Auth.ts*.
 */

import { useState } from "./vendor/react.js?v=0208e316";
import { supabase, errText } from "./supabase.js?v=0208e316";
import { Mark } from "./Dashboard.js?v=0208e316";
export function AuthScreen({ notice, onNotice } = {}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const fmtCode = (v) => {
    const x = v
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 15);
    return x.match(/.{1,5}/g)?.join("-") || "";
  };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code))
          throw new Error("Введи код приглашения целиком: XXXXX-XXXXX-XXXXX.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { invite_code: code },
            emailRedirectTo: window.location.origin + window.location.pathname,
          },
        });
        if (error) throw error;
        if (!data.session)
          setMsg({
            kind: "ok",
            text: "Готово. Мы отправили письмо для подтверждения почты — перейди по ссылке из него, потом войди.",
          });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) throw error;
        setMsg({
          kind: "ok",
          text: "Если такая почта зарегистрирована, на неё пришло письмо со ссылкой для смены пароля.",
        });
      }
    } catch (err) {
      setMsg({ kind: "bad", text: errText(err) });
    } finally {
      setBusy(false);
    }
  }
  const titles = { login: "Вход", signup: "Регистрация", reset: "Восстановление пароля" };
  const buttons = { login: "Войти", signup: "Зарегистрироваться", reset: "Отправить ссылку" };
  return React.createElement(
    "div",
    { className: "auth-wrap" },
    React.createElement(
      "form",
      { className: "auth", onSubmit: submit },
      React.createElement(
        "div",
        { className: "brand" },
        React.createElement(Mark, { size: 22 }),
        React.createElement(
          "span",
          { className: "wordmark" },
          "rbx",
          React.createElement("b", null, "transfer"),
        ),
      ),
      React.createElement("h1", null, titles[mode]),
      notice &&
        React.createElement(
          "div",
          { className: "kicked", role: "alert" },
          notice,
          " ",
          React.createElement(
            "button",
            { type: "button", className: "ghost", onClick: onNotice, "aria-label": "Закрыть" },
            "×",
          ),
        ),
      mode !== "reset" &&
        React.createElement(
          "div",
          { className: "tabs", role: "tablist" },
          React.createElement(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": mode === "login",
              className: mode === "login" ? "on" : "",
              onClick: () => {
                setMode("login");
                setMsg(null);
              },
            },
            "Вход",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": mode === "signup",
              className: mode === "signup" ? "on" : "",
              onClick: () => {
                setMode("signup");
                setMsg(null);
              },
            },
            "Регистрация",
          ),
        ),
      mode === "signup" &&
        React.createElement(
          "label",
          null,
          "Код приглашения",
          React.createElement("input", {
            id: "auth-code",
            className: "code-input",
            required: true,
            value: code,
            onChange: (e) => setCode(fmtCode(e.target.value)),
            placeholder: "XXXXX-XXXXX-XXXXX",
            autoComplete: "off",
            spellCheck: false,
          }),
        ),
      React.createElement(
        "label",
        null,
        "Почта",
        React.createElement("input", {
          id: "auth-email",
          type: "email",
          autoComplete: "email",
          required: true,
          value: email,
          onChange: (e) => setEmail(e.target.value),
        }),
      ),
      mode !== "reset" &&
        React.createElement(
          "label",
          null,
          "Пароль",
          React.createElement("input", {
            id: "auth-password",
            type: "password",
            autoComplete: mode === "login" ? "current-password" : "new-password",
            minLength: 6,
            required: true,
            value: password,
            onChange: (e) => setPassword(e.target.value),
          }),
        ),
      React.createElement(
        "button",
        { className: "primary", type: "submit", disabled: busy },
        busy ? "Подожди…" : buttons[mode],
      ),
      msg && React.createElement("div", { className: "msg " + msg.kind }, msg.text),
      mode === "login" &&
        React.createElement(
          "button",
          {
            type: "button",
            className: "link",
            onClick: () => {
              setMode("reset");
              setMsg(null);
            },
          },
          "Забыл пароль",
        ),
      mode === "reset" &&
        React.createElement(
          "button",
          {
            type: "button",
            className: "link",
            onClick: () => {
              setMode("login");
              setMsg(null);
            },
          },
          "Назад ко входу",
        ),
      mode === "signup" &&
        React.createElement(
          "p",
          { className: "hint" },
          "Нужен одноразовый код приглашения от администратора. После регистрации придёт письмо: перейди по ссылке, чтобы подтвердить почту.",
        ),
    ),
  );
}
export function NewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setErr(errText(error));
    else onDone();
  }
  return React.createElement(
    "div",
    { className: "auth-wrap" },
    React.createElement(
      "form",
      { className: "auth", onSubmit: submit },
      React.createElement(
        "div",
        { className: "brand" },
        React.createElement(Mark, { size: 22 }),
        React.createElement(
          "span",
          { className: "wordmark" },
          "rbx",
          React.createElement("b", null, "transfer"),
        ),
      ),
      React.createElement("h1", null, "Новый пароль"),
      React.createElement(
        "label",
        null,
        "Пароль",
        React.createElement("input", {
          id: "new-password",
          type: "password",
          autoComplete: "new-password",
          minLength: 6,
          required: true,
          value: password,
          onChange: (e) => setPassword(e.target.value),
        }),
      ),
      React.createElement(
        "button",
        { className: "primary", type: "submit", disabled: busy },
        "Сохранить пароль",
      ),
      err && React.createElement("div", { className: "msg bad" }, err),
    ),
  );
}
