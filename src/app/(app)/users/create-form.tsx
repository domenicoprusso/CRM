"use client";

import { useActionState } from "react";
import { createTeamUser } from "./actions";
import { Card, Notice, SubmitButton } from "@/components/ui";

const ROLES = ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"] as const;
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES: "Commerciale",
  SUPPORT: "Supporto",
  VIEWER: "Viewer",
};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createTeamUser, {
    password: null,
    error: null,
  });

  return (
    <Card>
      <h3 className="text-lg font-semibold">Nuovo utente</h3>
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {state.password ? (
        <div className="my-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Utente creato.</p>
          <p className="mt-1 text-sm text-emerald-800">Password temporanea (mostrata solo ora):</p>
          <p className="mt-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-base font-bold text-slate-950 select-all">
            {state.password}
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            Comunicala direttamente all&apos;utente. Non verra mostrata di nuovo.
          </p>
        </div>
      ) : null}
      <form action={action} className="mt-4 grid gap-3">
        <input name="name" placeholder="Nome completo" required />
        <input name="email" type="email" placeholder="email@azienda.it" required />
        <select name="role" defaultValue="SALES">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <SubmitButton label={pending ? "Creazione in corso..." : "Crea utente"} />
      </form>
    </Card>
  );
}
