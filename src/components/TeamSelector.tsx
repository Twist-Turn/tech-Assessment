import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Page, Team } from "../lib/types";
import { Select } from "./ui/select";

interface Props {
  value: string | null;
  onChange: (teamId: string | null) => void;
}

export function TeamSelector({ value, onChange }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Page<Team>>("/teams?limit=100")
      .then((d) => setTeams(d.items))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Select
      disabled={loading}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{loading ? "Loading teams…" : "— Select a team —"}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  );
}
