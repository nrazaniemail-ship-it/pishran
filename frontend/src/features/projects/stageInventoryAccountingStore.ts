import { localStore } from '../../core/storage/localStore'
import type { StageInventoryAccountingPosting } from './inventoryControlLedgers'

export type PersistedStageInventoryAccountingPosting = StageInventoryAccountingPosting & {
  projectId: string
  persistedAt: string
}
export type StageInventoryAccountingStore = {
  schema: 1
  projectId: string
  entries: PersistedStageInventoryAccountingPosting[]
}
export type StageInventoryAccountingPersistResult = {
  insertedCount: number
  existingCount: number
  entries: PersistedStageInventoryAccountingPosting[]
  debitTotal: number
  creditTotal: number
}

const storageKey = (projectId: string) => 'accounting:stage-inventory:v1:' + projectId
const comparable = (row: StageInventoryAccountingPosting) => JSON.stringify({
  id: row.id, period: row.period, kind: row.kind, productId: row.productId,
  sourceReference: row.sourceReference, debitAccount: row.debitAccount,
  creditAccount: row.creditAccount, amount: row.amount,
})

export async function loadStageInventoryAccountingPostings(projectId: string): Promise<StageInventoryAccountingStore> {
  if (!projectId.trim()) throw new Error('A project ID is required for stage accounting storage.')
  const saved = await localStore.get<StageInventoryAccountingStore>(storageKey(projectId))
  if (!saved) return { schema: 1, projectId, entries: [] }
  if (saved.schema !== 1 || saved.projectId !== projectId || !Array.isArray(saved.entries)) {
    throw new Error('Stored stage accounting ledger has an unsupported or inconsistent schema.')
  }
  return saved
}

export async function persistStageInventoryAccountingPostings(
  projectId: string,
  postings: StageInventoryAccountingPosting[],
): Promise<StageInventoryAccountingPersistResult> {
  if (!projectId.trim()) throw new Error('A project ID is required for stage accounting storage.')
  if (!Array.isArray(postings)) throw new Error('Stage accounting postings must be an array.')
  let insertedCount = 0
  let existingCount = 0
  const saved = await localStore.update<StageInventoryAccountingStore>(
    storageKey(projectId),
    current => {
      const store = current ?? { schema: 1 as const, projectId, entries: [] }
      if (store.schema !== 1 || store.projectId !== projectId || !Array.isArray(store.entries)) {
        throw new Error('Stored stage accounting ledger has an unsupported or inconsistent schema.')
      }
      const byId = new Map(store.entries.map(entry => [entry.id, entry]))
      for (const posting of postings) {
        if (!posting.id.trim() || !Number.isInteger(posting.period) || posting.period < 1 ||
            !posting.productId.trim() || !posting.sourceReference.trim() ||
            !posting.debitAccount.trim() || !posting.creditAccount.trim() ||
            !Number.isFinite(posting.amount) || posting.amount <= 0 ||
            posting.debitAccount === posting.creditAccount) {
          throw new Error('A stage accounting posting is incomplete or invalid.')
        }
        const previous = byId.get(posting.id)
        if (previous) {
          if (comparable(previous) !== comparable(posting)) {
            throw new Error('A persisted posting ID was reused with different accounting content: ' + posting.id)
          }
          existingCount += 1
          continue
        }
        const persisted: PersistedStageInventoryAccountingPosting = {
          ...posting, projectId, persistedAt: new Date().toISOString(),
        }
        byId.set(posting.id, persisted)
        insertedCount += 1
      }
      return { schema: 1, projectId, entries: [...byId.values()] }
    },
  )
  const debitTotal = saved.entries.reduce((sum, row) => sum + row.amount, 0)
  const creditTotal = debitTotal
  return { insertedCount, existingCount, entries: saved.entries, debitTotal, creditTotal }
}
