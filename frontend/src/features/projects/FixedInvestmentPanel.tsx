import {
  createBlankFixedInvestmentItem, validateFixedInvestmentItems,
  type FixedInvestmentItem, type FixedInvestmentAcquisition, type FixedInvestmentSale, type ProjectFoundation,
  type FixedInvestmentDepreciationMethod,
} from './projectFoundation'
import { listFinancialMethods, type FinancialMethodDefinition } from './financialMethodDirectory'
import { buildComfarDepreciationAssetsFromFixedInvestmentItems, calculateComfarAssetLifecycle, reconcileFixedInvestmentRegister } from '../steel/financialModel'

type Props = { value: FixedInvestmentItem[]; foundation: ProjectFoundation; projectStartYear: number; periodCount: number; capexTotal: number; preOperatingCost?: number; referenceDepreciationByYear?: ReadonlyArray<readonly [number, number]>; onChange: (items: FixedInvestmentItem[]) => void; language?: 'fa' | 'en'; blankTemplate?: boolean }
const makeId = (prefix: string) => prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
const assetClasses: { value: FixedInvestmentItem['assetClass']; fa: string; en: string }[] = [
  { value: 'land', fa: 'زمین', en: 'Land' },
  { value: 'site', fa: 'محوطه‌سازی و آماده‌سازی سایت', en: 'Site preparation' },
  { value: 'buildings', fa: 'ساختمان و ابنیه', en: 'Buildings' },
  { value: 'machinery', fa: 'ماشین‌آلات و تجهیزات', en: 'Machinery and equipment' },
  { value: 'infrastructure', fa: 'تأسیسات زیربنایی', en: 'Infrastructure' },
  { value: 'vehicles', fa: 'وسائط نقلیه', en: 'Vehicles' },
  { value: 'office', fa: 'تجهیزات اداری و خدماتی', en: 'Office and service equipment' },
  { value: 'intangible', fa: 'دارایی نامشهود', en: 'Intangible assets' },
  { value: 'preproduction', fa: 'هزینه‌های قبل از بهره‌برداری', en: 'Pre-production expenditures' },
  { value: 'other', fa: 'سایر دارایی‌های ثابت', en: 'Other fixed assets' },
]
const directoryMethodToAssetMethod: Record<string, FixedInvestmentDepreciationMethod> = {
  'depreciation.none': 'none',
  'depreciation.straight-line-zero': 'linear-zero',
  'depreciation.straight-line-scrap': 'linear-scrap',
  'depreciation.accelerated': 'accelerated',
  'depreciation.sum-of-years-digits': 'sum-of-digits',
}
const methods: { value: FixedInvestmentDepreciationMethod; definition: FinancialMethodDefinition }[] =
  listFinancialMethods('depreciation')
    .filter(definition => directoryMethodToAssetMethod[definition.id] !== undefined)
    .map(definition => ({ value: directoryMethodToAssetMethod[definition.id], definition }))

export default function FixedInvestmentPanel({ value, foundation, projectStartYear, periodCount, capexTotal, preOperatingCost = 0, referenceDepreciationByYear, onChange, language = 'fa', blankTemplate = false }: Props) {
  const en = language === 'en'
  const t = (fa: string, english: string) => en ? english : fa
  const issues = validateFixedInvestmentItems(value, foundation)
  const depreciationBuild = buildComfarDepreciationAssetsFromFixedInvestmentItems(value, projectStartYear, periodCount, foundation.planning.periodFrequency, foundation)
  const assetLifecycle = calculateComfarAssetLifecycle(depreciationBuild.assets, depreciationBuild.sales, periodCount)
  const depreciationSchedule = assetLifecycle.depreciation
  const depreciationWarnings = [...depreciationBuild.warnings, ...assetLifecycle.warnings]
  const capexReconciliation = reconcileFixedInvestmentRegister(value, capexTotal, preOperatingCost)
  const referenceRows = foundation.planning.periodFrequency === 'annual'
    ? (referenceDepreciationByYear ?? []).map(([year, reference]) => {
        const row = depreciationSchedule.periods.find(period => projectStartYear + period.period - 1 === year)
        return row ? { year, model: row.depreciation, reference, variance: row.depreciation - reference } : null
      }).filter((row): row is { year: number; model: number; reference: number; variance: number } => row !== null)
    : []
  const maximumReferenceVariance = referenceRows.reduce((maximum, row) => Math.max(maximum, Math.abs(row.variance)), 0)
  const hasDepreciableAssets = value.some(item => item.acquisitions.length > 0)
  const issueMessages: Record<string, string> = {
    'duplicate-fixed-asset-id':'شناسه اقلام سرمایه‌گذاری ثابت باید یکتا باشد.',
    'depreciation-basis-unresolved':'مبنای شرایط استهلاک هنوز مستند یا تأیید نشده است.',
    'depreciation-basis-conflict':'منابع درباره نرخ یا ارزش اسقاط استهلاک اختلاف دارند و باید تعیین تکلیف شوند.',
    'asset-acquisition-period-unallocated':'دوره تحصیل هنوز تخصیص یا تأیید نشده است.',
    'asset-acquisition-period-estimated':'دوره تحصیل برآوردی است و تا تأیید نباید مبنای جریان نقدی قطعی باشد.',
    'missing-fixed-asset-description':'شرح هر قلم دارایی را وارد کنید.',
    'unknown-fixed-asset-currency':'ارز دارایی باید در ساختار ارزهای پروژه تعریف شده باشد.',
    'local-asset-currency-mismatch':'دارایی با منشأ محلی باید به ارز محلی ثبت شود.',
    'foreign-asset-currency-mismatch':'دارایی با منشأ خارجی باید به یکی از ارزهای خارجی تعریف‌شده ثبت شود.',
    'missing-fixed-asset-cost-centre':'برای این قلم دارایی یک مرکز هزینه معتبر انتخاب کنید.',
    'missing-asset-acquisition':'برای هر قلم دارایی حداقل یک دوره تحصیل لازم است.',
    'invalid-asset-acquisition':'دوره، مقدار و قیمت تحصیل باید معتبر و نامنفی باشند.',
    'asset-acquisition-currency-mismatch':'ارز نوبت تحصیل باید با ارز قلم دارایی یکسان باشد.',
    'missing-asset-exchange-rate':'برای تحصیل دارایی با منشأ خارجی، نرخ تبدیل مثبت به ارز محلی لازم است.',
    'missing-depreciation-start':'برای دارایی مستهلک‌شونده، Starting at را تعیین کنید.',
    'invalid-depreciation-length':'مدت استهلاک باید مثبت و ماه‌ها بین صفر تا ۱۱ باشد.',
    'invalid-scrap-percent':'ارزش اسقاط باید بین صفر تا ۱۰۰ درصد بهای اولیه باشد.',
    'invalid-depreciation-rate':'نرخ استهلاک باید بیشتر از صفر و حداکثر ۱۰۰ درصد در سال باشد.',
    'invalid-first-depreciation-months':'ماه‌های سال اول استهلاک باید عدد صحیحی بین ۱ تا ۱۲ باشد.',
    'sum-of-years-partial-period-not-benchmarked':'روش مجموع سنوات برای سال ناقص یا ماه اضافه تا زمان تطبیق عددی مستقل فعال نمی‌شود.',
    'depreciation-rate-length-mismatch':'نرخ و مدت استهلاک خطی با یکدیگر سازگار نیستند.',
    'unknown-asset-sale-acquisition':'فروش دارایی باید به یک نوبت تحصیل موجود مرتبط باشد.',
    'invalid-asset-sale-period-currency':'برای فروش دارایی، دوره و ارز معتبر لازم است.',
    'invalid-asset-sale-price':'قیمت فروش تعریف‌شده باید عددی نامنفی باشد.',
    'land-not-depreciable':'برای زمین روش استهلاک انتخاب نکنید.',
    'duplicate-asset-acquisition-id':'شناسه نوبت‌های تحصیل باید یکتا باشد.',
    'local-sale-currency-mismatch':'فروش در بازار محلی باید به ارز محلی ثبت شود.',
    'foreign-sale-currency-mismatch':'فروش در بازار خارجی باید به یک ارز خارجی تعریف‌شده ثبت شود.',
    'asset-sale-before-acquisition':'تاریخ فروش نمی‌تواند قبل از تاریخ تحصیل باشد.',
    'invalid-asset-sale-period-format':'دوره فروش باید سال پروژه یا تاریخ کامل باشد.',
    'missing-sale-balance-date':'برای ثبت تاریخ کامل فروش، تاریخ تراز پروژه را تعیین کنید.',
    'asset-sale-not-at-balance-date':'فروش دارایی باید در تاریخ تراز دوره انجام شود.',
    'missing-asset-sale-exchange-rate':'برای فروش با ارز خارجی، نرخ تبدیل همان دوره لازم است.'
  }
  const currencies = [
    ...(foundation.currencies.localCurrencyCode ? [{ code: foundation.currencies.localCurrencyCode, name: foundation.currencies.localCurrencyName || foundation.currencies.localCurrencyCode }] : []),
    ...foundation.currencies.foreignCurrencies.map(currency => ({ code: currency.code, name: currency.name })),
  ]
  const updateItem = (id: string, patch: Partial<FixedInvestmentItem>) => onChange(value.map(item => item.id === id ? { ...item, ...patch } : item))
  const updateDepreciation = (id: string, patch: Partial<FixedInvestmentItem['depreciation']>) => onChange(value.map(item => item.id === id ? { ...item, depreciation: { ...item.depreciation, ...patch } } : item))
  const updateAcquisition = (id: string, acquisitionId: string, patch: Partial<FixedInvestmentAcquisition>) => onChange(value.map(item => item.id === id ? { ...item, acquisitions: item.acquisitions.map(row => row.id === acquisitionId ? { ...row, ...patch } : row) } : item))
  const updateSale = (id: string, saleId: string, patch: Partial<FixedInvestmentSale>) => onChange(value.map(item => item.id === id ? { ...item, sales: item.sales.map(row => row.id === saleId ? { ...row, ...patch } : row) } : item))
  const addAcquisition = (id: string) => onChange(value.map(item => item.id === id ? { ...item, acquisitions: [...item.acquisitions, { id: makeId('acq'), period: '', quantity: blankTemplate ? 0 : 1, unitPrice: 0, currencyCode: item.currencyCode, exchangeRateToLocal: null, allocationBasis: 'unallocated' }] } : item))
  const addSale = (id: string) => onChange(value.map(item => item.id === id ? { ...item, sales: [...item.sales, { id: makeId('sale'), acquisitionId: item.acquisitions[0]?.id ?? '', period: '', market: 'local', priceMode: 'book-value', currencyCode: item.currencyCode, selfDefinedPrice: null }] } : item))
  const field = (label: string, valueText: string | number, onValue: (value: string) => void, type = 'text', min?: number, max?: number, disabled = false, step?: number) =>
    <label className="fw-field"><span>{label}</span><input type={type} value={blankTemplate && type === 'number' && valueText === 0 ? '' : valueText} min={min} max={max} step={step} disabled={disabled} onChange={e => onValue(e.target.value)} /></label>

  return <section className="fw-card" style={{ marginTop: 18 }}>
    <h3>{t('دفتر عمومی هزینه‌های سرمایه‌گذاری ثابت','Fixed Investment Register')}</h3>
    <p className="fw-hint">{t('این دفتر فونداسیون مشترک دارایی‌های ثابت و هزینه‌های قبل از بهره‌برداری است. هر قلم چند نوبت تحصیل، مبنای مستندات دوره، شرایط استهلاک و فروش مستقل دارد. استهلاک و واگذاری به موتور مالی متصل‌اند؛ اما زمان‌بندی CAPEX فقط وقتی از دفتر استخراج می‌شود که دوره‌های تحصیل مستند یا تأیید شده و جمع دفتر با CAPEX تطبیق داشته باشد. در غیر این صورت CAPEX تجمیعی به‌عنوان مبنای موقت باقی می‌ماند.','This register is shared across industries and templates. Each asset class can have multiple acquisition periods, currencies, depreciation conditions and disposals. Its depreciation and disposal schedules feed the integrated finance engine. Fixed-asset acquisitions and pre-production expenditures are reconciled separately to aggregate CAPEX, preventing double-counting; the evidence basis for each acquisition period and depreciation condition is recorded and validated.')}</p>
    {value.map(item => <div className="fw-card" key={item.id}>
      <div className="fw-grid">
        {field(t('شرح دارایی','Fixed Investment Item'), item.description, v => updateItem(item.id, { description: v }))}
        <label className="fw-field"><span>{t('طبقه دارایی','Asset Class')}</span><select value={item.assetClass} onChange={e => updateItem(item.id, { assetClass: e.target.value as FixedInvestmentItem['assetClass'], depreciation: e.target.value === 'land' ? { ...item.depreciation, method: 'none' } : item.depreciation })}>{assetClasses.map(option => <option key={option.value} value={option.value}>{en ? option.en : option.fa}</option>)}</select></label>
        <label className="fw-field"><span>{t('منشأ دارایی','Asset Origin')}</span><select value={item.origin} onChange={e => { const origin = e.target.value as FixedInvestmentItem['origin']; const currencyCode = origin === 'local' ? foundation.currencies.localCurrencyCode : (foundation.currencies.foreignCurrencies[0]?.code ?? ''); updateItem(item.id, { origin, currencyCode, acquisitions: item.acquisitions.map(row => ({ ...row, currencyCode })), sales: item.sales.map(row => ({ ...row, currencyCode })) }) }}><option value="local">{t('محلی','Local')}</option><option value="foreign">{t('خارجی','Foreign')}</option></select></label>
        <label className="fw-field"><span>{t('ارز دارایی','Asset Currency')}</span><select value={item.currencyCode} onChange={e => updateItem(item.id, { currencyCode: e.target.value, acquisitions: item.acquisitions.map(row => ({ ...row, currencyCode: e.target.value })), sales: item.sales.map(row => ({ ...row, currencyCode: e.target.value })) })}><option value="">{t('انتخاب ارز','Select currency')}</option>{currencies.filter(currency => item.origin === 'local' ? currency.code === foundation.currencies.localCurrencyCode : currency.code !== foundation.currencies.localCurrencyCode).map(currency => <option key={currency.code} value={currency.code}>{currency.code} — {currency.name}</option>)}</select></label>
        {foundation.costCentres.active && <label className="fw-field"><span>{t('مرکز هزینه','Cost Centre')}</span><select value={item.costCentreId} onChange={e => updateItem(item.id, { costCentreId: e.target.value })}><option value="">{t('انتخاب مرکز هزینه','Select Cost Centre')}</option>{foundation.costCentres.items.map(centre => <option key={centre.id} value={centre.id}>{centre.code} — {centre.name}</option>)}</select></label>}
        <button type="button" className="secondary-button" onClick={() => onChange(value.filter(row => row.id !== item.id))}>{t('حذف قلم دارایی','Remove Fixed Investment Item')}</button>
      </div>

      <h4>{t('شرایط استهلاک','Depreciation Conditions')}</h4>
      <div className="fw-grid">
        <label className="fw-field"><span>{t('روش استهلاک از دایرکتوری','Depreciation Method Directory')}</span><select value={item.depreciation.method} onChange={e => updateDepreciation(item.id, { method: e.target.value as FixedInvestmentItem['depreciation']['method'] })}>{methods.map(option => <option key={option.definition.id} value={option.value}>{en ? option.definition.nameEn : option.definition.nameFa}</option>)}</select></label>
        {(() => {
          const definition = methods.find(option => option.value === item.depreciation.method)?.definition
          if (!definition) return null
          const calculationLabel = definition.calculationStatus === 'implemented' ? t('محاسبه در موتور موجود است','Calculation implemented') : definition.calculationStatus === 'conditional' ? t('محاسبه با محدودیت','Conditional calculation') : t('فقط در فهرست روش‌ها؛ محاسبه فعال نیست','Catalogue only; calculation inactive')
          const benchmarkLabel = definition.benchmarkStatus === 'verified' ? t('آزمون مرجع تأییدشده','Benchmark verified') : definition.benchmarkStatus === 'partial' ? t('اعتبارسنجی جزئی','Partially benchmarked') : t('هنوز با مرجع عددی تطبیق نشده','Not numerically benchmarked')
          return <div className="fw-hint" role="note">
            <strong>{calculationLabel} · {benchmarkLabel}</strong>
            <div>{t('فرمول: ','Formula: ')}{definition.formula}</div>
            <div>{t('دامنه اعتبار: ','Validity: ')}{definition.validity}</div>
            <div>{t('منبع: ','Source: ')}{definition.source}</div>
            {definition.limitations && <div>{t('محدودیت: ','Limitation: ')}{definition.limitations}</div>}
          </div>
        })()}
        <label className="fw-field"><span>{t('مبنای شرایط استهلاک','Depreciation Condition Evidence')}</span><select value={item.depreciationBasis??'unresolved'} onChange={e=>updateItem(item.id,{depreciationBasis:e.target.value as FixedInvestmentItem['depreciationBasis']})}>
          <option value="source-table">{t('مستند به جدول منبع','Source-table')}</option>
          <option value="user-confirmed">{t('تأیید کاربر بدون سند (محاسبه نمی‌شود)','User-confirmed without source (not calculated)')}</option>
          <option value="source-conflict">{t('تعارض بین منابع','Source conflict')}</option>
          <option value="unresolved">{t('تعیین‌نشده','Unresolved')}</option>
        </select></label>
        {item.depreciationBasis==='source-table'&&<>
          {field(t('مرجع سند دارایی‌به‌دارایی (نام فایل/صفحه/شناسه)','Asset-by-asset source reference (file/page/ID)'),item.depreciationEvidenceReference??'',v=>updateItem(item.id,{depreciationEvidenceReference:v}),'text')}
          <label className="fw-field"><span><input type="checkbox" checked={item.depreciationEvidenceVerified===true} onChange={e=>updateItem(item.id,{depreciationEvidenceVerified:e.target.checked})}/>{t('سند دارایی‌به‌دارایی بررسی و تأیید شده است','Asset-by-asset source document has been reviewed and verified')}</span></label>
          {(!item.depreciationEvidenceReference?.trim()||item.depreciationEvidenceVerified!==true)&&<p className="fw-hint">{t('تا زمان ثبت مرجع سند و تأیید بررسی آن، استهلاک در موتور مالی صفر می‌ماند.','Depreciation remains zero in the finance engine until the source reference is recorded and verified.')}</p>}
        </>}
        {item.depreciationBasis==='user-confirmed'&&<p className="fw-hint">{t('تأیید کاربر به‌تنهایی سند دارایی‌به‌دارایی محسوب نمی‌شود و استهلاک محاسبه نخواهد شد.','User confirmation alone is not an asset-by-asset source document; depreciation will not be calculated.')}</p>}
        {field(t('شروع استهلاک','Starting at'), item.depreciation.startingAt, v => updateDepreciation(item.id, { startingAt: v }), 'text')}
        {field(t('نرخ استهلاک (% در سال)','Rate (% per annum)'), item.depreciation.ratePercent ?? '', v => updateDepreciation(item.id, { ratePercent: v === '' ? null : Number(v) }), 'number', 0, 100, item.depreciation.method === 'none' || item.depreciation.method === 'sum-of-digits')}
        {field(t('مدت استهلاک ـ سال','Length — Years'), item.depreciation.lengthYears ?? '', v => updateDepreciation(item.id, { lengthYears: v === '' ? null : Number(v) }), 'number', 0, 100, item.depreciation.method === 'none', 0.001)}
        {field(t('مدت استهلاک ـ ماه','Length — Months'), item.depreciation.lengthMonths, v => updateDepreciation(item.id, { lengthMonths: Number(v) }), 'number', 0, 11, item.depreciation.method === 'none')}
        {field(t('ماه‌های مشمول استهلاک در سال اول','Months in first depreciation year'), item.depreciation.firstDepreciationMonths, v => updateDepreciation(item.id, { firstDepreciationMonths: Number(v) }), 'number', 1, 12, item.depreciation.method === 'none')}
        {field(t('ارزش اسقاط (% از بهای اولیه)','Scrap (% of original value)'), item.depreciation.scrapPercent, v => updateDepreciation(item.id, { scrapPercent: Number(v) }), 'number', 0, 100, item.depreciation.method === 'none')}
        {item.depreciation.method === 'sum-of-digits' && (item.depreciation.lengthMonths > 0 || item.depreciation.firstDepreciationMonths !== 12) && <p className="fw-hint">{t('برای حفظ دقت، محاسبه مجموع سنوات در دوره ناقص فعلاً مسدود است.','Sum of years digits with a partial period is held to avoid unverified depreciation results.')}</p>}
      </div>

      <h4>{t('هزینه تحصیل دارایی به تفکیک دوره','Costs of Assets by Period')}</h4>
      {item.acquisitions.map(acquisition => <div className="fw-grid" key={acquisition.id}>
        {field(t('دوره تحصیل','Acquisition Period'), acquisition.period, v => updateAcquisition(item.id, acquisition.id, { period: v }))}
        <label className="fw-field"><span>{t('مبنای دوره تحصیل','Acquisition Period Basis')}</span><select value={acquisition.allocationBasis ?? 'unallocated'} onChange={e=>updateAcquisition(item.id,acquisition.id,{allocationBasis:e.target.value as FixedInvestmentAcquisition['allocationBasis']})}><option value="source-period">{t('مستند به فایل منبع','Source-period evidence')}</option><option value="user-confirmed">{t('تأییدشده توسط کاربر','User-confirmed')}</option><option value="proportional-estimate">{t('برآورد تناسبی','Proportional estimate')}</option><option value="unallocated">{t('تخصیص‌نیافته','Unallocated')}</option></select></label>
        {field(t('مقدار','Quantity'), acquisition.quantity, v => updateAcquisition(item.id, acquisition.id, { quantity: Number(v) }), 'number', 0)}
        {field(t('قیمت واحد','Price'), acquisition.unitPrice, v => updateAcquisition(item.id, acquisition.id, { unitPrice: Number(v) }), 'number', 0)}
        {field(t('نرخ تبدیل به ارز محلی','Exchange Rate to Local Currency'), acquisition.exchangeRateToLocal ?? '', v => updateAcquisition(item.id, acquisition.id, { exchangeRateToLocal: v === '' ? null : Number(v) }), 'number', 0, undefined, item.origin === 'local')}
        <div className="fw-field"><span>{t('جمع ردیف','Total')}</span><b>{(acquisition.quantity * acquisition.unitPrice).toLocaleString(en ? 'en-US' : 'fa-IR', { maximumFractionDigits: 2 })} {acquisition.currencyCode}</b></div>
        <button type="button" className="secondary-button" onClick={() => updateItem(item.id, { acquisitions: item.acquisitions.filter(row => row.id !== acquisition.id) })}>{t('حذف نوبت تحصیل','Remove Acquisition')}</button>
      </div>)}
      <button type="button" className="secondary-button" onClick={() => addAcquisition(item.id)}>{t('افزودن نوبت تحصیل','Add Acquisition')}</button>

      <h4>{t('فروش و واگذاری دارایی','Sale of Asset')}</h4>
      {item.sales.map(sale => <div className="fw-grid" key={sale.id}>
        <label className="fw-field"><span>{t('نوبت تحصیل مرتبط','Related Acquisition')}</span><select value={sale.acquisitionId} onChange={e => updateSale(item.id, sale.id, { acquisitionId: e.target.value })}><option value="">{t('انتخاب نوبت','Select Acquisition')}</option>{item.acquisitions.map(acquisition => <option key={acquisition.id} value={acquisition.id}>{acquisition.period}</option>)}</select></label>
        {field(t('تاریخ/دوره فروش','Date/Period of Sale'), sale.period, v => updateSale(item.id, sale.id, { period: v }))}
        <label className="fw-field"><span>{t('بازار فروش','Sale Market')}</span><select value={sale.market} onChange={e => updateSale(item.id, sale.id, { market: e.target.value as FixedInvestmentSale['market'] })}><option value="local">{t('محلی','Local')}</option><option value="foreign">{t('خارجی','Foreign')}</option></select></label>
        <label className="fw-field"><span>{t('روش تعیین قیمت فروش','Asset Liquidation Price')}</span><select value={sale.priceMode} onChange={e => updateSale(item.id, sale.id, { priceMode: e.target.value as FixedInvestmentSale['priceMode'] })}><option value="book-value">{t('به ارزش دفتری','Sale at book value')}</option><option value="self-defined">{t('قیمت تعریف‌شده توسط کاربر','Self-defined price')}</option></select></label>
        <label className="fw-field"><span>{t('ارز فروش','Sale Currency')}</span><select value={sale.currencyCode} onChange={e => updateSale(item.id, sale.id, { currencyCode: e.target.value })}>{currencies.map(currency => <option key={currency.code} value={currency.code}>{currency.code} — {currency.name}</option>)}</select></label>
        {sale.priceMode === 'self-defined' && field(t('قیمت فروش','Sale Price'), sale.selfDefinedPrice ?? '', v => updateSale(item.id, sale.id, { selfDefinedPrice: v === '' ? null : Number(v) }), 'number', 0)}
        <button type="button" className="secondary-button" onClick={() => updateItem(item.id, { sales: item.sales.filter(row => row.id !== sale.id) })}>{t('حذف فروش','Remove Sale')}</button>
      </div>)}
      <button type="button" className="secondary-button" disabled={item.acquisitions.length === 0} onClick={() => addSale(item.id)}>{t('افزودن فروش دارایی','Add Asset Sale')}</button>
    </div>)}
    <button type="button" className="secondary-button" onClick={() => onChange([...value, createBlankFixedInvestmentItem()])}>{t('افزودن قلم سرمایه‌گذاری ثابت','Add Fixed Investment Item')}</button>
    {hasDepreciableAssets && <div className="fw-card">
      <h4>{t('پیش‌نمایش برنامه استهلاک دارایی‌ها','Asset Depreciation Schedule Preview')}</h4>
      <p className="fw-hint">{t('این پیش‌نمایش از نوبت‌های تحصیل و فروش همین دفتر ساخته می‌شود و برنامه استهلاک/واگذاری آن به موتور مالی یکپارچه ارسال می‌شود. جمع دفتر با CAPEX تجمیعی تطبیق داده می‌شود؛ زمان‌بندی دفتر فقط در صورت تأیید دوره‌های تحصیل و انطباق جمع، جایگزین تخصیص موقت CAPEX می‌شود و هیچ مبلغی دوباره به سرمایه‌گذاری اضافه نمی‌گردد.','This preview is built from acquisition and disposal vintages in this register and is passed to the integrated finance engine for depreciation and asset-sale treatment. Register totals are reconciled to aggregate CAPEX; register timing replaces the provisional CAPEX allocation only when acquisition periods are verified and totals match. Register amounts are never added a second time.')}</p>
      {depreciationWarnings.map((warning,index)=><p className="fw-hint" key={index}>{warning}</p>)}
      {periodCount > 0 && <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('استهلاک دوره','Depreciation')}</th><th>{t('ارزش دفتری پایان دوره','Closing Book Value')}</th><th>{t('عایدی فروش','Asset Sale Proceeds')}</th><th>{t('برگشت سرمایه','Return of Capital')}</th><th>{t('سایر درآمد/زیان','Other Income / Loss')}</th></tr></thead><tbody>{depreciationSchedule.periods.map(row=>{const sales=assetLifecycle.sales.filter(sale=>sale.period===row.period);const sum=(key:'saleProceeds'|'returnOfCapital'|'otherIncomeLoss')=>sales.reduce((total,sale)=>total+sale[key],0);return <tr key={row.period}><td>{projectStartYear+row.period-1}</td><td>{row.depreciation.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</td><td>{row.closingBookValue.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</td><td>{sum('saleProceeds').toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</td><td>{sum('returnOfCapital').toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</td><td>{sum('otherIncomeLoss').toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</td></tr>})}</tbody></table></div>}
      {referenceRows.length > 0 && <div className="fw-card">
        <h4>{t('تطبیق استهلاک سالانه با خروجی مرجع','Annual Depreciation vs Reference Output')}</h4>
        <p className="fw-hint">{t('اختلاف‌ها به‌صورت شفاف نمایش داده می‌شوند و هیچ نرخ یا عمر مفیدی برای نزدیک‌کردن مصنوعی نتایج تغییر نمی‌کند.','Variances are shown transparently; no rate or useful life is adjusted to force an artificial match.')}</p>
        <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('سال','Year')}</th><th>{t('محاسبه پیشران','Pishran Calculation')}</th><th>{t('خروجی مرجع','Reference Output')}</th><th>{t('اختلاف','Variance')}</th></tr></thead><tbody>{referenceRows.map(row=><tr key={row.year}><td>{row.year}</td><td>{row.model.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</td><td>{row.reference.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</td><td>{row.variance.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</td></tr>)}</tbody></table></div>
        <div className="fw-validation"><span>{t('بیشترین اختلاف مطلق','Maximum Absolute Variance')}</span><b>{maximumReferenceVariance.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</b></div>
      </div>}
      {!assetLifecycle.valid && <p className="fw-hint">{t('برنامه استهلاک دارای هشدار است و نباید به‌عنوان خروجی تأییدشده استفاده شود.','The depreciation schedule has warnings and must not be treated as a validated output.')}</p>}
    </div>}
    <div className="fw-card">
      <h4>{t('تطبیق دفتر دارایی با CAPEX تجمیعی','Fixed Investment Register to Aggregate CAPEX Reconciliation')}</h4>
      <p className="fw-hint">{t('این کنترل، جمع نوبت‌های تحصیل را پس از تبدیل به ارز محلی با CAPEX منهای هزینه‌های قبل از بهره‌برداری مقایسه می‌کند. ارقام دفتر دوباره به CAPEX اضافه نمی‌شوند؛ تا زمان رفع اختلاف، برنامه سرمایه‌گذاری تجمیعی منبع جریان نقدی باقی می‌ماند.','This control compares acquisition vintages converted to local currency with aggregate CAPEX less pre-operating expenses. Register amounts are not added again to CAPEX; until the difference is resolved, aggregate CAPEX remains the cash-flow source.')}</p>
      <div className="fw-validation"><span>{t('جمع نوبت‌های تحصیل به ارز محلی','Register Acquisitions in Local Currency')}</span><b>{depreciationBuild.assets.length || value.some(item=>item.acquisitions.length>0) ? capexReconciliation.registerTotal.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2}) : '—'}</b></div>
      <div className="fw-validation"><span>{t('CAPEX هدف پس از کسر هزینه‌های قبل از بهره‌برداری','CAPEX Target Excluding Pre-operating Expenses')}</span><b>{capexReconciliation.capexFixedAssetTarget.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</b></div>
      <div className="fw-validation"><span>{t('جمع هزینه‌های قبل از بهره‌برداری در دفتر','Pre-production Expenditures in Register')}</span><b>{capexReconciliation.preproductionTotal.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</b></div>
      <div className="fw-validation"><span>{t('هدف هزینه‌های قبل از بهره‌برداری','Pre-production Expenditure Target')}</span><b>{capexReconciliation.preOperatingTarget.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</b></div>
      <div className="fw-validation"><span>{t('اختلاف هزینه‌های قبل از بهره‌برداری','Pre-production Reconciliation Difference')}</span><b>{capexReconciliation.preproductionDifference.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</b></div>
      <div className="fw-validation"><span>{t('اختلاف تطبیق','Reconciliation Difference')}</span><b>{capexReconciliation.difference.toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})}</b></div>
      <div className="fw-validation"><span>{t('وضعیت تطبیق','Reconciliation Status')}</span><b>{capexReconciliation.status==='matched'?t('منطبق','Matched'):capexReconciliation.status==='not-entered'?t('ثبت نشده','Not entered'):t('نیازمند تطبیق','Unreconciled')}</b></div>
      <div className="fw-validation"><span>{t('تأیید زمان‌بندی تحصیل دارایی‌های ثابت','Fixed Asset Acquisition Timing')}</span><b>{depreciationBuild.investmentScheduleVerified?t('تأییدشده','Verified'):t('موقت / نیازمند تأیید','Provisional / Requires confirmation')}</b></div>
      <div className="fw-validation"><span>{t('تأیید زمان‌بندی هزینه‌های قبل از بهره‌برداری','Pre-production Timing')}</span><b>{depreciationBuild.preOperatingScheduleVerified?t('تأییدشده','Verified'):t('موقت / نیازمند تأیید','Provisional / Requires confirmation')}</b></div>
      {capexReconciliation.warnings.map((warning,index)=><p className="fw-hint" key={index}>{warning}</p>)}
    </div>
    <h4>{t('کنترل کامل بودن دفتر دارایی','Fixed Investment Register Validation')}</h4>
    <div className="fw-validation"><span>{t('خطاهای ثبت','Input errors')}</span><b>{issues.length}</b></div>
    {issues.map((issue, index) => <div className="fw-hint" key={issue.path + issue.code + index}><b>{issue.path}</b> — {en ? issue.message : (issueMessages[issue.code] ?? issue.message)}</div>)}
  </section>
}
