import { localStore } from '../../core/storage/localStore'
import { validateProductionRecord, type ProductionRecord } from './productionAnalysis'

const STORAGE_KEY = 'production:records:v1'

export async function listProductionRecords(projectId?: string): Promise<ProductionRecord[]> {
  const records = await localStore.get<ProductionRecord[]>(STORAGE_KEY) ?? []
  return projectId ? records.filter(record => record.projectId === projectId) : records
}

export async function saveProductionRecord(record: ProductionRecord): Promise<ProductionRecord> {
  const errors = validateProductionRecord(record)
  if (errors.length) throw new Error(errors.join('؛ '))
  const records = await listProductionRecords()
  const index = records.findIndex(item => item.id === record.id)
  if (index >= 0) records[index] = { ...record, updatedAt: new Date().toISOString() }
  else records.push(record)
  await localStore.set(STORAGE_KEY, records)
  return index >= 0 ? records[index] : record
}

export async function deleteProductionRecord(id: string): Promise<void> {
  const records = await listProductionRecords()
  await localStore.set(STORAGE_KEY, records.filter(record => record.id !== id))
}
