export type DiffLineType = 'context' | 'added' | 'removed'

export interface DiffLine {
  type: DiffLineType
  leftNumber: number | null
  rightNumber: number | null
  content: string
}

export function buildLineDiff(
  leftSource: string,
  rightSource: string,
): DiffLine[] {
  const leftLines = splitLines(leftSource)
  const rightLines = splitLines(rightSource)
  const lcs = buildLcsMatrix(leftLines, rightLines)

  const lines: DiffLine[] = []
  let leftIndex = 0
  let rightIndex = 0
  let leftNumber = 1
  let rightNumber = 1

  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    if (leftLines[leftIndex] === rightLines[rightIndex]) {
      lines.push({
        type: 'context',
        leftNumber,
        rightNumber,
        content: leftLines[leftIndex],
      })
      leftIndex += 1
      rightIndex += 1
      leftNumber += 1
      rightNumber += 1
      continue
    }

    if (lcs[leftIndex + 1][rightIndex] >= lcs[leftIndex][rightIndex + 1]) {
      lines.push({
        type: 'removed',
        leftNumber,
        rightNumber: null,
        content: leftLines[leftIndex],
      })
      leftIndex += 1
      leftNumber += 1
      continue
    }

    lines.push({
      type: 'added',
      leftNumber: null,
      rightNumber,
      content: rightLines[rightIndex],
    })
    rightIndex += 1
    rightNumber += 1
  }

  while (leftIndex < leftLines.length) {
    lines.push({
      type: 'removed',
      leftNumber,
      rightNumber: null,
      content: leftLines[leftIndex],
    })
    leftIndex += 1
    leftNumber += 1
  }

  while (rightIndex < rightLines.length) {
    lines.push({
      type: 'added',
      leftNumber: null,
      rightNumber,
      content: rightLines[rightIndex],
    })
    rightIndex += 1
    rightNumber += 1
  }

  return lines
}

function splitLines(source: string): string[] {
  return source.split('\n')
}

function buildLcsMatrix(leftLines: string[], rightLines: string[]): number[][] {
  const matrix = Array.from({ length: leftLines.length + 1 }, () =>
    Array.from({ length: rightLines.length + 1 }, () => 0),
  )

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (
      let rightIndex = rightLines.length - 1;
      rightIndex >= 0;
      rightIndex -= 1
    ) {
      if (leftLines[leftIndex] === rightLines[rightIndex]) {
        matrix[leftIndex][rightIndex] =
          matrix[leftIndex + 1][rightIndex + 1] + 1
        continue
      }

      matrix[leftIndex][rightIndex] = Math.max(
        matrix[leftIndex + 1][rightIndex],
        matrix[leftIndex][rightIndex + 1],
      )
    }
  }

  return matrix
}
