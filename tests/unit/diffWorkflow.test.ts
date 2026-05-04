import { describe, expect, it } from 'vitest'

import { diffSnapshots } from '../../src/core/diff/diffSnapshots'
import { parseInsertDump } from '../../src/core/postgres/parseInsertDump'

describe('parser and diff workflow', () => {
  it('diffs parsed PostgreSQL INSERT snapshots end-to-end', () => {
    const left = parseInsertDump(`
      INSERT INTO users (id, name, role) VALUES
        (1, 'Alice', 'admin'),
        (2, 'Bob', 'user');
    `)

    const right = parseInsertDump(`
      INSERT INTO users (id, name, role) VALUES
        (1, 'Alice', 'owner'),
        (3, 'Carol', 'user');
    `)

    const diff = diffSnapshots(left, right)

    expect(diff.users.summary).toEqual({
      added: 1,
      removed: 1,
      modified: 1,
      unchanged: 0,
    })
    expect(diff.users.rows.map((row) => row.status)).toEqual(['modified', 'added', 'removed'])
  })
})
