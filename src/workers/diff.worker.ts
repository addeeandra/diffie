/// <reference lib="webworker" />

import type { DiffWorkerRequest, DiffWorkerResponse } from '../core/model/worker'

import { diffSnapshots } from '../core/diff/diffSnapshots'
import { parseInsertDump } from '../core/postgres/parseInsertDump'

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope

ctx.onmessage = (event: MessageEvent<DiffWorkerRequest>) => {
  const request = event.data

  try {
    const response = handleRequest(request)
    ctx.postMessage(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown worker error.'
    const failure: DiffWorkerResponse = {
      id: request.id,
      type: 'error',
      error: message,
    }

    ctx.postMessage(failure)
  }
}

function handleRequest(request: DiffWorkerRequest): DiffWorkerResponse {
  if (request.type === 'parse-snapshot') {
    return {
      id: request.id,
      type: 'parse-snapshot:success',
      snapshot: parseInsertDump(request.sql),
    }
  }

  const leftSnapshot = parseInsertDump(request.leftSql)
  const rightSnapshot = parseInsertDump(request.rightSql)

  return {
    id: request.id,
    type: 'run-diff:success',
    leftSnapshot,
    rightSnapshot,
    diff: diffSnapshots(leftSnapshot, rightSnapshot),
  }
}
