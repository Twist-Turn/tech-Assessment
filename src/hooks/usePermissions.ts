import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ResolvedPermissions } from "../lib/types";

export function useResolvedPermissions(userId: string | null, teamId: string | null) {
  const [data, setData] = useState<ResolvedPermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !teamId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<ResolvedPermissions>(
        `/resolve-permissions?userId=${encodeURIComponent(userId)}&teamId=${encodeURIComponent(teamId)}`
      )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, teamId]);

  return { data, loading, error };
}
