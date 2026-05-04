export interface PrintState {
  expandedTables: boolean
  changedOnly: boolean
}

export const defaultPrintState: PrintState = {
  expandedTables: true,
  changedOnly: true,
}
