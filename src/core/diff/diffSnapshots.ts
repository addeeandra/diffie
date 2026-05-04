import type {
  DiffResult,
  RowData,
  RowDiff,
  Snapshot,
  TableDiff,
  TableShapeSummary,
  TableSummary,
} from '../model/types'

import { compareRows } from './compareRows'
import { detectTableKey } from './detectTableKey'

export function diffSnapshots(left: Snapshot, right: Snapshot): DiffResult {
  const diff: DiffResult = {}
  const tableNames = new Set([...Object.keys(left), ...Object.keys(right)])

  for (const tableName of [...tableNames].sort()) {
    const leftRows = left[tableName] ?? []
    const rightRows = right[tableName] ?? []

    if (!(tableName in left)) {
      diff[tableName] = buildWholeTableDiff('added', [], rightRows)
      continue
    }

    if (!(tableName in right)) {
      diff[tableName] = buildWholeTableDiff('removed', leftRows, [])
      continue
    }

    const columns = collectColumns(leftRows, rightRows)
    const shape = buildShapeSummary(leftRows, rightRows)
    const autoKeyColumns = resolveAutoKeyColumns(tableName, leftRows, rightRows)

    if (autoKeyColumns.length > 0) {
      diff[tableName] = buildKeyedTableDiff(
        columns,
        shape,
        leftRows,
        rightRows,
        autoKeyColumns,
      )
      continue
    }

    diff[tableName] = buildPositionalTableDiff(
      columns,
      shape,
      leftRows,
      rightRows,
    )
  }

  return diff
}

function resolveAutoKeyColumns(
  tableName: string,
  leftRows: RowData[],
  rightRows: RowData[],
): string[] {
  const leftKeys = detectTableKey(tableName, leftRows)
  const rightKeys = detectTableKey(tableName, rightRows)

  if (leftKeys.length === 0 || rightKeys.length === 0) {
    return []
  }

  return areSameKeyColumns(leftKeys, rightKeys) ? leftKeys : []
}

function areSameKeyColumns(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((column, index) => column === right[index])
  )
}

function buildWholeTableDiff(
  status: 'added' | 'removed',
  leftRows: RowData[],
  rightRows: RowData[],
): TableDiff {
  const rows = status === 'added' ? rightRows : leftRows
  const tableRows: RowDiff[] = rows.map((row) => ({
    status,
    key: `row:${buildRowFingerprint(row)}`,
    dataA: status === 'removed' ? row : undefined,
    dataB: status === 'added' ? row : undefined,
    changes: {},
  }))

  return {
    status,
    columns: collectColumns(leftRows, rightRows),
    shape: buildShapeSummary(leftRows, rightRows),
    rows: tableRows,
    summary: summarize(tableRows),
    keyColumns: [],
    matchingStrategy: 'position',
    warnings: [],
  }
}

function buildKeyedTableDiff(
  columns: string[],
  shape: TableShapeSummary,
  leftRows: RowData[],
  rightRows: RowData[],
  keyColumns: string[],
): TableDiff {
  const leftIndex = indexRows(leftRows, keyColumns)
  const rightIndex = indexRows(rightRows, keyColumns)
  const orderedKeys = [
    ...rightRows.map((row) => serializeKey(row, keyColumns)),
    ...leftRows
      .map((row) => serializeKey(row, keyColumns))
      .filter((key) => !rightIndex.has(key)),
  ]

  const rows: RowDiff[] = []

  for (const key of orderedKeys) {
    const leftRow = leftIndex.get(key)
    const rightRow = rightIndex.get(key)

    if (!leftRow && rightRow) {
      rows.push({ status: 'added', key, dataB: rightRow, changes: {} })
      continue
    }

    if (leftRow && !rightRow) {
      rows.push({ status: 'removed', key, dataA: leftRow, changes: {} })
      continue
    }

    if (!leftRow || !rightRow) {
      continue
    }

    const changes = compareRows(leftRow, rightRow)

    if (Object.keys(changes).length > 0) {
      rows.push({
        status: 'modified',
        key,
        dataA: leftRow,
        dataB: rightRow,
        changes,
      })
      continue
    }

    rows.push({
      status: 'unchanged',
      key,
      dataA: leftRow,
      dataB: rightRow,
      changes: {},
    })
  }

  return {
    status: deriveTableStatus(rows),
    columns,
    shape,
    rows,
    summary: summarize(rows),
    keyColumns,
    matchingStrategy: 'auto',
    warnings: [],
  }
}

function buildPositionalTableDiff(
  columns: string[],
  shape: TableShapeSummary,
  leftRows: RowData[],
  rightRows: RowData[],
): TableDiff {
  const rows: RowDiff[] = []
  const max = Math.max(leftRows.length, rightRows.length)

  for (let index = 0; index < max; index += 1) {
    const leftRow = leftRows[index]
    const rightRow = rightRows[index]
    const key = `index:${index}`

    if (!leftRow && rightRow) {
      rows.push({ status: 'added', key, dataB: rightRow, changes: {} })
      continue
    }

    if (leftRow && !rightRow) {
      rows.push({ status: 'removed', key, dataA: leftRow, changes: {} })
      continue
    }

    if (!leftRow || !rightRow) {
      continue
    }

    const changes = compareRows(leftRow, rightRow)

    if (Object.keys(changes).length > 0) {
      rows.push({
        status: 'modified',
        key,
        dataA: leftRow,
        dataB: rightRow,
        changes,
      })
      continue
    }

    rows.push({
      status: 'unchanged',
      key,
      dataA: leftRow,
      dataB: rightRow,
      changes: {},
    })
  }

  return {
    status: deriveTableStatus(rows),
    columns,
    shape,
    rows,
    summary: summarize(rows),
    keyColumns: [],
    matchingStrategy: 'position',
    warnings: [
      'No stable key detected. Rows were compared by position and may produce misleading diffs if order changed.',
    ],
  }
}

function buildShapeSummary(
  leftRows: RowData[],
  rightRows: RowData[],
): TableShapeSummary {
  const leftColumns = collectColumns(leftRows, [])
  const rightColumns = collectColumns([], rightRows)
  const leftSet = new Set(leftColumns)
  const rightSet = new Set(rightColumns)

  return {
    leftColumns,
    rightColumns,
    addedColumns: rightColumns.filter((column) => !leftSet.has(column)),
    removedColumns: leftColumns.filter((column) => !rightSet.has(column)),
  }
}

function collectColumns(leftRows: RowData[], rightRows: RowData[]): string[] {
  const seen = new Set<string>()
  const columns: string[] = []

  for (const row of [...leftRows, ...rightRows]) {
    for (const column of Object.keys(row)) {
      if (!seen.has(column)) {
        seen.add(column)
        columns.push(column)
      }
    }
  }

  return columns
}

function indexRows(
  rows: RowData[],
  keyColumns: string[],
): Map<string, RowData> {
  const index = new Map<string, RowData>()

  for (const row of rows) {
    index.set(serializeKey(row, keyColumns), row)
  }

  return index
}

function serializeKey(row: RowData, keyColumns: string[]): string {
  return keyColumns
    .map((column) => `${column}=${JSON.stringify(row[column])}`)
    .join('|')
}

function deriveTableStatus(rows: RowDiff[]): TableDiff['status'] {
  return rows.some((row) => row.status !== 'unchanged')
    ? 'modified'
    : 'unchanged'
}

function summarize(rows: RowDiff[]): TableSummary {
  return rows.reduce<TableSummary>(
    (summary, row) => {
      summary[row.status] += 1
      return summary
    },
    {
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
    },
  )
}

function buildRowFingerprint(row: RowData): string {
  return Object.entries(row)
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join('|')
}
