/*
 * rbx transfer — useTeamData.js
 * Загрузка аккаунтов, переводов и настроек из базы с автообновлением.
 * Файл собран из исходника src/useTeamData.ts*.
 */

import { useCallback, useEffect, useRef, useState } from "./vendor/react.js?v=8508abad";
import { supabase } from "./supabase.js?v=8508abad";
import { DEFAULT_SETTINGS } from "./calc.js?v=8508abad";
async function fetchAllTransfers() {
  const out = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("transfers")
      .select("*")
      .order("sent_at", { ascending: false })
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...data);
    if (!data || data.length < page) break;
  }
  return out;
}
export function useTeamData(userId) {
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timer = useRef(undefined);
  const load = useCallback(async () => {
    try {
      const [a, t, s, adm] = await Promise.all([
        supabase.from("accounts").select("*").order("sort_order").order("created_at"),
        fetchAllTransfers(),
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase.rpc("is_site_admin"),
      ]);
      if (a.error) throw a.error;
      if (s.error) throw s.error;
      setAccounts(a.data);
      setTransfers(t);
      if (s.data) setSettings({ ...DEFAULT_SETTINGS, ...s.data, ready_ratio: Number(s.data.ready_ratio) });
      setIsAdmin(adm.data === true);
      setError("");
    } catch (e) {
      setError(e.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    load();
    const reload = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(load, 250);
    };
    const ch = supabase
      .channel("my-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "transfers" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_settings" }, reload)
      .subscribe();
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      window.clearTimeout(timer.current);
    };
  }, [load]);
  return { accounts, transfers, settings, loading, error, reload: load, isAdmin };
}
