import { buildProjectCalendarPeriods, validateProjectFoundation, type ProjectFoundation, type ProjectCurrency, type ProjectCostCentre, type ProjectInflationIndex, type ProjectTaxRate } from './projectFoundation'

type Props = { value: ProjectFoundation; onChange: (value: ProjectFoundation) => void; language?: 'fa' | 'en' }
const makeId = (prefix: string) => prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)

export default function ProjectFoundationPanel({ value, onChange, language = 'fa' }: Props) {
  const en = language === 'en'
  const issues = validateProjectFoundation(value)
  const calendarPeriods = value.planning.projectStartDate && value.planning.projectEndDate &&
    value.planning.periodFrequency !== 'unspecified' && value.planning.fiscalYearStartMonth !== null
    ? buildProjectCalendarPeriods(value.planning.projectStartDate, value.planning.projectEndDate,
      value.planning.periodFrequency, value.planning.fiscalYearStartMonth)
    : []
  const t = (fa: string, english: string) => en ? english : fa
  const issueMessages: Record<string, string> = {
    'invalid-balance-month':'ماه تاریخ تراز باید عدد صحیحی بین ۱ تا ۱۲ باشد.', 'invalid-balance-day':'روز تاریخ تراز باید عدد صحیحی بین ۱ تا ۳۱ باشد.', 'missing-period-frequency':'تناوب دوره مالی را انتخاب کنید.', 'missing-balance-month':'ماه تاریخ تراز را مشخص کنید.', 'missing-balance-day':'روز تاریخ تراز را مشخص کنید.', 'missing-day-count-basis':'مبنای شمارش روز را مشخص کنید.', 'missing-cash-flow-timing':'زمان‌بندی جریان نقدی برای تنزیل را انتخاب کنید.', 'missing-discounting-method':'روش تنزیل را انتخاب کنید.', 'missing-tax-system':'نظام مالیاتی را انتخاب کنید.', 'missing-loss-carryforward-setting':'وضعیت انتقال زیان مالیاتی را مشخص کنید.',
    'missing-valuation-date':'تاریخ ارزش‌گذاری هنوز تعیین نشده است.', 'missing-local-currency':'پیش از محاسبه، ارز محلی را مشخص کنید.',
    'duplicate-currency-code':'کد ارزها باید یکتا باشد.', 'incomplete-currency':'برای هر ارز خارجی، کد و نام لازم است.',
    'invalid-exchange-rate':'هر نرخ ارز باید دوره و نرخ مثبت به ارز محلی داشته باشد.', 'empty-cost-centres':'تحلیل مراکز هزینه فعال است اما مرکزی تعریف نشده است.',
    'duplicate-cost-centre-code':'کد مراکز هزینه باید یکتا باشد.', 'incomplete-cost-centre':'برای هر مرکز هزینه، کد و نام لازم است.',
    'unknown-parent-cost-centre':'مرکز هزینه والد انتخاب‌شده وجود ندارد.', 'empty-inflation-indices':'تورم فعال است اما شاخص قیمتی تعریف نشده است.',
    'incomplete-inflation-index':'هر شاخص تورم به نام و کد ارز نیاز دارد.', 'invalid-inflation-rate':'هر نرخ تورم باید دوره و نرخی بزرگ‌تر از ۱۰۰- درصد داشته باشد.',
    'invalid-discount-rate':'نرخ تنزیل باید بزرگ‌تر از ۱۰۰- درصد باشد.', 'missing-financial-discount-rate':'نرخ تنزیل مالی دستی تعیین نشده است.',
    'invalid-loss-carryforward-period':'مدت انتقال زیان باید عدد صحیح نامنفی باشد.', 'invalid-tax-rate':'هر نرخ مالیات باید بین صفر تا ۱۰۰ درصد باشد.',
    'missing-tax-rates':'نظام مالیاتی انتخاب شده اما نرخ مالیات دوره‌ای وارد نشده است.'
  }
  const update = (patch: Partial<ProjectFoundation>) => onChange({ ...value, ...patch })
  const updatePlanning = (patch: Partial<ProjectFoundation['planning']>) => update({ planning: { ...value.planning, ...patch } })
  const updateCurrencies = (patch: Partial<ProjectFoundation['currencies']>) => update({ currencies: { ...value.currencies, ...patch } })
  const updateCentres = (patch: Partial<ProjectFoundation['costCentres']>) => update({ costCentres: { ...value.costCentres, ...patch } })
  const updateInflation = (patch: Partial<ProjectFoundation['inflation']>) => update({ inflation: { ...value.inflation, ...patch } })
  const updateDiscounting = (patch: Partial<ProjectFoundation['discounting']>) => update({ discounting: { ...value.discounting, ...patch } })
  const updateTax = (patch: Partial<ProjectFoundation['taxation']>) => update({ taxation: { ...value.taxation, ...patch } })
  const input = (label: string, valueText: string | number, onValue: (value: string) => void, type = 'text', min?: number, max?: number) =>
    <label className="fw-field"><span>{label}</span><input type={type} value={type === 'number' && valueText === 0 ? '' : valueText} min={min} max={max} onChange={e => onValue(e.target.value)} /></label>

  const addCurrency = () => updateCurrencies({ foreignCurrencies: [...value.currencies.foreignCurrencies, { id: makeId('currency'), code: '', name: '', exchangeRates: [] }] })
  const updateCurrency = (id: string, patch: Partial<ProjectCurrency>) => updateCurrencies({ foreignCurrencies: value.currencies.foreignCurrencies.map(row => row.id === id ? { ...row, ...patch } : row) })
  const addExchangeRate = (id: string) => updateCurrencies({ foreignCurrencies: value.currencies.foreignCurrencies.map(row => row.id === id ? { ...row, exchangeRates: [...row.exchangeRates, { period: '', rateToLocal: 0 }] } : row) })
  const updateExchangeRate = (id: string, index: number, patch: Partial<ProjectCurrency['exchangeRates'][number]>) => updateCurrencies({ foreignCurrencies: value.currencies.foreignCurrencies.map(row => row.id === id ? { ...row, exchangeRates: row.exchangeRates.map((rate, i) => i === index ? { ...rate, ...patch } : rate) } : row) })
  const addCostCentre = () => updateCentres({ items: [...value.costCentres.items, { id: makeId('centre'), code: '', name: '' }] })
  const updateCostCentre = (id: string, patch: Partial<ProjectCostCentre>) => updateCentres({ items: value.costCentres.items.map(row => row.id === id ? { ...row, ...patch } : row) })
  const addInflationIndex = () => updateInflation({ indices: [...value.inflation.indices, { id: makeId('index'), name: '', currencyCode: value.currencies.localCurrencyCode, rates: [] }] })
  const updateIndex = (id: string, patch: Partial<ProjectInflationIndex>) => updateInflation({ indices: value.inflation.indices.map(row => row.id === id ? { ...row, ...patch } : row) })
  const addInflationRate = (id: string) => updateInflation({ indices: value.inflation.indices.map(row => row.id === id ? { ...row, rates: [...row.rates, { period: '', ratePercent: 0 }] } : row) })
  const updateInflationRate = (id: string, index: number, patch: Partial<ProjectInflationIndex['rates'][number]>) => updateInflation({ indices: value.inflation.indices.map(row => row.id === id ? { ...row, rates: row.rates.map((rate, i) => i === index ? { ...rate, ...patch } : rate) } : row) })
  const addTaxRate = () => updateTax({ rates: [...value.taxation.rates, { id: makeId('tax'), period: '', ratePercent: 0 }] })
  const updateTaxRate = (id: string, patch: Partial<ProjectTaxRate>) => updateTax({ rates: value.taxation.rates.map(row => row.id === id ? { ...row, ...patch } : row) })

  return <section className="fw-card" style={{ marginTop: 18 }}>
    <h3>{t('فونداسیون مشترک پروژه و تنظیمات پایه','Common Project Foundation & Base Settings')}</h3>
    <p className="fw-hint">{t('این تنظیمات مستقل از صنعت و قالب پروژه‌اند. در قالب خام، نرخ‌ها و داده‌های نامعلوم عمداً خالی می‌مانند؛ هیچ نرخ ارز، تورم، مالیات یا نرخ تنزیل ساختگی به مدل تزریق نمی‌شود.','These settings are industry- and template-independent. In the blank template, unknown rates and data remain empty; no exchange rate, inflation, tax or discount rate is assumed.')}</p>

    <h4>{t('۱. دوره‌بندی و تاریخ مبنا','1. Planning Periods & Balance Date')}</h4>
    <div className="fw-grid">
      <label className="fw-field"><span>{t('تناوب دوره مالی','Financial Period Frequency')}</span><select value={value.planning.periodFrequency} onChange={e => updatePlanning({ periodFrequency: e.target.value as ProjectFoundation['planning']['periodFrequency'] })}><option value="unspecified">{t('انتخاب تناوب','Select frequency')}</option><option value="annual">{t('سالانه','Annual')}</option><option value="semiannual">{t('شش‌ماهه','Semiannual')}</option><option value="quarterly">{t('فصلی','Quarterly')}</option><option value="monthly">{t('ماهانه','Monthly')}</option></select></label>
      {input(t('تاریخ شروع پروژه','Project Start Date'), value.planning.projectStartDate, v => updatePlanning({ projectStartDate: v }), 'date')}
      {input(t('تاریخ پایان پروژه','Project End Date'), value.planning.projectEndDate, v => updatePlanning({ projectEndDate: v }), 'date')}
      {input(t('ماه آغاز سال مالی','Fiscal Year Start Month'), value.planning.fiscalYearStartMonth ?? '', v => updatePlanning({ fiscalYearStartMonth: v === '' ? null : Number(v) }), 'number', 1, 12)}
      <label className="fw-field"><span>{t('مبنای شمارش روز','Day-count Basis')}</span><select value={value.planning.dayCountBasis ?? ''} onChange={e => updatePlanning({ dayCountBasis: e.target.value === '' ? null : Number(e.target.value) as 360 | 365 })}><option value="">{t('انتخاب مبنا','Select basis')}</option><option value={360}>360</option><option value={365}>365</option></select></label>
      {input(t('ماه تاریخ تراز','Balance Date Month'), value.planning.balanceDateMonth ?? '', v => updatePlanning({ balanceDateMonth: v === '' ? null : Number(v) }), 'number', 1, 12)}
      {input(t('روز تاریخ تراز','Balance Date Day'), value.planning.balanceDateDay ?? '', v => updatePlanning({ balanceDateDay: v === '' ? null : Number(v) }), 'number', 1, 31)}
      {input(t('تاریخ ارزش‌گذاری','Valuation Date'), value.planning.valuationDate, v => updatePlanning({ valuationDate: v }), 'date')}
      <label className="fw-field"><span>{t('زمان‌بندی جریان نقدی برای تنزیل','Cash Flow Timing for Discounting')}</span><select value={value.planning.cashFlowTiming} onChange={e => updatePlanning({ cashFlowTiming: e.target.value as ProjectFoundation['planning']['cashFlowTiming'] })}><option value="unspecified">{t('انتخاب زمان‌بندی','Select timing')}</option><option value="period-end">{t('پایان دوره','Period-end')}</option><option value="mid-period">{t('میانه دوره','Mid-period')}</option></select></label>
    </div>
     {calendarPeriods.length > 0 && <div className="fw-validation" style={{ marginTop: 10 }}>
       <b>{t('تقویم مالی تولیدشده','Generated Financial Calendar')}: {calendarPeriods.length} {t('دوره','periods')}</b>
       <p className="fw-hint">{t('دوره‌های ناقص ابتدا و انتهای پروژه جداگانه محاسبه می‌شوند.','Partial first and last project periods are calculated separately.')}</p>
       <div className="fw-grid">{calendarPeriods.slice(0, 6).map(period => <div key={period.index} className="fw-hint">
         {t('دوره','Period')} {period.index}: {period.startDate} تا {period.endDate} · {period.days} {t('روز','days')} {period.partial ? '· ' + t('ناقص','Partial') : ''}
       </div>)}</div>
       {calendarPeriods.length > 6 && <p className="fw-hint">{t('و','and')} {calendarPeriods.length - 6} {t('دوره دیگر','more periods')}</p>}
     </div>}

    <h4>{t('۲. ارزها و نرخ‌های تبدیل','2. Currencies & Exchange Rates')}</h4>
    <div className="fw-grid">
      {input(t('کد ارز محلی (ISO)','Local Currency Code (ISO)'), value.currencies.localCurrencyCode, v => updateCurrencies({ localCurrencyCode: v.toUpperCase() }))}
      {input(t('نام ارز محلی','Local Currency Name'), value.currencies.localCurrencyName, v => updateCurrencies({ localCurrencyName: v }))}
    </div>
    {value.currencies.foreignCurrencies.map(currency => <div className="fw-grid" key={currency.id}>
      {input(t('کد ارز خارجی','Foreign Currency Code'), currency.code, v => updateCurrency(currency.id, { code: v.toUpperCase() }))}
      {input(t('نام ارز خارجی','Foreign Currency Name'), currency.name, v => updateCurrency(currency.id, { name: v }))}
      <button type="button" className="secondary-button" onClick={() => updateCurrencies({ foreignCurrencies: value.currencies.foreignCurrencies.filter(row => row.id !== currency.id) })}>{t('حذف ارز','Remove Currency')}</button>
      {currency.exchangeRates.map((rate, index) => <div className="fw-grid" key={index}>
        {input(t('دوره نرخ ارز','Exchange-rate Period'), rate.period, v => updateExchangeRate(currency.id, index, { period: v }))}
        {input(t('نرخ تبدیل به ارز محلی','Rate to Local Currency'), rate.rateToLocal, v => updateExchangeRate(currency.id, index, { rateToLocal: Number(v) }), 'number', 0)}
        <button type="button" className="secondary-button" onClick={() => updateCurrency(currency.id, { exchangeRates: currency.exchangeRates.filter((_, i) => i !== index) })}>{t('حذف نرخ','Remove Rate')}</button>
      </div>)}
      <button type="button" className="secondary-button" onClick={() => addExchangeRate(currency.id)}>{t('افزودن نرخ ارز برای دوره','Add Period Exchange Rate')}</button>
    </div>)}
    <button type="button" className="secondary-button" onClick={addCurrency}>{t('افزودن ارز خارجی','Add Foreign Currency')}</button>

    <h4>{t('۳. مراکز هزینه','3. Cost Centres')}</h4>
    <label className="fw-field"><span>{t('فعال‌سازی تحلیل مراکز هزینه','Enable Cost Centre Analysis')}</span><input type="checkbox" checked={value.costCentres.active} onChange={e => updateCentres({ active: e.target.checked })} /></label>
    {value.costCentres.items.map(centre => <div className="fw-grid" key={centre.id}>
      {input(t('کد مرکز','Cost Centre Code'), centre.code, v => updateCostCentre(centre.id, { code: v }))}
      {input(t('نام مرکز','Cost Centre Name'), centre.name, v => updateCostCentre(centre.id, { name: v }))}
      <button type="button" className="secondary-button" onClick={() => updateCentres({ items: value.costCentres.items.filter(row => row.id !== centre.id) })}>{t('حذف مرکز','Remove Cost Centre')}</button>
    </div>)}
    <button type="button" className="secondary-button" onClick={addCostCentre}>{t('افزودن مرکز هزینه','Add Cost Centre')}</button>

    <h4>{t('۴. تورم و شاخص‌های قیمت','4. Inflation & Price Indices')}</h4>
    <label className="fw-field"><span>{t('فعال‌سازی تورم','Enable Inflation')}</span><input type="checkbox" checked={value.inflation.active} onChange={e => updateInflation({ active: e.target.checked })} /></label>
    {value.inflation.indices.map(index => <div className="fw-grid" key={index.id}>
      {input(t('نام شاخص','Index Name'), index.name, v => updateIndex(index.id, { name: v }))}
      {input(t('کد ارز شاخص','Index Currency Code'), index.currencyCode, v => updateIndex(index.id, { currencyCode: v.toUpperCase() }))}
      <button type="button" className="secondary-button" onClick={() => updateInflation({ indices: value.inflation.indices.filter(row => row.id !== index.id) })}>{t('حذف شاخص','Remove Index')}</button>
      {index.rates.map((rate, rateIndex) => <div className="fw-grid" key={rateIndex}>
        {input(t('دوره تورم','Inflation Period'), rate.period, v => updateInflationRate(index.id, rateIndex, { period: v }))}
        {input(t('نرخ تورم (%)','Inflation Rate (%)'), rate.ratePercent, v => updateInflationRate(index.id, rateIndex, { ratePercent: Number(v) }), 'number', -99, 1000)}
        <button type="button" className="secondary-button" onClick={() => updateIndex(index.id, { rates: index.rates.filter((_, i) => i !== rateIndex) })}>{t('حذف نرخ','Remove Rate')}</button>
      </div>)}
      <button type="button" className="secondary-button" onClick={() => addInflationRate(index.id)}>{t('افزودن نرخ تورم دوره‌ای','Add Period Inflation Rate')}</button>
    </div>)}
    <button type="button" className="secondary-button" onClick={addInflationIndex}>{t('افزودن شاخص قیمت','Add Price Index')}</button>

    <h4>{t('۵. تنزیل و مالیات','5. Discounting & Taxation')}</h4>
    <div className="fw-grid">
      <label className="fw-field"><span>{t('روش نرخ تنزیل','Discounting Method')}</span><select value={value.discounting.method} onChange={e => updateDiscounting({ method: e.target.value as ProjectFoundation['discounting']['method'] })}><option value="unspecified">{t('انتخاب روش','Select method')}</option><option value="manual">{t('نرخ دستی','Manual Rate')}</option><option value="wacc">WACC</option></select></label>
      {input(t('نرخ تنزیل مالی (%)','Financial Discount Rate (%)'), value.discounting.financialRatePercent ?? '', v => updateDiscounting({ financialRatePercent: v === '' ? null : Number(v) }), 'number', -99, 1000)}
      {input(t('نرخ تنزیل اقتصادی (%)','Economic Discount Rate (%)'), value.discounting.economicRatePercent ?? '', v => updateDiscounting({ economicRatePercent: v === '' ? null : Number(v) }), 'number', -99, 1000)}
      <label className="fw-field"><span>{t('نظام مالیاتی','Tax System')}</span><select value={value.taxation.system} onChange={e => updateTax({ system: e.target.value as ProjectFoundation['taxation']['system'] })}><option value="unspecified">{t('انتخاب نظام مالیاتی','Select tax system')}</option><option value="corporate">{t('مالیات بر درآمد شرکت','Corporate Income Tax')}</option><option value="none">{t('بدون مالیات','No Tax')}</option><option value="custom">{t('سفارشی','Custom')}</option></select></label>
      <label className="fw-field"><span>{t('انتقال زیان مالیاتی','Loss Carry-forward')}</span><select value={value.taxation.lossCarryForward === null ? '' : String(value.taxation.lossCarryForward)} onChange={e => updateTax({ lossCarryForward: e.target.value === '' ? null : e.target.value === 'true' })}><option value="">{t('تعریف‌نشده','Not specified')}</option><option value="true">{t('فعال','Enabled')}</option><option value="false">{t('غیرفعال','Disabled')}</option></select></label>
      {input(t('مدت انتقال زیان (سال؛ خالی = نامحدود/تعریف‌نشده)','Loss Carry-forward Period (Years; blank = unspecified)'), value.taxation.lossCarryForwardYears ?? '', v => updateTax({ lossCarryForwardYears: v === '' ? null : Number(v) }), 'number', 0, 100)}
    </div>
    {value.taxation.rates.map(rate => <div className="fw-grid" key={rate.id}>
      {input(t('دوره مالیاتی','Tax Period'), rate.period, v => updateTaxRate(rate.id, { period: v }))}
      {input(t('نرخ مالیات (%)','Tax Rate (%)'), rate.ratePercent, v => updateTaxRate(rate.id, { ratePercent: Number(v) }), 'number', 0, 100)}
      <button type="button" className="secondary-button" onClick={() => updateTax({ rates: value.taxation.rates.filter(row => row.id !== rate.id) })}>{t('حذف نرخ','Remove Rate')}</button>
    </div>)}
    <button type="button" className="secondary-button" onClick={addTaxRate}>{t('افزودن نرخ مالیاتی دوره‌ای','Add Period-specific Tax Rate')}</button>

    <h4>{t('کنترل کامل بودن فونداسیون','Foundation Validation')}</h4>
    <div className="fw-validation"><span>{t('خطاهای مانع محاسبه','Calculation-blocking errors')}</span><b>{issues.filter(issue => issue.severity === 'error').length}</b><span>{t('هشدارها','Warnings')}</span><b>{issues.filter(issue => issue.severity === 'warning').length}</b></div>
    {issues.map((issue, index) => <div className="fw-hint" key={issue.path + issue.code + index}><b>{issue.severity === 'error' ? t('خطا','Error') : t('هشدار','Warning')} · {issue.path}</b> — {en ? issue.message : (issueMessages[issue.code] ?? issue.message)}</div>)}
  </section>
}
