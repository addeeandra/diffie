import type { CellChange, RowData } from '../model/types'

export function compareRows(_left: RowData, _right: RowData): Record<string, CellChange> {
  throw new Error('compareRows() is not implemented yet.')
}
