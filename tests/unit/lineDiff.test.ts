import { describe, expect, it } from 'vitest'

import { buildLineDiff } from '../../src/core/diff/lineDiff'

describe('buildLineDiff', () => {
  it('marks removed, added, and context lines with line numbers', () => {
    const lines = buildLineDiff('a\nb\nc', 'a\nx\nc\nd')

    expect(lines).toEqual([
      { type: 'context', leftNumber: 1, rightNumber: 1, content: 'a' },
      { type: 'removed', leftNumber: 2, rightNumber: null, content: 'b' },
      { type: 'added', leftNumber: null, rightNumber: 2, content: 'x' },
      { type: 'context', leftNumber: 3, rightNumber: 3, content: 'c' },
      { type: 'added', leftNumber: null, rightNumber: 4, content: 'd' },
    ])
  })
})
