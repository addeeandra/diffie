import type { CellChange, RowData } from '../model/types'

export function compareRows(
  left: RowData,
  right: RowData,
): Record<string, CellChange> {
  const changes: Record<string, CellChange> = {}
  const columns = new Set([...Object.keys(left), ...Object.keys(right)])

  for (const column of columns) {
    if (!isEqual(left[column], right[column])) {
      changes[column] = {
        from: left[column],
        to: right[column],
      }
    }
  }

  return changes
}

function isEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false
    }

    return left.every((value, index) => isEqual(value, right[index]))
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)

    if (leftKeys.length !== rightKeys.length) {
      return false
    }

    return leftKeys.every((key) => isEqual(left[key], right[key]))
  }

  return false
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
