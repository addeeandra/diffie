export function splitValueTuples(valuesSource: string): string[] {
  const tuples: string[] = []
  let depth = 0
  let start = -1
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let index = 0; index < valuesSource.length; index += 1) {
    const char = valuesSource[index]
    const next = valuesSource[index + 1]

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
      if (depth === 0) {
        start = index + 1
      }

      depth += 1
      continue
    }

    if (char === ')') {
      if (depth === 0) {
        throw new Error(
          'Unexpected closing parenthesis while parsing VALUES tuples.',
        )
      }

      depth -= 1

      if (depth === 0) {
        tuples.push(valuesSource.slice(start, index))
        start = -1
      }
    }
  }

  if (inSingleQuote || inDoubleQuote || depth !== 0) {
    throw new Error(
      'Unterminated VALUES tuple while parsing PostgreSQL INSERT statement.',
    )
  }

  return tuples
}
