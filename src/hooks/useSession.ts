import { useEffect, useState } from "react";
import { getSession, onSessionChange, type Session } from "../lib/auth";

export function useSession() {
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(getSession());
    setLoading(false);
    return onSessionChange((s) => setSession(s));
  }, []);

  return { session, loading };
}
