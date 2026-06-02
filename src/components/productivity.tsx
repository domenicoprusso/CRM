import Link from "next/link";
import { ActivityType, TaskPriority, TaskStatus, type Activity, type Task } from "@prisma/client";
import type { TimelineEvent } from "@/lib/timeline";
import { CalendarCheck2, ClipboardList, ListTodo, MessageSquareMore, SquareCheckBig } from "lucide-react";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(date: Date | null | undefined) {
  return date ? dayFormatter.format(date) : "N/D";
}

function formatDateTime(date: Date | null | undefined) {
  return date ? dateFormatter.format(date) : "N/D";
}

function priorityTone(priority: TaskPriority) {
  if (priority === TaskPriority.URGENT || priority === TaskPriority.HIGH) return "red" as const;
  if (priority === TaskPriority.MEDIUM) return "amber" as const;
  return "slate" as const;
}

function taskStatusTone(status: TaskStatus) {
  if (status === TaskStatus.DONE) return "brand" as const;
  if (status === TaskStatus.CANCELLED) return "red" as const;
  return "slate" as const;
}

function activityIcon(type: ActivityType) {
  if (type === ActivityType.EMAIL) return <MessageSquareMore className="h-4 w-4" />;
  if (type === ActivityType.CALL) return <ListTodo className="h-4 w-4" />;
  if (type === ActivityType.MEETING) return <CalendarCheck2 className="h-4 w-4" />;
  if (type === ActivityType.FOLLOW_UP) return <ClipboardList className="h-4 w-4" />;
  return <SquareCheckBig className="h-4 w-4" />;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={taskStatusTone(status)}>{status}</Badge>;
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={priorityTone(priority)}>{priority}</Badge>;
}

export function ActivityTypeBadge({ type }: { type: ActivityType }) {
  return <Badge tone="slate">{type}</Badge>;
}

export function NextActionPanel({ task }: { task: (Task & { owner: { name: string } }) | null }) {
  if (!task) {
    return <EmptyState message="Nessuna prossima azione aperta associata a questa opportunita." />;
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2 text-brand-700 shadow-soft">{activityIcon(ActivityType.FOLLOW_UP)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/tasks/${task.id}`} className="font-semibold text-brand-700 hover:text-brand-900">
              {task.title}
            </Link>
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <p className="mt-1 text-sm text-slate-600">{task.owner.name} · Scadenza {formatDate(task.dueAt)}</p>
          {task.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function ActivityTimeline({ activities }: { activities: Array<Activity & { user: { name: string }; company?: { id: string; name: string } | null; contact?: { id: string; firstName: string; lastName: string } | null; lead?: { id: string; title: string } | null; opportunity?: { id: string; title: string } | null }> }) {
  if (activities.length === 0) return <EmptyState message="Nessuna attivita registrata." />;

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="rounded-2xl border border-slate-100 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-50 p-2 text-slate-700">{activityIcon(activity.type)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/activities/${activity.id}`} className="font-semibold text-brand-700 hover:text-brand-900">
                  {activity.subject}
                </Link>
                <ActivityTypeBadge type={activity.type} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(activity.occurredAt)} · {activity.user.name}</p>
              {activity.body ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{activity.body}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {activity.company ? <Link href={`/companies/${activity.company.id}`} className="text-brand-700 hover:text-brand-900">{activity.company.name}</Link> : null}
                {activity.contact ? <Link href={`/contacts/${activity.contact.id}`} className="text-brand-700 hover:text-brand-900">{activity.contact.firstName} {activity.contact.lastName}</Link> : null}
                {activity.lead ? <Link href={`/leads/${activity.lead.id}`} className="text-brand-700 hover:text-brand-900">{activity.lead.title}</Link> : null}
                {activity.opportunity ? <Link href={`/opportunities/${activity.opportunity.id}`} className="text-brand-700 hover:text-brand-900">{activity.opportunity.title}</Link> : null}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskList({ tasks }: { tasks: Array<Task & { owner: { name: string }; company?: { id: string; name: string } | null; contact?: { id: string; firstName: string; lastName: string } | null; lead?: { id: string; title: string } | null; opportunity?: { id: string; title: string } | null }> }) {
  if (tasks.length === 0) return <EmptyState message="Nessun task presente." />;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-2xl border border-slate-100 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-50 p-2 text-slate-700">{task.status === TaskStatus.DONE ? <SquareCheckBig className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/tasks/${task.id}`} className="font-semibold text-brand-700 hover:text-brand-900">
                  {task.title}
                </Link>
                <TaskStatusBadge status={task.status} />
                <TaskPriorityBadge priority={task.priority} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {task.owner.name} · Scadenza {formatDate(task.dueAt)} · Promemoria {formatDateTime(task.reminderAt)}
              </p>
              {task.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {task.company ? <Link href={`/companies/${task.company.id}`} className="text-brand-700 hover:text-brand-900">{task.company.name}</Link> : null}
                {task.contact ? <Link href={`/contacts/${task.contact.id}`} className="text-brand-700 hover:text-brand-900">{task.contact.firstName} {task.contact.lastName}</Link> : null}
                {task.lead ? <Link href={`/leads/${task.lead.id}`} className="text-brand-700 hover:text-brand-900">{task.lead.title}</Link> : null}
                {task.opportunity ? <Link href={`/opportunities/${task.opportunity.id}`} className="text-brand-700 hover:text-brand-900">{task.opportunity.title}</Link> : null}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductivitySectionLink({ href, label }: { href: string; label: string }) {
  return <ButtonLink href={href}>{label}</ButtonLink>;
}

// ─── Unified CRM Timeline ────────────────────────────────────────────────────

const timelineDateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const TONE_CLASSES = {
  brand: "bg-brand-50 text-brand-700",
  red:   "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
  slate: "bg-slate-100 text-slate-700",
} as const;

const DOT_CLASSES = {
  brand: "bg-brand-500",
  red:   "bg-red-500",
  amber: "bg-amber-500",
  slate: "bg-slate-400",
} as const;

export function UnifiedTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState message="Nessun evento registrato per questo record." />
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-slate-200" aria-hidden />

      {events.map((event, index) => (
        <div key={event.id} className={`relative flex gap-4 pb-5 ${index === events.length - 1 ? "pb-0" : ""}`}>
          {/* Dot */}
          <div className="relative mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
            <span className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${DOT_CLASSES[event.badge.tone]}`} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {/* Badge */}
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[event.badge.tone]}`}>
                {event.badge.label}
              </span>
              {/* Timestamp */}
              <span className="text-xs text-slate-400">
                {timelineDateFormatter.format(event.at)}
              </span>
              {/* Actor */}
              <span className="text-xs font-medium text-slate-600">{event.actor}</span>
            </div>

            {/* Title */}
            <div className="mt-1">
              {event.href ? (
                <Link href={event.href} className="text-sm font-semibold text-brand-700 hover:text-brand-900 hover:underline">
                  {event.title}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-slate-900">{event.title}</p>
              )}
            </div>

            {/* Subtitle */}
            {event.subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{event.subtitle}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
