"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { AppDataTable } from "@/components/ui";

type TanstackDataGridProps<T extends object> = {
  title: string;
  columns: ColumnDef<T>[];
  data: T[];
  pageSize?: number;
};

export function TanstackDataGrid<T extends object>({
  title,
  columns,
  data,
  pageSize = 10,
}: TanstackDataGridProps<T>) {
  return <AppDataTable title={title} columns={columns} data={data} pageSize={pageSize} />;
}
