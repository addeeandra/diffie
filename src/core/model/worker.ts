import type { DiffResult, Snapshot } from './types'

export interface ParseSnapshotRequest {
  id: number
  type: 'parse-snapshot'
  sql: string
}

export interface RunDiffRequest {
  id: number
  type: 'run-diff'
  leftSql: string
  rightSql: string
}

export type DiffWorkerRequest = ParseSnapshotRequest | RunDiffRequest

export interface ParseSnapshotSuccess {
  id: number
  type: 'parse-snapshot:success'
  snapshot: Snapshot
}

export interface RunDiffSuccess {
  id: number
  type: 'run-diff:success'
  leftSnapshot: Snapshot
  rightSnapshot: Snapshot
  diff: DiffResult
}

export interface WorkerFailure {
  id: number
  type: 'error'
  error: string
}

export type DiffWorkerResponse =
  | ParseSnapshotSuccess
  | RunDiffSuccess
  | WorkerFailure
