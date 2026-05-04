<script setup lang="ts">
import { computed, ref } from 'vue'

import type { RowDiff, TableDiff, TableStatus } from './core/model/types'

import { buildLineDiff } from './core/diff/lineDiff'
import { useDiffSession } from './composables/useDiffSession'
import { usePrintView } from './composables/usePrintView'

const {
  activeView,
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
  showDiff,
  showInput,
  stats,
} = useDiffSession()

const printView = usePrintView()

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
const leftDropActive = ref(false)
const rightDropActive = ref(false)
const openColumnMenu = ref<string | null>(null)
const hiddenColumnsByTable = ref<Record<string, string[]>>({})
const diffViewMode = ref<'overview' | 'details'>('overview')
const focusedTableName = ref<string | null>(null)

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
          <h1>PostgreSQL snapshot diff</h1>
        </div>

        <nav class="view-switch" aria-label="Primary views">
          <button
            class="view-switch-button"
            :data-active="activeView === 'input'"
            type="button"
            @click="showInput"
          >
            Input
          </button>
          <button
            class="view-switch-button"
            :data-active="activeView === 'diff'"
            type="button"
            :disabled="!hasDiff"
            @click="showDiff"
          >
            Diff
            <span v-if="hasDiff && isDirty" class="inline-note">stale</span>
          </button>
        </nav>
      </div>

      <div class="toolbar print-hidden">
        <p class="toolbar-note">
          INSERT-first, local-only, browser-based.
          <span v-if="isDirty">Inputs changed since the last diff.</span>
        </p>

        <div v-if="activeView === 'input'" class="toolbar-actions">
          <button
            class="button"
            type="button"
            :disabled="busy"
            @click="runDiff"
          >
            {{ busy ? 'Working…' : hasDiff ? 'Update diff' : 'Run diff' }}
            &rarr;
          </button>
        </div>

        <div v-else class="toolbar-actions">
          <button
            class="button button-secondary"
            type="button"
            @click="showInput"
          >
            &larr; Edit input
          </button>
          <button
            class="button"
            type="button"
            :disabled="busy"
            @click="runDiff"
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
      </div>
    </header>

    <p v-if="error" class="error-banner print-hidden">{{ error }}</p>

    <section v-if="activeView === 'input'" class="panel-stack">
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

    <section v-else-if="diff && stats" class="panel-stack">
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
  </main>
</template>
