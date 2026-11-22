import { localStore } from '../../core/storage/localStore'
import type { StageInventoryAccountingPosting } from './inventoryControlLedgers'

export type StageAccountingDocumentType = 'original' | 'reversal' | 'adjustment'
export type PersistedStageInventoryAccountingPosting = StageInventoryAccountingPosting & {
  projectId: string
  persistedAt: string
  documentType?: StageAccountingDocumentType
  originalDocumentId?: string
  adjustmentOfDocumentId?: string
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
const comparable = (row: StageInventoryAccountingPosting & Partial<PersistedStageInventoryAccountingPosting>) => JSON.stringify({
  id: row.id, period: row.period, kind: row.kind, productId: row.productId,
  sourceReference: row.sourceReference, debitAccount: row.debitAccount,
  creditAccount: row.creditAccount, amount: row.amount,
  documentType: row.documentType ?? 'original',
  originalDocumentId: row.originalDocumentId ?? null,
  adjustmentOfDocumentId: row.adjustmentOfDocumentId ?? null,
})
const validatePosting = (posting: StageInventoryAccountingPosting) => {
  if (!posting.id.trim() || !Number.isInteger(posting.period) || posting.period < 1 ||
      !posting.productId.trim() || !posting.sourceReference.trim() ||
      !posting.debitAccount.trim() || !posting.creditAccount.trim() ||
      !Number.isFinite(posting.amount) || posting.amount <= 0 ||
      posting.debitAccount === posting.creditAccount) {
    throw new Error('A stage accounting posting is incomplete or invalid.')
  }
}
const assertProject = (projectId: string) => {
  if (!projectId.trim()) throw new Error('A project ID is required for stage accounting storage.')
}
const emptyStore = (projectId: string): StageInventoryAccountingStore => ({ schema: 1, projectId, entries: [] })
const validateStore = (store: StageInventoryAccountingStore, projectId: string) => {
  if (store.schema !== 1 || store.projectId !== projectId || !Array.isArray(store.entries)) {
    throw new Error('Stored stage accounting ledger has an unsupported or inconsistent schema.')
  }
}

export async function loadStageInventoryAccountingPostings(projectId: string): Promise<StageInventoryAccountingStore> {
  assertProject(projectId)
  const saved = await localStore.get<StageInventoryAccountingStore>(storageKey(projectId))
  if (!saved) return emptyStore(projectId)
  validateStore(saved, projectId)
  return saved
}

function resultFor(saved: StageInventoryAccountingStore, insertedCount: number, existingCount: number): StageInventoryAccountingPersistResult {
  const debitTotal = saved.entries.reduce((sum, row) => sum + row.amount, 0)
  return { insertedCount, existingCount, entries: saved.entries, debitTotal, creditTotal: debitTotal }
}

export async function persistStageInventoryAccountingPostings(
  projectId: string,
  postings: StageInventoryAccountingPosting[],
): Promise<StageInventoryAccountingPersistResult> {
  assertProject(projectId)
  if (!Array.isArray(postings)) throw new Error('Stage accounting postings must be an array.')
  let insertedCount = 0
  let existingCount = 0
  const saved = await localStore.update<StageInventoryAccountingStore>(storageKey(projectId), current => {
    const store = current ?? emptyStore(projectId)
    validateStore(store, projectId)
    const byId = new Map(store.entries.map(entry => [entry.id, entry]))
    for (const posting of postings) {
      validatePosting(posting)
      const previous = byId.get(posting.id)
      if (previous) {
        if (comparable(previous) !== comparable(posting)) {
          throw new Error('A persisted posting ID was reused with different accounting content: ' + posting.id)
        }
        existingCount += 1
        continue
      }
      byId.set(posting.id, { ...posting, projectId, persistedAt: new Date().toISOString(), documentType: 'original' })
      insertedCount += 1
    }
    return { schema: 1, projectId, entries: [...byId.values()] }
  })
  return resultFor(saved, insertedCount, existingCount)
}

export async function appendStageInventoryAccountingReversal(
  projectId: string,
  originalDocumentId: string,
  reversalDocumentId: string,
  reversalPeriod: number,
): Promise<StageInventoryAccountingPersistResult> {
  assertProject(projectId)
  if (!originalDocumentId.trim() || !reversalDocumentId.trim() ||
      !Number.isInteger(reversalPeriod) || reversalPeriod < 1) {
    throw new Error('A reversal requires document IDs and a valid accounting period.')
  }
  let insertedCount = 0
  let existingCount = 0
  const saved = await localStore.update<StageInventoryAccountingStore>(storageKey(projectId), current => {
    const store = current ?? emptyStore(projectId)
    validateStore(store, projectId)
    const original = store.entries.find(entry => entry.id === originalDocumentId)
    if (!original || (original.documentType ?? 'original') !== 'original') {
      throw new Error('Only an existing original document can be reversed.')
    }
    if (reversalPeriod < original.period) throw new Error('A reversal cannot be posted before its original accounting period.')
    const existingById = store.entries.find(entry => entry.id === reversalDocumentId)
    const previousReversal = store.entries.find(entry => entry.documentType === 'reversal' && entry.originalDocumentId === originalDocumentId)
    if (existingById) {
      if (existingById.documentType === 'reversal' && existingById.originalDocumentId === originalDocumentId &&
          existingById.period === reversalPeriod && existingById.amount === original.amount &&
          existingById.debitAccount === original.creditAccount && existingById.creditAccount === original.debitAccount) {
        existingCount += 1
        return store
      }
      throw new Error('A reversal document ID already exists with different content.')
    }
    if (previousReversal) throw new Error('The original document has already been reversed.')
    const reversal: PersistedStageInventoryAccountingPosting = {
      id: reversalDocumentId, period: reversalPeriod, kind: original.kind,
      productId: original.productId, sourceReference: 'REVERSAL:' + original.id,
      debitAccount: original.creditAccount, creditAccount: original.debitAccount,
      amount: original.amount, projectId, persistedAt: new Date().toISOString(),
      documentType: 'reversal', originalDocumentId: original.id,
    }
    return { ...store, entries: [...store.entries, reversal] }
  })
  if (!existingCount) insertedCount = saved.entries.filter(entry => entry.id === reversalDocumentId).length ? 1 : 0
  return resultFor(saved, insertedCount, existingCount)
}

export async function appendStageInventoryAccountingAdjustment(
  projectId: string,
  originalDocumentId: string,
  adjustment: StageInventoryAccountingPosting,
): Promise<StageInventoryAccountingPersistResult> {
  assertProject(projectId)
  validatePosting(adjustment)
  let insertedCount = 0
  let existingCount = 0
  const saved = await localStore.update<StageInventoryAccountingStore>(storageKey(projectId), current => {
    const store = current ?? emptyStore(projectId)
    validateStore(store, projectId)
    const original = store.entries.find(entry => entry.id === originalDocumentId)
    if (!original || (original.documentType ?? 'original') !== 'original') {
      throw new Error('An adjustment must reference an existing original document.')
    }
    if (adjustment.period < original.period) throw new Error('An adjustment cannot be posted before its original accounting period.')
    const existingById = store.entries.find(entry => entry.id === adjustment.id)
    if (existingById) {
      const expected = { ...adjustment, documentType: 'adjustment' as const, adjustmentOfDocumentId: originalDocumentId }
      if (comparable(existingById) === comparable(expected)) {
        existingCount += 1
        return store
      }
      throw new Error('An adjustment document ID already exists with different content.')
    }
    const previousAdjustment = store.entries.find(entry =>
      entry.documentType === 'adjustment' && entry.adjustmentOfDocumentId === originalDocumentId)
    if (previousAdjustment) throw new Error('The original document already has an adjustment document.')
    const entry: PersistedStageInventoryAccountingPosting = {
      ...adjustment, projectId, persistedAt: new Date().toISOString(),
      documentType: 'adjustment', adjustmentOfDocumentId: originalDocumentId,
    }
    return { ...store, entries: [...store.entries, entry] }
  })
  insertedCount = saved.entries.some(entry => entry.id === adjustment.id && entry.documentType === 'adjustment') && existingCount === 0 ? 1 : 0
  return resultFor(saved, insertedCount, existingCount)
}
