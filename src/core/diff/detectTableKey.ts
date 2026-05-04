import type { RowData } from '../model/types'

const AUTO_KEY_CANDIDATES = ['id', 'uuid']

export function detectTableKey(tableName: string, rows: RowData[]): string[] {
  if (rows.length === 0) {
    return []
  }

  const tableSpecificCandidate = `${toSingular(baseTableName(tableName))}_id`
  const candidates = [...AUTO_KEY_CANDIDATES, tableSpecificCandidate]

  for (const candidate of candidates) {
    if (isUniqueKey(candidate, rows)) {
      return [candidate]
    }
  }

  return []
}

function isUniqueKey(column: string, rows: RowData[]): boolean {
  const seen = new Set<string>()

  for (const row of rows) {
    if (!(column in row)) {
      return false
    }

    const value = row[column]

    if (value === null || value === undefined || value === '') {
      return false
    }

    const serialized = serializeKeyPart(value)

    if (seen.has(serialized)) {
      return false
    }

    seen.add(serialized)
  }

  return true
}

function baseTableName(tableName: string): string {
  const parts = tableName.split('.')
  return parts[parts.length - 1]
}

function toSingular(value: string): string {
  if (value.endsWith('ies') && value.length > 3) {
    return `${value.slice(0, -3)}y`
  }

  if (value.endsWith('sses') || value.endsWith('uses')) {
    return value.slice(0, -2)
  }

  if (value.endsWith('s') && !value.endsWith('ss')) {
    return value.slice(0, -1)
  }

  return value
}

function serializeKeyPart(value: unknown): string {
  return typeof value === 'string' ? `string:${value}` : JSON.stringify(value)
}
