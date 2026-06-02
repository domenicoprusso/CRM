import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimelineEventKind =
  | "created"
  | "import"
  | "activity"
  | "task"
  | "status_change"
  | "owner_change"
  | "stage_change"
  | "won"
  | "lost"
  | "converted"
  | "updated";

export type TimelineBadgeTone = "brand" | "red" | "amber" | "slate";

export type TimelineBadge = {
  label: string;
  tone: TimelineBadgeTone;
};

export type TimelineEvent = {
  id: string;
  at: Date;
  kind: TimelineEventKind;
  actor: string;
  title: string;
  subtitle?: string;
  href?: string;
  badge: TimelineBadge;
};

// ─── Badge config ─────────────────────────────────────────────────────────────

const KIND_BADGE: Record<TimelineEventKind, TimelineBadge> = {
  created:      { label: "Creazione",     tone: "brand"  },
  import:       { label: "Import",        tone: "slate"  },
  activity:     { label: "Attivita",      tone: "brand"  },
  task:         { label: "Task",          tone: "amber"  },
  status_change:{ label: "Cambio stato",  tone: "amber"  },
  owner_change: { label: "Cambio owner",  tone: "slate"  },
  stage_change: { label: "Cambio stage",  tone: "amber"  },
  won:          { label: "Won",           tone: "brand"  },
  lost:         { label: "Lost",          tone: "red"    },
  converted:    { label: "Conversione",   tone: "brand"  },
  updated:      { label: "Modifica",      tone: "slate"  },
};

export function badgeForKind(kind: TimelineEventKind): TimelineBadge {
  return KIND_BADGE[kind];
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

type JsonObj = Record<string, unknown>;

function str(val: unknown): string {
  return val == null ? "" : String(val);
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nuovo", CONTACTED: "Contattato", QUALIFIED: "Qualificato",
  NURTURING: "In coltivazione", CONVERTED: "Convertito", LOST: "Perso",
};

function leadStatusLabel(s: string) {
  return LEAD_STATUS_LABELS[s] ?? s;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  EMAIL: "Email", CALL: "Chiamata", MEETING: "Incontro",
  NOTE: "Nota", FOLLOW_UP: "Follow-up", IMPORT: "Import", AI_SUMMARY: "Sommario AI",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "Da fare", IN_PROGRESS: "In lavorazione", DONE: "Completato", CANCELLED: "Annullato",
};

// Detect most significant change in an UPDATE audit entry
function detectUpdateKind(
  before: JsonObj,
  after: JsonObj,
): { kind: TimelineEventKind; title: string } | null {
  // Status change (Lead)
  if (str(before.status) !== str(after.status) && str(after.status)) {
    return {
      kind: "status_change",
      title: `Stato: ${leadStatusLabel(str(before.status))} → ${leadStatusLabel(str(after.status))}`,
    };
  }
  // Owner change
  if (str(before.ownerId) !== str(after.ownerId) && str(after.ownerId)) {
    return { kind: "owner_change", title: "Owner riassegnato" };
  }
  // Stage change (Opportunity)
  if (str(before.stageId) !== str(after.stageId) && str(after.stageId)) {
    return { kind: "stage_change", title: "Stage aggiornato" };
  }
  return null;
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

function isImportActor(userId: string | null | undefined): boolean {
  return !userId;
}

function actorName(user: { name: string } | null, userId: string | null | undefined): string {
  if (isImportActor(userId)) return "Sistema (Import)";
  return user?.name ?? "Sistema";
}

function sortedDesc(events: TimelineEvent[]): TimelineEvent[] {
  return events.slice().sort((a, b) => b.at.getTime() - a.at.getTime());
}

// ─── Company timeline ─────────────────────────────────────────────────────────

export async function getCompanyTimeline(
  db: PrismaClient | typeof prisma,
  tenantId: string,
  companyId: string,
  limit = 50,
): Promise<TimelineEvent[]> {
  const [auditLogs, activities, tasks, contacts, leads, opportunities] = await Promise.all([
    db.auditLog.findMany({
      where: { tenantId, entityType: "Company", entityId: companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { name: true } } },
    }),
    db.activity.findMany({
      where: { tenantId, companyId },
      orderBy: { occurredAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
    db.task.findMany({
      where: { tenantId, companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { owner: { select: { name: true } } },
    }),
    // Contacts/Leads/Opps for context events
    db.contact.findMany({ where: { tenantId, companyId }, select: { id: true, firstName: true, lastName: true, createdAt: true } }),
    db.lead.findMany({ where: { tenantId, companyId }, select: { id: true, title: true, createdAt: true, status: true } }),
    db.opportunity.findMany({ where: { tenantId, companyId }, select: { id: true, title: true, createdAt: true } }),
  ]);

  const events: TimelineEvent[] = [];

  // Audit events for company itself
  for (const log of auditLogs) {
    const actor = actorName(log.user, log.userId);
    const before = (log.before ?? {}) as JsonObj;
    const after  = (log.after  ?? {}) as JsonObj;

    if (log.action === "CREATE") {
      const kind: TimelineEventKind = isImportActor(log.userId) ? "import" : "created";
      events.push({ id: log.id, at: log.createdAt, kind, actor,
        title: kind === "import" ? "Azienda importata da TeamSystem" : "Azienda creata",
        badge: badgeForKind(kind) });
    } else if (log.action === "UPDATE") {
      const detected = detectUpdateKind(before, after);
      if (detected) {
        events.push({ id: log.id, at: log.createdAt, kind: detected.kind, actor,
          title: detected.title, badge: badgeForKind(detected.kind) });
      } else {
        events.push({ id: log.id, at: log.createdAt, kind: "updated", actor,
          title: "Dati azienda aggiornati", badge: badgeForKind("updated") });
      }
    }
  }

  // Activity events
  for (const act of activities) {
    const typeLabel = ACTIVITY_TYPE_LABELS[act.type] ?? act.type;
    events.push({
      id: `act-${act.id}`, at: act.occurredAt, kind: "activity",
      actor: act.user.name,
      title: `${typeLabel}: ${act.subject}`,
      subtitle: act.body ?? undefined,
      href: `/activities/${act.id}`,
      badge: badgeForKind("activity"),
    });
  }

  // Task events
  for (const task of tasks) {
    const statusLabel = TASK_STATUS_LABELS[task.status] ?? task.status;
    events.push({
      id: `task-${task.id}`, at: task.createdAt, kind: "task",
      actor: task.owner.name,
      title: `Task: ${task.title}`,
      subtitle: `Stato: ${statusLabel}${task.dueAt ? ` · Scadenza ${new Intl.DateTimeFormat("it-IT").format(task.dueAt)}` : ""}`,
      href: `/tasks/${task.id}`,
      badge: badgeForKind("task"),
    });
  }

  // Structural context: contacts, leads, opportunities linked
  for (const contact of contacts) {
    events.push({
      id: `contact-created-${contact.id}`, at: contact.createdAt, kind: "created",
      actor: "Sistema",
      title: `Contatto collegato: ${contact.firstName} ${contact.lastName}`,
      href: `/contacts/${contact.id}`,
      badge: { label: "Contatto", tone: "slate" },
    });
  }
  for (const lead of leads) {
    events.push({
      id: `lead-created-${lead.id}`, at: lead.createdAt, kind: "created",
      actor: "Sistema",
      title: `Lead collegato: ${lead.title}`,
      href: `/leads/${lead.id}`,
      badge: { label: "Lead", tone: "brand" },
    });
  }
  for (const opp of opportunities) {
    events.push({
      id: `opp-created-${opp.id}`, at: opp.createdAt, kind: "created",
      actor: "Sistema",
      title: `Opportunita collegata: ${opp.title}`,
      href: `/opportunities/${opp.id}`,
      badge: { label: "Opportunita", tone: "brand" },
    });
  }

  return sortedDesc(events).slice(0, limit);
}

// ─── Lead timeline ────────────────────────────────────────────────────────────

export async function getLeadTimeline(
  db: PrismaClient | typeof prisma,
  tenantId: string,
  leadId: string,
  limit = 50,
): Promise<TimelineEvent[]> {
  const [lead, auditLogs, activities, tasks, oppAudit] = await Promise.all([
    db.lead.findFirst({
      where: { tenantId, id: leadId },
      select: { id: true, createdAt: true, sourceOpportunity: { select: { id: true, title: true } } },
    }),
    db.auditLog.findMany({
      where: { tenantId, entityType: "Lead", entityId: leadId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { name: true } } },
    }),
    db.activity.findMany({
      where: { tenantId, leadId },
      orderBy: { occurredAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
    db.task.findMany({
      where: { tenantId, leadId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { owner: { select: { name: true } } },
    }),
    // Conversion events
    db.auditLog.findMany({
      where: { tenantId, action: "CONVERT", entityType: "Lead", entityId: leadId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const events: TimelineEvent[] = [];

  // Creation event (from entity itself if no audit)
  if (lead) {
    const hasCreateAudit = auditLogs.some((l) => l.action === "CREATE");
    if (!hasCreateAudit) {
      events.push({
        id: `lead-self-created-${leadId}`, at: lead.createdAt, kind: "created",
        actor: "Sistema", title: "Lead creato",
        badge: badgeForKind("created"),
      });
    }
  }

  // Audit events
  for (const log of auditLogs) {
    const actor = actorName(log.user, log.userId);
    const before = (log.before ?? {}) as JsonObj;
    const after  = (log.after  ?? {}) as JsonObj;

    switch (log.action) {
      case "CREATE": {
        const kind: TimelineEventKind = isImportActor(log.userId) ? "import" : "created";
        events.push({ id: log.id, at: log.createdAt, kind, actor,
          title: kind === "import" ? "Lead importato da TeamSystem" : "Lead creato",
          badge: badgeForKind(kind) });
        break;
      }
      case "UPDATE": {
        const detected = detectUpdateKind(before, after);
        if (detected) {
          events.push({ id: log.id, at: log.createdAt, kind: detected.kind, actor,
            title: detected.title, badge: badgeForKind(detected.kind) });
        } else {
          events.push({ id: log.id, at: log.createdAt, kind: "updated", actor,
            title: "Lead aggiornato", badge: badgeForKind("updated") });
        }
        break;
      }
      case "CONVERT": {
        const oppTitle = lead?.sourceOpportunity?.title;
        events.push({ id: log.id, at: log.createdAt, kind: "converted", actor,
          title: "Lead convertito in opportunita",
          subtitle: oppTitle ? `Opportunita: ${oppTitle}` : undefined,
          href: lead?.sourceOpportunity ? `/opportunities/${lead.sourceOpportunity.id}` : undefined,
          badge: badgeForKind("converted") });
        break;
      }
    }
  }

  // Dedup convert events (both sources may log it)
  const seenConvert = new Set<string>();
  for (const log of oppAudit) {
    if (!seenConvert.has(log.id)) {
      seenConvert.add(log.id);
    }
  }

  // Activity events
  for (const act of activities) {
    const typeLabel = ACTIVITY_TYPE_LABELS[act.type] ?? act.type;
    events.push({
      id: `act-${act.id}`, at: act.occurredAt, kind: "activity",
      actor: act.user.name,
      title: `${typeLabel}: ${act.subject}`,
      subtitle: act.body ?? undefined,
      href: `/activities/${act.id}`,
      badge: badgeForKind("activity"),
    });
  }

  // Task events
  for (const task of tasks) {
    const statusLabel = TASK_STATUS_LABELS[task.status] ?? task.status;
    events.push({
      id: `task-${task.id}`, at: task.createdAt, kind: "task",
      actor: task.owner.name,
      title: `Task: ${task.title}`,
      subtitle: `Stato: ${statusLabel}${task.dueAt ? ` · Scadenza ${new Intl.DateTimeFormat("it-IT").format(task.dueAt)}` : ""}`,
      href: `/tasks/${task.id}`,
      badge: badgeForKind("task"),
    });
  }

  return sortedDesc(events).slice(0, limit);
}

// ─── Opportunity timeline ─────────────────────────────────────────────────────

export async function getOpportunityTimeline(
  db: PrismaClient | typeof prisma,
  tenantId: string,
  opportunityId: string,
  limit = 50,
): Promise<TimelineEvent[]> {
  const [opp, auditLogs, activities, tasks, stages] = await Promise.all([
    db.opportunity.findFirst({
      where: { tenantId, id: opportunityId },
      select: { id: true, createdAt: true, sourceLead: { select: { id: true, title: true } } },
    }),
    db.auditLog.findMany({
      where: { tenantId, entityType: "Opportunity", entityId: opportunityId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { name: true } } },
    }),
    db.activity.findMany({
      where: { tenantId, opportunityId },
      orderBy: { occurredAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
    db.task.findMany({
      where: { tenantId, opportunityId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { owner: { select: { name: true } } },
    }),
    db.pipelineStage.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
  ]);

  const stageMap = new Map(stages.map((s) => [s.id, s.name]));
  const events: TimelineEvent[] = [];

  // Creation event fallback
  if (opp) {
    const hasCreateAudit = auditLogs.some((l) => l.action === "CREATE");
    if (!hasCreateAudit) {
      const subtitle = opp.sourceLead ? `Da lead: ${opp.sourceLead.title}` : undefined;
      events.push({
        id: `opp-self-created-${opportunityId}`, at: opp.createdAt, kind: "created",
        actor: "Sistema",
        title: opp.sourceLead ? "Opportunita creata da conversione lead" : "Opportunita creata",
        subtitle,
        href: opp.sourceLead ? `/leads/${opp.sourceLead.id}` : undefined,
        badge: badgeForKind("created"),
      });
    }
  }

  // Audit events
  for (const log of auditLogs) {
    const actor = actorName(log.user, log.userId);
    const before = (log.before ?? {}) as JsonObj;
    const after  = (log.after  ?? {}) as JsonObj;

    switch (log.action) {
      case "CREATE": {
        const subtitle = opp?.sourceLead ? `Da lead: ${opp.sourceLead.title}` : undefined;
        events.push({ id: log.id, at: log.createdAt, kind: "created", actor,
          title: opp?.sourceLead ? "Opportunita creata da conversione lead" : "Opportunita creata",
          subtitle,
          href: opp?.sourceLead ? `/leads/${opp.sourceLead.id}` : undefined,
          badge: badgeForKind("created") });
        break;
      }
      case "UPDATE": {
        const detected = detectUpdateKind(before, after);
        if (detected && detected.kind === "stage_change") {
          const fromName = stageMap.get(str(before.stageId)) ?? "N/D";
          const toName   = stageMap.get(str(after.stageId))  ?? "N/D";
          events.push({ id: log.id, at: log.createdAt, kind: "stage_change", actor,
            title: `Stage: ${fromName} → ${toName}`,
            badge: badgeForKind("stage_change") });
        } else if (detected) {
          events.push({ id: log.id, at: log.createdAt, kind: detected.kind, actor,
            title: detected.title, badge: badgeForKind(detected.kind) });
        } else {
          events.push({ id: log.id, at: log.createdAt, kind: "updated", actor,
            title: "Opportunita aggiornata", badge: badgeForKind("updated") });
        }
        break;
      }
      case "MOVE": {
        const fromName = stageMap.get(str(before.stageId)) ?? "N/D";
        const toName   = stageMap.get(str(after.stageId))  ?? "N/D";
        events.push({ id: log.id, at: log.createdAt, kind: "stage_change", actor,
          title: `Stage: ${fromName} → ${toName}`,
          badge: badgeForKind("stage_change") });
        break;
      }
      case "MARK_WON": {
        events.push({ id: log.id, at: log.createdAt, kind: "won", actor,
          title: "Opportunita segnata come vinta",
          badge: badgeForKind("won") });
        break;
      }
      case "MARK_LOST": {
        events.push({ id: log.id, at: log.createdAt, kind: "lost", actor,
          title: "Opportunita segnata come persa",
          badge: badgeForKind("lost") });
        break;
      }
    }
  }

  // Activity events
  for (const act of activities) {
    const typeLabel = ACTIVITY_TYPE_LABELS[act.type] ?? act.type;
    events.push({
      id: `act-${act.id}`, at: act.occurredAt, kind: "activity",
      actor: act.user.name,
      title: `${typeLabel}: ${act.subject}`,
      subtitle: act.body ?? undefined,
      href: `/activities/${act.id}`,
      badge: badgeForKind("activity"),
    });
  }

  // Task events
  for (const task of tasks) {
    const statusLabel = TASK_STATUS_LABELS[task.status] ?? task.status;
    events.push({
      id: `task-${task.id}`, at: task.createdAt, kind: "task",
      actor: task.owner.name,
      title: `Task: ${task.title}`,
      subtitle: `Stato: ${statusLabel}${task.dueAt ? ` · Scadenza ${new Intl.DateTimeFormat("it-IT").format(task.dueAt)}` : ""}`,
      href: `/tasks/${task.id}`,
      badge: badgeForKind("task"),
    });
  }

  return sortedDesc(events).slice(0, limit);
}
