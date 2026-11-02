// The chart card every Reports chart sits in (I-141): the question as its title, one line saying what to do, the chart,
// and the same numbers as a table (a toggle, or always below), or - when there is nothing to draw - why.
import { useId, useState } from "react";
import { Bar, BarChart, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { Button, DataTable, EmptyState } from "../../components/ui/index.js";

const AXIS_TICK = { fontSize: 12, fill: "#334155" };
const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 6px 24px rgba(15,23,42,0.10)", fontSize: 13 };
const LABEL_WIDTH = 150;
const ROW_HEIGHT = 34;

// Colours with a word beside them everywhere (legend, table headings), so none of them carries meaning alone.
export const GREEN = "#1c9a59";
export const AMBER = "#f59e0b";
export const ORANGE = "#ea7a1b";
export const RED = "#dc2626";
export const BLUE = "#138096";

/**
 * Horizontal bars, one row per category. `series` = [{ key, name, color, text }]; more than one series are stacked
 * unless `stacked` is false. `onSelect(row, seriesKey)` makes a bar clickable (the table or chips are the keyboard way).
 * `target` draws a dashed line at that value.
 */
export function BarsChart({ data, categoryKey, series, stacked = true, onSelect, ariaLabel, target, targetLabel, unit = "" }) {
  const height = data.length * (stacked ? ROW_HEIGHT : ROW_HEIGHT * series.length * 0.75) + (series.length > 1 ? 64 : 24);
  const together = stacked && series.length > 1;
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={Math.max(height, 90)}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 28, top: 8, bottom: 4 }} barCategoryGap={6}>
          <XAxis type="number" allowDecimals={false} hide={!target} tick={AXIS_TICK} domain={[0, (max) => Math.max(max, target || 0)]} unit={unit} />
          <YAxis type="category" dataKey={categoryKey} width={LABEL_WIDTH} interval={0} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
          {series.length > 1 && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
          {target != null && <ReferenceLine x={target} stroke="#334155" strokeDasharray="5 4" label={{ value: targetLabel, position: "insideTopRight", fontSize: 11, fill: "#334155" }} />}
          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name}
              stackId={together ? "a" : undefined}
              fill={item.color}
              isAnimationActive={false}
              radius={together ? (index === series.length - 1 ? [0, 6, 6, 0] : 0) : [0, 6, 6, 0]}
              cursor={onSelect ? "pointer" : undefined}
              onClick={onSelect ? (entry) => onSelect(entry?.payload ?? entry, item.key) : undefined}
            >
              <LabelList
                dataKey={item.key}
                position={together ? "center" : "right"}
                formatter={(value) => (value ? value : "")}
                style={{ fontSize: 12, fontWeight: 600, fill: together ? item.text || "#fff" : "#334155" }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The chips under a chart: the keyboard and screen-reader way to open a bar. */
export function ChartChips({ items, onClick, ariaLabel = "Chart categories" }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onClick(item)}
          aria-label={item.aria}
          className="cursor-pointer rounded-lg bg-slate-50 px-2 py-1 text-2xs font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700 max-sm:min-h-11"
        >
          {item.label} · {item.count}
        </button>
      ))}
    </div>
  );
}

/**
 * @param question  the one question this chart answers (the card's title)
 * @param hint      one line: what to do with the answer
 * @param empty     { title, hint } instead of the chart when there is nothing to draw
 * @param table     { caption, columns, rows, rowKey } the same numbers as a table
 * @param tableBelow  show the table under the chart instead of behind a "Show as table" button
 */
export function ChartCard({ question, hint, empty, chart, table, tableBelow = false, children }) {
  const id = useId();
  const [asTable, setAsTable] = useState(false);
  const toggle = table && !tableBelow && !empty;
  const tableNode = table && (
    <DataTable caption={table.caption} columns={table.columns} rows={table.rows} rowKey={table.rowKey || "key"} pageSize={0} minWidth={table.minWidth || "md"} />
  );
  return (
    <section aria-labelledby={id} className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="section-title">{question}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{hint}</p>
        </div>
        {toggle && (
          <Button variant="secondary" size="sm" icon={asTable ? BarChart3 : Table2} onClick={() => setAsTable((on) => !on)}>
            {asTable ? "Show as chart" : "Show as table"}
          </Button>
        )}
      </div>
      {empty ? (
        <EmptyState size="sm" icon={BarChart3} title={empty.title} hint={empty.hint} />
      ) : toggle && asTable ? (
        tableNode
      ) : (
        <>
          {chart}
          {tableBelow && tableNode}
        </>
      )}
      {children}
    </section>
  );
}

/** A list under a question: title, hint, count, and the controls (downloads, filters) the caller puts in `action`. */
export function ListSection({ title, hint, count, action, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="section-title">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      <p className="meta" aria-live="polite">{count} {count === 1 ? "row" : "rows"}</p>
      {children}
    </section>
  );
}
