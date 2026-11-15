# نقشه پوشش قابلیت‌های COMFAR در پیشران

این سند نقشه راه مهندسی برای تبدیل پیشران به جایگزین جامع COMFAR است. وضعیت «گزینه در فرم» به معنی تکمیل موتور محاسبات یا گزارش نیست؛ برای هر قابلیت باید ورودی، موتور، خروجی، آزمون و ترجمه همگی تکمیل شوند.

## 1. اصول طراحی ساختار پروژه

Reference Manual فصل VI ساختار درختی پروژه را بر اساس نوع پروژه و سطح تحلیل تعریف می‌کند. شاخه‌های اصلی مدل صنعتی عبارت‌اند از:
- Project Identification
- Planning Horizon
- Products
- Currencies
- Cost Centre Structure (when active)
- Inflation (when active)
- Joint-venture Partner (when active)
- Discounting
- Fixed Investment
- Production Costs
- Sales Programme
- Working Capital
- Sources of Finance
- Taxes, Allowances
- Starting Balances (for Expansion/Rehabilitation)
- Economic Analysis (when active)

پیشران باید این ساختار را در فرم‌ها و درخت داده‌ها به‌صورت قابل توسعه بازنمایی کند؛ نه اینکه صرفاً چند فرم ثابت و غیرمرتبط داشته باشد.

## 2. گزینه‌های ایجاد پروژه

| قابلیت مرجع | وضعیت فعلی پیشران | کار لازم برای برابری عملکرد |
|---|---|---|
| Project Type: Industrial, Maritime, Agricultural, Infrastructure, Tourism, Mining | انتخاب هر شش نوع پروژه در فرم تعریف پروژه اضافه شده؛ ساختار اختصاصی هنوز یکسان/ناقص است | تعریف پروفایل ساختاری مستقل برای هر نوع پروژه؛ بدون تزریق فرم‌های فولادی به صنایع دیگر |
| Opportunity Study | گزینه سطح مطالعه اضافه شده | تولید ساختار ورودی تجمیعی و خروجی متناسب با سطح فرصت |
| Feasibility Study | گزینه سطح مطالعه اضافه شده و پیش‌فرض فعلی است | فعال‌سازی ساختار تفصیلی، ریزشدن هزینه‌ها و برنامه‌ها |
| New Project | موجود | تکمیل گردش‌کار استاندارد |
| Expansion/Rehabilitation | گزینه و ماژول اختصاصی موجود؛ محاسبات ناقص | تکمیل Opening/Starting Balances، مدل با/بدون طرح، دارایی‌ها و بدهی‌های موجود و Incremental Analysis |
| Joint-venture Project | گزینه انتخابی و فرم ثبت حداکثر ۲۰ شریک با سهم سرمایه، آورده و سهم سود اضافه شده؛ اتصال محاسباتی ناقص است | مدل طبقات سرمایه، توزیع سود، برداشت‌ها و گزارش جریان نقدی هر شریک |
| Financial Analysis | موتور مالی موجود اما نیازمند تطبیق گسترده | تکمیل تمام schedules و آزمون‌های فصل XI |
| Economic Analysis | گزینه انتخابی اضافه شده | موتور قیمت اقتصادی/سایه‌ای و جداول اقتصادی فصل VIII و XII |
| Cost Centre Analysis | گزینه انتخابی اضافه شده | ساختار مراکز هزینه، تخصیص و گزارش سودآوری هر مرکز |
| Cost Allocation | گزینه انتخابی اضافه شده؛ فعال‌سازی Cost Centre در فرم انجام می‌شود | allocation keys، مبانی تخصیص و گزارش‌های تطبیقی |
| Value-added Analysis | گزینه انتخابی اضافه شده | محاسبه و گزارش ارزش افزوده |
| Foreign Exchange Effect | گزینه انتخابی اضافه شده | تفکیک جریان ارز، تبدیل به numeraire و اثر تراز پرداخت‌ها |
| Employment Effects | گزینه انتخابی اضافه شده | داده نیروی کار، تفکیک مهارت/گروه و خروجی اشتغال |

## 3. داده‌های مالی و عملیاتی — فصل VII

| گروه | اجزای لازم |
|---|---|
| Common Financial Data | Item Description، Currency، Foreign/Local Origin or Market، Escalation، Remarks، Cost Centre |
| Project Identification | Project Title، Project Description، Date and Time، Project Classification، Joint Venture، Special Features |
| Planning Horizon | Construction Phase، Production Phase، startup period، month of balance، financial periods، annual/monthly/quarterly timing |
| Product Definition | چند محصول، واحدها، قیمت‌ها، کیفیت و ارتباط محصول با تولید/فروش |
| Currencies | Local Currency، Foreign Currencies، exchange rates، conversion dates، currency denomination |
| Cost Centres | تعریف مراکز هزینه، رابطه با اقلام هزینه و محصولات |
| Inflation | شاخص‌های قیمت، نرخ تورم، escalation/deviation from inflation |
| Discounting | نرخ و تاریخ تنزیل، جریان‌های مورد تنزیل، تفکیک مالی/اقتصادی |
| Fixed Investment | زمین، ساختمان، ماشین‌آلات، زیرساخت، هزینه‌های پیش از بهره‌برداری، زمان‌بندی مخارج، استهلاک و فروش دارایی |
| Production Costs | مواد، ملزومات، انرژی، نیروی کار، تعمیرات، سربار و هزینه‌های مستقیم/غیرمستقیم |
| Sales Programme | مقدار و قیمت فروش هر محصول در هر دوره، بازار داخلی/صادراتی، موجودی و زمان‌بندی فروش |
| Working Capital | موجودی‌ها، WIP، محصول نهایی، دریافتنی، نقد، پرداختنی و روزهای پوشش |
| Sources of Finance | Equity Capital، Joint-venture Partner، Loans، disbursement/repayment phases، interest, fees، grace periods، capitalized interest |
| Taxes and Allowances | tax system، tax rates، allowances، loss treatment، sales taxes، import duties، tax depreciation |
| Starting Balances | Work in Progress، Finished Product Inventory، Other Assets، Liabilities، Fixed Investment Items، Long-term Debt، Equity Capital، Subsidies and Grants |

## 4. تحلیل اقتصادی — فصل VIII و XII

حداقل موارد زیر باید به‌صورت ماژول اقتصادی مستقل تعریف شوند:
- تبدیل قیمت‌های مالی به economic prices و اعمال conversion factors.
- Foreign Exchange Component و shadow exchange rate / numeraire.
- تفکیک tradable و non-tradable inputs/outputs در صورت پشتیبانی روش.
- دستمزد و آثار اشتغال با تفکیک گروه نیروی کار.
- indirect effects و allocation keys.
- economic costs and benefits، جداول جریان اقتصادی و شاخص‌های بازده اقتصادی.
- جلوگیری از اختلاط نرخ‌ها و جریان‌های مالی با جریان‌های اقتصادی.

## 5. دامنه محاسبه و خروجی‌ها — فصل IX و X

کاربر باید بتواند خروجی‌های لازم را انتخاب کند و پیش از محاسبه، وضعیت کمبود داده یا خطاها را ببیند. خروجی‌های لازم شامل:
- Financial Schedules and Graphs.
- Schedules and Graphs for Economic Analysis.
- Fixed Investment Costs.
- Production Costs.
- Sales and Production.
- Working Capital.
- Sources of Finance and Debt Service.
- Cash Flow for Financial Planning.
- Net Income Statement.
- Discounted Cash Flow for Total Capital Invested.
- Discounted Cash Flow for Total Equity Invested.
- NPV, NPVR, IRR, MIRR, Payback, Break-even.
- Projected Balance Sheet and Ratios.
- Cost Centre and Cost Allocation outputs.
- Joint-venture partner results.
- Foreign currency and employment/economic results.

در پیشران باید Calculation Report داشته باشیم که هر کمبود داده، ناسازگاری دوره، کمبود تأمین مالی، نبود جواب IRR یا نقص محاسبات را با محل و علت نشان دهد. خروجی گرافیکی باید از همان schedule عددی تولید شود، نه از محاسبات مستقل و ناسازگار.

## 6. قواعد محاسبات مالی — فصل XI

موتور مالی باید برای هر مورد فرمول، ورودی، دوره وقوع، قرارداد حسابداری و آزمون مرجع داشته باشد:
- Time and period conventions؛ زمان ثبت معاملات و تاریخ تراز.
- Currency conversion and exchange rate changes.
- Fixed investment timing and asset disposal.
- Depreciation, residual/salvage value and accumulated depreciation.
- Production and sales programme; inventory movements.
- Operating and production costs, escalation and inflation.
- Working capital, starting balances, collection/liquidation and payout periods.
- Equity/risk capital and joint-venture contributions/distributions.
- Long- and medium-term loans; disbursement and repayment phases.
- Interest, fees and capitalized interest.
- Taxes, allowances and loss treatment.
- Dividends and financing cash flow.
- Balance sheet and financial schedules reconciliation.

هر روش باید با داده Tutorial و در صورت امکان خروجی پروژه واقعی کاربر آزموده شود. اختلاف عددی باید در reconciliation report با مقدار، دوره، علت و منبع ثبت شود.

## 7. تحلیل حساسیت و تحلیل افزایشی — فصل XIII و XIV

- Sensitivity Analysis باید متغیرهای مستقل و دامنه تغییر، شاخص هدف و جدول/نمودار نتیجه را پشتیبانی کند.
- Incremental Analysis برای Expansion/Rehabilitation باید سه مرحله مرجع را پیاده کند: ۱) Existing Enterprise — Without Project، ۲) Existing Enterprise + Project، ۳) حذف داده‌های بنگاه موجود از مرحله دوم و محاسبه Incremental Project Effect. پیشران این گردش‌کار سه‌مرحله‌ای را در فرم نمایش می‌دهد و دو مجموعه جریان نقدی هم‌دوره را به‌صورت period-by-period مقایسه می‌کند؛ اتصال این ورودی‌های تجمیعی به scheduleهای تفصیلی تولید، فروش، هزینه، سرمایه در گردش و تأمین مالی هنوز لازم است.
- در حالت توسعه، ارزش فرصت دارایی موجود باید به‌درستی منظور شود؛ ارزش دفتری با ارزش اقتصادی یا opportunity cost یکی نیست.
- مدل With Project باید شامل بنگاه موجود به‌علاوه سرمایه‌گذاری جدید باشد؛ Without Project مسیر ادامه فعالیت بنگاه را مستقل مدل کند.
- تفاوت جریان‌های نقدی هر دوره باید مبنای Incremental Cash Flow باشد؛ تفاضل دو NPV با افق یا مبنای زمانی متفاوت قابل قبول نیست.

## 8. Tutorial Manual: مجموعه آزمون‌های پذیرش

| نمونه Tutorial | قابلیت‌هایی که باید در پیشران بازسازی و آزموده شوند |
|---|---|
| Tomato Canning | Industrial، Opportunity Study، Financial Analysis، یک محصول، Sales Programme، Working Capital، وام، Net Income Statement، Cash Flow for Financial Planning، Discounted Cash Flow، NPV/NPVR/IRR/MIRR، Break-even، Balance Sheet، Ratios |
| Growmania Garments | Opportunity Study، Cost Allocation، Joint-venture Project، Value-added Analysis، پروژه چندمحصولی، تحلیل هزینه و تخصیص |
| Sahara Textile Mills | Feasibility Study، Joint-venture Project، Cost Centre Analysis، Cost Allocation، Economic Analysis، Foreign Exchange Effect، Employment Effects، چند محصول و برنامه تفصیلی |
| HRCR200 / نورد گرم کلاف | آزمون تطبیق صنعتی واقعی بر مبنای CAPEX/OPEX/Marketing و خروجی مالی مرجع |
| توسعه/بازسازی کارخانه موجود | آزمون مستقل با Starting Balances، دارایی ثابت و بدهی موجود، Without/With Project و Incremental Analysis |

## 9. Technical Manual: الزامات محصول و استقرار

Technical Manual مرجع الگوریتم مالی نیست؛ اما برای جایگزینی عملی نرم‌افزار باید قابلیت‌های محصولی زیر در معماری پیشران دیده شوند:
- نصب مستقل و اجرای چندکاربره/شبکه‌ای در معماری مدرن.
- مدیریت مجوز، نقش‌ها و تعداد کاربران هم‌زمان؛ بدون وابستگی به دانگل سخت‌افزاری قدیمی.
- بسته‌بندی نسخه دسکتاپ/وب/موبایل و کنترل نسخه.
- پشتیبان‌گیری، بازیابی، انتقال پروژه و قالب فایل.
- کنترل دسترسی و ثبت رویدادهای تغییر داده.
- راهنمای درون‌برنامه‌ای context-sensitive و پشتیبانی فنی.
- زبان رابط و زبان چاپ/گزارش باید مستقل از هم قابل انتخاب باشند.

## 10. معیار تکمیل هر قابلیت

هیچ قابلیت زمانی «تکمیل» تلقی نمی‌شود مگر اینکه هر شش مورد زیر وجود داشته باشد:
1. فرم ورودی و اعتبارسنجی.
2. ذخیره پایدار و نسخه‌بندی داده.
3. الگوریتم محاسباتی مستند.
4. گزارش و نمودار خروجی.
5. آزمون عددی با مثال Tutorial یا خروجی مرجع.
6. اصطلاحات فارسی/انگلیسی منطبق با Help و واژه‌نامه مشترک.

## 11. وضعیت فعلی و اولویت بعدی

- فرم Expansion/Rehabilitation اکنون Starting Balances را با تفکیک Work in Progress و Finished Product Inventory به ازای هر محصول، Other Assets، Liabilities، دوره‌های Liquidation/Payout دریافتنی و پرداختنی، Fixed Investment Items و Long-term Debt دریافت می‌کند. سرمایه افتتاحیه نیز به تفکیک Ordinary Capital و Preference Capital، شریک، Paid-in Capital، Capital Refund، Preferred Dividends و Export of Profit ثبت می‌شود. برای بدهی موجود موتور Annuity، Constant Principal و Profile پیاده‌سازی شده است: First Repayment Date، Number of Repayments، Repayment Frequency، Grace-period Interest، Capitalized Interest و Accrued Interest برای دو روش اول؛ در Profile نیز تاریخ/مبلغ اصل هر بازپرداخت و Month Interest Paid مستقل از بازپرداخت اصل محاسبه می‌شود. این ماژول هنوز کامل نیست: برنامه‌های بدهی به مدل اصلی جریان نقدی و گزارش‌ها متصل نشده‌اند؛ کارمزدهای تفصیلی (Agency/Guarantee/Commitment/Other)، موتور استهلاک و partial-year، تاریخچه و جایگزینی/فروش دارایی، اتصال کامل Foreign Currency Component و گزارش تطبیقی باید تکمیل شوند.
- Project Type شامل شش گروه COMFAR و Joint-venture Partner با فرم ثبت شرکا اضافه شده است. Study Level و گزینه‌های Special Features نیز در فرم Project Definition ذخیره می‌شوند؛ اما ساختارهای تفصیلی هر نوع پروژه و موتورهای Economic Analysis، Cost Centre، Cost Allocation، Value-added، Foreign Exchange و Employment هنوز پیاده‌سازی نشده‌اند.
- Incremental Analysis engine اکنون ورودی‌های غیرعددی و افق‌های ناهم‌تراز را رد می‌کند؛ آزمون‌های مرجع به validator اضافه شده‌اند.
- موتور استهلاک چهار روش `Linear to zero`، `Linear to scrap`، `Accelerated` و `Sum of years digits` در `calculateComfarAssetDepreciationSchedule` پیاده‌سازی شده است. سه روش نخست آزمون partial-year دارند؛ `Sum of years digits` برای سال ناقص یا ماه اضافه فعلاً fail-closed است تا فرمول هم‌پوشانی ماه‌ها با یک خروجی مرجع عددی مستقل تطبیق داده شود. قواعد تاریخ خرید و `Starting at` در همان سال نیز در نگاشت دوره‌ای لحاظ شده‌اند.
- موتور استهلاک چهار روش در `calculateComfarAssetDepreciationSchedule` پیاده‌سازی شده و آزمون‌های مرجع برای Linear to zero، Linear to scrap، Accelerated و Sum of years digits (سال کامل) دارد. حالت‌های partial-year برای سه روش نخست آزمون شده‌اند؛ Sum of years digits با دوره ناقص عمداً fail-closed است تا فرمول هم‌پوشانی ماه‌ها بدون تطبیق عددی مستقل فعال نشود. تابع `calculateComfarAssetLifecycle` اکنون فروش دارایی را در تاریخ تراز فروش اعمال می‌کند: استهلاک تا همان دوره، حذف ارزش دفتری از دارایی ثابت، محاسبه Return of capital و Other income/loss و تبدیل عواید ارزی با نرخ دوره فروش. دفتر Fixed Investment اکنون به تفکیک هر نوبت تحصیل به برنامه استهلاک و فروش متصل است؛ عواید فروش، Return of capital و Other income/loss به مدل یکپارچه جریان نقدی، مالیات و سه صورت مالی منتقل می‌شوند. برای فروش با ارز خارجی، نرخ دوره فروش از Project Foundation خوانده می‌شود. این اتصال فعلاً برای دوره‌بندی سالانه فعال است و فروش/جایگزینی مجدد دارایی و دوره‌بندی شش‌ماهه/فصلی/ماهانه هنوز خارج از دامنه این مرحله‌اند. گام بعد: کامل‌کردن دارایی‌های افتتاحیه در Starting Balances، آزمون با خروجی مرجع COMFAR، سپس تکمیل برنامه CAPEX دوره‌ای و گسترش مدل With/Without Project.


## 12. فونداسیون مشترک فرم‌های خام — وضعیت پیاده‌سازی

برای جلوگیری از طراحی جداگانه و ناسازگار فرم‌ها در هر صنعت، ساختار مستقل و نسخه‌بندی‌شده `ProjectFoundation` به مدل پروژه اضافه شده است. فرم مشترک آن در مرحله تعریف پروژه قرار گرفته و برای همه قالب‌ها قابل استفاده است.

اجزای فرم پایه:
- Planning Periods & Balance Date: تناوب سالانه/شش‌ماهه/فصلی/ماهانه، روز و ماه تراز، Valuation Date، Day-count Basis و Cash Flow Timing.
- Currencies & Exchange Rates: ارز محلی با کد ISO، ارزهای خارجی و نرخ تبدیل دوره‌ای هر ارز به ارز محلی.
- Cost Centres: فعال‌سازی تحلیل مراکز هزینه، کد و نام مرکز هزینه.
- Inflation & Price Indices: شاخص‌های قیمت برحسب ارز و نرخ تورم دوره‌ای.
- Discounting & Taxation: روش تنزیل، نرخ مالی و اقتصادی، نظام مالیاتی، انتقال زیان و نرخ مالیات به تفکیک دوره.

قواعد مهم:
- قالب خام هیچ نرخ ارز، نرخ تورم، نرخ مالیات یا نرخ تنزیل مالی را به‌صورت پیش‌فرض فرض نمی‌کند.
- اطلاعات پایه در یک شیء نسخه‌بندی‌شده و با مهاجرت سازگار با پروژه‌های ذخیره‌شده قبلی نگهداری می‌شود.
- اعتبارسنجی ساختاری برای کدهای تکراری ارز و مراکز هزینه، نرخ‌های نامعتبر، ارز محلی تعریف‌نشده و نرخ‌های مالیاتی/تورمی ناقص اضافه شده است.
- داده‌های FX، Inflation، Cost Centre، Discounting و Taxation هنوز به تمام scheduleهای محاسباتی و گزارش‌های نهایی متصل نشده‌اند؛ ثبت و اعتبارسنجی فرم، به‌تنهایی به معنی تکمیل موتور آن بخش‌ها نیست.

### دفتر عمومی Fixed Investment — وضعیت پیاده‌سازی
- فرم مشترک Fixed Investment Register به مرحله CAPEX اضافه شده و در مدل پروژه ذخیره می‌شود؛ برای هر Fixed Investment Item طبقه دارایی، منشأ محلی/خارجی، ارز، Cost Centre، شرایط استهلاک، Starting at، Rate، Length، Scrap، چند نوبت تحصیل در دوره‌های مختلف و چند Sale of Asset قابل ثبت است.
- برای خرید خارجی، Exchange Rate to Local Currency به تفکیک نوبت تحصیل اجباری است. ارز دارایی با منشأ آن کنترل می‌شود و هر ارز باید قبلاً در Project Foundation تعریف شده باشد.
- فروش دارایی با انتخاب acquisition مربوط، Date/Period of Sale، Local/Foreign Market و Sale at book value یا Self-defined price ثبت می‌شود.
- جمع دفتر دارایی به CAPEX تجمیعی اضافه نمی‌شود تا دوباره‌شماری رخ ندهد؛ اما برنامه استهلاک و فروش دارایی از همین دفتر به موتور مالی یکپارچه تغذیه می‌شود. مخارج دوره‌ای دفتر و ردیف‌های CAPEX تجمیعی هنوز باید با کنترل تطبیق به یکدیگر متصل شوند.
- دفتر دارایی فعلاً در قالب جدید قابل استفاده است؛ برای یکسان‌سازی فرم Starting Balances در Expansion/Rehabilitation با همین ساختار، مرحله مهاجرت/اشتراک کامپوننت باقی مانده است.

### گام بعدی فونداسیون
1. اتصال دفتر Fixed Investment به ردیف‌های CAPEX و برنامه مخارج هر دوره، با کنترل تطبیق جمع و جلوگیری از دوباره‌شماری.
2. تطبیق عددی برنامه Depreciation و Asset Sale با خروجی واقعی COMFAR، تکمیل Sum of years digits برای دوره ناقص، دارایی‌های افتتاحیه و چرخه فروش/جایگزینی.
3. تکمیل ساختار Production Costs، Sales Programme و Working Capital به‌صورت چندمحصولی و دوره‌ای.
4. یکسان‌سازی دفتر دارایی پروژه جدید با Starting Balances دارایی‌های ثابت در Expansion/Rehabilitation.
5. پس از تثبیت و آزمون فونداسیون خام، ورود داده‌های HRCR200 و تطبیق schedule به schedule با فایل‌های Excel و خروجی مرجع.
