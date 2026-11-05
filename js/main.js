/*
 * rbx transfer — main.js
 * Точка входа: вход/выход, проверка блокировки (мгновенный выход), запуск приложения.
 * Файл собран из исходника src/main.ts*.
 */

import { StrictMode, useEffect, useState } from "./vendor/react.js?v=0208e316";
import { createRoot } from "./vendor/react-dom-client.js?v=0208e316";
import { supabase, configured, onKick } from "./supabase.js?v=0208e316";
import { AuthScreen, NewPasswordScreen } from "./Auth.js?v=0208e316";
import { Dashboard } from "./Dashboard.js?v=0208e316";
import { restoreRoute } from "./router.js?v=0208e316";
function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [kicked, setKicked] = useState(() => {
    try {
      return sessionStorage.getItem("rbx-kicked") || "";
    } catch {
      return "";
    }
  });
  const uid = session?.user.id;
  // Каждые 5 секунд и при возврате на вкладку проверяем, не удалён ли / не заблокирован ли пользователь
  useEffect(() => {
    if (!uid) return;
    let dead = false;
    async function check() {
      if (dead) return;
      const { data, error } = await supabase.rpc("my_status");
      if (dead || error) return;
      if (data === "blocked" || data === "gone") {
        const msg =
          data === "blocked" ? "Доступ к сайту закрыт администратором." : "Аккаунт удалён администратором.";
        try {
          sessionStorage.setItem("rbx-kicked", msg);
        } catch {
          /* ignore */
        }
        setKicked(msg);
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
      }
    }
    check();
    const t = window.setInterval(check, 4000);
    const off = onKick(() => {
      check();
    });
    const vis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("focus", vis);
    return () => {
      dead = true;
      off();
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("focus", vis);
    };
  }, [uid]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!configured)
    return React.createElement(
      "div",
      { className: "auth-wrap" },
      React.createElement(
        "div",
        { className: "auth" },
        React.createElement("h1", null, "Сайт не настроен"),
        React.createElement(
          "p",
          null,
          "Не заданы ключи Supabase. Открой файл config.js в репозитории на GitHub, вставь Project URL и anon key, сохрани и через минуту обнови страницу.",
        ),
      ),
    );
  if (!ready) return React.createElement("div", { className: "empty center" }, "Загружаю…");
  if (recovery && session)
    return React.createElement(NewPasswordScreen, { onDone: () => setRecovery(false) });
  if (!session)
    return React.createElement(AuthScreen, {
      notice: kicked,
      onNotice: () => {
        setKicked("");
        try {
          sessionStorage.removeItem("rbx-kicked");
        } catch {
          /* ignore */
        }
      },
    });
  return React.createElement(Dashboard, {
    key: session.user.id,
    email: session.user.email || "",
    userId: session.user.id,
  });
}
if (!document.querySelector(".bg-coins"))
  document.body.insertAdjacentHTML("afterbegin", '<div class="bg-coins" aria-hidden="true"></div>');
restoreRoute("gift/transfer/send");
createRoot(document.getElementById("root")).render(
  React.createElement(StrictMode, null, React.createElement(App, null)),
);
