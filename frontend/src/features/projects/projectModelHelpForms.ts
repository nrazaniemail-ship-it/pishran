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
f('title','عنوان پروژه','Project title'),f('description','شرح پروژه','Project description'),f('dateTime','تاریخ و زمان تهیه','Date and time prepared'),f('status','وضعیت','Status','select',['new','expansion','rehabilitation']),f('projectType','نوع پروژه','Project type','select',['industrial','maritime','agricultural','infrastructure','tourism','mining','other']),f('analysisLevel','سطح مطالعه','Analysis level','select',['opportunity','feasibility']),f('economicAnalysis','تحلیل اقتصادی','Economic analysis','boolean'),f('valueAddedAnalysis','تحلیل ارزش افزوده','Value-added analysis','boolean'),f('foreignExchangeEffect','اثر ارزی','Foreign-exchange effect','boolean'),f('employmentEffects','آثار اشتغال','Employment effects','boolean'),f('costCentreAnalysis','تحلیل مراکز هزینه','Cost-centre analysis','boolean'),f('costAllocation','تخصیص هزینه','Cost allocation','boolean'),f('jointVenture','مشارکت','Joint venture','boolean'),f('inflation','تورم','Inflation','boolean'),f('workingCapitalMode','مبنای سرمایه در گردش','Working capital mode','select',['units','value'])
]),
s('planning-horizon','افق برنامه‌ریزی و تقویم دوره‌ها','Planning horizon and period calendar','project',false,'VII.G; XI.A, XI.C',[
f('constructionStart','شروع ساخت','Construction start','date'),f('constructionEnd','پایان ساخت','Construction end','date'),f('startupMonths','مدت راه‌اندازی','Start-up duration','number',undefined,'ماه'),f('productionStart','شروع تولید','Production start','date'),f('productionEnd','پایان تولید','Production end','date'),f('balanceMonth','ماه ترازنامه','Month of balance','number',undefined,'ماه'),f('frequency','تناوب دوره','Period frequency','select',['annual','semiannual','quarterly','monthly','user-defined']),f('fiscalYearStartMonth','ماه شروع سال مالی','Fiscal-year start month','number',undefined,'ماه'),f('periodCount','تعداد دوره‌ها','Number of periods','number'),f('userDefinedPeriodMonths','مدت دوره سفارشی','User-defined period length','number',undefined,'ماه'),f('periodStart','تاریخ شروع دوره','Period start date','date'),f('periodEnd','تاریخ پایان دوره','Period end date','date')
]),
s('products','تعریف محصولات و ظرفیت اسمی','Products and nominal capacity','operating',true,'VII.H; XI.J, XI.L',[
f('name','نام محصول','Product name'),f('unit','واحد','Unit'),f('actualStart','شروع واقعی تولید','Actual start','date'),f('actualEnd','پایان واقعی تولید','Actual end','date'),f('productionIntervalMode','نوع بازه تولید','Production interval mode','select',['default','user-defined']),f('productionIntervalStart','شروع بازه تولید','Production interval start','date'),f('productionIntervalEnd','پایان بازه تولید','Production interval end','date'),f('finishedGoodsDaysCoverage','روز پوشش محصول نهایی','Finished-goods days coverage','number',undefined,'روز'),f('nominalCapacity','ظرفیت اسمی','Nominal capacity','number'),f('capacityUnit','واحد ظرفیت','Capacity unit'),f('market','بازار','Market','select',['local','foreign','mixed'])
]),
s('currencies','ارزها و نرخ تبدیل','Currencies and exchange rates','project',true,'VII.I; XI.A',[
f('code','کد ارز','Currency code'),f('name','نام ارز','Currency name'),f('type','نوع ارز','Currency type','select',['local','foreign']),f('accountingCurrency','ارز حسابداری','Accounting currency','boolean'),f('accountingUnit','واحد گزارش','Accounting unit','select',['absolute','thousands','millions']),f('effectiveDate','تاریخ اثر نرخ','Exchange-rate date','date'),f('exchangeRate','نرخ تبدیل به ارز محلی','Rate to local currency','number'),f('referenceCurrency','ارز مرجع اطلاعاتی','Reference currency','boolean')
]),
s('currency-rates','نرخ‌های تبدیل ارز به تفکیک دوره','Period-specific currency exchange rates','project',true,'VII.I; XI.A',[
f('currencyCode','کد ارز','Currency code'),f('period','دوره مالی','Financial period'),f('effectiveDate','تاریخ اثر نرخ','Rate effective date','date'),f('exchangeRate','نرخ تبدیل به ارز محلی','Rate to local currency','number')
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
f('description','شرح مخارج','Description'),f('currency','ارز','Currency'),f('origin','مبدأ','Origin','select',['local','foreign']),f('period','دوره','Period'),f('quantity','مقدار','Quantity','number'),f('unitPrice','قیمت واحد','Unit price','number'),f('total','جمع','Total','number'),f('amortizationMethod','روش استهلاک','Amortization method','select',['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits']),f('amortizationLength','مدت استهلاک','Amortization length','number',undefined,'سال'),f('amortizationStartMode','مبنای شروع استهلاک','Amortization start mode','select',['production-start','specified-date']),f('amortizationStartDate','تاریخ شروع استهلاک','Amortization start date','date'),f('firstAmortizationYearMonths','ماه‌های سال اول استهلاک','Months in first amortization year','number',undefined,'ماه'),f('amortizationRatePercent','نرخ استهلاک سالانه','Annual amortization rate','percent'),f('scrapPercent','ارزش اسقاط','Salvage value','percent')
]),
s('production-costs','هزینه‌های تولید مستقیم و غیرمستقیم','Direct and indirect production costs','operating',true,'VII.O; XI.J',[
f('item','شرح قلم هزینه','Cost item'),f('classification','نوع','Classification','select',['direct','indirect']),f('productId','محصول','Product ID'),f('costCentreId','مرکز هزینه','Cost centre ID'),f('currency','ارز','Currency'),f('origin','مبدأ','Origin','select',['local','foreign']),f('basis','مبنای هزینه','Cost basis','select',['nominal-capacity','per-unit-output','period-adjustments']),f('activityBasis','مبنای فعالیت','Activity basis','select',['sales','production']),f('nominalCapacity','ظرفیت اسمی مبنا','Nominal capacity','number'),f('standardQuantity','مقدار استاندارد','Standard quantity','number'),f('standardUnitPrice','قیمت استاندارد','Standard unit price','number'),f('standardTotal','جمع استاندارد','Standard total','number'),f('fixedPercent','سهم ثابت','Fixed share','percent'),f('variablePercent','سهم متغیر','Variable share','percent'),f('period','دوره تعدیل','Adjustment period'),f('adjustmentQuantity','مقدار تعدیل','Adjustment quantity','number'),f('adjustmentUnitPrice','قیمت تعدیل','Adjustment unit price','number'),f('adjustmentTotal','جمع تعدیل','Adjustment total','number'),f('adjustmentFixedPercent','سهم ثابت تعدیل','Adjustment fixed share','percent'),f('adjustmentVariablePercent','سهم متغیر تعدیل','Adjustment variable share','percent'),f('initialStockQuantity','موجودی اولیه ساخت','Initial stock quantity','number'),f('initialStockValue','ارزش موجودی اولیه','Initial stock value','number'),f('allocationKeyId','کلید تخصیص','Allocation key ID')
]),
s('sales-programme','برنامه فروش، قیمت، مالیات و یارانه','Sales programme, prices, taxes and subsidies','operating',true,'VII.P; XI.L',[
f('productId','محصول','Product ID'),f('period','دوره','Period'),f('salesQuantity','مقدار فروش','Sales quantity','number'),f('netUnitPrice','قیمت خالص واحد','Net unit price','number'),f('salesTaxPercent','مالیات فروش/عوارض صادراتی','Sales tax/export duty','percent'),f('subsidyPercent','درصد یارانه','Subsidy percentage','percent'),f('subsidyAmount','مبلغ یارانه','Subsidy amount','number'),f('grossUnitPrice','قیمت ناخالص واحد','Gross unit price','number'),f('openingFinishedGoods','موجودی اول دوره محصول','Opening finished goods','number'),f('closingFinishedGoods','موجودی پایان دوره محصول','Closing finished goods','number'),f('productionActive','تولید فعال در این دوره','Production active in period','boolean'),f('futureSalesQuantity','مجموع فروش دوره‌های بعد','Future sales quantity','number'),f('terminalInventorySale','فروش خودکار موجودی پایان طرح','Automatic sale of terminal inventory','boolean')
]),
s('working-capital','سرمایه در گردش به تفکیک اجزا','Working capital by component','operating',true,'VII.Q; XI.K, XI.L',[
f('item','شرح جزء','Component'),f('category','طبقه','Category','select',['raw-materials','factory-supplies','utilities','energy','spare-parts','work-in-progress','finished-products','accounts-receivable','cash-in-hand-local','cash-in-hand-foreign','accounts-payable']),f('productId','محصول','Product ID'),f('costItemId','قلم هزینه مرتبط','Linked cost item ID'),f('origin','مبدأ ارزی','Currency origin','select',['local','foreign']),f('market','بازار','Market','select',['local','foreign']),f('mode','مبنای محاسبه','Calculation mode','select',['units','value']),f('basis','مبنای ارزش‌گذاری','Valuation basis','select',['cost-of-products-produced-materials','cost-of-products-produced-factory-cost','cost-of-products-produced-excluding-materials','cost-of-products-produced-total-including-marketing','cost-of-products-sold-operating-cost','cost-of-products-sold-operating-plus-marketing']),f('activityBasis','مبنای فعالیت','Activity basis','select',['sales','production']),f('daysCoverage','روز پوشش','Days coverage','number',undefined,'days'),f('turnover','ضریب گردش','Turnover coefficient','number'),f('period','دوره','Period'),f('periodMonths','مدت دوره','Period length','number',undefined,'ماه'),f('requiredQuantity','مقدار موردنیاز','Required quantity','number'),f('requiredValue','ارزش موردنیاز','Required value','number'),f('initialStockQuantity','موجودی اولیه ساخت','Initial stock quantity','number'),f('initialStockValue','ارزش موجودی اولیه ساخت','Initial stock value','number'),f('startingBalance','مانده افتتاحیه','Starting balance','number'),f('recoveryPeriod','دوره بازیافت','Recovery period'),f('depositPercent','درصد وجه نقد سپرده‌شده','Cash in short-term deposits','percent'),f('depositRate','نرخ سود سپرده','Deposit interest rate','percent')
]),
s('equity-grants','آورده سهامداران و کمک‌های بلاعوض','Equity and capital grants','finance',true,'VII.R.1; XI.F, XI.Q',[
f('sourceName','نام منبع','Source name'),f('sourceType','نوع منبع','Source type','select',['equity','grant','subsidy']),f('shareClass','طبقه سهام','Share class'),f('period','دوره','Period'),f('paidIn','آورده','Paid-in amount','number'),f('paidOut','بازپرداخت سرمایه','Capital refund','number'),f('preferredDividendAbsolute','سود ممتاز مطلق','Absolute preferred dividend','number'),f('preferredDividendPercent','نرخ سود ممتاز','Preferred dividend rate','percent'),f('currency','ارز','Currency')
]),
s('loan-conditions','شرایط تسهیلات و دوره تنفس','Loan conditions and grace period','finance',true,'VII.R.2-3; XI.M',[
f('loanName','نام تسهیلات','Loan name'),f('kind','نوع تسهیلات','Facility type','select',['long-term','short-term']),f('currency','ارز','Currency'),f('origin','مبدأ','Origin','select',['local','foreign']),f('repaymentType','روش بازپرداخت','Repayment type','select',['constant-principal','annuity','profile']),f('interval','تناوب اقساط','Repayment interval','select',['yearly','half-yearly','quarterly','monthly']),f('firstRepaymentDate','تاریخ اولین قسط','First repayment date','date'),f('numberOfRepayments','تعداد اقساط','Number of repayments','number'),f('facilityLimit','سقف تسهیلات','Facility limit','number'),f('interestPaymentMonth','ماه پرداخت بهره وام پروفایلی','Profile-loan interest payment month','number',undefined,'ماه'),f('disbursementUntil','پایان دوره برداشت','Disbursement until','date'),f('graceMonths','دوره تنفس','Grace period','number',undefined,'ماه'),f('openingDebt','مانده بدهی افتتاحیه','Opening debt balance','number'),f('openingExchangeRateToLocal','نرخ تبدیل مانده افتتاحیه به ارز محلی','Opening balance exchange rate to local currency','number')
]),
s('loan-disbursements','برداشت و بازپرداخت تاریخ‌دار','Dated drawdowns and repayments','finance',true,'VII.R.2; XI.M',[
f('loanName','نام تسهیلات','Loan name'),f('date','تاریخ جریان','Flow date','date'),f('amount','مبلغ؛ برداشت مثبت و بازپرداخت پروفایلی منفی','Amount; drawdown positive, profile repayment negative','number'),f('flowType','نوع جریان','Flow type','select',['drawdown','profile-repayment'])
]),
s('loan-interest','نرخ بهره و سرمایه‌ای‌سازی','Interest rates and capitalization','finance',true,'VII.R.2; XI.M',[
f('loanName','نام تسهیلات','Loan name'),f('effectiveDate','تاریخ اثر نرخ','Rate effective date','date'),f('annualRate','نرخ سالانه','Annual interest rate','percent'),f('capitalizePercent','درصد بهره سرمایه‌ای‌شونده','Interest capitalization share','percent'),f('capitalizeUntil','آخرین تاریخ سرمایه‌ای‌سازی','Capitalize until','date'),f('capitalizedInterestMethod','روش استهلاک بهره سرمایه‌ای','Capitalized-interest depreciation method','select',['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits']),f('capitalizedInterestStart','شروع استهلاک بهره سرمایه‌ای','Capitalized-interest depreciation start','date'),f('capitalizedInterestRate','نرخ استهلاک بهره سرمایه‌ای','Capitalized-interest depreciation rate','percent'),f('capitalizedInterestLength','مدت استهلاک بهره سرمایه‌ای','Capitalized-interest depreciation length','number',undefined,'سال')
]),
s('loan-fees','کارمزد تسهیلات و مبانی محاسبه','Loan fees and calculation bases','finance',true,'VII.R.2; XI.M Table 20',[
f('loanName','نام تسهیلات','Loan name'),f('type','نوع کارمزد','Fee type','select',['agency','guarantee','commitment','other']),f('rate','نرخ کارمزد','Fee rate','percent'),f('basis','مبنای کارمزد','Fee basis','select',['each-positive-disbursement','outstanding-loan-including-current-disbursement-excluding-current-repayment','undisbursed-commitment','total-loan']),f('payment','زمان پرداخت','Payment timing','select',['at-each-disbursement','with-interest','at-first-disbursement']),f('paymentDate','تاریخ پرداخت کارمزد','Fee payment date','date'),f('treatment','نحوه حسابداری کارمزد','Fee accounting treatment','select',['expense','capitalize']),f('currency','ارز پرداخت','Fee currency','select',['loan-currency','local-currency']),f('depreciationMethod','روش استهلاک کارمزد','Fee depreciation method','select',['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits']),f('depreciationStart','شروع استهلاک کارمزد','Fee depreciation start','date'),f('depreciationRate','نرخ استهلاک کارمزد','Fee depreciation rate','percent'),f('depreciationLength','مدت استهلاک کارمزد','Fee depreciation length','number',undefined,'سال')
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
f('method','روش تحلیل','Analysis method','select',['cost-benefit','value-added']),f('numeraireType','نوع واحد شمارش','Numeraire type','select',['local-domestic-prices','local-border-prices','foreign-border-prices']),f('numeraireCurrency','ارز واحد شمارش','Numeraire currency'),f('numeraireUnit','واحد گزارش','Numeraire accounting unit','select',['units','tens','hundreds','thousands','millions']),f('officialExchangeRate','نرخ رسمی ارز','Official exchange rate','number'),f('shadowExchangeRate','نرخ سایه‌ای ارز','Shadow exchange rate','number'),f('standardConversionFactor','ضریب تبدیل استاندارد OER/SER','Standard conversion factor OER/SER','number'),f('foreignCurrencyConversionFactor','ضریب تبدیل ارز خارجی SER/OER','Foreign currency conversion factor SER/OER','number'),f('discountRate','نرخ تنزیل اقتصادی','Economic discount rate','percent'),f('referenceDate','تاریخ مرجع اقتصادی','Economic reference date','date')
]),
s('economic-items','طبقه‌بندی و تعدیل ارزش اقتصادی نهاده‌ها و محصولات','Economic classification and price adjustment','economic',true,'VIII.F-H; XII.B-D',[
f('item','شرح قلم','Item'),f('financialItemId','قلم مالی متناظر','Linked financial item ID'),f('assignedToEconomicBrowser','انتقال به ساختار اقتصادی','Assigned to economic browser','boolean'),f('direction','جهت','Direction','select',['input','output']),f('market','بازار','Market','select',['local','foreign']),f('tradeCategory','طبقه تجاری','Trade category','select',['non-traded','imported','importable','exportable','exported']),f('disaggregationLevel','سطح تجزیه به اجزا','Disaggregation level','number'),f('parentEconomicItemId','قلم اقتصادی بالادست','Parent economic item ID'),f('financialValue','ارزش مالی در اولین ظهور','Financial value at first appearance','number'),f('firstAppearancePrice','قیمت اولین ظهور','First-appearance price','number'),f('firstAppearanceQuantity','مقدار اولین ظهور','First-appearance quantity','number'),f('borderPriceType','مبنای قیمت مرزی','Border price basis','select',['CIF','FOB','consumer-price','producer-price']),f('borderPrice','قیمت مرزی/قیمت تولیدکننده یا مصرف‌کننده','Border/producer/consumer price','number'),f('borderPriceCurrency','ارز قیمت مرزی','Border price currency'),f('adjustmentFactor','ضریب تعدیل','Adjustment factor','number'),f('adjustedMarketValue','ارزش بازار تعدیل‌شده','Adjusted market value','number'),f('fxExposure','مواجهه ارزی','Foreign-currency exposure','percent'),f('taxesDutiesIncludedPercent','درصد مالیات و عوارض منظورشده (ورودی)','Taxes/duties included (inputs)','percent'),f('valueAddedIncludedPercent','درصد ارزش افزوده منظورشده','Value added included','percent'),f('exportablePercent','درصد صادرات‌پذیر','Exportable percentage','percent'),f('importablePercent','درصد واردات‌پذیر/جانشینی واردات','Importable/import substitution percentage','percent'),f('importSubstitutionPercent','درصد جانشینی واردات','Import substitution percentage','percent'),f('transportAdjustedValue','ارزش تعدیل‌شده حمل‌ونقل','Adjusted transport value','number'),f('transportForeignExposurePercent','مواجهه ارزی حمل‌ونقل','Transport foreign exposure','percent'),f('otherAdjustedValue','ارزش تعدیل‌شده سایر هزینه‌ها','Adjusted other costs','number'),f('otherForeignExposurePercent','مواجهه ارزی سایر هزینه‌ها','Other-cost foreign exposure','percent'),f('consumerOrProducerPrice','قیمت مصرف‌کننده یا تولیدکننده','Consumer or producer price','number'),f('subsidyNegativeTax','یارانه نهاده به‌عنوان مالیات منفی','Input subsidy as negative tax','boolean'),f('currency','ارز','Currency')
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
   const entered=Object.values(row.values??{}).some(fieldValue=>fieldValue!==null&&fieldValue!=='')
   const requiredBySection:Record<string,string[]>={
    'project-identification':['title','projectType','analysisLevel'],
    'planning-horizon':['periodStart','periodEnd','frequency'],
    products:['name','unit'],
    currencies:['code','name','type'],
    'currency-rates':['currencyCode','period','exchangeRate'],
    inflation:['currencyCode','period'],
    'cost-centres':['name','group'],
    'cost-allocation':['name','type','costCentreId','allocationPercent'],
    'joint-venture':['name','type'],
    'fixed-investment':['assetName','currency','origin'],
    'preproduction-expenditure':['description','currency','origin','period','quantity','unitPrice','total','amortizationMethod','amortizationLength','amortizationStartMode','firstAmortizationYearMonths'],
    'production-costs':['item','classification','currency','origin','basis'],
    'sales-programme':['productId','period'],
    'working-capital':['item','category','basis'],
    'equity-grants':['sourceName','sourceType','period','currency'],
    'loan-conditions':['loanName','kind','currency','origin','repaymentType','interval'],
    'loan-disbursements':['loanName','date','amount','flowType'],
    'loan-interest':['loanName','effectiveDate','annualRate'],
    'loan-fees':['loanName','type','rate','basis','payment','currency'],
    'profit-distribution':['period','retainedPercent','distributedPercent'],
    'tax-brackets':['lowerLimit','rate','period'],
    'tax-allowances':['type','period','amount'],
    'depreciation-adjustments':['period','origin','amount'],
    'starting-balances':['category','item','amount'],
    'economic-items':['item','direction','market','tradeCategory'],
    'economic-effects':['type','period'],
    sensitivity:['analysisType','variableGroup','variableId'],
    'incremental-analysis':['alternative','view','period'],
   }
   if(entered)for(const key of requiredBySection[section.id]??[]){
    if(section.id==='production-costs'&&key==='productId'&&typeof row.values?.allocationKeyId==='string'&&row.values.allocationKeyId.trim())continue
    const requiredValue=row.values?.[key]
    if(requiredValue===null||requiredValue===undefined||requiredValue==='')errors.push(section.id+':'+i+':required-field:'+key)
   }
   if(section.id==='cost-allocation'&&row.values.type==='user-defined'&&
      (typeof row.values.productId!=='string'||!row.values.productId.trim()))
    errors.push('cost-allocation:'+i+':required-field:productId')
   for(const field of section.fields){
    const v=row.values?.[field.key]
    if(v===undefined){errors.push(section.id+':'+i+':missing-field:'+field.key);continue}
    if((field.type==='number'||field.type==='percent')&&v!==null&&v!==''&&(typeof v!=='number'||!Number.isFinite(v)))errors.push(section.id+':'+i+':invalid-number:'+field.key)
    const minimumPercent=section.id==='inflation'&&field.key==='inflationPercent'?-100:0
    if(field.type==='percent'&&typeof v==='number'&&(v<minimumPercent||v>100))errors.push(section.id+':'+i+':percent-out-of-range:'+field.key)
    if(field.type==='select'&&v!==null&&v!==''&&field.options&&!field.options.includes(String(v)))errors.push(section.id+':'+i+':invalid-option:'+field.key)
    if(field.type==='date'&&typeof v==='string'&&v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))errors.push(section.id+':'+i+':invalid-date:'+field.key)
    if(field.type==='date'&&typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)){
     const [year,month,day]=v.split('-').map(Number)
     const date=new Date(Date.UTC(year,month-1,day))
     if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)errors.push(section.id+':'+i+':invalid-date:'+field.key)
    }
   }
   const nonNegativeBySection:Record<string,string[]>={
    'fixed-investment':['quantity','unitPrice','total','ratePercent','lengthYears','salePrice'],
    'preproduction-expenditure':['quantity','unitPrice','total','amortizationLength','firstAmortizationYearMonths'],
    'production-costs':['nominalCapacity','standardQuantity','standardUnitPrice','standardTotal','adjustmentQuantity','adjustmentUnitPrice','adjustmentTotal','initialStockQuantity','initialStockValue'],
    'sales-programme':['salesQuantity','netUnitPrice','grossUnitPrice','subsidyAmount','openingFinishedGoods','closingFinishedGoods','futureSalesQuantity'],
    'working-capital':['daysCoverage','turnover','periodMonths','requiredQuantity','requiredValue','initialStockQuantity','initialStockValue','startingBalance','depositRate'],
    'loan-conditions':['numberOfRepayments','graceMonths','openingDebt'],
    'loan-disbursements':['amount'],
    'loan-interest':['annualRate','capitalizePercent','capitalizedInterestRate','capitalizedInterestLength'],
    'loan-fees':['rate','depreciationRate','depreciationLength'],
    'tax-brackets':['lowerLimit'],
    'tax-allowances':['amount'],
    'starting-balances':['quantity','unitPrice','amount','settlementDays','remainingLife'],
    'economic-global':['officialExchangeRate','shadowExchangeRate','standardConversionFactor','foreignCurrencyConversionFactor'],
    'economic-items':['financialValue','firstAppearancePrice','firstAppearanceQuantity','borderPrice','adjustmentFactor','adjustedMarketValue','transportAdjustedValue','otherAdjustedValue'],
    'economic-effects':['amount','headcount','shadowWageFactor'],
    'sensitivity':['targetNpv','maxIncrease','maxDecrease','order'],
   }
   for(const key of nonNegativeBySection[section.id]??[]){
    const amount=row.values[key]
    if(typeof amount==='number'&&amount<0)errors.push(section.id+':'+i+':negative-value:'+key)
   }
   if(section.id==='sales-programme'){
    const v=row.values
    const entered=['salesQuantity','netUnitPrice','salesTaxPercent','subsidyPercent','subsidyAmount','closingFinishedGoods'].some(key=>v[key]!==null&&v[key]!=='')
    if(entered&&(!v.productId||!v.period))errors.push('sales-programme:'+i+':product-and-period-required')
    if(v.subsidyPercent!==null&&v.subsidyPercent!==''&&v.subsidyAmount!==null&&v.subsidyAmount!=='')errors.push('sales-programme:'+i+':choose-subsidy-percent-or-amount')
   }
   if(section.id==='fixed-investment'){
    const v=row.values
    const hasAcquisition=['quantity','unitPrice','total'].some(key=>v[key]!==null&&v[key]!=='')
    if(hasAcquisition&&(!v.assetName||!v.acquisitionDate))errors.push('fixed-investment:'+i+':asset-and-acquisition-date-required')
    if(v.startMode==='specified-date'&&!v.startDate)errors.push('fixed-investment:'+i+':depreciation-start-date-required')
   }
   if(section.id==='production-costs'){
    const v=row.values
    if(v.fixedPercent!==null&&v.fixedPercent!==''&&v.variablePercent!==null&&v.variablePercent!==''&&Math.abs(Number(v.fixedPercent)+Number(v.variablePercent)-100)>1e-8)errors.push('production-costs:'+i+':fixed-variable-split-must-equal-100')
   }
   const q=row.values.quantity,p=row.values.unitPrice,t=row.values.total
   if(typeof q==='number'&&typeof p==='number'&&typeof t==='number'&&Math.abs(q*p-t)>Math.max(.01,Math.abs(t)*1e-8))errors.push(section.id+':'+i+':quantity-price-total-mismatch')
   const fixed=row.values.fixedPercent,variable=row.values.variablePercent
   if(typeof fixed==='number'&&typeof variable==='number'&&Math.abs(fixed+variable-100)>1e-8)errors.push(section.id+':'+i+':fixed-variable-split-must-equal-100')
  }
 }
 const allocations=value.sections?.['cost-allocation']??[]
 for(const row of allocations){
  const name=row.values.name,centre=row.values.costCentreId
  if(typeof name!=='string'||!name)continue
  const same=allocations.filter(x=>x.values.name===name&&x.values.costCentreId===centre)
  if(same.every(x=>typeof x.values.allocationPercent==='number')){
   const sum=same.reduce((n,x)=>n+(x.values.allocationPercent as number),0)
   if(Math.abs(sum-100)>1e-8)errors.push('cost-allocation:'+name+':allocation-must-equal-100')
  }
 }
 for(const row of value.sections?.['loan-conditions']??[]){
  const v=row.values
  if(v.kind==='short-term'&&v.repaymentType!==''&&v.repaymentType!=='profile')errors.push('short-term-loan-must-use-profile')
  if((v.repaymentType==='annuity'||v.repaymentType==='constant-principal')&&typeof v.numberOfRepayments==='number'&&(!Number.isInteger(v.numberOfRepayments)||v.numberOfRepayments<=0))errors.push('invalid-number-of-repayments')
  if(typeof v.firstRepaymentDate==='string'&&v.firstRepaymentDate){
   const date=new Date(v.firstRepaymentDate+'T00:00:00Z')
   if(!Number.isFinite(date.getTime())||date.getUTCDate()!==new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate())errors.push('first-repayment-date-must-be-month-end')
  }
 }
 for(const row of value.sections?.['loan-disbursements']??[]){
  const amount=row.values.amount,kind=row.values.flowType
  if(typeof amount==='number'&&kind==='drawdown'&&amount<=0)errors.push('loan-drawdown-must-be-positive')
  if(typeof amount==='number'&&kind==='profile-repayment'&&amount>=0)errors.push('profile-repayment-must-be-negative')
 }
 const feeBasis:Record<string,string>={agency:'each-positive-disbursement',guarantee:'outstanding-loan-including-current-disbursement-excluding-current-repayment',commitment:'undisbursed-commitment',other:'total-loan'}
 const feePayment:Record<string,string>={agency:'at-each-disbursement',guarantee:'with-interest',commitment:'with-interest',other:'at-first-disbursement'}
 for(const row of value.sections?.['loan-fees']??[]){
  const v=row.values
  if(typeof v.type==='string'&&v.type&&v.basis!==''&&v.basis!==feeBasis[v.type])errors.push('loan-fee-basis-mismatch:'+v.type)
  if(typeof v.type==='string'&&v.type&&v.payment!==''&&v.payment!==feePayment[v.type])errors.push('loan-fee-payment-mismatch:'+v.type)
 }
 const restrictedUnits=new Set(['work-in-progress','accounts-receivable','cash-in-hand-local','cash-in-hand-foreign','accounts-payable'])
 for(const row of value.sections?.['working-capital']??[]){
  const v=row.values
  if(v.mode==='units'&&typeof v.category==='string'&&restrictedUnits.has(v.category))errors.push('working-capital-category-value-mode-only:'+v.category)
  if(v.category==='finished-products'&&v.mode==='value')errors.push('finished-products-inventory-must-use-quantity-mode')
  if((v.initialStockQuantity!==null||v.initialStockValue!==null)&&typeof v.category==='string'&&!['raw-materials','factory-supplies','utilities','energy','spare-parts'].includes(v.category))errors.push('initial-stock-not-supported-for-category:'+v.category)
  const expectedBasis:Record<string,string>={'raw-materials':'cost-of-products-produced-materials','factory-supplies':'cost-of-products-produced-materials','utilities':'cost-of-products-produced-materials','energy':'cost-of-products-produced-materials','spare-parts':'cost-of-products-produced-materials','work-in-progress':'cost-of-products-produced-factory-cost','finished-products':'cost-of-products-sold-operating-cost','accounts-receivable':'cost-of-products-sold-operating-plus-marketing','cash-in-hand-local':'cost-of-products-produced-excluding-materials','cash-in-hand-foreign':'cost-of-products-produced-excluding-materials','accounts-payable':'cost-of-products-produced-total-including-marketing'}
  if(typeof v.category==='string'&&v.category&&typeof v.basis==='string'&&v.basis&&expectedBasis[v.category]&&v.basis!==expectedBasis[v.category])errors.push('working-capital-basis-mismatch:'+v.category)
  if(typeof v.daysCoverage==='number'&&v.daysCoverage<=0)errors.push('working-capital-days-coverage-must-be-positive')
  if(typeof v.turnover==='number'&&v.turnover<=0)errors.push('working-capital-turnover-must-be-positive')
  if(typeof v.daysCoverage==='number'&&typeof v.periodMonths==='number'&&typeof v.turnover==='number'&&v.periodMonths>0&&Math.abs(v.turnover-(30*v.periodMonths/v.daysCoverage))>1e-8)errors.push('working-capital-turnover-days-coverage-mismatch')
 }
 for(const row of value.sections?.['fixed-investment']??[]){
  const v=row.values
  if(typeof v.firstDepreciationYearMonths==='number'&&(!Number.isInteger(v.firstDepreciationYearMonths)||v.firstDepreciationYearMonths<1||v.firstDepreciationYearMonths>12))errors.push('invalid-first-depreciation-year-months')
  if(v.startMode==='specified-date'&&(!v.startDate||v.startDate===''))errors.push('depreciation-start-date-required')
 }
 const globalEconomic=(value.sections?.['economic-global']??[])[0]?.values
 if(globalEconomic){
  const scf=globalEconomic.standardConversionFactor,fccf=globalEconomic.foreignCurrencyConversionFactor
  if(typeof scf==='number'&&typeof fccf==='number'&&Math.abs(scf*fccf-1)>1e-8)errors.push('economic-global:scf-fccf-must-be-reciprocal')
  if(globalEconomic.numeraireType==='foreign-border-prices'&&(!globalEconomic.numeraireCurrency||globalEconomic.numeraireCurrency===''))errors.push('economic-global:foreign-numeraire-currency-required')
 }
 for(const row of value.sections?.['economic-items']??[]){
  const v=row.values
  const direction=v.direction,market=v.market,category=v.tradeCategory
  if(typeof direction==='string'&&typeof market==='string'&&typeof category==='string'&&category){
   const allowed=direction==='input'
    ? (market==='foreign'?['imported']:['non-traded','importable','exportable'])
    : (market==='foreign'?['exported']:['non-traded','exportable','importable'])
   if(!allowed.includes(category))errors.push('economic-item:invalid-trade-category:'+direction+':'+market+':'+category)
  }
  if(typeof v.disaggregationLevel==='number'&&(!Number.isInteger(v.disaggregationLevel)||v.disaggregationLevel<1||v.disaggregationLevel>3))errors.push('economic-item:disaggregation-level-must-be-1-to-3')
  if(category==='non-traded'&&typeof v.fxExposure==='number'&&v.fxExposure!==0)errors.push('economic-item:non-traded-fx-exposure-must-be-zero')
  if(direction==='output'&&typeof v.taxesDutiesIncludedPercent==='number'&&v.taxesDutiesIncludedPercent!==0)errors.push('economic-output:taxes-duties-included-not-entered-here')
 }
 for(const row of value.sections?.['products']??[]){
  const v=row.values
  if(v.productionIntervalMode==='user-defined'&&(!v.productionIntervalStart||!v.productionIntervalEnd))errors.push('product:user-defined-production-interval-requires-start-and-end')
  if(typeof v.productionIntervalStart==='string'&&typeof v.productionIntervalEnd==='string'&&v.productionIntervalStart&&v.productionIntervalEnd&&v.productionIntervalEnd<v.productionIntervalStart)errors.push('product:production-interval-end-before-start')
 }
 for(const row of value.sections?.['sales-programme']??[]){
  const v=row.values
  if(v.productionActive===false&&typeof v.salesQuantity==='number'&&typeof v.openingFinishedGoods==='number'&&v.salesQuantity>v.openingFinishedGoods)errors.push('sales:production-inactive-sales-exceed-opening-stock')
  if(typeof v.futureSalesQuantity==='number'&&v.futureSalesQuantity<0)errors.push('sales:future-sales-quantity-negative')
 }
 for(const row of value.sections?.['profit-distribution']??[]){
  const retained=row.values.retainedPercent,distributed=row.values.distributedPercent
  if(typeof retained==='number'&&typeof distributed==='number'&&Math.abs(retained+distributed-100)>1e-8)errors.push('profit-retention-and-distribution-must-equal-100')
 }

 // Stable row identities and cross-row checks for the remaining generic modules.
 for(const [sectionId,rows] of Object.entries(value.sections??{})){
  const ids=rows.map(row=>row.id)
  if(ids.some(id=>!id))errors.push(sectionId+':blank-row-id')
  if(new Set(ids).size!==ids.length)errors.push(sectionId+':duplicate-row-id')
 }
 const costCentres=value.sections?.['cost-centres']??[]
 const centreIds=new Set(costCentres.map(row=>row.id))
 const centreNames=costCentres.map(row=>row.values.name).filter((name):name is string=>typeof name==='string'&&name.trim()!=='')
 if(new Set(centreNames.map(name=>name.trim().toLocaleLowerCase())).size!==centreNames.length)errors.push('cost-centres:duplicate-name')
 const parentOf=new Map(costCentres.map(row=>[row.id,typeof row.values.parentId==='string'?row.values.parentId:'']))
 for(const row of costCentres){
  const parent=row.values.parentId
  if(typeof parent==='string'&&parent.trim()&&!centreIds.has(parent))errors.push('cost-centre:unknown-parent:'+parent)
  if(parent===row.id)errors.push('cost-centre:self-parent:'+row.id)
  const path=new Set<string>();let cursor:string|undefined=row.id
  while(cursor){if(path.has(cursor)){errors.push('cost-centre:parent-cycle:'+row.id);break}path.add(cursor);cursor=parentOf.get(cursor)}
 }
 for(const row of value.sections?.['cost-allocation']??[]){
  const v=row.values
  if(typeof v.allocationPercent==='number'&&(!Number.isFinite(v.allocationPercent)||v.allocationPercent<0||v.allocationPercent>100))errors.push('cost-allocation:invalid-percent')
  if(typeof v.costCentreId==='string'&&v.costCentreId.trim()&&!centreIds.has(v.costCentreId))errors.push('cost-allocation:unknown-cost-centre:'+v.costCentreId)
 }
 for(const row of value.sections?.['equity-grants']??[]){
  const v=row.values
  if(v.sourceType==='grant'||v.sourceType==='subsidy'){
   if(typeof v.sourceName!=='string'||!v.sourceName.trim())errors.push('equity-grant:source-name-required')
   if(typeof v.period!=='string'||!v.period.trim())errors.push('equity-grant:period-required')
   if(v.paidIn!==null&&v.paidIn!==undefined&&(typeof v.paidIn!=='number'||!Number.isFinite(v.paidIn)||v.paidIn<0))errors.push('equity-grant:invalid-amount')
   if(v.paidOut!==null&&v.paidOut!==undefined&&(typeof v.paidOut!=='number'||!Number.isFinite(v.paidOut)||v.paidOut<0))errors.push('equity-grant:invalid-refund')
  }
 }
 for(const row of value.sections?.['joint-venture']??[]){
  const v=row.values
  for(const key of ['preferredDividendPercent','profitSharePercent','repatriationPercent'] as const){
   const amount=v[key]
   if(typeof amount==='number'&&(!Number.isFinite(amount)||amount<0||amount>100))errors.push('joint-venture:invalid-'+key)
  }
  for(const key of ['paidIn','paidOut','preferredDividendAbsolute'] as const){
   const amount=v[key]
   if(typeof amount==='number'&&(!Number.isFinite(amount)||amount<0))errors.push('joint-venture:invalid-'+key)
  }
 }
 const products=value.sections?.['products']??[]
 const productRefs=new Set(products.flatMap(row=>[row.id,typeof row.values.name==='string'?row.values.name.trim():'']).filter(Boolean))
 for(const sectionId of ['sales-programme','production-costs','working-capital','cost-allocation']){
  for(const [index,row] of (value.sections?.[sectionId]??[]).entries()){
   const productId=row.values.productId
   if(typeof productId==='string'&&productId.trim()&&!productRefs.has(productId.trim()))
    errors.push(sectionId+':'+index+':unknown-product-reference:'+productId)
  }
 }
 const financialRefs=new Set([
  ...(value.sections?.['fixed-investment']??[]).map(row=>row.id),
  ...(value.sections?.['production-costs']??[]).map(row=>row.id),
  ...(value.sections?.['sales-programme']??[]).map(row=>row.id),
  ...(value.sections?.['products']??[]).map(row=>row.id),
 ])
 const costItems=value.sections?.['production-costs']??[]
 const costItemRefs=new Set(costItems.flatMap(row=>[row.id,typeof row.values.item==='string'?row.values.item.trim():'']).filter(Boolean))
 for(const [index,row] of (value.sections?.['working-capital']??[]).entries()){
  const item=row.values.costItemId
  if(typeof item==='string'&&item.trim()&&!costItemRefs.has(item.trim()))
   errors.push('working-capital:'+index+':unknown-cost-item-reference:'+item)
 }
 for(const [index,row] of (value.sections?.['economic-items']??[]).entries()){
  const linked=row.values.financialItemId
  if(typeof linked==='string'&&linked.trim()&&!financialRefs.has(linked.trim()))
   errors.push('economic-items:'+index+':unknown-financial-item-reference:'+linked)
 }
 const economicRows=value.sections?.['economic-items']??[]
 const economicIds=new Set(economicRows.map(row=>row.id))
 const economicParent=new Map(economicRows.map(row=>[row.id,typeof row.values.parentEconomicItemId==='string'?row.values.parentEconomicItemId:'']))
 for(const row of economicRows){
  const parent=row.values.parentEconomicItemId
  if(typeof parent==='string'&&parent.trim()&&!economicIds.has(parent.trim()))
   errors.push('economic-items:unknown-parent-reference:'+parent)
  const path=new Set<string>();let cursor:string|undefined=row.id
  while(cursor){if(path.has(cursor)){errors.push('economic-items:parent-cycle:'+row.id);break}path.add(cursor);cursor=economicParent.get(cursor)}
 }
 const costCentreRows=value.sections?.['cost-centres']??[]
 const costCentreIds=new Set(costCentreRows.map(row=>row.id))
 for(const [index,row] of (value.sections?.['production-costs']??[]).entries()){
  const centre=row.values.costCentreId
  if(typeof centre==='string'&&centre.trim()&&!costCentreIds.has(centre.trim()))
   errors.push('production-costs:'+index+':unknown-cost-centre:'+centre)
  const allocation=row.values.allocationKeyId
  if(typeof allocation==='string'&&allocation.trim()&&!(value.sections?.['cost-allocation']??[]).some(item=>item.id===allocation.trim()))
   errors.push('production-costs:'+index+':unknown-allocation-key:'+allocation)
 }
 const allocationRows=value.sections?.['cost-allocation']??[]
 const allocationGroups=new Map<string,typeof allocationRows>()
 for(const row of allocationRows){
  const name=typeof row.values.name==='string'?row.values.name.trim():''
  const centre=typeof row.values.costCentreId==='string'?row.values.costCentreId.trim():''
  const key=name&&centre?name+'|'+centre:''
  if(key)allocationGroups.set(key,[...(allocationGroups.get(key)??[]),row])
 }
 for(const [key,rows] of allocationGroups){
  const percentages=rows.map(row=>row.values.allocationPercent)
  if(percentages.some(value=>value!==null&&value!=='')){
   if(percentages.some(value=>typeof value!=='number'||!Number.isFinite(value)||value<0||value>100))
    errors.push('cost-allocation:invalid-percentages:'+key)
   else if(Math.abs((percentages as number[]).reduce((sum,value)=>sum+value,0)-100)>0.01)
    errors.push('cost-allocation:percentages-must-equal-100:'+key)
  }
  const targets=rows.map(row=>[row.values.costCentreId,row.values.productId].join('|'))
  if(new Set(targets).size!==targets.length)errors.push('cost-allocation:duplicate-target:'+key)
 }
 const loanConditions=value.sections?.['loan-conditions']??[]
 const loanNames=loanConditions.map(row=>typeof row.values.loanName==='string'?row.values.loanName.trim():'').filter(Boolean)
 if(new Set(loanNames.map(name=>name.toLocaleLowerCase())).size!==loanNames.length)errors.push('loan-conditions:duplicate-loan-name')
 for(const sectionId of ['loan-disbursements','loan-interest','loan-fees']){
  for(const [index,row] of (value.sections?.[sectionId]??[]).entries()){
   const loanName=row.values.loanName
   if(typeof loanName==='string'&&loanName.trim()&&!loanNames.includes(loanName.trim()))
    errors.push(sectionId+':'+index+':unknown-loan-reference:'+loanName)
  }
 }
 const currencyRows=value.sections?.['currencies']??[]
 const currencyCodes=currencyRows.map(row=>typeof row.values.code==='string'?row.values.code.trim().toUpperCase():'').filter(Boolean)
 if(new Set(currencyCodes).size!==currencyCodes.length)errors.push('currencies:duplicate-currency-code')
 const accountingCurrencies=currencyRows.filter(row=>row.values.accountingCurrency===true)
 if(accountingCurrencies.length>1)errors.push('currencies:multiple-accounting-currencies')
 const incremental=value.sections?.['incremental-analysis']??[]
 const incrementalKeys=incremental.map(row=>[row.values.alternative,row.values.view,row.values.period].join('|'))
 if(incremental.some(row=>!['alternative','view','period'].every(key=>typeof row.values[key]==='string'&&String(row.values[key]).trim())))
  errors.push('incremental-analysis:alternative-view-and-period-required')
 if(new Set(incrementalKeys).size!==incrementalKeys.length)errors.push('incremental-analysis:duplicate-alternative-view-period')
 for(const row of value.sections?.['sensitivity']??[]){
  const v=row.values
  for(const key of ['quantityChange','priceChange','valueChange','maxIncrease','maxDecrease'] as const){
   const amount=v[key]
   if(typeof amount==='number'&&(!Number.isFinite(amount)||(key==='maxIncrease'||key==='maxDecrease'?amount<0:amount< -100)))errors.push('sensitivity:invalid-'+key)
  }
  if(typeof v.order==='number'&&(!Number.isInteger(v.order)||v.order<1))errors.push('sensitivity:invalid-variable-order')
 }
 if(currencyRows.length){
  const localCurrencies=currencyRows.filter(row=>row.values.type==='local')
  if(localCurrencies.length!==1)errors.push('currencies:exactly-one-local-currency-required')
  if(accountingCurrencies.length!==1)errors.push('currencies:exactly-one-accounting-currency-required')
  if(accountingCurrencies.length===1&&accountingCurrencies[0].values.type!=='local')
   errors.push('currencies:accounting-currency-must-be-local')
  for(const row of currencyRows){
   const code=typeof row.values.code==='string'?row.values.code.trim().toUpperCase():''
   const rate=row.values.exchangeRate
   if(rate!==null&&rate!==''&&(typeof rate!=='number'||!Number.isFinite(rate)||rate<=0))
    errors.push('currencies:invalid-exchange-rate:'+code)
   if(row.values.type==='foreign'&&rate!==null&&rate!==''&&(!row.values.effectiveDate||row.values.effectiveDate===''))
    errors.push('currencies:exchange-rate-date-required:'+code)
   if(row.values.type==='local'&&typeof rate==='number'&&Math.abs(rate-1)>1e-10)
    errors.push('currencies:local-currency-rate-must-equal-one:'+code)
   if(row.values.accountingCurrency===true&&row.values.type!=='local')
    errors.push('currencies:accounting-currency-must-be-local:'+code)
  }
 }
 const currencySections=['fixed-investment','preproduction-expenditure','production-costs','equity-grants','loan-conditions','loan-fees','tax-allowances','depreciation-adjustments']
 for(const sectionId of currencySections){
  for(const [index,row] of (value.sections?.[sectionId]??[]).entries()){
   const raw=row.values.currency
   if(typeof raw==='string'&&raw.trim()&&!currencyCodes.includes(raw.trim().toUpperCase()))
    errors.push(sectionId+':'+index+':unknown-currency-reference:'+raw)
  }
 }
 const currencyRateRows=value.sections?.['currency-rates']??[]
 const currencyRateKeys=currencyRateRows.map(row=>[row.values.currencyCode,row.values.period].join('|'))
 if(new Set(currencyRateKeys).size!==currencyRateKeys.length)errors.push('currency-rates:duplicate-currency-period')
 for(const [index,row] of currencyRateRows.entries()){
  const code=typeof row.values.currencyCode==='string'?row.values.currencyCode.trim().toUpperCase():''
  const period=typeof row.values.period==='string'?row.values.period.trim():''
  const rate=row.values.exchangeRate
  if(code&&!currencyCodes.includes(code))errors.push('currency-rates:'+index+':unknown-currency:'+code)
  if(typeof rate!=='number'||!Number.isFinite(rate)||rate<=0)errors.push('currency-rates:'+index+':invalid-exchange-rate')
  if(code&&currencyRows.some(currency=>String(currency.values.code??'').trim().toUpperCase()===code&&currency.values.type==='local')&&
    typeof rate==='number'&&Math.abs(rate-1)>1e-10)errors.push('currency-rates:'+index+':local-currency-rate-must-equal-one')
  if(!period)errors.push('currency-rates:'+index+':period-required')
 }
 const inflationRows=value.sections?.['inflation']??[]
 const inflationKeys=inflationRows.map(row=>[row.values.currencyCode,row.values.period].join('|'))
 if(new Set(inflationKeys).size!==inflationKeys.length)errors.push('inflation:duplicate-currency-period')
 for(const [index,row] of inflationRows.entries()){
  const code=typeof row.values.currencyCode==='string'?row.values.currencyCode.trim().toUpperCase():''
  if(code&&!currencyCodes.includes(code))errors.push('inflation:'+index+':unknown-currency:'+code)
  if(typeof row.values.priceIndex==='number'&&(!Number.isFinite(row.values.priceIndex)||row.values.priceIndex<=0))
   errors.push('inflation:'+index+':invalid-price-index')
  if(typeof row.values.inflationPercent==='number'&&(!Number.isFinite(row.values.inflationPercent)||row.values.inflationPercent<=-100||row.values.inflationPercent>100))
   errors.push('inflation:'+index+':invalid-inflation-rate')
 }
 const taxBrackets=value.sections?.['tax-brackets']??[]
 const taxByPeriod=new Map<string,typeof taxBrackets>()
 for(const row of taxBrackets){
  const period=typeof row.values.period==='string'?row.values.period.trim():''
  if(period)taxByPeriod.set(period,[...(taxByPeriod.get(period)??[]),row])
 }
 for(const [period,rows] of taxByPeriod){
  const sorted=[...rows].sort((a,b)=>Number(a.values.lowerLimit)-Number(b.values.lowerLimit))
  const lowerLimits=sorted.map(row=>row.values.lowerLimit)
  if(lowerLimits.some(value=>typeof value!=='number'||!Number.isFinite(value)||value<0))
   errors.push('tax-brackets:invalid-lower-limit:'+period)
  if(new Set(lowerLimits).size!==lowerLimits.length)
   errors.push('tax-brackets:duplicate-lower-limit:'+period)
  let previousRate=-Infinity
  for(const row of sorted){
   const rate=row.values.rate
   if(typeof rate!=='number'||!Number.isFinite(rate)||rate<0||rate>100){
    errors.push('tax-brackets:invalid-rate:'+period)
    continue
   }
   if(rate<previousRate)errors.push('tax-brackets:progressive-rates-must-not-decrease:'+period)
   previousRate=rate
  }
 }
 for(const row of value.sections?.['economic-effects']??[]){
  const v=row.values
  if(typeof v.headcount==='number'&&(!Number.isFinite(v.headcount)||v.headcount<0))errors.push('economic-effects:invalid-headcount')
  if(typeof v.shadowWageFactor==='number'&&(!Number.isFinite(v.shadowWageFactor)||v.shadowWageFactor<=0))errors.push('economic-effects:invalid-shadow-wage-factor')
  if(typeof v.amount==='number'&&!Number.isFinite(v.amount))errors.push('economic-effects:non-finite-amount')
 }

 return errors
}

export type HelpDrivenCalendarPeriod={index:number;startDate:string;endDate:string}
export function validateHelpDrivenProjectPeriods(value:HelpDrivenProjectForms,periods:readonly HelpDrivenCalendarPeriod[]):string[]{
 const errors:string[]=[]
 if(!periods.length){
  for(const [sectionId,rows] of Object.entries(value.sections??{})){
   for(const [rowIndex,row] of rows.entries()){
    for(const key of ['period','adjustmentPeriod','recoveryPeriod','date','effectiveDate','acquisitionDate','startDate','saleDate','firstRepaymentDate','disbursementUntil','capitalizeUntil','capitalizedInterestStart','depreciationStart']){
     const raw=row.values[key]
     if(typeof raw==='string'&&raw.trim())errors.push(sectionId+':'+rowIndex+':project-calendar-required-for:'+key)
    }
   }
  }
  return errors
 }
 const validPeriods=periods.map((period,index)=>({period,index,start:Date.parse(period.startDate+'T00:00:00Z'),end:Date.parse(period.endDate+'T00:00:00Z')}))
 for(let i=0;i<validPeriods.length;i++){
  const current=validPeriods[i]
  if(!Number.isFinite(current.start)||!Number.isFinite(current.end)||current.start>current.end)
   errors.push('project-calendar:invalid-period:'+String(current.period.index))
  if(i>0&&current.start<=validPeriods[i-1].end)
   errors.push('project-calendar:overlapping-or-unsorted-periods:'+String(current.period.index))
 }
 const resolvePeriod=(key:string):number=>{
  const matches=validPeriods.filter(({period,index,start,end})=>key===String(period.index)||key===period.startDate||key===period.endDate||(key.length===7&&key===period.startDate.slice(0,7)&&key===period.endDate.slice(0,7)))
  return matches.length===1?matches[0].index:-1
 }
 const datedFields:Record<string,string[]>={
  'planning-horizon':['constructionStart','constructionEnd','productionStart','productionEnd','periodStart','periodEnd'],
  products:['actualStart','actualEnd','productionIntervalStart','productionIntervalEnd'],
  currencies:['effectiveDate'],inflation:['effectiveDate'],
  'fixed-investment':['acquisitionDate','startDate','saleDate'],
  'loan-conditions':['firstRepaymentDate','disbursementUntil'],
  'loan-disbursements':['date'],
  'loan-interest':['effectiveDate','capitalizeUntil','capitalizedInterestStart'],
  'loan-fees':['depreciationStart'],'preproduction-expenditure':['amortizationStartDate'],
 }
 for(const [sectionId,rows] of Object.entries(value.sections??{})){
  const periodFields=['period','adjustmentPeriod','recoveryPeriod']
  for(const [rowIndex,row] of rows.entries()){
   for(const key of periodFields){
    const raw=row.values[key]
    if(typeof raw==='string'&&raw.trim()&&raw!=='project-end'&&resolvePeriod(raw.trim())<0)
     errors.push(sectionId+':'+rowIndex+':period-outside-project-calendar:'+key+':'+raw)
   }
   for(const key of datedFields[sectionId]??[]){
    const raw=row.values[key]
    if(typeof raw==='string'&&raw.trim()){
     const containing=validPeriods.filter(({start,end})=>Date.parse(raw+'T00:00:00Z')>=start&&Date.parse(raw+'T00:00:00Z')<=end)
     if(containing.length!==1)errors.push(sectionId+':'+rowIndex+':date-outside-project-calendar:'+key+':'+raw)
    }
   }
   const pairs=sectionId==='products'?[['actualStart','actualEnd'],['productionIntervalStart','productionIntervalEnd']]:sectionId==='fixed-investment'?[['acquisitionDate','saleDate']]:[]
   for(const [startKey,endKey] of pairs){
    const start=row.values[startKey],end=row.values[endKey]
    if(typeof start==='string'&&start&&typeof end==='string'&&end&&start>end)
     errors.push(sectionId+':'+rowIndex+':date-range-reversed:'+startKey+':'+endKey)
   }
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
