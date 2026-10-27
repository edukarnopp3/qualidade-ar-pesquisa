export const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// Keep gaps and signed endpoints intact; a min/max band is not an area from zero.
export function rangeRuns(rows) {
  const runs = []; let current = [];
  rows.forEach((row, index) => {
    if (row.n > 0 && Number.isFinite(row.min) && Number.isFinite(row.max)) current.push({ index, min: row.min, max: row.max });
    else if (current.length) { runs.push(current); current = []; }
  });
  if (current.length) runs.push(current);
  return runs;
}

export function weekdayBoxes(rows = []) {
  return Array.from({ length: 7 }, (_, day) => {
    const row = rows.find(entry => entry.day === day);
    // Empty tuples are accepted by ECharts; a bare null breaks boxplot parsing.
    return row?.n ? [row.min, row.q1, row.median, row.q3, row.max] : [null, null, null, null, null];
  });
}
