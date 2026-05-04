<script setup lang="ts">
import { computed, ref } from "vue";

import type { RowDiff, TableDiff, TableStatus } from "./core/model/types";

import { useDiffSession } from "./composables/useDiffSession";
import { usePrintView } from "./composables/usePrintView";

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
} = useDiffSession();

const printView = usePrintView();

const filter = ref<"all" | TableStatus>("all");
const search = ref("");
const showUnchangedRows = ref(false);
const statusOptions: Array<"all" | TableStatus> = [
  "all",
  "added",
  "removed",
  "modified",
  "unchanged",
];
const showChangedColumnsOnly = ref(false);
const showParsedPreview = ref(false);
const leftDropActive = ref(false);
const rightDropActive = ref(false);

const tableStatusCounts = computed(() => {
  if (!diff.value) {
    return {
      all: 0,
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
    };
  }

  return Object.values(diff.value).reduce(
    (counts, table) => {
      counts.all += 1;
      counts[table.status] += 1;
      return counts;
    },
    {
      all: 0,
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
    },
  );
});

const visibleTables = computed(() => {
  if (!diff.value) {
    return [];
  }

  return Object.entries(diff.value).filter(([name, table]) => {
    const matchesFilter =
      filter.value === "all" || table.status === filter.value;
    const matchesSearch =
      search.value.trim() === "" ||
      name.toLowerCase().includes(search.value.trim().toLowerCase());

    return matchesFilter && matchesSearch;
  });
});

function visibleRows(table: TableDiff) {
  return showUnchangedRows.value
    ? table.rows
    : table.rows.filter((row) => row.status !== "unchanged");
}

function rowData(row: RowDiff) {
  return row.dataB ?? row.dataA ?? {};
}

function visibleColumns(table: TableDiff) {
  if (!showChangedColumnsOnly.value) {
    return table.columns;
  }

  const changed = new Set(table.keyColumns);

  for (const row of table.rows) {
    for (const column of Object.keys(row.changes)) {
      changed.add(column);
    }

    if (row.status === "added" || row.status === "removed") {
      for (const [column, value] of Object.entries(rowData(row))) {
        if (value !== null && value !== undefined) {
          changed.add(column);
        }
      }
    }
  }

  return table.columns.filter(
    (column) => changed.has(column) || table.keyColumns.includes(column),
  );
}

async function loadSqlFile(
  side: "left" | "right",
  file: File | null | undefined,
) {
  if (!file) {
    return;
  }

  const text = await file.text();

  if (side === "left") {
    leftSql.value = text;
    return;
  }

  rightSql.value = text;
}

async function handleFileInput(side: "left" | "right", event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  await loadSqlFile(side, file);
  input.value = "";
}

async function handleDrop(side: "left" | "right", event: DragEvent) {
  event.preventDefault();
  setDropActive(side, false);
  await loadSqlFile(side, event.dataTransfer?.files?.[0]);
}

function handleDragOver(side: "left" | "right", event: DragEvent) {
  event.preventDefault();
  setDropActive(side, true);
}

function handleDragLeave(side: "left" | "right") {
  setDropActive(side, false);
}

function setDropActive(side: "left" | "right", value: boolean) {
  if (side === "left") {
    leftDropActive.value = value;
    return;
  }

  rightDropActive.value = value;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
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

        <div class="toolbar-actions" v-if="activeView === 'input'">
          <button
            class="button button-secondary"
            type="button"
            @click="showParsedPreview = !showParsedPreview"
          >
            {{
              showParsedPreview ? "Hide parsed preview" : "Show parsed preview"
            }}
          </button>
          <button
            class="button button-secondary"
            type="button"
            @click="previewSnapshots"
            :disabled="busy"
          >
            Parse now
          </button>
          <button
            class="button"
            type="button"
            @click="runDiff"
            :disabled="busy"
          >
            {{ busy ? "Working…" : hasDiff ? "Update diff" : "Run diff" }}
            &rarr;
          </button>
        </div>

        <div class="toolbar-actions" v-else>
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
            @click="runDiff"
            :disabled="busy"
          >
            {{ busy ? "Working…" : isDirty ? "Update diff" : "Re-run diff" }}
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

      <details
        v-if="showParsedPreview || (leftPreview && rightPreview)"
        class="panel panel-tight preview-panel"
        :open="showParsedPreview"
      >
        <summary class="panel-summary">Parsed preview</summary>
        <div class="preview-grid compact-grid">
          <article>
            <div class="panel-header slim compact">
              <h2>Snapshot A</h2>
            </div>
            <pre>{{ JSON.stringify(leftPreview, null, 2) }}</pre>
          </article>
          <article>
            <div class="panel-header slim compact">
              <h2>Snapshot B</h2>
            </div>
            <pre>{{ JSON.stringify(rightPreview, null, 2) }}</pre>
          </article>
        </div>
      </details>
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
          <label>
            <span>Search</span>
            <input
              v-model="search"
              type="search"
              placeholder="users, sessions, public.orders..."
            />
          </label>

          <div>
            <span>Status</span>
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
          <label class="checkbox-label">
            <input v-model="showUnchangedRows" type="checkbox" />
            Show unchanged rows
          </label>
          <label class="checkbox-label">
            <input v-model="showChangedColumnsOnly" type="checkbox" />
            Show changed columns only
          </label>
        </div>
      </section>

      <section
        v-if="visibleTables.length === 0"
        class="panel panel-tight empty-state"
      >
        <h2>No tables match the current filter.</h2>
      </section>

      <details
        v-for="[tableName, table] in visibleTables"
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
                ? `key: ${table.keyColumns.join(", ")}`
                : "key: positional"
            }}</span>
          </div>

          <div class="table-summary-metrics">
            <span>+{{ table.summary.added }}</span>
            <span>-{{ table.summary.removed }}</span>
            <span>~{{ table.summary.modified }}</span>
            <span>={{ table.summary.unchanged }}</span>
          </div>
        </summary>

        <p v-if="table.warnings.length" class="warning-banner">
          {{ table.warnings.join(" ") }}
        </p>

        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th v-for="column in visibleColumns(table)" :key="column">
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
                <td v-for="column in visibleColumns(table)" :key="column">
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
