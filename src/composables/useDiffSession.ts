import { computed, onBeforeUnmount, ref } from 'vue'

import type {
  DiffWorkerResponse,
  ParseSnapshotSuccess,
  RunDiffSuccess,
} from '../core/model/worker'
import type { DiffResult, Snapshot } from '../core/model/types'

const SAMPLE_SQL_A = `-- Snapshot A
INSERT INTO users (id, name, role, active) VALUES
  (1, 'Alice', 'admin', TRUE),
  (2, 'Bob', 'user', TRUE),
  (3, 'Carol', 'user', FALSE);

INSERT INTO sessions (uuid, user_id, status) VALUES
  ('sess-1', 1, 'active'),
  ('sess-2', 2, 'idle');
`

const SAMPLE_SQL_B = `-- Snapshot B
INSERT INTO users (id, name, role, active) VALUES
  (1, 'Alice', 'owner', TRUE),
  (2, 'Bob', 'user', FALSE),
  (4, 'Dave', 'user', TRUE);

INSERT INTO sessions (uuid, user_id, status) VALUES
  ('sess-1', 1, 'expired'),
  ('sess-3', 4, 'active');
`

type WorkerRequestInput =
  | {
      type: 'parse-snapshot'
      sql: string
    }
  | {
      type: 'run-diff'
      leftSql: string
      rightSql: string
    }

export function useDiffSession() {
  const leftSql = ref(SAMPLE_SQL_A)
  const rightSql = ref(SAMPLE_SQL_B)
  const leftPreview = ref<Snapshot | null>(null)
  const rightPreview = ref<Snapshot | null>(null)
  const diff = ref<DiffResult | null>(null)
  const error = ref('')
  const busy = ref(false)
  const activeView = ref<'input' | 'diff'>('input')
  const lastDiffLeftSql = ref('')
  const lastDiffRightSql = ref('')

  let nextRequestId = 1
  let worker: Worker | null = null
  const pending = new Map<
    number,
    {
      resolve: (value: DiffWorkerResponse) => void
      reject: (reason?: unknown) => void
    }
  >()

  const hasDiff = computed(() => diff.value !== null)

  const isDirty = computed(() => {
    if (!hasDiff.value) {
      return false
    }

    return (
      leftSql.value !== lastDiffLeftSql.value ||
      rightSql.value !== lastDiffRightSql.value
    )
  })

  const stats = computed(() => {
    if (!diff.value) {
      return null
    }

    return Object.values(diff.value).reduce(
      (summary, table) => {
        summary.tables += 1
        summary.changedTables += table.status === 'unchanged' ? 0 : 1
        summary.added += table.summary.added
        summary.removed += table.summary.removed
        summary.modified += table.summary.modified
        summary.unchanged += table.summary.unchanged
        return summary
      },
      {
        tables: 0,
        changedTables: 0,
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 0,
      },
    )
  })

  function ensureWorker(): Worker {
    if (worker) {
      return worker
    }

    worker = new Worker(new URL('../workers/diff.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', handleWorkerMessage)
    worker.addEventListener('error', handleWorkerError)

    return worker
  }

  function handleWorkerMessage(event: MessageEvent<DiffWorkerResponse>) {
    const response = event.data
    const deferred = pending.get(response.id)

    if (!deferred) {
      return
    }

    pending.delete(response.id)
    deferred.resolve(response)
  }

  function handleWorkerError(event: ErrorEvent) {
    for (const [id, deferred] of pending.entries()) {
      pending.delete(id)
      deferred.reject(
        new Error(event.message || 'Worker failed to process request.'),
      )
    }
  }

  function post(request: WorkerRequestInput): Promise<DiffWorkerResponse> {
    const id = nextRequestId
    nextRequestId += 1

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      ensureWorker().postMessage({ ...request, id })
    })
  }

  async function previewSnapshots() {
    busy.value = true
    error.value = ''

    try {
      const [leftResponse, rightResponse] = await Promise.all([
        post({ type: 'parse-snapshot', sql: leftSql.value }),
        post({ type: 'parse-snapshot', sql: rightSql.value }),
      ])

      if (leftResponse.type === 'error') {
        throw new Error(leftResponse.error)
      }

      if (rightResponse.type === 'error') {
        throw new Error(rightResponse.error)
      }

      leftPreview.value = (leftResponse as ParseSnapshotSuccess).snapshot
      rightPreview.value = (rightResponse as ParseSnapshotSuccess).snapshot
    } catch (caught) {
      error.value =
        caught instanceof Error
          ? caught.message
          : 'Failed to preview snapshots.'
    } finally {
      busy.value = false
    }
  }

  async function runDiff() {
    busy.value = true
    error.value = ''

    try {
      const response = await post({
        type: 'run-diff',
        leftSql: leftSql.value,
        rightSql: rightSql.value,
      })

      if (response.type === 'error') {
        throw new Error(response.error)
      }

      applyDiffResponse(response as RunDiffSuccess)
      lastDiffLeftSql.value = leftSql.value
      lastDiffRightSql.value = rightSql.value
      activeView.value = 'diff'
    } catch (caught) {
      error.value =
        caught instanceof Error ? caught.message : 'Failed to run diff.'
    } finally {
      busy.value = false
    }
  }

  function applyDiffResponse(response: RunDiffSuccess) {
    leftPreview.value = response.leftSnapshot
    rightPreview.value = response.rightSnapshot
    diff.value = response.diff
  }

  function showInput() {
    activeView.value = 'input'
  }

  function showDiff() {
    if (diff.value) {
      activeView.value = 'diff'
    }
  }

  onBeforeUnmount(() => {
    for (const [, deferred] of pending.entries()) {
      deferred.reject(
        new Error('Diff session closed before worker request completed.'),
      )
    }

    pending.clear()
    worker?.terminate()
    worker = null
  })

  return {
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
  }
}
