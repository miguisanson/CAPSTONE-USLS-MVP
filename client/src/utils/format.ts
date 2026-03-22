import dayjs from "dayjs";

export const readableEnum = (value: string): string => value.replace(/_/g, " ");

export const formatDate = (value?: string | null): string =>
  value ? dayjs(value).format("MMM D, YYYY") : "-";

export const formatDateTime = (value?: string | null): string =>
  value ? dayjs(value).format("MMM D, YYYY h:mm A") : "-";

export const toInputDateTime = (value?: string | null): string =>
  value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "";

export const diffDaysFromNow = (value?: string | null): number => {
  if (!value) return 0;
  return dayjs().diff(dayjs(value), "day");
};

export const dueInLabel = (value?: string | null): string => {
  if (!value) return "No due date";
  const diff = dayjs(value).diff(dayjs(), "day");
  if (diff < 0) return `${Math.abs(diff)} day(s) overdue`;
  if (diff === 0) return "Due today";
  return `Due in ${diff} day(s)`;
};
