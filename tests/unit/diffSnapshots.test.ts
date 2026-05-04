import { describe, expect, it } from 'vitest'

import { compareRows } from '../../src/core/diff/compareRows'
import { detectTableKey } from '../../src/core/diff/detectTableKey'
import { diffSnapshots } from '../../src/core/diff/diffSnapshots'

describe('detectTableKey', () => {
  it('prefers id when present and unique', () => {
    expect(
      detectTableKey('users', [
        { id: 1, uuid: 'a' },
        { id: 2, uuid: 'b' },
      ]),
    ).toEqual(['id'])
  })

  it('falls back to uuid when id is not available', () => {
    expect(
      detectTableKey('sessions', [
        { uuid: 'a-1', token: 'x' },
        { uuid: 'a-2', token: 'y' },
      ]),
    ).toEqual(['uuid'])
  })

  it('supports singularized table-specific keys', () => {
    expect(
      detectTableKey('public.orders', [
        { order_id: 'ord-1', total: 10 },
        { order_id: 'ord-2', total: 20 },
      ]),
    ).toEqual(['order_id'])
  })

  it('returns no key when candidates are not reliable', () => {
    expect(detectTableKey('users', [{ id: 1 }, { id: 1 }])).toEqual([])
  })
})

describe('compareRows', () => {
  it('returns only changed fields', () => {
    expect(
      compareRows(
        { id: 1, name: 'Alice', active: true },
        { id: 1, name: 'Alicia', active: true },
      ),
    ).toEqual({
      name: {
        from: 'Alice',
        to: 'Alicia',
      },
    })
  })
})

describe('diffSnapshots', () => {
  it('diffs keyed tables using auto-detected id matching', () => {
    const diff = diffSnapshots(
      {
        users: [
          { id: 1, name: 'Alice', role: 'admin' },
          { id: 2, name: 'Bob', role: 'user' },
        ],
      },
      {
        users: [
          { id: 1, name: 'Alice', role: 'owner' },
          { id: 3, name: 'Carol', role: 'user' },
        ],
      },
    )

    expect(diff.users.status).toBe('modified')
    expect(diff.users.matchingStrategy).toBe('auto')
    expect(diff.users.keyColumns).toEqual(['id'])
    expect(diff.users.summary).toEqual({
      added: 1,
      removed: 1,
      modified: 1,
      unchanged: 0,
    })
    expect(diff.users.rows).toEqual([
      {
        status: 'modified',
        key: 'id=1',
        dataA: { id: 1, name: 'Alice', role: 'admin' },
        dataB: { id: 1, name: 'Alice', role: 'owner' },
        changes: {
          role: {
            from: 'admin',
            to: 'owner',
          },
        },
      },
      {
        status: 'added',
        key: 'id=3',
        dataA: undefined,
        dataB: { id: 3, name: 'Carol', role: 'user' },
        changes: {},
      },
      {
        status: 'removed',
        key: 'id=2',
        dataA: { id: 2, name: 'Bob', role: 'user' },
        dataB: undefined,
        changes: {},
      },
    ])
  })

  it('falls back to positional comparison when no stable key exists', () => {
    const diff = diffSnapshots(
      {
        audit_logs: [{ event: 'login', actor: 'alice' }],
      },
      {
        audit_logs: [{ event: 'login', actor: 'bob' }],
      },
    )

    expect(diff.audit_logs.matchingStrategy).toBe('position')
    expect(diff.audit_logs.keyColumns).toEqual([])
    expect(diff.audit_logs.warnings[0]).toMatch(
      /Rows were compared by position/,
    )
    expect(diff.audit_logs.rows[0]).toEqual({
      status: 'modified',
      key: 'index:0',
      dataA: { event: 'login', actor: 'alice' },
      dataB: { event: 'login', actor: 'bob' },
      changes: {
        actor: {
          from: 'alice',
          to: 'bob',
        },
      },
    })
  })

  it('marks added and removed tables', () => {
    const diff = diffSnapshots(
      {
        removed_table: [{ id: 1, value: 'before' }],
      },
      {
        added_table: [{ id: 2, value: 'after' }],
      },
    )

    expect(diff.added_table.status).toBe('added')
    expect(diff.added_table.summary).toEqual({
      added: 1,
      removed: 0,
      modified: 0,
      unchanged: 0,
    })
    expect(diff.removed_table.status).toBe('removed')
    expect(diff.removed_table.summary).toEqual({
      added: 0,
      removed: 1,
      modified: 0,
      unchanged: 0,
    })
  })

  it('keeps unchanged tables marked as unchanged', () => {
    const diff = diffSnapshots(
      {
        users: [{ uuid: 'u-1', name: 'Alice' }],
      },
      {
        users: [{ uuid: 'u-1', name: 'Alice' }],
      },
    )

    expect(diff.users.status).toBe('unchanged')
    expect(diff.users.summary).toEqual({
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 1,
    })
    expect(diff.users.matchingStrategy).toBe('auto')
    expect(diff.users.keyColumns).toEqual(['uuid'])
  })
})
