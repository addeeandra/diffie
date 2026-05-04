export type RowValue = string | number | boolean | null

export type RowData = Record<string, unknown>
export type Snapshot = Record<string, RowData[]>

export type RowStatus = 'added' | 'removed' | 'modified' | 'unchanged'
export type TableStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export interface CellChange {
  from: unknown
  to: unknown
}

export interface RowDiff {
  status: RowStatus
  key: string
  dataA?: RowData
  dataB?: RowData
  changes: Record<string, CellChange>
}

export interface TableSummary {
  added: number
  removed: number
  modified: number
  unchanged: number
}

export interface TableDiff {
  status: TableStatus
  columns: string[]
  rows: RowDiff[]
  summary: TableSummary
  keyColumns: string[]
  matchingStrategy: 'user' | 'auto' | 'position'
  warnings: string[]
}

export type DiffResult = Record<string, TableDiff>
