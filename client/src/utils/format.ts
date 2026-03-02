import dayjs from "dayjs";

export const readableEnum = (value: string): string => value.replace(/_/g, " ");

export const formatDate = (value?: string | null): string =>
  value ? dayjs(value).format("MMM D, YYYY") : "-";

export const formatDateTime = (value?: string | null): string =>
  value ? dayjs(value).format("MMM D, YYYY h:mm A") : "-";

export const toInputDateTime = (value?: string | null): string =>
  value ? dayjs(value).format("YYYY-MM-DDTHH:mm") : "";
