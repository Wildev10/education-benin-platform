import { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  hidden?: "sm" | "md" | "lg";
};

const hiddenCls: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export function Table<T>({
  columns,
  rows,
  getKey,
  caption,
  striped = true,
  empty = "Aucune donnée.",
  minWidth,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T, index: number) => string;
  caption?: string;
  striped?: boolean;
  empty?: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table
          className="w-full text-left text-sm"
          style={minWidth ? { minWidth } : undefined}
        >
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="bg-ink text-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    "px-5 py-4 font-semibold",
                    col.hidden ? hiddenCls[col.hidden] : "",
                    col.headerClassName ?? "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr
                key={getKey(row, i)}
                className={`transition ${
                  striped && i % 2 === 1 ? "bg-page" : "bg-surface"
                } hover:bg-brand-light/40`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      "px-5 py-4",
                      col.hidden ? hiddenCls[col.hidden] : "",
                      col.className ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {col.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="px-5 py-8 text-center text-ink-secondary">{empty}</p>
      )}
    </div>
  );
}
