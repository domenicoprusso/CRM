import { toggleUserActive, updateUserRole } from "./actions";
import { CreateUserForm } from "./create-form";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readParam, type SearchParamsInput } from "@/lib/crm-filters";
import { getAllTeamUsers } from "@/lib/team";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"] as const;
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES: "Commerciale",
  SUPPORT: "Supporto",
  VIEWER: "Viewer",
};

const dayFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date | null) {
  return date ? dayFormatter.format(new Date(date)) : "Mai";
}

function listNotice(params: SearchParamsInput) {
  if (readParam(params, "updated") === "1") return { tone: "success" as const, message: "Utente aggiornato." };
  if (readParam(params, "error") === "self-role") return { tone: "error" as const, message: "Non puoi modificare il tuo ruolo." };
  if (readParam(params, "error") === "self-deactivate") return { tone: "error" as const, message: "Non puoi disattivare il tuo account." };
  if (readParam(params, "error") === "not-found") return { tone: "error" as const, message: "Utente non trovato." };
  return { tone: "slate" as const, message: undefined };
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const user = await requireUser("user:manage");
  const params = await searchParams;
  const notice = listNotice(params);
  const users = await getAllTeamUsers(prisma, user.tenantId);

  return (
    <>
      <PageHeader
        title="Team"
        description="Gestisci gli utenti del workspace, i ruoli e lo stato di accesso."
      />
      <Notice tone={notice.tone} message={notice.message} />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <CreateUserForm />

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <h3 className="text-lg font-semibold">Utenti del team</h3>
            <Badge tone="slate">{users.length} utenti</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Utente</th>
                  <th className="px-6 py-3">Ruolo</th>
                  <th className="px-6 py-3">Stato</th>
                  <th className="px-6 py-3">Ultimo accesso</th>
                  <th className="px-6 py-3">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50 ${!u.isActive ? "opacity-60" : ""}`}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-950">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      {u.id === user.id ? (
                        <span className="text-sm text-slate-500">{ROLE_LABELS[u.role] ?? u.role}</span>
                      ) : (
                        <form action={updateUserRole} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <select
                            name="role"
                            defaultValue={u.role}
                            className="rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 px-2 py-1 text-xs"
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-lg bg-slate-100 dark:bg-slate-700 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                          >
                            Salva
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={u.isActive ? "brand" : "slate"}>
                        {u.isActive ? "Attivo" : "Disattivo"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">
                      {formatDate(u.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4">
                      {u.id === user.id ? (
                        <span className="text-xs text-slate-400">Tu</span>
                      ) : (
                        <form action={toggleUserActive}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="isActive" value={u.isActive ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`rounded-lg px-3 py-1 text-xs font-medium ${
                              u.isActive
                                ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                                : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                            }`}
                          >
                            {u.isActive ? "Disattiva" : "Riattiva"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
