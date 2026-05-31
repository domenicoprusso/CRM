export type NotificationCategoryId = "overdue" | "due-today" | "followup-today" | "opportunity-no-next-action";

export type NotificationItem = {
  fingerprint: string;
  categoryId: NotificationCategoryId;
  categoryLabel: string;
  title: string;
  subtitle: string;
  href: string;
  tone: "red" | "amber" | "brand" | "slate";
  sortAt: string;
};

export type NotificationSection = {
  id: NotificationCategoryId;
  label: string;
  description: string;
  tone: "red" | "amber" | "brand" | "slate";
  count: number;
  items: NotificationItem[];
};

export type NotificationSnapshot = {
  generatedAt: string;
  totalCount: number;
  sections: NotificationSection[];
  items: NotificationItem[];
};

