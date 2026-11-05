/*
 * rbx transfer — router.js
 * Маршруты сайта: адрес #/раздел/вкладка, кнопка «Назад», открытие вкладок в новом окне (СКМ).
 * Файл собран из исходника src/router.ts.
 */

// =====================================================================
// Маршруты сайта (многостраничность)
// ---------------------------------------------------------------------
// Каждая страница — свой адрес после «#», например:
//   #/gift/transfer/accounts   #/direct/journal   #/admin/user/<id>
// Поэтому работают кнопка «Назад» браузера, обновление страницы
// и открытие любой вкладки сайта в новой вкладке браузера (СКМ / Ctrl+клик).
// =====================================================================
import { useEffect, useState } from "./vendor/react.js?v=1aac96d1";
const LAST = "rbx-last-route";
/** Текущий путь без «#/», например "gift/transfer/send". */
function readPath() {
  return decodeURIComponent(location.hash.replace(/^#\/?/, ""));
}
/** Части текущего пути; компонент перерисовывается при каждой смене адреса. */
export function useRoute() {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const onChange = () => {
      const p = readPath();
      setPath(p);
      try {
        localStorage.setItem(LAST, p);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path.split("/").filter(Boolean);
}
/** Перейти на страницу (запись попадает в историю, «Назад» вернёт обратно). */
export function go(path) {
  const target = "#/" + path;
  if (location.hash !== target) location.hash = target;
}
/** Ссылка на страницу сайта: href для обычного клика, СКМ и «открыть в новой вкладке». */
export const href = (path) => "#/" + path;
/** При открытии сайта без адреса — вернуть последнюю открытую страницу. */
export function restoreRoute(fallback) {
  if (readPath()) return;
  let last = "";
  try {
    last = localStorage.getItem(LAST) || "";
  } catch {
    /* ignore */
  }
  history.replaceState(null, "", "#/" + (last || fallback));
}
