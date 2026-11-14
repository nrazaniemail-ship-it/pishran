const DB_NAME = 'pishran_store'
const STORE_NAME = 'kv'
const PREFIX = 'pishran_'

type StoreRecord = { key: string; value: unknown }

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
        request.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return dbPromise
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> {
  const db = await openDatabase()
  if (!db) return undefined
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const request = operation(tx.objectStore(STORE_NAME))
    let result: T | undefined
    request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'))
  })
}

function localKey(key: string) {
  return PREFIX + key
}

function readFallback<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(localKey(key))
    return raw === null ? undefined : JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

function writeFallback(key: string, value: unknown) {
  localStorage.setItem(localKey(key), JSON.stringify(value))
}

export const localStore = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const record = await runTransaction<StoreRecord>('readonly', store => store.get(key))
      if (record) return record.value as T
    } catch {
      // Fall through to the browser-local fallback.
    }
    return readFallback<T>(key)
  },

  async set<T>(key: string, value: T): Promise<void> {
    const db = await openDatabase()
    if (db) {
      try {
        await runTransaction('readwrite', store => store.put({ key, value }))
      } catch {
        writeFallback(key, value)
      }
    } else {
      writeFallback(key, value)
    }
    // Settings mirrors are an optimization; a quota/permission failure must not
    // turn a successful IndexedDB write into a failed save.
    if (db && key.startsWith('settings:')) {
      try { writeFallback(key, value) } catch { /* IndexedDB remains authoritative. */ }
    }
  },

  async remove(key: string): Promise<void> {
    try { await runTransaction('readwrite', store => store.delete(key)) } catch { /* local fallback below */ }
    try { localStorage.removeItem(localKey(key)) } catch { /* storage may be disabled */ }
  },

  async list(prefix = ''): Promise<StoreRecord[]> {
    const db = await openDatabase()
    if (db) {
      try {
        const records = await runTransaction<StoreRecord[]>('readonly', store => store.getAll())
        if (records) return records.filter(record => record.key.startsWith(prefix))
      } catch { /* local fallback below */ }
    }
    const records: StoreRecord[] = []
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key?.startsWith(PREFIX)) {
          const name = key.slice(PREFIX.length)
          if (name.startsWith(prefix)) {
            const value = readFallback(name)
            if (value !== undefined) records.push({ key: name, value })
          }
        }
      }
    } catch { /* storage may be disabled */ }
    return records
  },

  async exportAll(): Promise<{ schema: number; exportedAt: string; records: StoreRecord[] }> {
    return { schema: 1, exportedAt: new Date().toISOString(), records: await this.list() }
  },

  async importAll(backup: { schema?: number; records?: StoreRecord[] }): Promise<number> {
    if (!backup || !Array.isArray(backup.records)) throw new Error('ساختار فایل پشتیبان معتبر نیست')
    return this.replaceAll(backup.records)
  },

  async replaceAll(records: StoreRecord[]): Promise<number> {
    if (!Array.isArray(records)) throw new Error('فایل پشتیبان نامعتبر است')
    const seen = new Set<string>()
    for (const record of records) {
      if (!record || typeof record.key !== 'string' || !record.key.trim() || record.key.length > 240 || seen.has(record.key)) {
        throw new Error('ساختار رکوردهای فایل پشتیبان معتبر نیست')
      }
      seen.add(record.key)
    }
    const db = await openDatabase()
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.clear()
        for (const record of records) store.put({ key: record.key, value: record.value })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error ?? new Error('بازیابی اطلاعات متوقف شد'))
      })
    }
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i)
        if (key?.startsWith(PREFIX)) localStorage.removeItem(key)
      }
      for (const record of records) writeFallback(record.key, record.value)
    } catch {
      if (!db) throw new Error('ذخیره‌سازی محلی در دسترس نیست')
      // IndexedDB is authoritative when available; fallback mirroring may be unavailable.
    }
    return records.length
  },

  async info(): Promise<{ backend: 'IndexedDB' | 'localStorage'; items: number }> {
    const db = await openDatabase()
    return { backend: db ? 'IndexedDB' : 'localStorage', items: (await this.list()).length }
  }
}
