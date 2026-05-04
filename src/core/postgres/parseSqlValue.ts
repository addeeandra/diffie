const NUMERIC_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

export function parseSqlValue(value: string): unknown {
  const trimmed = stripTopLevelCast(value.trim())

  if (/^null$/i.test(trimmed)) {
    return null
  }

  if (/^(true|t)$/i.test(trimmed)) {
    return true
  }

  if (/^(false|f)$/i.test(trimmed)) {
    return false
  }

  if (/^e'/i.test(trimmed) && trimmed.endsWith("'")) {
    return parseEscapeString(trimmed)
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return parseSingleQuotedString(trimmed)
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"')
  }

  if (NUMERIC_RE.test(trimmed)) {
    return Number(trimmed)
  }

  return trimmed
}

function stripTopLevelCast(value: string): string {
  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let index = 0; index < value.length - 1; index += 1) {
    const char = value[index]
    const next = value[index + 1]

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

    if (char === "'") {
      inSingleQuote = true
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
      continue
    }

    if (depth === 0 && char === ':' && next === ':') {
      return value.slice(0, index).trim()
    }
  }

  return value
}

function parseSingleQuotedString(value: string): string {
  return value.slice(1, -1).replace(/''/g, "'")
}

function parseEscapeString(value: string): string {
  const body = value.slice(2, -1).replace(/''/g, "'")
  let result = ''

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    const next = body[index + 1]

    if (char !== '\\') {
      result += char
      continue
    }

    if (next === undefined) {
      result += '\\'
      continue
    }

    const escapes: Record<string, string> = {
      "'": "'",
      '"': '"',
      '\\': '\\',
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
      v: '\v',
      '0': '\0',
    }

    result += escapes[next] ?? next
    index += 1
  }

  return result
}
