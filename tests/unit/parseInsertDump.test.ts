import { describe, expect, it } from 'vitest'

import { parseInsertDump } from '../../src/core/postgres/parseInsertDump'
import { parseSqlValue } from '../../src/core/postgres/parseSqlValue'
import { splitValueTuples } from '../../src/core/postgres/splitValueTuples'

describe('parseSqlValue', () => {
  it('parses common scalar values', () => {
    expect(parseSqlValue('NULL')).toBeNull()
    expect(parseSqlValue('TRUE')).toBe(true)
    expect(parseSqlValue('f')).toBe(false)
    expect(parseSqlValue('42')).toBe(42)
    expect(parseSqlValue('-10.5')).toBe(-10.5)
    expect(parseSqlValue("'Alice'")).toBe('Alice')
    expect(parseSqlValue("'O''Reilly'")).toBe("O'Reilly")
    expect(parseSqlValue("E'Line\\nTwo'")).toBe('Line\nTwo')
    expect(parseSqlValue(`'{"a":1}'::jsonb`)).toBe('{"a":1}')
  })
})

describe('splitValueTuples', () => {
  it('splits VALUES tuples without breaking on commas inside strings', () => {
    expect(
      splitValueTuples(
        `(1, 'Alice'), (2, 'comma, inside'), (3, 'semi; colon')`,
      ),
    ).toEqual([`1, 'Alice'`, `2, 'comma, inside'`, `3, 'semi; colon'`])
  })
})

describe('parseInsertDump', () => {
  it('parses multi-row INSERT statements and merges repeated inserts per table', () => {
    const snapshot = parseInsertDump(`
      INSERT INTO users (id, name, active) VALUES
        (1, 'Alice', TRUE),
        (2, 'Bob', FALSE);

      INSERT INTO users (id, name, active) VALUES
        (3, 'Carol', TRUE);
    `)

    expect(snapshot).toEqual({
      users: [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
        { id: 3, name: 'Carol', active: true },
      ],
    })
  })

  it('supports quoted identifiers, schema-qualified tables, casts, and semicolons in strings', () => {
    const snapshot = parseInsertDump(`
      -- this comment should be ignored: INSERT INTO hidden (id) VALUES (1);
      INSERT INTO public."Audit Log" ("uuid", "message", "payload") VALUES
        ('abc-123', 'Bob''s login; success', '{"ip":"127.0.0.1"}'::jsonb);
    `)

    expect(snapshot).toEqual({
      'public.Audit Log': [
        {
          uuid: 'abc-123',
          message: "Bob's login; success",
          payload: '{"ip":"127.0.0.1"}',
        },
      ],
    })
  })

  it('throws on column and value count mismatch', () => {
    expect(() =>
      parseInsertDump(`
        INSERT INTO users (id, name) VALUES (1);
      `),
    ).toThrow(/Column count mismatch/)
  })
})
