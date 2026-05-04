import type { RowData, Snapshot } from '../model/types'
import { parseSqlValue } from './parseSqlValue'
import { splitValueTuples } from './splitValueTuples'

interface ParsedInsertStatement {
  tableName: string
  columns: string[]
  rows: RowData[]
}

const INSERT_INTO_RE = /^\s*INSERT\s+INTO\s+/i
const ONLY_RE = /^ONLY\b/i
const VALUES_RE = /^VALUES\b/i

export function parseInsertDump(sql: string): Snapshot {
  const snapshot: Snapshot = {}

  for (const statement of extractInsertStatements(sql)) {
    const parsed = parseInsertStatement(statement)
    const tableRows = snapshot[parsed.tableName] ?? []
    tableRows.push(...parsed.rows)
    snapshot[parsed.tableName] = tableRows
  }

  return snapshot
}

function extractInsertStatements(sql: string): string[] {
  const statements: string[] = []
  let statementStart = -1
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
      }

      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        index += 1
      }

      continue
    }

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        index += 1
        continue
      }

      if (char === "'") {
        inSingleQuote = false
      }

      continue
    }

    if (inDoubleQuote) {
      if (char === '"' && next === '"') {
        index += 1
        continue
      }

      if (char === '"') {
        inDoubleQuote = false
      }

      continue
    }

    if (char === '-' && next === '-') {
      inLineComment = true
      index += 1
      continue
    }

    if (char === '/' && next === '*') {
      inBlockComment = true
      index += 1
      continue
    }

    if (char === "'") {
      inSingleQuote = true
      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      continue
    }

    if (statementStart === -1 && isKeywordAt(sql, index, 'INSERT')) {
      statementStart = index
      index += 'INSERT'.length - 1
      continue
    }

    if (statementStart !== -1 && char === ';') {
      statements.push(sql.slice(statementStart, index + 1))
      statementStart = -1
    }
  }

  if (statementStart !== -1) {
    throw new Error('Unterminated INSERT statement in PostgreSQL snapshot.')
  }

  return statements
}

function parseInsertStatement(statement: string): ParsedInsertStatement {
  const prefixMatch = statement.match(INSERT_INTO_RE)

  if (!prefixMatch) {
    throw new Error('Unsupported INSERT statement encountered.')
  }

  let cursor = prefixMatch[0].length
  cursor = skipWhitespace(statement, cursor)

  const onlyMatch = statement.slice(cursor).match(ONLY_RE)

  if (onlyMatch) {
    cursor += onlyMatch[0].length
    cursor = skipWhitespace(statement, cursor)
  }

  const tableStart = cursor

  while (cursor < statement.length && statement[cursor] !== '(') {
    cursor += 1
  }

  if (statement[cursor] !== '(') {
    throw new Error('INSERT statement is missing a column list.')
  }

  const tableName = normalizeIdentifierPath(
    statement.slice(tableStart, cursor).trim(),
  )
  const columnsResult = readParenthesized(statement, cursor)
  const columns = splitIdentifierList(columnsResult.content)
  cursor = skipWhitespace(statement, columnsResult.endIndex)

  const valuesMatch = statement.slice(cursor).match(VALUES_RE)

  if (!valuesMatch) {
    throw new Error(
      `Unsupported INSERT form for table ${tableName}. Expected VALUES.`,
    )
  }

  cursor += valuesMatch[0].length
  const valuesSource = statement.slice(cursor).trim().replace(/;\s*$/, '')
  const tuples = splitValueTuples(valuesSource)

  const rows = tuples.map((tuple) => {
    const values = splitTupleValues(tuple).map(parseSqlValue)

    if (values.length !== columns.length) {
      throw new Error(
        `Column count mismatch for table ${tableName}. Expected ${columns.length} values, got ${values.length}.`,
      )
    }

    return Object.fromEntries(
      columns.map((column, index) => [column, values[index]]),
    )
  })

  return { tableName, columns, rows }
}

function splitTupleValues(tupleSource: string): string[] {
  const values: string[] = []
  let current = ''
  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let index = 0; index < tupleSource.length; index += 1) {
    const char = tupleSource[index]
    const next = tupleSource[index + 1]

    if (inSingleQuote) {
      current += char

      if (char === "'" && next === "'") {
        current += next
        index += 1
        continue
      }

      if (char === "'") {
        inSingleQuote = false
      }

      continue
    }

    if (inDoubleQuote) {
      current += char

      if (char === '"' && next === '"') {
        current += next
        index += 1
        continue
      }

      if (char === '"') {
        inDoubleQuote = false
      }

      continue
    }

    if (char === "'") {
      inSingleQuote = true
      current += char
      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      current += char
      continue
    }

    if (char === '(') {
      depth += 1
      current += char
      continue
    }

    if (char === ')') {
      depth -= 1
      current += char
      continue
    }

    if (depth === 0 && char === ',') {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (inSingleQuote || inDoubleQuote || depth !== 0) {
    throw new Error('Unterminated value list inside PostgreSQL INSERT tuple.')
  }

  if (current.trim() !== '') {
    values.push(current.trim())
  }

  return values
}

function splitIdentifierList(source: string): string[] {
  const identifiers: string[] = []
  let current = ''
  let inDoubleQuote = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (inDoubleQuote) {
      current += char

      if (char === '"' && next === '"') {
        current += next
        index += 1
        continue
      }

      if (char === '"') {
        inDoubleQuote = false
      }

      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      current += char
      continue
    }

    if (char === ',') {
      identifiers.push(normalizeIdentifier(current))
      current = ''
      continue
    }

    current += char
  }

  if (current.trim() !== '') {
    identifiers.push(normalizeIdentifier(current))
  }

  return identifiers.filter(Boolean)
}

function normalizeIdentifierPath(source: string): string {
  const parts: string[] = []
  let current = ''
  let inDoubleQuote = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (inDoubleQuote) {
      current += char

      if (char === '"' && next === '"') {
        current += next
        index += 1
        continue
      }

      if (char === '"') {
        inDoubleQuote = false
      }

      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      current += char
      continue
    }

    if (char === '.') {
      parts.push(normalizeIdentifier(current))
      current = ''
      continue
    }

    current += char
  }

  if (current.trim() !== '') {
    parts.push(normalizeIdentifier(current))
  }

  return parts.join('.')
}

function normalizeIdentifier(source: string): string {
  const trimmed = source.trim()

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"')
  }

  return trimmed
}

function readParenthesized(
  source: string,
  openIndex: number,
): { content: string; endIndex: number } {
  let depth = 0
  let inDoubleQuote = false

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (inDoubleQuote) {
      if (char === '"' && next === '"') {
        index += 1
        continue
      }

      if (char === '"') {
        inDoubleQuote = false
      }

      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      continue
    }

    if (char === '(') {
      depth += 1
      continue
    }

    if (char === ')') {
      depth -= 1

      if (depth === 0) {
        return {
          content: source.slice(openIndex + 1, index),
          endIndex: index + 1,
        }
      }
    }
  }

  throw new Error('Unterminated parenthesized expression in INSERT statement.')
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index

  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1
  }

  return cursor
}

function isKeywordAt(source: string, index: number, keyword: string): boolean {
  const value = source.slice(index, index + keyword.length)

  if (value.toUpperCase() !== keyword.toUpperCase()) {
    return false
  }

  const previous = source[index - 1]
  const next = source[index + keyword.length]

  return !isIdentifierChar(previous) && !isIdentifierChar(next)
}

function isIdentifierChar(value: string | undefined): boolean {
  return value !== undefined && /[A-Za-z0-9_$]/.test(value)
}
