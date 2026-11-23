import { useMemo, useState } from 'react'
import {
  appendStageInventoryAccountingAdjustment,
  appendStageInventoryAccountingReversal,
  type PersistedStageInventoryAccountingPosting,
} from './stageInventoryAccountingStore'

type Props = {
  projectId: string
  entries: PersistedStageInventoryAccountingPosting[]
  periodCount: number
  onUpdated: (entries: PersistedStageInventoryAccountingPosting[]) => void
  en?: boolean
}

const documentId = (prefix: string) => {
  const suffix = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
  return prefix + '-' + suffix
}

export default function StageInventoryCorrectionsPanel({ projectId, entries, periodCount, onUpdated, en = false }: Props) {
  const originals = useMemo(() => entries.filter(row => (row.documentType ?? 'original') === 'original'), [entries])
  const [originalId, setOriginalId] = useState('')
  const [period, setPeriod] = useState(1)
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const selected = originals.find(row => row.id === originalId) ?? originals[0]
  const existingCorrection = selected
    ? entries.find(row => (row.documentType === 'reversal' && row.originalDocumentId === selected.id) ||
        (row.documentType === 'adjustment' && row.adjustmentOfDocumentId === selected.id))
    : undefined
  const minPeriod = selected?.period ?? 1
  const safePeriod = Math.max(minPeriod, Math.min(periodCount || minPeriod, period))

  const reverse = async () => {
    if (!selected || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await appendStageInventoryAccountingReversal(
        projectId, selected.id, documentId('REV'), safePeriod,
      )
      onUpdated(result.entries)
      setMessage(en ? 'Reversal appended and saved locally.' : 'سند برگشت به‌صورت الحاقی ثبت و در ذخیره‌ساز محلی ذخیره شد.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally { setBusy(false) }
  }

  const adjust = async () => {
    if (!selected || busy) return
    const amount = Number(adjustmentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(en ? 'Enter a positive adjustment amount.' : 'مبلغ تعدیل باید عددی مثبت باشد.')
      return
    }
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await appendStageInventoryAccountingAdjustment(projectId, selected.id, {
        id: documentId('ADJ'),
        period: safePeriod,
        kind: selected.kind,
        productId: selected.productId,
        sourceReference: 'ADJUST:' + selected.sourceReference,
        debitAccount: selected.debitAccount,
        creditAccount: selected.creditAccount,
        amount,
      })
      onUpdated(result.entries)
      setAdjustmentAmount('')
      setMessage(en ? 'Positive adjustment appended and saved locally.' : 'تعدیل افزایشی به‌صورت الحاقی ثبت و در ذخیره‌ساز محلی ذخیره شد.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally { setBusy(false) }
  }

  const correctedIds = new Set(entries.flatMap(row => row.documentType === 'reversal' && row.originalDocumentId
    ? [row.originalDocumentId] : row.documentType === 'adjustment' && row.adjustmentOfDocumentId
      ? [row.adjustmentOfDocumentId] : []))

  return <section className="fw-card" aria-label={en ? 'Append-only stage journal corrections' : 'اصلاحات الحاقی دفتر مرحله‌ای'}>
    <h4>{en ? 'Append-only journal corrections' : 'اصلاحات الحاقی اسناد دفتر مرحله‌ای'}</h4>
    <p className="fw-hint">{en
      ? 'Choose an original posting. Reversal posts the exact inverse in the selected period; adjustment adds a positive difference using the original debit/credit direction. Existing originals are never overwritten.'
      : 'سند اصلی را انتخاب کنید. برگشت، معکوس دقیق سند را در دوره انتخابی ثبت می‌کند؛ تعدیل، مبلغ افزایشی مثبت را با همان جهت بدهکار/بستانکار ثبت می‌کند. سند اصلی هرگز بازنویسی نمی‌شود.'}</p>
    {originals.length === 0
      ? <p className="fw-hint">{en ? 'No original stage postings are available yet.' : 'هنوز سند اصلی برای اصلاح وجود ندارد.'}</p>
      : <>
        <label className="fw-field">
          <span>{en ? 'Original document' : 'سند اصلی'}</span>
          <select value={selected?.id ?? ''} onChange={event => { setOriginalId(event.target.value); setPeriod(1); setError(''); setMessage('') }}>
            {originals.map(row => <option key={row.id} value={row.id}>
              {row.id} · P{row.period} · {row.kind} · {row.amount}
            </option>)}
          </select>
        </label>
        {selected && <>
          <p className="fw-hint">{en ? 'Debit' : 'بدهکار'}: {selected.debitAccount} · {en ? 'Credit' : 'بستانکار'}: {selected.creditAccount} · {en ? 'Product' : 'محصول'}: {selected.productId} · {en ? 'Amount' : 'مبلغ'}: {selected.amount}</p>
          <label className="fw-field">
            <span>{en ? 'Posting period' : 'دوره ثبت'}</span>
            <select value={safePeriod} onChange={event => setPeriod(Number(event.target.value))}>
              {Array.from({ length: Math.max(1, periodCount - minPeriod + 1) }, (_, index) => minPeriod + index).map(value =>
                <option key={value} value={value}>{en ? 'Period' : 'دوره'} {value}</option>)}
            </select>
          </label>
          {existingCorrection
            ? <p className="fw-hint">{en ? 'This original already has a correction:' : 'این سند اصلی قبلاً اصلاح شده است:'} {existingCorrection.id} ({existingCorrection.documentType}). {en ? 'A second correction is blocked.' : 'اصلاح دوم برای این سند مسدود است.'}</p>
            : <div className="fw-grid">
              <button className="secondary-button" disabled={busy || safePeriod < minPeriod} onClick={reverse}>
                {busy ? (en ? 'Saving…' : 'در حال ثبت…') : (en ? 'Append exact reversal' : 'ثبت برگشت کامل')}
              </button>
              <label className="fw-field">
                <span>{en ? 'Positive adjustment difference' : 'مبلغ تعدیل افزایشی'}</span>
                <input type="number" min="0.01" step="0.01" value={adjustmentAmount} onChange={event => setAdjustmentAmount(event.target.value)} />
              </label>
              <button className="secondary-button" disabled={busy || !(Number(adjustmentAmount) > 0)} onClick={adjust}>
                {en ? 'Append adjustment' : 'ثبت تعدیل افزایشی'}
              </button>
            </div>}
        </>}
      </>}
    {error && <p className="fw-validation" role="alert">{error}</p>}
    {message && <p className="fw-result" role="status">{message}</p>}
    <p className="fw-hint">{en
      ? 'Only one correction type is permitted per original document. A decrease or opposite-direction correction must be handled by a full reversal and a separately identified replacement posting.'
      : 'برای هر سند اصلی فقط یک نوع اصلاح مجاز است. کاهش مبلغ یا اصلاح با جهت معکوس باید با برگشت کامل و ثبت یک سند جایگزین با شناسه مستقل انجام شود.'}</p>
    <p className="fw-hint">{en ? 'Already corrected originals: ' : 'اسناد اصلی اصلاح‌شده: '}{
      originals.filter(row => correctedIds.has(row.id)).length} / {originals.length}</p>
  </section>
}
