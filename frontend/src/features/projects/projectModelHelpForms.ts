/**
 * Blank, source-traceable form catalogue covering COMFAR III Expert
 * Reference Manual chapters VI, VII, XI, XIII and XIV.
 * This is an input layer; engine integration and output reconciliation remain separate.
 */
export type HelpFieldType='text'|'number'|'percent'|'date'|'select'|'boolean'
export type HelpFieldValue=string|number|boolean|null
export type HelpFormRow={id:string;values:Record<string,HelpFieldValue>}
export type HelpFormField={key:string;fa:string;en:string;type:HelpFieldType;unit?:string;options?:readonly string[]}
export type HelpFormSection={id:string;fa:string;en:string;group:'project'|'operating'|'investment'|'finance'|'tax'|'economic'|'analysis';repeatable:boolean;source:string;fields:readonly HelpFormField[]}
const f=(key:string,fa:string,en:string,type:HelpFieldType='text',options?:readonly string[],unit?:string):HelpFormField=>({key,fa,en,type,options,unit})
const s=(id:string,fa:string,en:string,group:HelpFormSection['group'],repeatable:boolean,source:string,fields:HelpFormField[]):HelpFormSection=>({id,fa,en,group,repeatable,source,fields})
export const HELP_FORM_SECTIONS:readonly HelpFormSection[]=[
s('project-identification','شناسنامه و طبقه‌بندی پروژه','Project identification and classification','project',false,'VII.F; VI.B',[
f('title','عنوان پروژه','Project title'),f('description','شرح پروژه','Project description'),f('dateTime','تاریخ و زمان تهیه','Date and time prepared'),f('status','وضعیت','Status','select',['new','expansion','rehabilitation']),f('projectType','نوع پروژه','Project type','select',['industrial','maritime','agricultural','infrastructure','tourism','mining']),f('analysisLevel','سطح مطالعه','Analysis level','select',['opportunity','feasibility']),f('economicAnalysis','تحلیل اقتصادی','Economic analysis','boolean'),f('valueAddedAnalysis','تحلیل ارزش افزوده','Value-added analysis','boolean'),f('foreignExchangeEffect','اثر ارزی','Foreign-exchange effect','boolean'),f('employmentEffects','آثار اشتغال','Employment effects','boolean'),f('costCentreAnalysis','تحلیل مراکز هزینه','Cost-centre analysis','boolean'),f('costAllocation','تخصیص هزینه','Cost allocation','boolean'),f('jointVenture','مشارکت','Joint venture','boolean'),f('inflation','تورم','Inflation','boolean'),f('workingCapitalMode','مبنای سرمایه در گردش','Working capital mode','select',['units','value'])
]),
s('planning-horizon','افق برنامه‌ریزی و تقویم دوره‌ها','Planning horizon and period calendar','project',false,'VII.G; XI.A, XI.C',[
f('constructionStart','شروع ساخت','Construction start','date'),f('constructionEnd','پایان ساخت','Construction end','date'),f('startupMonths','مدت راه‌اندازی','Start-up duration','number',undefined,'ماه'),f('productionStart','شروع تولید','Production start','date'),f('productionEnd','پایان تولید','Production end','date'),f('balanceMonth','ماه ترازنامه','Month of balance','number',undefined,'ماه'),f('frequency','تناوب دوره','Period frequency','select',['annual','semiannual','quarterly','monthly']),f('fiscalYearStartMonth','ماه شروع سال مالی','Fiscal-year start month','number',undefined,'ماه'),f('periodCount','تعداد دوره‌ها','Number of periods','number')
]),
s('products','تعریف محصولات و ظرفیت اسمی','Products and nominal capacity','operating',true,'VII.H; XI.J, XI.L',[
f('name','نام محصول','Product name'),f('unit','واحد','Unit'),f('actualStart','شروع واقعی تولید','Actual start','date'),f('actualEnd','پایان واقعی تولید','Actual end','date'),f('nominalCapacity','ظرفیت اسمی','Nominal capacity','number'),f('capacityUnit','واحد ظرفیت','Capacity unit'),f('market','بازار','Market','select',['local','foreign','mixed'])
]),
s('currencies','ارزها و نرخ تبدیل','Currencies and exchange rates','project',true,'VII.I; XI.A',[
f('code','کد ارز','Currency code'),f('name','نام ارز','Currency name'),f('type','نوع ارز','Currency type','select',['local','foreign']),f('accountingCurrency','ارز حسابداری','Accounting currency','boolean'),f('accountingUnit','واحد گزارش','Accounting unit','select',['absolute','thousands','millions']),f('effectiveDate','تاریخ اثر نرخ','Exchange-rate date','date'),f('exchangeRate','نرخ تبدیل به ارز محلی','Rate to local currency','number'),f('referenceCurrency','ارز مرجع اطلاعاتی','Reference currency','boolean')
]),
s('inflation','تورم و شاخص قیمت ارزها','Inflation and currency price indices','project',true,'VII.K; XI.A, XI.C',[
f('currencyCode','ارز','Currency'),f('period','دوره','Period'),f('effectiveDate','تاریخ اثر','Effective date','date'),f('inflationPercent','نرخ تورم','Inflation rate','percent'),f('priceIndex','شاخص قیمت','Price index','number')
]),
s('cost-centres','ساختار مراکز هزینه','Cost-centre structure','operating',true,'VII.J',[
f('name','نام مرکز هزینه','Cost-centre name'),f('group','گروه','Group','select',['production','storage','environment','marketing','services','administration']),f('parentId','مرکز بالادست','Parent cost centre'),f('level','سطح','Level','select',['group','subgroup','unit']),f('productIds','محصولات مرتبط','Associated product IDs')
]),
s('cost-allocation','کلیدهای تخصیص هزینه غیرمستقیم','Indirect cost allocation keys','operating',true,'VII.J; XI.G',[
f('name','نام کلید','Key name'),f('type','نوع کلید','Key type','select',['direct-cost','direct-factory-cost','direct-material-cost','direct-labour-cost','sales-revenue','equal-products','user-defined']),f('productId','شناسه محصول','Product ID'),f('allocationPercent','درصد تخصیص','Allocation percentage','percent'),f('costCentreId','مرکز هزینه','Cost centre ID')
]),
s('joint-venture','شرکا و طبقات سهام','Joint-venture partners and equity classes','finance',true,'VII.L, VII.R.1; XI.Q',[
f('name','نام شریک/طبقه سهام','Partner/share class'),f('type','نوع شریک','Partner type','select',['joint-venture-partner','ordinary-shareholder','preferred-shareholder']),f('period','دوره','Period'),f('paidIn','آورده پرداخت‌شده','Equity paid in','number'),f('paidOut','بازپرداخت سرمایه','Capital refund','number'),f('preferredDividendAbsolute','سود ممتاز ثابت','Absolute preferred dividend','number'),f('preferredDividendPercent','نرخ سود ممتاز','Preferred dividend rate','percent'),f('profitSharePercent','سهم سود باقی‌مانده','Remaining profit share','percent'),f('repatriationPercent','درصد سود انتقالی','Dividend repatriation','percent')
]),
s('discounting','تنزیل، Short NPV و MIRR','Discounting, Short NPV and MIRR','finance',false,'VII.M; XI.E, XI.F',[
f('investmentRate','نرخ تنزیل کل سرمایه','Total-investment discount rate','percent'),f('equityRate','نرخ تنزیل حقوق صاحبان سهام','Total-equity discount rate','percent'),f('shortNpvYears','طول Short NPV','Short NPV length','number',undefined,'سال'),f('referenceDate','تاریخ مرجع تنزیل','Discount reference date','date'),f('referencePoint','نقطه زمانی مرجع','Temporal reference point','select',['beginning-of-first-period','end-of-first-period']),f('investmentReinvestmentRate','نرخ سرمایه‌گذاری مجدد MIRR کل سرمایه','Total-investment MIRR reinvestment rate','percent'),f('investmentBorrowingRate','نرخ استقراض MIRR کل سرمایه','Total-investment MIRR borrowing rate','percent'),f('equityReinvestmentRate','نرخ سرمایه‌گذاری مجدد MIRR حقوق صاحبان سهام','Equity MIRR reinvestment rate','percent'),f('equityBorrowingRate','نرخ استقراض MIRR حقوق صاحبان سهام','Equity MIRR borrowing rate','percent')
]),
s('fixed-investment','سرمایه‌گذاری ثابت و دفتر دارایی','Fixed investment and asset register','investment',true,'VII.N; XI.H, XI.I',[
f('assetName','شرح دارایی','Asset description'),f('currency','ارز','Currency'),f('origin','مبدأ','Origin','select',['local','foreign']),f('acquisitionDate','تاریخ تحصیل','Acquisition date','date'),f('quantity','مقدار','Quantity','number'),f('unitPrice','قیمت واحد','Unit price','number'),f('total','جمع','Total','number'),f('method','روش استهلاک','Depreciation method','select',['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits']),f('startMode','شروع استهلاک','Depreciation start mode','select',['production-start','specified-date']),f('startDate','تاریخ شروع استهلاک','Depreciation start date','date'),f('firstDepreciationYearMonths','ماه‌های سال اول استهلاک','Months in first depreciation year','number',undefined,'months'),f('ratePercent','نرخ سالانه','Annual rate','percent'),f('lengthYears','مدت استهلاک','Depreciation length','number',undefined,'سال'),f('scrapPercent','ارزش اسقاط از بهای اولیه','Scrap value % of original cost','percent'),f('saleDate','تاریخ واگذاری','Disposal date','date'),f('salePrice','مبلغ واگذاری','Disposal proceeds','number'),f('costCentreId','مرکز هزینه','Cost centre ID')
]),
s('preproduction-expenditure','مخارج پیش از تولید','Pre-production expenditures','investment',true,'X; XI (pre-production expenditure)',[
f('description','شرح مخارج','Description'),f('currency','ارز','Currency'),f('origin','مبدأ','Origin','select',['local','foreign']),f('period','دوره','Period'),f('quantity','مقدار','Quantity','number'),f('unitPrice','قیمت واحد','Unit price','number'),f('total','جمع','Total','number'),f('amortizationMethod','روش استهلاک','Amortization method','select',['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits']),f('amortizationLength','مدت استهلاک','Amortization length','number',undefined,'سال')
]),
s('production-costs','هزینه‌های تولید مستقیم و غیرمستقیم','Direct and indirect production costs','operating',true,'VII.O; XI.J',[
f('item','شرح قلم هزینه','Cost item'),f('classification','نوع','Classification','select',['direct','indirect']),f('productId','محصول','Product ID'),f('costCentreId','مرکز هزینه','Cost centre ID'),f('currency','ارز','Currency'),f('origin','مبدأ','Origin','select',['local','foreign']),f('basis','مبنای هزینه','Cost basis','select',['nominal-capacity','per-unit-output','period-adjustments']),f('activityBasis','مبنای فعالیت','Activity basis','select',['sales','production']),f('nominalCapacity','ظرفیت اسمی مبنا','Nominal capacity','number'),f('standardQuantity','مقدار استاندارد','Standard quantity','number'),f('standardUnitPrice','قیمت استاندارد','Standard unit price','number'),f('standardTotal','جمع استاندارد','Standard total','number'),f('fixedPercent','سهم ثابت','Fixed share','percent'),f('variablePercent','سهم متغیر','Variable share','percent'),f('period','دوره تعدیل','Adjustment period'),f('adjustmentQuantity','مقدار تعدیل','Adjustment quantity','number'),f('adjustmentUnitPrice','قیمت تعدیل','Adjustment unit price','number'),f('adjustmentTotal','جمع تعدیل','Adjustment total','number'),f('adjustmentFixedPercent','سهم ثابت تعدیل','Adjustment fixed share','percent'),f('adjustmentVariablePercent','سهم متغیر تعدیل','Adjustment variable share','percent'),f('initialStockQuantity','موجودی اولیه ساخت','Initial stock quantity','number'),f('initialStockValue','ارزش موجودی اولیه','Initial stock value','number'),f('allocationKeyId','کلید تخصیص','Allocation key ID')
]),
s('sales-programme','برنامه فروش، قیمت، مالیات و یارانه','Sales programme, prices, taxes and subsidies','operating',true,'VII.P; XI.L',[
f('productId','محصول','Product ID'),f('period','دوره','Period'),f('salesQuantity','مقدار فروش','Sales quantity','number'),f('netUnitPrice','قیمت خالص واحد','Net unit price','number'),f('salesTaxPercent','مالیات فروش/عوارض صادراتی','Sales tax/export duty','percent'),f('subsidyPercent','درصد یارانه','Subsidy percentage','percent'),f('subsidyAmount','مبلغ یارانه','Subsidy amount','number'),f('grossUnitPrice','قیمت ناخالص واحد','Gross unit price','number'),f('openingFinishedGoods','موجودی اول دوره محصول','Opening finished goods','number'),f('closingFinishedGoods','موجودی پایان دوره محصول','Closing finished goods','number')
]),
s('working-capital','سرمایه در گردش به تفکیک اجزا','Working capital by component','operating',true,'VII.Q; XI.K, XI.L',[
f('item','شرح جزء','Component'),f('category','طبقه','Category','select',['raw-materials','factory-supplies','utilities','energy','spare-parts','work-in-progress','finished-products','accounts-receivable','cash-in-hand-local','cash-in-hand-foreign','accounts-payable']),f('mode','مبنای محاسبه','Calculation mode','select',['units','value']),f('basis','مبنای ارزش‌گذاری','Valuation basis','select',['cost-of-products-produced','cost-of-products-sold','operating-cost','operating-cost-plus-marketing']),f('daysCoverage','روز پوشش','Days coverage','number',undefined,'days'),f('turnover','ضریب گردش','Turnover coefficient','number'),f('period','دوره','Period'),f('requiredQuantity','مقدار موردنیاز','Required quantity','number'),f('requiredValue','ارزش موردنیاز','Required value','number'),f('initialStockQuantity','موجودی اولیه ساخت','Initial stock quantity','number'),f('initialStockValue','ارزش موجودی اولیه ساخت','Initial stock value','number'),f('startingBalance','مانده افتتاحیه','Starting balance','number'),f('recoveryPeriod','دوره بازیافت','Recovery period'),f('depositPercent','درصد وجه نقد سپرده‌شده','Cash in short-term deposits','percent'),f('depositRate','نرخ سود سپرده','Deposit interest rate','percent')
]),
s('equity-grants','آورده سهامداران و کمک‌های بلاعوض','Equity and capital grants','finance',true,'VII.R.1; XI.F, XI.Q',[
f('sourceName','نام منبع','Source name'),f('sourceType','نوع منبع','Source type','select',['equity','grant','subsidy']),f('shareClass','طبقه سهام','Share class'),f('period','دوره','Period'),f('paidIn','آورده','Paid-in amount','number'),f('paidOut','بازپرداخت سرمایه','Capital refund','number'),f('preferredDividendAbsolute','سود ممتاز مطلق','Absolute preferred dividend','number'),f('preferredDividendPercent','نرخ سود ممتاز','Preferred dividend rate','percent'),f('currency','ارز','Currency')
]),
s('loan-conditions','شرایط تسهیلات و دوره تنفس','Loan conditions and grace period','finance',true,'VII.R.2-3; XI.M',[
f('loanName','نام تسهیلات','Loan name'),f('kind','نوع تسهیلات','Facility type','select',['long-term','short-term']),f('currency','ارز','Currency'),f('origin','مبدأ','Origin','select',['local','foreign']),f('repaymentType','روش بازپرداخت','Repayment type','select',['constant-principal','annuity','profile']),f('interval','تناوب اقساط','Repayment interval','select',['yearly','half-yearly','quarterly','monthly']),f('firstRepaymentDate','تاریخ اولین قسط','First repayment date','date'),f('numberOfRepayments','تعداد اقساط','Number of repayments','number'),f('interestPaymentMonth','ماه پرداخت بهره وام پروفایلی','Profile-loan interest payment month','number',undefined,'ماه'),f('disbursementUntil','پایان دوره برداشت','Disbursement until','date'),f('graceMonths','دوره تنفس','Grace period','number',undefined,'ماه'),f('openingDebt','مانده بدهی افتتاحیه','Opening debt balance','number')
]),
s('loan-disbursements','برداشت و بازپرداخت تاریخ‌دار','Dated drawdowns and repayments','finance',true,'VII.R.2; XI.M',[
f('loanName','نام تسهیلات','Loan name'),f('date','تاریخ جریان','Flow date','date'),f('amount','مبلغ؛ برداشت مثبت و بازپرداخت پروفایلی منفی','Amount; drawdown positive, profile repayment negative','number'),f('flowType','نوع جریان','Flow type','select',['drawdown','profile-repayment'])
]),
s('loan-interest','نرخ بهره و سرمایه‌ای‌سازی','Interest rates and capitalization','finance',true,'VII.R.2; XI.M',[
f('loanName','نام تسهیلات','Loan name'),f('effectiveDate','تاریخ اثر نرخ','Rate effective date','date'),f('annualRate','نرخ سالانه','Annual interest rate','percent'),f('capitalizePercent','درصد بهره سرمایه‌ای‌شونده','Interest capitalization share','percent'),f('capitalizeUntil','آخرین تاریخ سرمایه‌ای‌سازی','Capitalize until','date'),f('capitalizedInterestMethod','روش استهلاک بهره سرمایه‌ای','Capitalized-interest depreciation method','select',['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits']),f('capitalizedInterestStart','شروع استهلاک بهره سرمایه‌ای','Capitalized-interest depreciation start','date'),f('capitalizedInterestRate','نرخ استهلاک بهره سرمایه‌ای','Capitalized-interest depreciation rate','percent'),f('capitalizedInterestLength','مدت استهلاک بهره سرمایه‌ای','Capitalized-interest depreciation length','number',undefined,'سال')
]),
s('loan-fees','کارمزد تسهیلات و مبانی محاسبه','Loan fees and calculation bases','finance',true,'VII.R.2; XI.M Table 20',[
f('loanName','نام تسهیلات','Loan name'),f('type','نوع کارمزد','Fee type','select',['agency','guarantee','commitment','other']),f('rate','نرخ کارمزد','Fee rate','percent'),f('basis','مبنای کارمزد','Fee basis','select',['each-positive-disbursement','outstanding-loan-including-current-disbursement-excluding-current-repayment','undisbursed-commitment','total-loan']),f('payment','زمان پرداخت','Payment timing','select',['at-each-disbursement','with-interest','at-first-disbursement']),f('currency','ارز پرداخت','Fee currency','select',['loan-currency','local-currency']),f('depreciationMethod','روش استهلاک کارمزد','Fee depreciation method','select',['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits']),f('depreciationStart','شروع استهلاک کارمزد','Fee depreciation start','date'),f('depreciationRate','نرخ استهلاک کارمزد','Fee depreciation rate','percent'),f('depreciationLength','مدت استهلاک کارمزد','Fee depreciation length','number',undefined,'سال')
]),
s('profit-distribution','سیاست تقسیم سود و بازگشت سرمایه','Profit distribution and repatriation','finance',true,'VII.R.4; XI.Q',[
f('period','دوره تولید','Production period'),f('retainedPercent','درصد سود نگهداری‌شده','Retained profit','percent'),f('distributedPercent','درصد سود توزیع‌شده','Distributed profit','percent'),f('shareholderClass','طبقه سهامدار','Shareholder class'),f('remainingProfitShare','سهم از سود باقی‌مانده','Share of remaining profit','percent'),f('netWorthDistribution','توزیع خالص ارزش ویژه در پایان طرح','Net worth distribution at project end','percent'),f('repatriatedPercent','درصد سود انتقالی','Repatriated dividend','percent')
]),
s('income-tax','مالیات بر درآمد و شرایط مالیاتی','Income tax and tax conditions','tax',false,'VII.S; XI.P',[
f('taxSystem','نظام مالیاتی','Tax system','select',['corporate-income-tax','other']),f('taxHolidayYears','مدت معافیت مالیاتی','Tax holiday duration','number',undefined,'سال'),f('taxHolidayEndDate','پایان معافیت','Tax holiday end','date'),f('lossCarryForwardYears','مدت انتقال زیان','Loss carry-forward period','number',undefined,'سال'),f('taxCurrency','ارز مالیات','Tax currency'),f('adjustmentPeriod','دوره تعدیل مطلق مالیات','Tax adjustment period'),f('adjustmentAmount','تعدیل مطلق مالیات','Absolute tax adjustment','number')
]),
s('tax-brackets','طبقات و نرخ‌های پلکانی مالیات','Progressive tax brackets and rates','tax',true,'VII.S; XI.P',[
f('lowerLimit','حد پایین طبقه','Bracket lower limit','number'),f('rate','نرخ طبقه','Bracket rate','percent'),f('period','دوره اثر','Effective period')
]),
s('tax-allowances','کمک‌هزینه سرمایه‌گذاری و استهلاک','Investment and depreciation allowances','tax',true,'VII.S; XI.R',[
f('type','نوع کمک‌هزینه','Allowance type','select',['investment-allowance','depreciation-allowance']),f('period','دوره','Period'),f('amount','مبلغ مطلق','Absolute amount','number'),f('currency','ارز','Currency')
]),
s('depreciation-adjustments','تعدیلات استهلاک دارایی داخلی و خارجی','Local and foreign asset depreciation adjustments','tax',true,'VII.S; XI.R',[
f('period','دوره','Period'),f('origin','مبدأ دارایی','Asset origin','select',['local','foreign']),f('amount','تعدیل استهلاک مثبت یا منفی','Positive/negative depreciation adjustment','number'),f('currency','ارز','Currency')
]),
s('starting-balances','مانده‌های افتتاحیه طرح توسعه/بازسازی','Opening balances for expansion/rehabilitation','tax',true,'VII.T; XI.F, XI.K',[
f('category','طبقه مانده','Balance category','select',['fixed-assets','materials-supplies','work-in-progress','finished-products','other-assets','accounts-receivable','cash-in-hand','short-term-deposits','cash-surplus','accounts-payable','long-term-debt','equity-capital','grants-subsidies']),f('item','شرح قلم','Item'),f('productId','محصول','Product ID'),f('currency','ارز','Currency'),f('origin','مبدأ','Origin','select',['local','foreign']),f('quantity','مقدار','Quantity','number'),f('unitPrice','قیمت واحد','Unit price','number'),f('amount','مبلغ','Amount','number'),f('foreignPercent','درصد جزء ارزی','Foreign component','percent'),f('settlementDays','روز وصول/پرداخت','Settlement days','number',undefined,'روز'),f('depreciationMethod','روش استهلاک دارایی موجود','Existing-asset depreciation method','select',['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits']),f('remainingLife','عمر باقیمانده','Remaining useful life','number',undefined,'سال')
]),
s('economic-global','پارامترهای کلان ارزیابی اقتصادی','Global economic-appraisal parameters','economic',false,'VIII.E; XII',[
f('method','روش تحلیل','Analysis method','select',['cost-benefit','value-added']),f('numeraire','واحد شمارش/Numeraire','Numeraire'),f('officialExchangeRate','نرخ رسمی ارز','Official exchange rate','number'),f('shadowExchangeRate','نرخ سایه‌ای ارز','Shadow exchange rate','number'),f('standardConversionFactor','ضریب تبدیل استاندارد','Standard conversion factor','number'),f('discountRate','نرخ تنزیل اقتصادی','Economic discount rate','percent'),f('referenceDate','تاریخ مرجع اقتصادی','Economic reference date','date')
]),
s('economic-items','طبقه‌بندی و تعدیل ارزش اقتصادی نهاده‌ها و محصولات','Economic classification and price adjustment','economic',true,'VIII.F-H; XII.B-D',[
f('item','شرح قلم','Item'),f('financialItemId','قلم مالی متناظر','Linked financial item ID'),f('direction','جهت','Direction','select',['input','output']),f('tradeCategory','طبقه تجاری','Trade category','select',['non-traded','traded-imported','importable','exportable','exported']),f('adjustmentFactor','ضریب تعدیل','Adjustment factor','number'),f('adjustedMarketValue','ارزش بازار تعدیل‌شده','Adjusted market value','number'),f('taxesIncluded','مالیات و عوارض منظورشده','Taxes and duties included','boolean'),f('subsidyNegativeTax','یارانه به‌عنوان مالیات منفی','Subsidy as negative tax','boolean'),f('fxExposure','مواجهه ارزی','Foreign-currency exposure','percent'),f('currency','ارز','Currency')
]),
s('economic-effects','وام خارجی، آثار غیرمستقیم و اشتغال','Foreign loans, indirect effects and employment','economic',true,'VIII; XII',[
f('type','نوع اثر','Effect type','select',['foreign-loan','indirect-effect','employment','environmental']),f('description','شرح','Description'),f('period','دوره','Period'),f('amount','مبلغ/مقدار','Amount/quantity','number'),f('currency','ارز','Currency'),f('market','بازار','Market','select',['local','foreign']),f('escalation','تعدیل قیمت','Price escalation','percent'),f('employmentCategory','طبقه اشتغال','Employment category'),f('headcount','اشتغال مستقیم','Direct headcount','number'),f('shadowWageFactor','ضریب دستمزد سایه‌ای','Shadow wage factor','number')
]),
s('sensitivity','تحلیل حساسیت و دستیابی به IRR/NPV هدف','Sensitivity and target IRR/NPV','analysis',true,'XIII',[
f('analysisType','نوع تحلیل','Analysis type','select',['global-input-variation','desired-irr','desired-npv','parametric-chart']),f('variableGroup','گروه متغیر','Variable group','select',['fixed-investment','production-costs','sales-programme','economic-indirect-effects','financial-costs','fixed-costs','operating-costs','personnel-costs','sales-revenues','variable-costs']),f('variableId','شناسه متغیر','Variable ID'),f('quantityChange','درصد تغییر مقدار','Quantity change','percent'),f('priceChange','درصد تغییر قیمت','Price change','percent'),f('valueChange','درصد تغییر ارزش','Value change','percent'),f('targetIrr','IRR هدف','Desired IRR','percent'),f('targetNpv','NPV هدف','Desired NPV','number'),f('maxIncrease','حداکثر افزایش','Maximum increase','percent'),f('maxDecrease','حداکثر کاهش','Maximum decrease','percent'),f('order','ترتیب متغیر','Variable order','number'),f('chartVariable','متغیر نمودار','Chart variable')
]),
s('incremental-analysis','تحلیل افزایشی و مقایسه وضعیت‌های طرح','Incremental analysis and project alternatives','analysis',true,'XIV; VII.T',[
f('alternative','نام گزینه','Alternative'),f('view','دیدگاه تحلیل','Analysis view','select',['existing-without-project','existing-with-project','project-in-isolation']),f('period','دوره','Period'),f('investmentDelta','تغییر سرمایه‌گذاری','Incremental investment','number'),f('financingDelta','تغییر تأمین مالی','Incremental financing','number'),f('revenueDelta','تغییر درآمد','Incremental revenue','number'),f('costDelta','تغییر هزینه','Incremental cost','number'),f('assetOpportunityValue','ارزش فرصت دارایی موجود','Opportunity value of existing assets','number')
])
] as const
export type HelpFormSectionId=string
export type HelpDrivenProjectForms={sections:Record<string,HelpFormRow[]>}
function blankValue(field:HelpFormField):HelpFieldValue{return field.type==='text'||field.type==='date'||field.type==='select'?'':null}
export function createBlankHelpFormRow(section:HelpFormSection,id=''):HelpFormRow{return{id,values:Object.fromEntries(section.fields.map(field=>[field.key,blankValue(field)]))}}
export function createBlankHelpDrivenProjectForms():HelpDrivenProjectForms{
 const sections:Record<string,HelpFormRow[]>={}
 for(const section of HELP_FORM_SECTIONS)sections[section.id]=section.repeatable?[]:[createBlankHelpFormRow(section,section.id+'-main')]
 return{sections}
}
export function validateHelpDrivenProjectForms(value:HelpDrivenProjectForms):string[]{
 const errors:string[]=[]
 for(const section of HELP_FORM_SECTIONS){
  const rows=value.sections?.[section.id]??[]
  if(!section.repeatable&&rows.length!==1)errors.push(section.id+':expected-single-record')
  if(new Set(rows.map(row=>row.id)).size!==rows.length)errors.push(section.id+':duplicate-row-id')
  for(const [i,row] of rows.entries()){
   for(const field of section.fields){
    const v=row.values?.[field.key]
    if(v===undefined){errors.push(section.id+':'+i+':missing-field:'+field.key);continue}
    if((field.type==='number'||field.type==='percent')&&v!==null&&v!==''&&(typeof v!=='number'||!Number.isFinite(v)))errors.push(section.id+':'+i+':invalid-number:'+field.key)
    if(field.type==='percent'&&typeof v==='number'&&(v<0||v>100))errors.push(section.id+':'+i+':percent-out-of-range:'+field.key)
    if(field.type==='select'&&v!==null&&v!==''&&field.options&&!field.options.includes(String(v)))errors.push(section.id+':'+i+':invalid-option:'+field.key)
   }
   const q=row.values.quantity,p=row.values.unitPrice,t=row.values.total
   if(typeof q==='number'&&typeof p==='number'&&typeof t==='number'&&Math.abs(q*p-t)>Math.max(.01,Math.abs(t)*1e-8))errors.push(section.id+':'+i+':quantity-price-total-mismatch')
   const fixed=row.values.fixedPercent,variable=row.values.variablePercent
   if(typeof fixed==='number'&&typeof variable==='number'&&Math.abs(fixed+variable-100)>1e-8)errors.push(section.id+':'+i+':fixed-variable-split-must-equal-100')
  }
 }
 const allocations=value.sections?.['cost-allocation']??[]
 for(const row of allocations){
  const name=row.values.name
  if(typeof name!=='string'||!name)continue
  const same=allocations.filter(x=>x.values.name===name)
  if(same.every(x=>typeof x.values.allocationPercent==='number')){
   const sum=same.reduce((n,x)=>n+(x.values.allocationPercent as number),0)
   if(Math.abs(sum-100)>1e-8)errors.push('cost-allocation:'+name+':allocation-must-equal-100')
  }
 }
 return errors
}
export function updateHelpFormRow(value:HelpDrivenProjectForms,sectionId:string,rowId:string,fieldKey:string,next:HelpFieldValue):HelpDrivenProjectForms{
 const rows=(value.sections[sectionId]??[]).map(row=>{
  if(row.id!==rowId)return row
  const values={...row.values,[fieldKey]:next}
  const q=values.quantity,p=values.unitPrice,t=values.total
  if([q,p,t].filter(x=>x!==null&&x!==''&&x!==undefined).length===2){
   if(typeof q==='number'&&typeof p==='number'&&(t===null||t===''))values.total=q*p
   else if(typeof q==='number'&&q!==0&&typeof t==='number'&&(p===null||p===''))values.unitPrice=t/q
   else if(typeof p==='number'&&p!==0&&typeof t==='number'&&(q===null||q===''))values.quantity=t/p
  }
  if(fieldKey==='fixedPercent'&&typeof next==='number'&&(values.variablePercent===null||values.variablePercent===''))values.variablePercent=100-next
  if(fieldKey==='variablePercent'&&typeof next==='number'&&(values.fixedPercent===null||values.fixedPercent===''))values.fixedPercent=100-next
  return{...row,values}
 })
 return{...value,sections:{...value.sections,[sectionId]:rows}}
}
export function addHelpFormRow(value:HelpDrivenProjectForms,sectionId:string,id:string):HelpDrivenProjectForms{
 const section=HELP_FORM_SECTIONS.find(x=>x.id===sectionId)
 if(!section?.repeatable)return value
 return{...value,sections:{...value.sections,[sectionId]:[...(value.sections[sectionId]??[]),createBlankHelpFormRow(section,id)]}}
}
export function removeHelpFormRow(value:HelpDrivenProjectForms,sectionId:string,rowId:string):HelpDrivenProjectForms{
 const section=HELP_FORM_SECTIONS.find(x=>x.id===sectionId)
 if(!section?.repeatable)return value
 return{...value,sections:{...value.sections,[sectionId]:(value.sections[sectionId]??[]).filter(row=>row.id!==rowId)}}
}
