"use client";

import { cn } from "@/lib/utils";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-primary)]">
      <table className={cn("data-table", className)}>{children}</table>
    </div>
  );
}

export function TableHead({ children, className }: TableProps) {
  return <thead className={className}>{children}</thead>;
}

export function TableBody({ children, className }: TableProps) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableRow({ children, className }: TableProps) {
  return <tr className={className}>{children}</tr>;
}

export function TableHeader({ children, className }: TableProps) {
  return (
    <th className={cn("first:rounded-tl-2xl last:rounded-tr-2xl", className)}>
      {children}
    </th>
  );
}

export function TableCell({ children, className }: TableProps) {
  return <td className={className}>{children}</td>;
}