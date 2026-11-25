import type { ComfarReferenceBaseline } from '../../core/projects/projectRepository'

type Props = { baseline: ComfarReferenceBaseline; language?: 'fa' | 'en' }

export default function ComfarReferencePanel({ baseline, language = 'fa' }: Props) {
  const en = language === 'en'
  const number = (value: number) => new Intl.NumberFormat(en ? 'en-US' : 'fa-IR', { maximumFractionDigits: 2 }).format(value)
  const money = (value: number) => number(value) + ' ' + baseline.currency
  const t = (fa: string, english: string) => en ? english : fa
  const metric = (fa: string, english: string, value: string) => ({ label: t(fa, english), value })
  const investment = [
    metric('هزینه‌های ثابت سرمایه‌گذاری', 'Fixed investment', money(baseline.fixedInvestment)),
    metric('مخارج پیش از تولید', 'Pre-production expenditure', money(baseline.preproductionTotal)),
    metric('بهره سرمایه‌ای‌شده', 'Capitalized interest', money(baseline.capitalizedInterest)),
    metric('افزایش خالص سرمایه در گردش', 'Net working-capital increase', money(baseline.workingCapital)),
    metric('کل هزینه‌های سرمایه‌گذاری', 'Total investment cost', money(baseline.totalInvestment)),
  ]
  const funding = [
    metric('حقوق صاحبان سهام', 'Equity', money(baseline.equity)),
    metric('وام بلندمدت', 'Long-term loans', money(baseline.longTermDebt)),
    metric('وام کوتاه‌مدت', 'Short-term loans', money(baseline.shortTermDebt)),
    metric('کل منابع تأمین مالی گزارش', 'Total financing sources in report', money(baseline.totalFunding)),
  ]
  const operations = [
    metric('درآمد فروش', 'Sales revenue', `${number(baseline.firstYearRevenue)} / ${number(baseline.referenceRevenue)} / ${number(baseline.lastYearRevenue)} ${baseline.currency}`),
    metric('هزینه تولید کارخانه', 'Factory production cost', `${number(baseline.firstYearFactoryCost)} / ${number(baseline.referenceFactoryCost)} / ${number(baseline.lastYearFactoryCost)} ${baseline.currency}`),
  ]
  const returns = [
    metric('خالص ارزش فعلی کل سرمایه', 'Investment NPV', `${money(baseline.investmentNpv)} · ${number(baseline.investmentNpvRate)}٪`),
    metric('نرخ بازده داخلی سرمایه‌گذاری', 'Investment IRR', `${number(baseline.investmentIrr)}٪`),
    metric('IRR تعدیل‌شده سرمایه‌گذاری', 'Investment MIRR', `${number(baseline.investmentMirr)}٪`),
    metric('خالص ارزش فعلی حقوق صاحبان سهام', 'Equity NPV', `${money(baseline.equityNpv)} · ${number(baseline.equityNpvRate)}٪`),
    metric('نرخ بازده داخلی حقوق صاحبان سهام', 'Equity IRR', `${number(baseline.equityIrr)}٪`),
    metric('IRR تعدیل‌شده حقوق صاحبان سهام', 'Equity MIRR', `${number(baseline.equityMirr)}٪`),
  ]
  const groups = [
    { title: t('هزینه‌های سرمایه‌گذاری', 'Investment costs'), rows: investment },
    { title: t('منابع تأمین مالی', 'Financing sources'), rows: funding },
    { title: t('درآمد و هزینه عملیاتی', 'Operating revenue and costs'), rows: operations },
    { title: t('شاخص‌های اقتصادی و مالی گزارش', 'Financial and economic indicators'), rows: returns },
  ]
  return <section className="comfar-reference-panel" aria-label={t('اطلاعات مرجع گزارش کامفار', 'COMFAR report reference')}>
    <div className="comfar-reference-head">
      <div>
        <span className="comfar-reference-kicker">{t('پرونده واردشده از گزارش مرجع', 'Imported reference report')}</span>
        <h2>{t('خلاصه اطلاعات گزارش کامفار', 'COMFAR report summary')}</h2>
        <p>{baseline.reportTitle} · {baseline.description}</p>
      </div>
      <span className="comfar-reference-source">{t('منبع', 'Source')}: {baseline.reportFile}</span>
    </div>
    <div className="comfar-reference-meta">
      <span>{t('تاریخ ورود داده', 'Input date')}: <b>{baseline.inputDate}</b></span>
      <span>{t('دوره ساخت', 'Construction')}: <b>{baseline.constructionStart} تا {baseline.constructionEnd} · {number(baseline.constructionYears)} {t('سال', 'years')}</b></span>
      <span>{t('دوره بهره‌برداری', 'Operation')}: <b>{baseline.operationStart} تا {baseline.operationEnd} · {number(baseline.operatingYears)} {t('سال', 'years')}</b></span>
      <span>{t('ظرفیت', 'Capacity')}: <b>{baseline.capacityDescription}</b></span>
      <span>{t('واحد پول حسابداری', 'Accounting currency')}: <b>{baseline.currency}</b></span>
      <span>{t('تاریخ ارزش‌گذاری', 'Valuation date')}: <b>{baseline.valuationDate}</b></span>
    </div>
    <div className="comfar-reference-groups">
      {groups.map(group => <div className="comfar-reference-group" key={group.title}>
        <h3>{group.title}</h3>
        <dl>{group.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      </div>)}
    </div>
    <p className="comfar-reference-note">{t(
      'این ارقام عیناً به‌عنوان اطلاعات مرجع گزارش ثبت شده‌اند؛ به معنی بازتولید محاسبات گزارش در مدل مالی پیشران نیستند. برای جلوگیری از ساخت فرضیات، جزئیات فنی و ریزجریان‌های سالانه‌ای که در خلاصه گزارش درج نشده‌اند باید از جداول تفصیلی همان گزارش تکمیل و تطبیق داده شوند.',
      'These figures are stored as report reference data; they do not mean the report calculations have been reproduced in Pishran’s financial model. Detailed technical inputs and annual schedules not shown in the summary must be completed and reconciled against the detailed tables in the same report.'
    )}</p>
  </section>
}
