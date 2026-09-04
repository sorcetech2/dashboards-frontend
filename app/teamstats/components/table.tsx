'use client';
import React from 'react';

import type { Column, ColumnDef } from '@tanstack/react-table';

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Team = {
  team_name: string;
  total_recordings_count: number;
  recent_recordings_count: number;
  recent_active_members: number;
  total_members: number;
};
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

export const columns: ColumnDef<Team>[] = [
  {
    accessorKey: 'team_name',
    header: ({ column }) => headerSortButton(column, 'Team Name')
  },
  {
    accessorKey: 'recent_recordings_count',
    header: ({ column }) => headerSortButton(column, '# Recordings (Recent)')
  },
  {
    accessorKey: 'total_recordings_count',
    header: ({ column }) => headerSortButton(column, '# Recordings')
  },
  {
    accessorKey: 'recent_active_members',
    header: ({ column }) =>
      headerSortButton(column, '# Active Members (Recent)')
  },
  {
    accessorKey: 'total_members',
    header: ({ column }) => headerSortButton(column, '# Total Members')
  }
];

function headerSortButton(column: Column<Team, unknown>, name: string) {
  const sortDirection = column.getIsSorted();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      aria-label={`${name}: ${sortDirection ? `sorted ${sortDirection}` : 'not sorted'}. Activate to change sorting.`}
    >
      {name}
      <ArrowUpDown aria-hidden="true" className="ml-2 h-4 w-4" />
    </Button>
  );
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // TanStack Table intentionally returns stateful callbacks; keep the table
  // outside React Compiler memoization until the library exposes a compatible API.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting
    }
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableCaption className="sr-only">
          Recording and active-member totals by team
        </TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      header.column.getCanSort()
                        ? header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
