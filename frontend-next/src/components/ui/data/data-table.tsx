"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, type ReactNode } from "react";
import { Button, Card, Grid, Space, Typography } from "antd";

const { Text } = Typography;
const { useBreakpoint } = Grid;

export type AppDataTableProps<T extends object> = {
  title?: string;
  columns: ColumnDef<T>[];
  data: T[];
  pageSize?: number;
  emptyText?: string;
  isLoading?: boolean;
  expandableRows?: boolean;
  renderExpandedRow?: (row: T) => ReactNode;
};

export function AppDataTable<T extends object>({
  title = "Data",
  columns,
  data,
  pageSize = 10,
  emptyText = "No data found",
  isLoading = false,
  expandableRows = false,
  renderExpandedRow,
}: AppDataTableProps<T>) {
  const screens = useBreakpoint();
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's hook is intentionally used here.
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize },
    },
  });

  const isCompact = !screens.md;
  const rows = table.getRowModel().rows;

  return (
    <Card title={title}>
      {isLoading ? (
        <Text type="secondary">Loading...</Text>
      ) : rows.length === 0 ? (
        <Text type="secondary">{emptyText}</Text>
      ) : isCompact ? (
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          {rows.map((row) => (
            <Space key={row.id} orientation="vertical" size={8} style={{ width: "100%" }}>
              <Card
                size="small"
                style={{
                  borderRadius: 0,
                  border: "1px solid var(--line)",
                  boxShadow: "var(--shadow)",
                }}
              >
                <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                  {row.getVisibleCells().map((cell) => {
                    const headerContent = cell.column.columnDef.header;
                    const headerLabel =
                      typeof headerContent === "string"
                        ? headerContent
                        : cell.column.id
                          ? cell.column.id.replace(/_/g, " ")
                          : "Field";

                    return (
                      <div key={cell.id} style={{ display: "grid", gap: 4 }}>
                        <Text
                          type="secondary"
                          style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}
                        >
                          {headerLabel}
                        </Text>
                        <div style={{ fontSize: 15, lineHeight: 1.5 }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </div>
                    );
                  })}
                </Space>
              </Card>
              {expandableRows && renderExpandedRow ? <div>{renderExpandedRow(row.original)}</div> : null}
            </Space>
          ))}
        </Space>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #d9eadf",
                        padding: "10px 8px",
                        fontWeight: 700,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ borderBottom: "1px solid #eef6f1", padding: "10px 8px" }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expandableRows && renderExpandedRow ? (
                    <tr>
                      <td colSpan={row.getVisibleCells().length} style={{ padding: "10px 8px" }}>
                        {renderExpandedRow(row.original)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Space style={{ marginTop: 12 }}>
        <Button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </Button>
        <Button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
        <Text type="secondary">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </Text>
      </Space>
    </Card>
  );
}
