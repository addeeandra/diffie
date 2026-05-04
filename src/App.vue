<script setup lang="ts">
import { computed, ref } from 'vue'
import { toBlob } from 'html-to-image'

import type { RowDiff, TableDiff, TableStatus } from './core/model/types'

import { buildLineDiff } from './core/diff/lineDiff'
import { useDiffSession } from './composables/useDiffSession'
import { usePrintView } from './composables/usePrintView'

const {
  busy,
  diff,
  error,
  hasDiff,
  isDirty,
  leftPreview,
  leftSql,
  rightPreview,
  rightSql,
  runDiff,
  previewSnapshots,
  stats,
} = useDiffSession()

const printView = usePrintView()

type SnapshotMethodId = 'local' | 'remote' | 'docker'

interface SnapshotHelpSnippet {
  id: SnapshotMethodId
  title: string
  summary: string
  tips: string[]
  command: string
}

interface SnapshotRecipeSnippet {
  id: `${SnapshotMethodId}-recipe`
  method: SnapshotMethodId
  title: string
  summary: string
  command: string
}

const snapshotHelpTemplates: SnapshotHelpSnippet[] = [
  {
    id: 'local',
    title: 'Local machine',
    summary:
      'For PostgreSQL running directly on your machine or reachable from localhost.',
    tips: [
      'Use the same table list and flags for both snapshots so the diff stays comparable.',
      'Schema-qualify tables like public.users when possible.',
      'Redirect output to a file, then paste or upload that file into Diffie.',
    ],
    command: `export PGPASSWORD="$DB_PASSWORD" pg_dump --username "$DB_USER" --host "127.0.0.1" --port "5432" --data-only --format=plain --column-inserts --table "$DB_TABLE" "$DB_NAME" > snapshot.sql`,
  },
  {
    id: 'remote',
    title: 'Remote host',
    summary:
      'For a PostgreSQL instance on a custom host, IP, or non-default port.',
    tips: [
      'Confirm your firewall / VPN / SSH tunnel first.',
      'Keep the output plain SQL so it can be inspected and reused easily.',
      'If you need multiple tables, repeat --table or remove it for a broader dump.',
    ],
    command: `export PGPASSWORD="$DB_PASSWORD" pg_dump --username "$DB_USER" --host "$DB_HOST" --port "$DB_PORT" --data-only --format=plain --column-inserts --table "$DB_TABLE" "$DB_NAME" > remote-snapshot.sql`,
  },
  {
    id: 'docker',
    title: 'Docker container',
    summary:
      'For PostgreSQL running inside Docker, where pg_dump executes in the container.',
    tips: [
      'Replace postgres-container with your real container name.',
      'The redirect happens on the host machine, so the output file is created locally.',
      'If the container lacks pg_dump, run the command from a separate postgres image instead.',
    ],
    command: `docker exec -e PGPASSWORD="$DB_PASSWORD" postgres-container pg_dump --username "$DB_USER" --dbname "$DB_NAME" --data-only --format=plain --column-inserts --table "$DB_TABLE" > docker-snapshot.sql`,
  },
]

const filter = ref<'all' | TableStatus>('all')
const search = ref('')
const showUnchangedRows = ref(false)
const statusOptions: Array<'all' | TableStatus> = [
  'all',
  'added',
  'removed',
  'modified',
  'unchanged',
]
const showChangedColumnsOnly = ref(false)
const showParsedPreview = ref(false)
const parsedPreviewMode = ref<'diff' | 'raw'>('diff')
const pageView = ref<'input' | 'help' | 'diff'>('input')
const leftDropActive = ref(false)
const rightDropActive = ref(false)
const openColumnMenu = ref<string | null>(null)
const hiddenColumnsByTable = ref<Record<string, string[]>>({})
const diffViewMode = ref<'overview' | 'details'>('overview')
const focusedTableName = ref<string | null>(null)
const selectedRowPreview = ref<{
  tableName: string
  table: TableDiff
  row: RowDiff
} | null>(null)
const rowPreviewCaptureElement = ref<HTMLElement | null>(null)
const rowPreviewImageState = ref<'idle' | 'copying' | 'copied' | 'error'>(
  'idle',
)
const rowPreviewCaptureTransparent = ref(false)
const copiedHelpSnippetId = ref<string | null>(null)
const helpSnippets = ref(
  snapshotHelpTemplates.map((snippet) => ({ ...snippet })),
)

const tableStatusCounts = computed(() => {
  if (!diff.value) {
    return {
      all: 0,
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
    }
  }

  return Object.values(diff.value).reduce(
    (counts, table) => {
      counts.all += 1
      counts[table.status] += 1
      return counts
    },
    {
      all: 0,
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
    },
  )
})

const visibleTables = computed(() => {
  if (!diff.value) {
    return []
  }

  return Object.entries(diff.value).filter(([name, table]) => {
    const matchesFilter =
      filter.value === 'all' || table.status === filter.value
    const matchesSearch =
      search.value.trim() === '' ||
      name.toLowerCase().includes(search.value.trim().toLowerCase())

    return matchesFilter && matchesSearch
  })
})

const detailTables = computed(() => {
  if (!focusedTableName.value) {
    return visibleTables.value
  }

  return visibleTables.value.filter(
    ([tableName]) => tableName === focusedTableName.value,
  )
})

const leftPreviewText = computed(() =>
  leftPreview.value ? JSON.stringify(leftPreview.value, null, 2) : '',
)

const rightPreviewText = computed(() =>
  rightPreview.value ? JSON.stringify(rightPreview.value, null, 2) : '',
)

const parsedPreviewDiff = computed(() =>
  buildLineDiff(leftPreviewText.value, rightPreviewText.value),
)

const currentTableNames = computed(() => {
  const names = new Set<string>()

  if (leftPreview.value) {
    Object.keys(leftPreview.value).forEach((tableName) => names.add(tableName))
  }

  if (rightPreview.value) {
    Object.keys(rightPreview.value).forEach((tableName) => names.add(tableName))
  }

  if (diff.value) {
    Object.keys(diff.value).forEach((tableName) => names.add(tableName))
  }

  return [...names].sort()
})

function visibleRows(table: TableDiff) {
  return showUnchangedRows.value
    ? table.rows
    : table.rows.filter((row) => row.status !== 'unchanged')
}

function rowData(row: RowDiff) {
  return row.dataB ?? row.dataA ?? {}
}

function visibleColumns(tableName: string, table: TableDiff) {
  const hiddenColumns = new Set(hiddenColumnsByTable.value[tableName] ?? [])
  const manuallyVisibleColumns = table.columns.filter(
    (column) => !hiddenColumns.has(column),
  )

  if (!showChangedColumnsOnly.value) {
    return manuallyVisibleColumns
  }

  const changed = new Set(table.keyColumns)

  for (const row of table.rows) {
    for (const column of Object.keys(row.changes)) {
      changed.add(column)
    }

    if (row.status === 'added' || row.status === 'removed') {
      for (const [column, value] of Object.entries(rowData(row))) {
        if (value !== null && value !== undefined) {
          changed.add(column)
        }
      }
    }
  }

  return manuallyVisibleColumns.filter(
    (column) => changed.has(column) || table.keyColumns.includes(column),
  )
}

function isColumnVisible(tableName: string, column: string) {
  return !(hiddenColumnsByTable.value[tableName] ?? []).includes(column)
}

function toggleColumnMenu(tableName: string) {
  openColumnMenu.value = openColumnMenu.value === tableName ? null : tableName
}

function toggleColumn(tableName: string, column: string) {
  const hiddenColumns = new Set(hiddenColumnsByTable.value[tableName] ?? [])

  if (hiddenColumns.has(column)) {
    hiddenColumns.delete(column)
  } else {
    hiddenColumns.add(column)
  }

  hiddenColumnsByTable.value = {
    ...hiddenColumnsByTable.value,
    [tableName]: [...hiddenColumns],
  }
}

function resetColumnVisibility(tableName: string) {
  hiddenColumnsByTable.value = {
    ...hiddenColumnsByTable.value,
    [tableName]: [],
  }
}

async function loadSqlFile(
  side: 'left' | 'right',
  file: File | null | undefined,
) {
  if (!file) {
    return
  }

  const text = await file.text()

  if (side === 'left') {
    leftSql.value = text
    return
  }

  rightSql.value = text
}

async function handleFileInput(side: 'left' | 'right', event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  await loadSqlFile(side, file)
  input.value = ''
}

async function handleDrop(side: 'left' | 'right', event: DragEvent) {
  event.preventDefault()
  setDropActive(side, false)
  await loadSqlFile(side, event.dataTransfer?.files?.[0])
}

function handleDragOver(side: 'left' | 'right', event: DragEvent) {
  event.preventDefault()
  setDropActive(side, true)
}

function handleDragLeave(side: 'left' | 'right') {
  setDropActive(side, false)
}

function setDropActive(side: 'left' | 'right', value: boolean) {
  if (side === 'left') {
    leftDropActive.value = value
    return
  }

  rightDropActive.value = value
}

function showInputPage() {
  pageView.value = 'input'
}

function showHelpPage() {
  pageView.value = 'help'
}

function showDiffPage() {
  if (hasDiff.value) {
    pageView.value = 'diff'
  }
}

async function runDiffAndShowPage() {
  await runDiff()

  if (!error.value && hasDiff.value) {
    pageView.value = 'diff'
  }
}

async function copyHelpSnippet(
  snippet: SnapshotHelpSnippet | SnapshotRecipeSnippet,
) {
  await navigator.clipboard.writeText(snippet.command)
  copiedHelpSnippetId.value = snippet.id
  window.setTimeout(() => {
    if (copiedHelpSnippetId.value === snippet.id) {
      copiedHelpSnippetId.value = null
    }
  }, 1500)
}

function resetHelpSnippet(snippetId: SnapshotMethodId) {
  const template = snapshotHelpTemplates.find(
    (snippet) => snippet.id === snippetId,
  )

  if (!template) {
    return
  }

  helpSnippets.value = helpSnippets.value.map((snippet) =>
    snippet.id === snippetId ? { ...template } : snippet,
  )
}

function buildTableFlagLines(tableNames: string[]) {
  return tableNames.map((tableName) => `--table "${tableName}"`).join(' ')
}

function applyCurrentTablesToSnippet(snippetId: SnapshotMethodId) {
  if (currentTableNames.value.length === 0) {
    return
  }

  const tableFlags = buildTableFlagLines(currentTableNames.value)

  helpSnippets.value = helpSnippets.value.map((snippet) => {
    if (snippet.id !== snippetId) {
      return snippet
    }

    return {
      ...snippet,
      command: snippet.command.replace('--table "$DB_TABLE"', tableFlags),
    }
  })
}

function showOverview() {
  diffViewMode.value = 'overview'
  focusedTableName.value = null
}

function showDetails(tableName?: string) {
  diffViewMode.value = 'details'

  if (tableName) {
    focusedTableName.value = tableName
  }
}

function clearFocusedTable() {
  focusedTableName.value = null
}

function openRowPreview(tableName: string, table: TableDiff, row: RowDiff) {
  selectedRowPreview.value = {
    tableName,
    table,
    row,
  }
}

function closeRowPreview() {
  selectedRowPreview.value = null
  rowPreviewImageState.value = 'idle'
  rowPreviewCaptureTransparent.value = false
}

async function renderRowPreviewBlob() {
  if (!rowPreviewCaptureElement.value) {
    return null
  }

  rowPreviewCaptureTransparent.value = true

  try {
    return await toBlob(rowPreviewCaptureElement.value, {
      cacheBust: true,
      pixelRatio: 2,
    })
  } finally {
    rowPreviewCaptureTransparent.value = false
  }
}

async function copyRowPreviewAsImage() {
  rowPreviewImageState.value = 'copying'

  try {
    const blob = await renderRowPreviewBlob()

    if (!blob) {
      throw new Error('Failed to render row preview image.')
    }

    if (
      !navigator.clipboard ||
      typeof ClipboardItem === 'undefined' ||
      typeof navigator.clipboard.write !== 'function'
    ) {
      throw new Error('Clipboard image copy is not supported in this browser.')
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ])

    rowPreviewImageState.value = 'copied'
  } catch {
    rowPreviewImageState.value = 'error'
  } finally {
    window.setTimeout(() => {
      if (rowPreviewImageState.value !== 'copying') {
        rowPreviewImageState.value = 'idle'
      }
    }, 1800)
  }
}

async function downloadRowPreviewAsImage() {
  const blob = await renderRowPreviewBlob()

  if (!blob || !selectedRowPreview.value) {
    rowPreviewImageState.value = 'error'
    return
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safeTableName = selectedRowPreview.value.tableName.replace(
    /[^a-z0-9_-]+/gi,
    '-',
  )
  const safeRowKey = selectedRowPreview.value.row.key.replace(
    /[^a-z0-9_-]+/gi,
    '-',
  )

  anchor.href = url
  anchor.download = `${safeTableName}-${safeRowKey}-diagram.png`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function rowPreviewCopyLabel() {
  if (rowPreviewImageState.value === 'copying') {
    return 'Copying…'
  }

  if (rowPreviewImageState.value === 'copied') {
    return 'Copied'
  }

  if (rowPreviewImageState.value === 'error') {
    return 'Copy failed'
  }

  return 'Copy diagram'
}

function rowPreviewImageHint() {
  if (rowPreviewImageState.value === 'error') {
    return 'Clipboard image copy may not be supported in this browser. Try Download PNG.'
  }

  return ''
}

function totalRows(table: TableDiff) {
  return (
    table.summary.added +
    table.summary.removed +
    table.summary.modified +
    table.summary.unchanged
  )
}

function rowBarWidth(count: number, table: TableDiff) {
  const total = totalRows(table)

  if (total === 0 || count === 0) {
    return '0%'
  }

  return `${(count / total) * 100}%`
}

function previewColumns(tableName: string, table: TableDiff) {
  return visibleColumns(tableName, table)
}

function previewLeftTitle(row: RowDiff) {
  if (row.status === 'added') {
    return 'before · missing'
  }

  return 'before'
}

function previewRightTitle(row: RowDiff) {
  if (row.status === 'removed') {
    return 'after · missing'
  }

  return 'after'
}

function previewCellState(row: RowDiff, column: string) {
  if (row.changes[column]) {
    return 'changed'
  }

  if (row.status === 'added') {
    return 'added'
  }

  if (row.status === 'removed') {
    return 'removed'
  }

  return 'same'
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value)
}
</script>

<template>
  <main class="app-shell">
    <header class="app-header print-block-avoid">
      <div class="app-header-main">
        <div>
          <p class="eyebrow">Diffie</p>
          <h1>Schema Diffs</h1>
        </div>

        <nav class="view-switch" aria-label="Primary views">
          <button
            class="view-switch-button"
            :data-active="pageView === 'help'"
            type="button"
            @click="showHelpPage"
          >
            Help
          </button>
          <button
            class="view-switch-button"
            :data-active="pageView === 'input'"
            type="button"
            @click="showInputPage"
          >
            Input
          </button>
          <button
            class="view-switch-button"
            :data-active="pageView === 'diff'"
            type="button"
            :disabled="!hasDiff"
            @click="showDiffPage"
          >
            Diff
            <span v-if="hasDiff && isDirty" class="inline-note">stale</span>
          </button>
        </nav>
      </div>

      <div class="toolbar print-hidden">
        <p class="toolbar-note">
          run locally in your browser without remote data send.
          <span v-if="isDirty">Inputs changed since the last diff.</span>
        </p>

        <div v-if="pageView === 'input'" class="toolbar-actions">
          <button
            class="button"
            type="button"
            :disabled="busy"
            @click="runDiffAndShowPage"
          >
            {{ busy ? 'Working…' : hasDiff ? 'Update diff' : 'Run diff' }}
            &rarr;
          </button>
        </div>

        <div v-else-if="pageView === 'diff'" class="toolbar-actions">
          <button
            class="button button-secondary"
            type="button"
            @click="showInputPage"
          >
            &larr; Edit input
          </button>
          <button
            class="button"
            type="button"
            :disabled="busy"
            @click="runDiffAndShowPage"
          >
            {{ busy ? 'Working…' : isDirty ? 'Update diff' : 'Re-run diff' }}
          </button>
          <button
            class="button button-secondary"
            type="button"
            @click="printView.print"
          >
            Print
          </button>
        </div>

        <div v-else class="toolbar-actions">
          <button
            class="button button-secondary"
            type="button"
            @click="showInputPage"
          >
            Back to input &rarr;
          </button>
        </div>
      </div>
    </header>

    <p v-if="error" class="error-banner print-hidden">{{ error }}</p>

    <section v-if="pageView === 'input'" class="panel-stack">
      <section class="panel panel-tight print-block-avoid">
        <div class="panel-header slim">
          <div>
            <h2>Input snapshots</h2>
            <p>
              Paste SQL directly, upload a file, or drag a dump into either
              editor.
            </p>
          </div>
        </div>

        <div class="editor-grid compact-grid">
          <label
            class="editor-card"
            :data-drag-active="leftDropActive"
            @dragover="handleDragOver('left', $event)"
            @dragleave="handleDragLeave('left')"
            @drop="handleDrop('left', $event)"
          >
            <span class="editor-row">
              <span class="editor-label">Snapshot A</span>
              <span class="editor-tools">
                <span class="upload-button">
                  Upload
                  <input
                    type="file"
                    accept=".sql,.txt"
                    @change="handleFileInput('left', $event)"
                  />
                </span>
              </span>
            </span>
            <textarea v-model="leftSql" spellcheck="false" />
          </label>

          <label
            class="editor-card"
            :data-drag-active="rightDropActive"
            @dragover="handleDragOver('right', $event)"
            @dragleave="handleDragLeave('right')"
            @drop="handleDrop('right', $event)"
          >
            <span class="editor-row">
              <span class="editor-label">Snapshot B</span>
              <span class="editor-tools">
                <span class="upload-button">
                  Upload
                  <input
                    type="file"
                    accept=".sql,.txt"
                    @change="handleFileInput('right', $event)"
                  />
                </span>
              </span>
            </span>
            <textarea v-model="rightSql" spellcheck="false" />
          </label>
        </div>
      </section>

      <section class="panel panel-tight preview-panel print-block-avoid">
        <div class="panel-header slim preview-header">
          <div>
            <h2>Parsed preview</h2>
            <p>
              Parse the current SQL inputs into the normalized snapshot
              structure.
            </p>
          </div>

          <div class="panel-header-actions">
            <div
              class="filter-pills"
              role="tablist"
              aria-label="Parsed preview mode"
            >
              <button
                class="filter-pill"
                :data-active="parsedPreviewMode === 'diff'"
                type="button"
                @click="parsedPreviewMode = 'diff'"
              >
                diff
              </button>
              <button
                class="filter-pill"
                :data-active="parsedPreviewMode === 'raw'"
                type="button"
                @click="parsedPreviewMode = 'raw'"
              >
                raw
              </button>
            </div>
            <button
              class="button button-secondary"
              type="button"
              @click="showParsedPreview = !showParsedPreview"
            >
              {{ showParsedPreview ? 'Hide preview' : 'Show preview' }}
            </button>
            <button
              class="button button-secondary"
              type="button"
              :disabled="busy"
              @click="previewSnapshots"
            >
              Parse now
            </button>
          </div>
        </div>

        <template v-if="showParsedPreview && leftPreview && rightPreview">
          <div v-if="parsedPreviewMode === 'diff'" class="parsed-diff">
            <div class="parsed-diff-header">
              <span>Parsed JSON diff</span>
              <span class="filter-help"
                >line-based preview diff, github-style</span
              >
            </div>
            <div class="parsed-diff-table-wrap">
              <table class="parsed-diff-table">
                <tbody>
                  <tr
                    v-for="(line, index) in parsedPreviewDiff"
                    :key="`${line.type}-${line.leftNumber}-${line.rightNumber}-${index}`"
                    :data-diff-line="line.type"
                  >
                    <td class="diff-gutter marker">
                      {{
                        line.type === 'added'
                          ? '+'
                          : line.type === 'removed'
                            ? '-'
                            : ' '
                      }}
                    </td>
                    <td class="diff-gutter">{{ line.leftNumber ?? '' }}</td>
                    <td class="diff-gutter">{{ line.rightNumber ?? '' }}</td>
                    <td class="diff-content">
                      <pre>{{ line.content }}</pre>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="preview-grid compact-grid">
            <article>
              <div class="panel-header slim compact">
                <h2>Snapshot A</h2>
              </div>
              <pre>{{ leftPreviewText }}</pre>
            </article>
            <article>
              <div class="panel-header slim compact">
                <h2>Snapshot B</h2>
              </div>
              <pre>{{ rightPreviewText }}</pre>
            </article>
          </div>
        </template>

        <div v-else-if="showParsedPreview" class="preview-empty">
          <p>
            No parsed preview yet. Click <code>Parse now</code> to inspect the
            current inputs.
          </p>
        </div>
      </section>
    </section>

    <section v-else-if="pageView === 'help'" class="panel-stack help-stack">
      <section class="panel panel-tight help-intro">
        <div class="panel-header slim">
          <div>
            <h2>How to snapshot PostgreSQL for Diffie</h2>
            <p>
              Diffie works best when both snapshots are dumped with the same
              table scope and flags. Start with <code>--data-only</code> and
              <code>--column-inserts</code>, then paste or upload the resulting
              SQL file.
            </p>
          </div>
        </div>

        <div class="help-grid compact-grid">
          <article class="help-card">
            <h3>Recommended defaults</h3>
            <ul class="help-list">
              <li>Use the same command shape for snapshot A and snapshot B.</li>
              <li>Keep the dump plain SQL, not custom/binary format.</li>
              <li>Schema-qualify tables like <code>public.users</code>.</li>
              <li>Prefer focused dumps first so previews stay manageable.</li>
            </ul>
          </article>
          <article class="help-card">
            <h3>Flag notes</h3>
            <ul class="help-list">
              <li><code>--data-only</code> avoids schema noise.</li>
              <li>
                <code>--column-inserts</code> makes the SQL explicit and
                parser-friendly.
              </li>
              <li><code>--table</code> can be repeated for multiple tables.</li>
              <li>
                <code>PGPASSWORD</code> is optional if your auth is already
                configured.
              </li>
            </ul>
          </article>
        </div>

        <div class="help-current-tables">
          <div>
            <h3>Use my current table names</h3>
            <p>
              Diffie can reuse table names found in your parsed preview or diff.
            </p>
          </div>

          <div v-if="currentTableNames.length" class="current-table-chip-list">
            <span
              v-for="tableName in currentTableNames"
              :key="tableName"
              class="shape-pill"
            >
              {{ tableName }}
            </span>
          </div>
          <p v-else class="filter-help">
            Parse snapshots or run a diff first, then come back here to inject
            the current table names into the commands below.
          </p>
        </div>
      </section>

      <section
        v-for="snippet in helpSnippets"
        :key="snippet.id"
        class="panel panel-tight help-card"
      >
        <div class="panel-header slim help-card-header">
          <div>
            <h2>{{ snippet.title }}</h2>
            <p>{{ snippet.summary }}</p>
          </div>
          <div class="panel-header-actions">
            <button
              v-if="currentTableNames.length"
              class="button button-secondary"
              type="button"
              @click="applyCurrentTablesToSnippet(snippet.id)"
            >
              Use current table names
            </button>
            <button
              class="button button-secondary"
              type="button"
              @click="resetHelpSnippet(snippet.id)"
            >
              Reset snippet
            </button>
            <button
              class="button button-secondary"
              type="button"
              @click="copyHelpSnippet(snippet)"
            >
              {{ copiedHelpSnippetId === snippet.id ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>

        <div class="help-body compact-grid">
          <div class="help-notes">
            <div class="help-subtitle">Tips</div>
            <ul class="help-list">
              <li v-for="tip in snippet.tips" :key="tip">{{ tip }}</li>
            </ul>
          </div>

          <label class="help-snippet-editor">
            <span class="help-subtitle">Editable command</span>
            <textarea v-model="snippet.command" spellcheck="false" />
          </label>
        </div>
      </section>
    </section>

    <section
      v-else-if="pageView === 'diff' && diff && stats"
      class="panel-stack"
    >
      <section class="summary-strip print-block-avoid">
        <article class="metric-inline">
          <span>Tables</span>
          <strong>{{ stats.tables }}</strong>
          <small>{{ stats.changedTables }} changed</small>
        </article>
        <article class="metric-inline success">
          <span>Added</span>
          <strong>{{ stats.added }}</strong>
        </article>
        <article class="metric-inline danger">
          <span>Removed</span>
          <strong>{{ stats.removed }}</strong>
        </article>
        <article class="metric-inline warning">
          <span>Modified</span>
          <strong>{{ stats.modified }}</strong>
        </article>
        <article class="metric-inline muted">
          <span>Unchanged</span>
          <strong>{{ stats.unchanged }}</strong>
        </article>
      </section>

      <section class="panel panel-tight controls print-hidden">
        <div class="control-group compact-controls">
          <div>
            <span>Diff view</span>
            <div
              class="filter-pills"
              role="tablist"
              aria-label="Diff view mode"
            >
              <button
                class="filter-pill"
                :data-active="diffViewMode === 'overview'"
                type="button"
                @click="showOverview"
              >
                overview
              </button>
              <button
                class="filter-pill"
                :data-active="diffViewMode === 'details'"
                type="button"
                @click="showDetails()"
              >
                details
                <span>{{ focusedTableName ? 'focused' : 'all' }}</span>
              </button>
            </div>
          </div>

          <label>
            <span>Search</span>
            <input
              v-model="search"
              type="search"
              placeholder="users, sessions, public.orders..."
            />
          </label>

          <div>
            <span>Table status</span>
            <div class="filter-help">counts below are tables, not rows</div>
            <div
              class="filter-pills"
              role="radiogroup"
              aria-label="Table status filter"
            >
              <button
                v-for="statusOption in statusOptions"
                :key="statusOption"
                class="filter-pill"
                :data-active="filter === statusOption"
                :data-status="statusOption"
                type="button"
                @click="filter = statusOption"
              >
                {{ statusOption }}
                <span>{{ tableStatusCounts[statusOption] }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="control-actions compact-actions">
          <template v-if="diffViewMode === 'details'">
            <button
              v-if="focusedTableName"
              class="button button-secondary"
              type="button"
              @click="clearFocusedTable"
            >
              show all tables
            </button>
            <label class="checkbox-label">
              <input v-model="showUnchangedRows" type="checkbox" />
              Show unchanged rows
            </label>
            <label class="checkbox-label">
              <input v-model="showChangedColumnsOnly" type="checkbox" />
              Show changed columns only
            </label>
          </template>
          <template v-else>
            <div class="filter-help overview-hint">
              Click any table tile to jump into detailed row-level diff.
            </div>
          </template>
        </div>
      </section>

      <section
        v-if="visibleTables.length === 0"
        class="panel panel-tight empty-state"
      >
        <h2>No tables match the current filter.</h2>
      </section>

      <section
        v-else-if="diffViewMode === 'overview'"
        class="overview-grid print-block-avoid"
      >
        <button
          v-for="[tableName, table] in visibleTables"
          :key="tableName"
          class="panel overview-tile"
          :data-status="table.status"
          type="button"
          @click="showDetails(tableName)"
        >
          <div class="overview-tile-head">
            <div>
              <h2>{{ tableName }}</h2>
              <div class="overview-meta-row">
                <span class="status-pill" :data-status="table.status">{{
                  table.status
                }}</span>
                <span class="meta-pill">{{
                  table.keyColumns.length
                    ? `key: ${table.keyColumns.join(', ')}`
                    : 'key: positional'
                }}</span>
              </div>
            </div>
            <span class="overview-open">open →</span>
          </div>

          <div class="overview-stats-grid">
            <div>
              <span>rows</span>
              <strong>{{ totalRows(table) }}</strong>
            </div>
            <div>
              <span>shape</span>
              <strong>
                +{{ table.shape.addedColumns.length }} / -{{
                  table.shape.removedColumns.length
                }}
              </strong>
            </div>
          </div>

          <div class="overview-bar" aria-hidden="true">
            <span
              class="bar-segment added"
              :style="{ width: rowBarWidth(table.summary.added, table) }"
            ></span>
            <span
              class="bar-segment removed"
              :style="{ width: rowBarWidth(table.summary.removed, table) }"
            ></span>
            <span
              class="bar-segment modified"
              :style="{ width: rowBarWidth(table.summary.modified, table) }"
            ></span>
            <span
              class="bar-segment unchanged"
              :style="{ width: rowBarWidth(table.summary.unchanged, table) }"
            ></span>
          </div>

          <div class="overview-summary-line">
            <span>+{{ table.summary.added }}</span>
            <span>-{{ table.summary.removed }}</span>
            <span>~{{ table.summary.modified }}</span>
            <span>={{ table.summary.unchanged }}</span>
          </div>

          <div
            v-if="
              table.shape.addedColumns.length ||
              table.shape.removedColumns.length
            "
            class="overview-shape-list"
          >
            <span
              v-for="column in table.shape.addedColumns"
              :key="`${tableName}-add-${column}`"
              class="shape-pill added"
            >
              + {{ column }}
            </span>
            <span
              v-for="column in table.shape.removedColumns"
              :key="`${tableName}-remove-${column}`"
              class="shape-pill removed"
            >
              - {{ column }}
            </span>
          </div>

          <p v-if="table.warnings.length" class="overview-warning">
            {{ table.warnings[0] }}
          </p>
        </button>
      </section>

      <details
        v-for="[tableName, table] in detailTables"
        v-else
        :key="tableName"
        class="panel panel-tight table-panel print-block-avoid"
        :open="table.status !== 'unchanged'"
      >
        <summary class="table-summary-row compact-summary-row">
          <div class="table-title-row">
            <h2>{{ tableName }}</h2>
            <span class="status-pill" :data-status="table.status">{{
              table.status
            }}</span>
            <span class="meta-pill">{{
              table.keyColumns.length
                ? `key: ${table.keyColumns.join(', ')}`
                : 'key: positional'
            }}</span>
          </div>

          <div class="table-summary-actions">
            <div class="table-summary-metrics">
              <span>+{{ table.summary.added }}</span>
              <span>-{{ table.summary.removed }}</span>
              <span>~{{ table.summary.modified }}</span>
              <span>={{ table.summary.unchanged }}</span>
            </div>

            <div class="column-menu-wrap print-hidden" @click.stop>
              <button
                class="icon-button"
                type="button"
                aria-label="Choose visible columns"
                :aria-expanded="openColumnMenu === tableName"
                @click.stop.prevent="toggleColumnMenu(tableName)"
              >
                ⋯
              </button>

              <div v-if="openColumnMenu === tableName" class="column-menu">
                <div class="column-menu-header">
                  <strong>Columns</strong>
                  <button
                    class="mini-link"
                    type="button"
                    @click.stop="resetColumnVisibility(tableName)"
                  >
                    Reset
                  </button>
                </div>

                <label
                  v-for="column in table.columns"
                  :key="column"
                  class="column-toggle"
                >
                  <input
                    :checked="isColumnVisible(tableName, column)"
                    type="checkbox"
                    @change="toggleColumn(tableName, column)"
                  />
                  <span>{{ column }}</span>
                </label>
              </div>
            </div>
          </div>
        </summary>

        <p v-if="table.warnings.length" class="warning-banner">
          {{ table.warnings.join(' ') }}
        </p>

        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th
                  v-for="column in visibleColumns(tableName, table)"
                  :key="column"
                >
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in visibleRows(table)"
                :key="row.key"
                :data-row-status="row.status"
                class="row-clickable"
                @click="openRowPreview(tableName, table, row)"
              >
                <td>
                  <span class="status-pill compact" :data-status="row.status">{{
                    row.status
                  }}</span>
                </td>
                <td
                  v-for="column in visibleColumns(tableName, table)"
                  :key="column"
                >
                  <template v-if="row.changes[column]">
                    <div class="cell-change">
                      <span class="value from">{{
                        formatValue(row.changes[column].from)
                      }}</span>
                      <span class="value to">{{
                        formatValue(row.changes[column].to)
                      }}</span>
                    </div>
                  </template>
                  <template v-else>
                    <span class="value">{{
                      formatValue(rowData(row)[column])
                    }}</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>

    <div
      v-if="selectedRowPreview"
      class="dialog-backdrop print-hidden"
      @click="closeRowPreview"
    >
      <section
        class="dialog-panel row-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Row transition preview"
        @click.stop
      >
        <header class="dialog-header">
          <div>
            <p class="eyebrow">Row preview</p>
            <h2>{{ selectedRowPreview.tableName }}</h2>
            <p class="filter-help">
              {{ selectedRowPreview.row.key }} ·
              {{ selectedRowPreview.row.status }}
            </p>
            <p
              v-if="rowPreviewImageHint()"
              class="filter-help row-preview-hint"
            >
              {{ rowPreviewImageHint() }}
            </p>
          </div>
          <div class="panel-header-actions">
            <button
              class="button button-secondary"
              type="button"
              :disabled="rowPreviewImageState === 'copying'"
              @click="copyRowPreviewAsImage"
            >
              {{ rowPreviewCopyLabel() }}
            </button>
            <button
              class="button button-secondary"
              type="button"
              :disabled="rowPreviewImageState === 'copying'"
              @click="downloadRowPreviewAsImage"
            >
              Download PNG
            </button>
            <button
              class="button button-secondary"
              type="button"
              @click="closeRowPreview"
            >
              Close
            </button>
          </div>
        </header>

        <div
          ref="rowPreviewCaptureElement"
          class="row-preview-flow row-preview-capture"
          :data-transparent-capture="rowPreviewCaptureTransparent"
        >
          <section
            class="entity-card"
            :data-side="
              selectedRowPreview.row.status === 'added' ? 'missing' : 'before'
            "
          >
            <div class="entity-card-head">
              <span class="meta-pill">{{
                previewLeftTitle(selectedRowPreview.row)
              }}</span>
            </div>
            <div class="entity-fields">
              <div
                v-for="column in previewColumns(
                  selectedRowPreview.tableName,
                  selectedRowPreview.table,
                )"
                :key="`before-${column}`"
                class="entity-field"
                :data-state="previewCellState(selectedRowPreview.row, column)"
              >
                <span class="entity-key">{{ column }}</span>
                <span class="entity-value">{{
                  formatValue(selectedRowPreview.row.dataA?.[column])
                }}</span>
              </div>
            </div>
          </section>

          <div class="entity-arrow" aria-hidden="true">
            <span>→</span>
          </div>

          <section
            class="entity-card"
            :data-side="
              selectedRowPreview.row.status === 'removed' ? 'missing' : 'after'
            "
          >
            <div class="entity-card-head">
              <span class="meta-pill">{{
                previewRightTitle(selectedRowPreview.row)
              }}</span>
            </div>
            <div class="entity-fields">
              <div
                v-for="column in previewColumns(
                  selectedRowPreview.tableName,
                  selectedRowPreview.table,
                )"
                :key="`after-${column}`"
                class="entity-field"
                :data-state="previewCellState(selectedRowPreview.row, column)"
              >
                <span class="entity-key">{{ column }}</span>
                <span class="entity-value">{{
                  formatValue(selectedRowPreview.row.dataB?.[column])
                }}</span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>
