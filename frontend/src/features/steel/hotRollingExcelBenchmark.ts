import type { FixedInvestmentItem, ProjectFoundation } from '../projects/projectFoundation'

const source='OPEX-HRCR200.Kashan.1402.07.10. rev01.xlsx · 1402/07/10'
const capexSource='CAPEX-HRCR200.Kashan.1402.07.10.rev01.xlsx · 1402/07/10'
const row=(id:string,name:string,quantity:number,unit:string,unitPrice:number,period:string,costGroup?:string)=>({
  id,name,quantity,unit,unitPrice,currency:'میلیون ریال',fxRate:1,period,source,sourceType:'گزارش/مستند',sourceDate:'1402-07-10',confidence:100,
  ...(costGroup?{costGroup}:{})
})
const department=(id:string,department:string,expert:number,technician:number,secretary:number,operator:number,driver:number,laborer:number)=>({id,department,expert,technician,secretary,operator,driver,laborer})


/** Upgrade the seeded HRCR asset register without overwriting user-edited amounts, rates or periods. */
export function migrateHotRollingCoilFixedInvestmentItems(
  savedItems: FixedInvestmentItem[],
  savedSeedVersion: number,
): FixedInvestmentItem[] {
  const defaults = createHotRollingCoilFixedInvestmentItems()
  if (savedSeedVersion < 1 && savedItems.length === 0) return defaults
  const defaultById = new Map(defaults.map(item => [item.id, item]))
  const migrated: FixedInvestmentItem[] = savedItems.map(saved => {
    const baseline = defaultById.get(saved.id)
    return {
      ...saved,
      costCentreId: saved.costCentreId ?? '',
      depreciationBasis: saved.depreciationBasis ?? baseline?.depreciationBasis ?? 'unresolved',
      depreciation: {
        ...saved.depreciation,
        lengthMonths: saved.depreciation?.lengthMonths ?? 0,
        firstDepreciationMonths: saved.depreciation?.firstDepreciationMonths ?? 12,
      },
      acquisitions: (saved.acquisitions ?? []).map(acquisition => ({
        ...acquisition,
        allocationBasis: acquisition.allocationBasis
          ?? baseline?.acquisitions.find(row => row.id === acquisition.id)?.allocationBasis
          ?? 'unallocated',
      })),
    }
  })
  const originalFixedAssetIds = defaults.filter(item => item.assetClass !== 'preproduction').map(item => item.id)
  const containsFullSeed = originalFixedAssetIds.every(id => migrated.some(item => item.id === id))
  if (savedSeedVersion < 2 && containsFullSeed && !migrated.some(item => item.assetClass === 'preproduction')) {
    const preproduction = defaults.find(item => item.assetClass === 'preproduction')
    if (preproduction) migrated.push({ ...preproduction, depreciationBasis: preproduction.depreciationBasis ?? 'unresolved' })
  }
  return migrated
}

export const EXCEL_HOT_ROLLING_200KT = {
  name:'پروژه آزمون مرجع نورد کلاف گرم ۲۰۰ هزار تن',
  location:'کاشان، ایران',
  owner:'مطالعه مرجع HRCR200',
  startYear:1402,
  constructionYears:2,
  life:15,
  currency:'میلیون ریال',
  fx:1,
  discountMode:'wacc' as const,
  manualRate:21,
  equity:70,
  debt:30,
  ke:30,
  kd:26,
  tax:5,
  waccTax:25,
  financeRate:26,
  reinvestmentRate:30,
  loans:[
    {id:'excel-loan-fixed',name:'وام بلندمدت سرمایه‌گذاری ثابت (۳۰٪ ساختار تأییدشده)',amount:5610850.8,currency:'میلیون ریال',fxRate:1,fxDate:'1402-07-10',annualRate:26,drawYear:1,graceYears:2,tenorYears:5,method:'اصل مساوی' as const,feeRate:0}
  ],
  capexSchedule:[68.0199181361,31.9800818639],
  nwcDays:30,
  workingCapitalDayBasis:360,
  depreciationYears:15,
  annualDepreciationOverride:1580327,
  terminalValueOverride:13954745.454709,
  salvagePct:0,
  opexFixedShare:100,
  staffOverheadRate:20,
  staffDepartments:[
    department('dept-management-office','دفتر مدیریت',1,1,1,0,1,1),
    department('dept-public-relations','روابط عمومی',1,0,1,0,1,1),
    department('dept-operation','بهره‌برداری',12,12,1,30,2,15),
    department('dept-maintenance','تعمیرات',12,12,1,15,0,6),
    department('dept-workshop','تعمیرگاه',8,8,1,10,0,6),
    department('dept-utilities','تأسیسات و پشتیبانی',7,7,2,10,8,3),
    department('dept-planning','برنامه‌ریزی تولید',2,0,1,0,0,0),
    department('dept-purchase','خرید',2,2,1,0,0,0),
    department('dept-sales','فروش',2,1,1,0,0,0),
    department('dept-warehouse','انبارها',2,0,0,0,0,6),
    department('dept-admin-finance','اداری و مالی',2,2,1,0,2,4),
    department('dept-services','خدمات',1,2,0,0,4,8),
    department('dept-it','سیستم‌های اطلاعاتی',1,1,1,0,0,0),
    department('dept-technical-control','کنترل فنی',2,3,1,2,1,0),
    department('dept-strategy','مطالعات و برنامه‌ریزی استراتژیک',2,0,0,0,0,0),
    department('dept-technical-support','پشتیبانی فنی',2,4,1,2,1,0),
    department('dept-quality-assurance','تضمین کیفیت',2,2,1,1,0,0),
    department('dept-quality-control','کنترل کیفیت',3,2,1,0,0,0),
    department('dept-development','توسعه',2,2,1,1,0,0)
  ],
  staff:[
    {id:'staff-management',title:'مدیر و معاون',count:3,monthlySalary:270,insurance:62.1,overtime:108,bonus:540,seniority:270},
    {id:'staff-supervisor',title:'رئیس و سرپرست',count:12,monthlySalary:189,insurance:43.47,overtime:75.6,bonus:378,seniority:189},
    {id:'staff-expert',title:'کارشناس',count:51,monthlySalary:135,insurance:31.05,overtime:54,bonus:270,seniority:135},
    {id:'staff-technician',title:'تکنسین',count:61,monthlySalary:108,insurance:24.84,overtime:43.2,bonus:216,seniority:108},
    {id:'staff-office',title:'کارمند دفتری و منشی',count:17,monthlySalary:97.2,insurance:22.356,overtime:38.88,bonus:194.4,seniority:97.2},
    {id:'staff-operator',title:'کارگر فنی و راننده',count:91,monthlySalary:81,insurance:18.63,overtime:32.4,bonus:162,seniority:81},
    {id:'staff-laborer',title:'کارگر ساده',count:50,monthlySalary:64.8,insurance:14.904,overtime:25.92,bonus:129.6,seniority:64.8}
  ],
  workingCapitalItems:[
    {id:'wc-raw',name:'موجودی مواد خام و مواد مصرفی',classification:'asset' as const,annualBase:0,days:30},
    {id:'wc-energy',name:'موجودی هزینه انرژی',classification:'asset' as const,annualBase:0,days:15},
    {id:'wc-spares',name:'قطعات یدکی مصرف‌شده',classification:'asset' as const,annualBase:0,days:30},
    {id:'wc-wip',name:'موجودی کالای در جریان ساخت',classification:'asset' as const,annualBase:0,days:3},
    {id:'wc-finished',name:'موجودی کالای ساخته‌شده',classification:'asset' as const,annualBase:0,days:5},
    {id:'wc-receivable',name:'حساب‌های دریافتنی',classification:'asset' as const,annualBase:0,days:0},
    {id:'wc-cash',name:'تنخواه و موجودی نقد داخلی',classification:'asset' as const,annualBase:0,days:60},
    {id:'wc-foreign-cash',name:'موجودی نقد خارجی',classification:'asset' as const,annualBase:0,days:60},
    {id:'wc-deposit',name:'سپرده کوتاه‌مدت',classification:'asset' as const,annualBase:0,days:0},
    {id:'wc-interest',name:'سپرده بهره‌دار',classification:'asset' as const,annualBase:0,days:0},
    {id:'wc-payables',name:'حساب‌های پرداختنی مواد خام',classification:'liability' as const,annualBase:0,days:0}
  ],
  products:[
    {id:'prod-coil',name:'کلاف گرم فولادی (با احتساب درآمد محصولات فرعی)',family:'کلاف گرم (Coil)',line:'line-coil',mix:100,grade:'عمومی',thkMin:1.5,thkMax:25,widthMin:600,widthMax:1500,lengthMin:0,lengthMax:0,diameterMin:0,diameterMax:0,weightMin:0,weightMax:0,price:311.298,unit:'میلیون ریال/تن'}
  ],
  lines:[
    {id:'line-coil',name:'خط نورد کلاف گرم ۲۰۰ هزار تن در سال',family:'Coil',feed:'اسلب',technology:'نورد گرم کلاف',capacity:200000,days:330,hours:24,shifts:3,availability:100,yield:100,plannedStop:0,unplannedStop:0,route:'اسلب ← کوره پیش‌گرم ← پوسته‌زدایی ← نورد خشن و نهایی ← خنک‌کاری ← کلاف‌پیچ',equipment:'کوره پیش‌گرم، دی‌اسکیلر، قفسه‌های نورد، سیستم خنک‌کاری و کلاف‌پیچ'}
  ],
  ramp:[70,80,90,100,100,100,100,100,100,100,100,100,100,100,100],
  density:7860,
  materialBalance:[
    row('mat-slab','اسلب فولادی (ضریب ضایعات ۲٪)',1.02,'تن اسلب/تن محصول',195.1,'به‌ازای هر تن'),
    row('mat-slab-freight','حمل اسلب از تأمین‌کننده',1020,'کیلوگرم/تن محصول',0.003847,'به‌ازای هر تن')
  ],
  processConsumables:[
    row('con-work-roll','غلتک کاری',0.6048,'کیلوگرم/تن محصول',1,'به‌ازای هر تن'),
    row('con-backup-roll','غلتک پشتیبان',0.061,'کیلوگرم/تن محصول',0.55,'به‌ازای هر تن'),
    row('con-edger-roll','غلتک Edger',0.0158,'کیلوگرم/تن محصول',0.55,'به‌ازای هر تن'),
    row('con-pinch-roll','غلتک Pinch Roll',0.0081,'کیلوگرم/تن محصول',0.55,'به‌ازای هر تن'),
    row('con-compressed-air','هوای فشرده ۶ بار',23.6,'Nm³/تن محصول',0.02,'به‌ازای هر تن'),
    row('con-hydraulic-oil','روغن هیدرولیک',0.03,'لیتر/تن محصول',0.6,'به‌ازای هر تن'),
    row('con-industrial-oil','روغن صنعتی',0.14,'لیتر/تن محصول',0.65,'به‌ازای هر تن'),
    row('con-grease','گریس',0.07,'کیلوگرم/تن محصول',0.9,'به‌ازای هر تن')
  ],
  utilities:[
    row('util-water','آب صنعتی',0.8,'مترمکعب/تن',0.09897854,'به‌ازای هر تن'),
    row('util-electricity','برق مصرفی با ضریب اوج بار و تلفات ۱۰٪',100,'kWh/تن',0.00995225,'به‌ازای هر تن'),
    row('util-gas','گاز طبیعی',47,'Nm³/تن',0.005819,'به‌ازای هر تن')
  ],
  spareParts:[
    row('spare-parts','لوازم یدکی (۲٪ ارزش کل تجهیزات)',1,'میلیون ریال/سال',176473.792,'سالانه')
  ],
  maintenance:[
    row('maint-industrial-building','تعمیر و نگهداری ساختمان صنعتی',1,'میلیون ریال/سال',40320,'سالانه'),
    row('maint-nonindustrial-building','تعمیر و نگهداری ساختمان غیرصنعتی',1,'میلیون ریال/سال',7628,'سالانه'),
    row('maint-machinery','تعمیر و نگهداری ماشین‌آلات',1,'میلیون ریال/سال',209455,'سالانه'),
    row('maint-utilities','تعمیر و نگهداری تأسیسات زیربنایی',1,'میلیون ریال/سال',56943,'سالانه'),
    row('maint-vehicles','تعمیر و نگهداری وسائط نقلیه',1,'میلیون ریال/سال',52851,'سالانه'),
    row('maint-office','تعمیر و نگهداری تجهیزات اداری',1,'میلیون ریال/سال',7563,'سالانه')
  ],
  capex:[
    {...row('capex-land','خرید زمین',1,'مجموع',2015000,'یک‌باره','زمین'),source:capexSource,origin:'داخلی'},
    {...row('capex-site','محوطه‌سازی و آماده‌سازی سایت',1,'مجموع',430007.7606094665,'یک‌باره','محوطه‌سازی'),source:capexSource,origin:'داخلی'},
    {...row('capex-industrial-building','ساختمان‌های صنعتی',1,'مجموع',2016000,'یک‌باره','ساختمان و ابنیه'),source:capexSource,origin:'داخلی'},
    {...row('capex-nonindustrial-building','ساختمان‌های غیرصنعتی',1,'مجموع',381422.057,'یک‌باره','ساختمان و ابنیه'),source:capexSource,origin:'داخلی'},
    {...row('capex-machinery-foreign','ماشین‌آلات و تجهیزات ـ سهم خارجی',1,'مجموع',9502740,'یک‌باره','ماشین‌آلات'),source:capexSource,origin:'خارجی'},
    {...row('capex-machinery-local','ماشین‌آلات و تجهیزات ـ سهم داخلی',1,'مجموع',970000,'یک‌باره','ماشین‌آلات'),source:capexSource,origin:'داخلی'},
    {...row('capex-utilities','تأسیسات زیربنایی',1,'مجموع',1707981.4,'یک‌باره','تأسیسات'),source:capexSource,origin:'داخلی'},
    {...row('capex-vehicles','وسائط نقلیه',1,'مجموع',490500,'یک‌باره','سایر'),source:capexSource,origin:'داخلی'},
    {...row('capex-office','تجهیزات اداری و خدماتی',1,'مجموع',70166.50296,'یک‌باره','سایر'),source:capexSource,origin:'داخلی'},
    {...row('capex-contingency','هزینه‌های احتمالی و پیش‌بینی‌نشده',1,'مجموع',879191,'یک‌باره','هزینه‌های غیرمستقیم'),source:capexSource,origin:'داخلی'},
    {...row('capex-preoperation','هزینه‌های قبل از بهره‌برداری',1,'مجموع',239826.63796,'یک‌باره','هزینه‌های غیرمستقیم'),source:capexSource,origin:'داخلی'}
  ],
  opex:[
    row('opex-factory-overhead','سایر هزینه‌های بالاسری کارخانه (۵٪ مبنای اکسل)',1,'میلیون ریال/سال',159060,'سالانه','سربار کارخانه'),
    row('opex-marketing','بازاریابی مستقیم (۰٫۱٪ فروش طبق فرمول سلول)',1,'تن محصول',0.311298,'به‌ازای هر تن','بازاریابی')
  ],
  market:[],
  notes:'پروژه آزمون مرجع بر مبنای دو فایل Excel HRCR200 کاشان با تاریخ ۱۴۰۲/۰۷/۱۰ ساخته شده است. ظرفیت ۲۰۰٬۰۰۰ تن در سال، قیمت موزون فروش ۳۱۱٫۲۹۸ میلیون ریال بر تن، هزینه‌های عملیاتی، نیروی انسانی و سرمایه در گردش از شیت‌های مرجع استخراج شده‌اند. برچسب‌های تأمین مالی فایل اکسل با مبالغ واقعی سازگار نیستند: برچسب خلاصه OPEX از ۸۰/۲۰ و برچسب جدول تأمین منابع از ۷۰/۲۰ سخن می‌گوید، اما مبالغ واقعی ساخت (۱۳٬۰۹۱٬۹۸۵٫۲۰ آورده و ۵٬۶۱۰٬۸۵۰٫۸۰ وام) نسبت تقریبی ۷۰/۳۰ آورده/بدهی را نشان می‌دهند. سرمایه در گردش ۴٬۵۹۵٬۳۷۰٫۴۶ است و فقط وام ۳٬۳۰۹٬۱۴۴٫۵۳ برای آن شناسایی شده؛ شکاف ۱٬۲۸۶٬۲۲۵٫۹۳ منبع قطعی ندارد. سناریوی پروژه پیشران طبق درخواست حامی ۲۰/۸۰ باقی می‌ماند و سناریوی ۷۰/۳۰ فقط برای مقایسه با خروجی مرجع نگهداری می‌شود. نرخ WACC بازحساب‌شده با هزینه حقوق صاحبان سهام ۳۰٪، هزینه بدهی ۲۶٪ و سپر مالیاتی ۲۵٪ برابر ۲۶٫۸۵٪ است. نرخ ۲۱٪ شیت IRR-NPV فقط به‌عنوان نرخ تاریخی گزارش منبع نگهداری شده و WACC ساختار تأییدشده نیست. منبع تأمین سرمایه در گردش در فایل صریح نیست و در تسهیلات مدل به‌عنوان بدهی جدید فرض نشده است. مالیات عملیاتی ۵٪ از شیت قیمت فروش و نرخ مالیات سپر WACC برابر ۲۵٪ جداگانه نگهداری شده‌اند. جریان‌های نقدی مرجع reference در آزمون مستقل شاخص‌های مالی استفاده می‌شوند و نباید با جریان نقدی تولیدشده توسط موتور پیشران یکی فرض شوند.'
} as const


/** Cached reference values from the original Excel sheets and the reference cash-flow export. */
export const EXCEL_REFERENCE_EXPECTED = {
  capacity:200000,
  rawMaterials:40844287,
  energy:269580.16640000005,
  processConsumables:259099,
  spareParts:176473.792,
  maintenance:374760,
  payrollBase:650052.8640000001,
  payrollOverhead:130010.57280000002,
  payrollTotal:780063.4368000001,
  factoryOverhead:159060,
  marketing:62259.6,
  depreciation:1580327,
  opexWithoutDepreciation:42666484.392,
  opexWithDepreciation:44246811.392,
  workingCapital:4595370.457200001,
  fixedInvestment:18463008.720569465,
  preOperatingCost:239826.63796,
  totalInvestment:18702835.358529467,
  wacc:0.21284299025331596,
  roundedDiscountRate:0.21,
  irrNpvSheetReportedNpvAt21:18509558.82096656,
  npvAtExactWacc:18039663.975015666,
  irrNpvSheetReportedIrr:0.43378234116396674,
  irrNpvSheetReportedMirr:0.33865108092920493,
  financeRate:0.26,
  reinvestmentRate:0.30,
  /** Row 9, periods C:S in OPEX sheet "IRR-NPV". This is the difference of rows 7 and 8, both labelled discounted cash flows; it is retained only to reproduce the sheet's reported metrics, not as a raw unlevered project cash-flow vector. */
  referenceIrrNpvNetDiscountedCashFlows:[
    -7908572.82,-5905218.02,3926279.2047649994,8140613.077362001,
    8941506.638881996,9688834.216513,9860858.381308004,9573587.738720998,
    9520342.875225,9520342.875225,9520342.875225,9520342.875225,
    9520342.875225,9520342.875225,9520342.875225,9520342.875225,
    23475088.329934
  ],
  sourceNotes:[
    'The OPEX workbook uses 360 days per year for working-capital turnover.',
    'The IRR-NPV sheet calculates NPV by applying NPV() to row 9, which is itself the difference between two rows labelled discounted cash flows; its IRR/MIRR also use this row. These are source-reported figures, not a verified raw project cash-flow basis.',
    'The IRR-NPV sheet total-investment link is 16,587,131.78 million IRR, while CAPEX fixed investment is 18,463,008.72 and total project investment including construction interest and working capital is 26,596,838.88 million IRR.',
    'The CAPEX workbook calculates WACC at 21.284299%; the OPEX IRR-NPV sheet rounds the discount rate to 21%.',
    'The 5% operating tax in the sales sheet and 25% WACC tax shield in the CAPEX discount-rate sheet are separate source assumptions.',
    'IRR-NPV cash flows are imported from reference and are not calculated by the source Excel workbook from the operating-cost tabs.'
  ]
} as const

/** Project cash-flow vector generated by Pishran's current unlevered project-CF rules from this fixture. */
export const PISHRAN_REFERENCE_MODEL_OUTPUT = {
  projectCashFlows:[
    -12721653.300001308,-5981182.058528159,9466927.362944,14227079.594456,
    16230009.551648002,18232939.508840006,18692476.554560006,18692476.554560006,
    18692476.554560006,18692476.554560006,18692476.554560006,18692476.554560006,
    18657688.47248648,18613460.204560008,18613460.204560008,18613460.204560008,
    37163576.11646901
  ],
  npvAt21Percent:42389832.7876326,
  npvAt25Percent:31361823.28372246,
  irr:0.5457016329570905,
  mirr:0.36645116868762795

} as const

/** Asset-level fixed-investment register seeded from the HRCR200 CAPEX/OPEX workbooks. */
export const HOT_ROLLING_FIXED_ASSET_REFERENCE = {
  fixedInvestmentTotal: 18_463_008.720569465,
  foreignMachineryEur: 18_135_000,
  foreignMachineryLocalEquivalent: 9_502_740,
  localMachinery: 970_000,
  depreciableInfrastructure: 1_423_564,
  nonDepreciableInfrastructure: 284_417.4,
  preProductionCostOutsideFixedInvestment: 239_826.63796,
  conditionsTableFirstYearDepreciation: 1_432_000.0916753965,
  seededRegisterFirstYearDepreciation: 1_582_725.9696743963,
  seededRegisterFirstYearVarianceToComfar: 150_171.6296743963,
  seededRegisterVsOpexScheduleVariance: 2_398.9696743963,
  opexScheduleAnnualDepreciation: 1_580_327,
  comfarFirstYearDepreciation: 1_432_554.34,
  comfarFirstYearVariance: 554.2483246035408,
  conditionsTableEngineByYear: [
    [1405,1_432_000.0916754],[1406,1_432_000.0916754],[1407,1_432_000.0916754],[1408,1_432_000.0916754],
    [1409,1_416_212.6285094],
    [1410,1_327_922.6285094],[1411,1_327_922.6285094],[1412,1_327_922.6285094],[1413,1_327_922.6285094],[1414,1_327_922.6285094],
    [1415,178_128.0785094],[1416,178_128.0785094],[1417,178_128.0785094],[1418,178_128.0785094],
    [1419,50_893.73671697]
  ] as const,
  seededRegisterEngineByYear: [
    [1405,1_582_725.9696744],[1406,1_582_725.9696744],[1407,1_582_725.9696744],[1408,1_582_725.9696744],
    [1409,1_566_938.5065],
    [1410,1_478_648.5065],[1411,1_478_648.5065],[1412,1_478_648.5065],
    [1413,1_376_151.8985],[1414,401_632.072478],
    [1415,178_128.0785094],[1416,178_128.0785094],[1417,178_128.0785094],[1418,178_128.0785094],
    [1419,50_893.73671697]
  ] as const,
  comfarDepreciationByYear: [
    [1405,1_432_554.34],[1406,1_432_554.34],[1407,1_432_554.34],
    [1408,1_425_537.64],[1409,1_365_962.59],
    [1410,1_316_912.59],[1411,1_316_912.59],[1412,1_316_912.59],[1413,1_316_912.59],
    [1414,98_840.49],[1415,98_840.49],[1416,98_840.49],
    [1417,94_540.41],[1418,60_745.69],[1419,52_751.46]
  ] as const,
  source: 'CAPEX/OPEX HRCR200 workbooks and COMFAR output pages 3–4 and 24–27',
} as const

export function createHotRollingCoilFixedInvestmentItems(): FixedInvestmentItem[] {
  const localAcquisition = (id: string, period: string, amount: number, allocationBasis: 'source-period' | 'user-confirmed' | 'proportional-estimate' = 'proportional-estimate') => ({
    id, period, quantity: 1, unitPrice: amount, currencyCode: 'IRR', exchangeRateToLocal: null, allocationBasis
  })
  const foreignAcquisition = (id: string, period: string, eurAmount: number, allocationBasis: 'source-period' | 'user-confirmed' | 'proportional-estimate' = 'proportional-estimate') => ({
    id, period, quantity: 1, unitPrice: eurAmount, currencyCode: 'EUR', exchangeRateToLocal: 0.524, allocationBasis
  })
  const depreciation = (ratePercent: number, scrapPercent: number) => ({
    method: 'linear-scrap' as const, startingAt: '1405-01-01', ratePercent,
    lengthYears: 100 / ratePercent, lengthMonths: 0, firstDepreciationMonths: 12, scrapPercent
  })
  const nonDepreciated = (scrapPercent = 0) => ({
    method: 'none' as const, startingAt: '', ratePercent: null, lengthYears: null,
    lengthMonths: 0, firstDepreciationMonths: 12, scrapPercent
  })
  const item = (
    id: string, description: string, assetClass: FixedInvestmentItem['assetClass'],
    origin: FixedInvestmentItem['origin'], currencyCode: string,
    depreciationConditions: FixedInvestmentItem['depreciation'],
    acquisitions: FixedInvestmentItem['acquisitions'],
    depreciationBasis: NonNullable<FixedInvestmentItem['depreciationBasis']> = 'source-table'
  ): FixedInvestmentItem => ({
    id, description, assetClass, origin, currencyCode, costCentreId: '',
    depreciation: depreciationConditions, depreciationBasis, acquisitions, sales: []
  })
  const siteTotal = 430_007.7606094665
  const buildingTotal = 2_397_422.057
  const utilityComponents = {
    infrastructureDepreciable: 1_423_564,
    infrastructureNonDepreciable: 284_417.4,
    vehicles: 490_500,
    office: 70_166.50296,
  }
  const utilityComponentTotal = Object.values(utilityComponents).reduce((sum, amount) => sum + amount, 0)
  const utilityFirstPeriodShare = 722_627.7 / utilityComponentTotal
  const utilitySplit = (amount: number) => [amount * utilityFirstPeriodShare, amount * (1 - utilityFirstPeriodShare)]
  const [infrastructureDep1403, infrastructureDep1404] = utilitySplit(utilityComponents.infrastructureDepreciable)
  const [infrastructureNonDep1403, infrastructureNonDep1404] = utilitySplit(utilityComponents.infrastructureNonDepreciable)
  const [vehicles1403, vehicles1404] = utilitySplit(utilityComponents.vehicles)
  const [office1403, office1404] = utilitySplit(utilityComponents.office)
  return [
    item('hrcr-land','خرید زمین','land','local','IRR',nonDepreciated(100),[
      localAcquisition('hrcr-land-1403','1403',2_015_000,'source-period')
    ]),
    item('hrcr-site','محوطه‌سازی و آماده‌سازی سایت','site','local','IRR',depreciation(7,10),[
      localAcquisition('hrcr-site-1403','1403',126_360.2406094665,'source-period'),
      localAcquisition('hrcr-site-1404','1404',siteTotal-126_360.2406094665,'source-period')
    ]),
    item('hrcr-buildings','ساختمان‌های صنعتی و غیرصنعتی','buildings','local','IRR',depreciation(7,10),[
      localAcquisition('hrcr-buildings-1403','1403',1_084_284.4,'source-period'),
      localAcquisition('hrcr-buildings-1404','1404',buildingTotal-1_084_284.4,'source-period')
    ]),
    item('hrcr-machinery-foreign','ماشین‌آلات و تجهیزات ـ سهم خارجی','machinery','foreign','EUR',depreciation(10.97955,10),[
      foreignAcquisition('hrcr-machinery-foreign-1403','1403',14_508_000),
      foreignAcquisition('hrcr-machinery-foreign-1404','1404',3_627_000)
    ],'source-conflict'),
    item('hrcr-machinery-local','ماشین‌آلات و تجهیزات ـ سهم داخلی','machinery','local','IRR',depreciation(10.97955,10),[
      localAcquisition('hrcr-machinery-local-1403','1403',485_000),
      localAcquisition('hrcr-machinery-local-1404','1404',485_000)
    ],'source-conflict'),
    item('hrcr-infrastructure-depreciable','تأسیسات زیربنایی ـ بخش مشمول استهلاک','infrastructure','local','IRR',depreciation(12,10),[
      localAcquisition('hrcr-infrastructure-dep-1403','1403',infrastructureDep1403),
      localAcquisition('hrcr-infrastructure-dep-1404','1404',infrastructureDep1404)
    ],'source-conflict'),
    item('hrcr-infrastructure-nondepreciable','تأسیسات زیربنایی ـ سهم نیازمند طبقه‌بندی استهلاک','infrastructure','local','IRR',nonDepreciated(),[
      localAcquisition('hrcr-infrastructure-nondep-1403','1403',infrastructureNonDep1403),
      localAcquisition('hrcr-infrastructure-nondep-1404','1404',infrastructureNonDep1404)
    ],'unresolved'),
    item('hrcr-vehicles','وسائط نقلیه','vehicles','local','IRR',depreciation(20,10),[
      localAcquisition('hrcr-vehicles-1403','1403',vehicles1403),
      localAcquisition('hrcr-vehicles-1404','1404',vehicles1404)
    ]),
    item('hrcr-office','تجهیزات اداری و خدماتی','office','local','IRR',depreciation(25,10),[
      localAcquisition('hrcr-office-1403','1403',office1403),
      localAcquisition('hrcr-office-1404','1404',office1404)
    ]),
    item('hrcr-contingencies','هزینه‌های احتمالی سرمایه‌ای ـ مبنای استهلاک نیازمند تطبیق','other','local','IRR',depreciation(10,0),[
      localAcquisition('hrcr-contingencies-1403','1403',439_595.5,'source-period'),
      localAcquisition('hrcr-contingencies-1404','1404',439_595.5,'source-period')
    ],'source-conflict'),
    item('hrcr-preproduction','هزینه‌های قبل از بهره‌برداری','preproduction','local','IRR',depreciation(10,0),[
      localAcquisition('hrcr-preproduction-1403','1403',119_913.31898),
      localAcquisition('hrcr-preproduction-1404','1404',119_913.31898)
    ],'source-conflict')
  ]
}

export function createHotRollingCoilProjectFoundation(): ProjectFoundation {
  return {
    schemaVersion: 1,
    planning: {
      periodFrequency: 'annual', projectStartDate: '', projectEndDate: '', fiscalYearStartMonth: null,
      balanceDateMonth: 12, balanceDateDay: null, dayCountBasis: 365, valuationDate: '2026-03-20', discountConvention: 'period-count', cashFlowTiming: 'period-end'
    },
    currencies: {
      localCurrencyCode: 'IRR', localCurrencyName: 'میلیون ریال',
      foreignCurrencies: [{
        id: 'currency-eur', code: 'EUR', name: 'یورو',
        exchangeRates: [{ period: '1403', rateToLocal: 0.524 }, { period: '1404', rateToLocal: 0.524 }]
      }]
    },
    costCentres: { active: false, items: [] },
    inflation: { active: false, indices: [] },
    discounting: { method: 'manual', financialRatePercent: 25, economicRatePercent: null },
    taxation: {
      system: 'corporate', lossCarryForward: true, lossCarryForwardYears: null,
      rates: Array.from({length:15},(_,index)=>({id:`tax-${1405+index}`,period:String(1405+index),ratePercent:25}))
    }
  }
}

export function mergeHotRollingCoilProjectFoundation(saved: unknown): ProjectFoundation {
  const defaults = createHotRollingCoilProjectFoundation()
  if (!saved || typeof saved !== 'object') return defaults
  const value = saved as Partial<ProjectFoundation>
  const planning = value.planning ?? defaults.planning
  const currencies = value.currencies ?? defaults.currencies
  const discounting = value.discounting ?? defaults.discounting
  const taxation = value.taxation ?? defaults.taxation
  return {
    ...defaults, ...value,
    planning: {
      ...defaults.planning, ...planning,
      periodFrequency: planning.periodFrequency === 'unspecified' ? defaults.planning.periodFrequency : planning.periodFrequency,
      balanceDateMonth: planning.balanceDateMonth ?? defaults.planning.balanceDateMonth,
      dayCountBasis: planning.dayCountBasis ?? defaults.planning.dayCountBasis,
      valuationDate: /^\d{4}-\d{2}-\d{2}$/.test(planning.valuationDate || '') ? planning.valuationDate : defaults.planning.valuationDate,
      cashFlowTiming: planning.cashFlowTiming === 'unspecified' ? defaults.planning.cashFlowTiming : planning.cashFlowTiming
    },
    currencies: {
      ...defaults.currencies, ...currencies,
      localCurrencyCode: currencies.localCurrencyCode || defaults.currencies.localCurrencyCode,
      localCurrencyName: currencies.localCurrencyName || defaults.currencies.localCurrencyName,
      foreignCurrencies: currencies.foreignCurrencies?.length ? currencies.foreignCurrencies : defaults.currencies.foreignCurrencies
    },
    costCentres: { ...defaults.costCentres, ...value.costCentres, items: value.costCentres?.items ?? defaults.costCentres.items },
    inflation: { ...defaults.inflation, ...value.inflation, indices: value.inflation?.indices ?? defaults.inflation.indices },
    discounting: {
      ...defaults.discounting, ...discounting,
      method: discounting.method === 'unspecified' ? defaults.discounting.method : discounting.method,
      financialRatePercent: discounting.financialRatePercent ?? defaults.discounting.financialRatePercent
    },
    taxation: {
      ...defaults.taxation, ...taxation,
      system: taxation.system === 'unspecified' ? defaults.taxation.system : taxation.system,
      lossCarryForward: taxation.lossCarryForward ?? defaults.taxation.lossCarryForward,
      rates: taxation.rates?.length ? taxation.rates : defaults.taxation.rates
    }
  }
}


/** Reconstructed 20-quarter 7%-per-quarter annuity control from the PDF's 28% annual rate and OPEX annual principal schedule. */
const hrcr200QuarterlyPayment = 840_992.2672863001
const hrcr200QuarterlyAnnuityReference = (() => {
  let openingBalance = 8_909_484.06
  return Array.from({length:20},(_,index)=>{
    const interestExpense = openingBalance * 0.07
    const principal = Math.min(openingBalance,hrcr200QuarterlyPayment-interestExpense)
    const closingBalance = Math.max(0,openingBalance-principal)
    const row = {quarter:index+1,openingBalance,interestExpense,principal,debtService:hrcr200QuarterlyPayment,closingBalance}
    openingBalance = closingBalance
    return row
  })
})()

/** Exact annual project cash-flow and tax controls transcribed from COMFAR III output. */
export const HOT_ROLLING_COMFAR_OUTPUT_AUDIT = {
  source: 'COMFAR III - 001 - نتایج تحلیل مالی و اقتصادی طرح · pages 2, 24–27, 59–62 and 67–73; OPEX workbook · جریانات نقدی مالی (کامفار), periods 1–17',
  valuationDate: '2026-03-20',
  discountRatePercent: 25,
  discountConvention: 'period-count' as const,
  cashFlowTiming: 'period-end' as const,
  constructionYears: [1403, 1404],
  operatingYears: Array.from({length:15},(_,index)=>1405+index),
  /** Cash flows by project year 1403–1419; terminal salvage is recorded separately below. */
  projectCashFlowsByYear: [
    -13_907_805.03,-8_093_664.03,9_602_342.59,14_451_793.80,16_364_704.85,
    18_303_107.76,18_712_850.68,15_024_064.82,15_024_064.82,15_024_064.82,
    15_024_064.82,14_719_546.80,14_719_546.80,14_719_546.80,14_718_471.78,
    14_710_023.10,14_708_024.54
  ],
  terminalSalvage: {
    displayedYear: 1420,
    amount: 13_735_466.82,
    includedAtFinalOperatingPeriodForNpvAndIrr: true
  },
  /** COMFAR discounts the salvage column at the final operating-period date in its reported schedule. */
  projectCashFlowsForIrr: [
    -13_907_805.03,-8_093_664.03,9_602_342.59,14_451_793.80,16_364_704.85,
    18_303_107.76,18_712_850.68,15_024_064.82,15_024_064.82,15_024_064.82,
    15_024_064.82,14_719_546.80,14_719_546.80,14_719_546.80,14_718_471.78,
    14_710_023.10,14_708_024.54 + 13_735_466.82
  ],
  taxScheduleByOperatingYear: Array.from({length:15},(_,index)=>({
    year:1405+index,
    ratePercent:index<5?5:25
  })),
  depreciationByOperatingYear: HOT_ROLLING_FIXED_ASSET_REFERENCE.comfarDepreciationByYear,
  changeInWorkingCapitalByOperatingYear: [
    [1405,3_309_144.53],[1406,409_216.09],[1407,441_167.49],[1408,441_167.49],
    [1409,-5_325.23],[1410,0],[1411,0],[1412,0],[1413,0],[1414,0],
    [1415,0],[1416,0],[1417,0],[1418,0],[1419,0]
  ] as const,
  projectNpvAt25: 31_399_764.27,
  projectIrrPercent: 48.31,
  projectMirrPercent: 28.03,
  /** Annual finance transactions from OPEX workbook sheet "جریانات نقدی مالی (کامفار)", periods mapped to 1403–1419. */
  financingCashFlowsByYear: [
    {year:1403,equity:8_905_157.30,longTermLoanNet:5_002_647.728981,shortTermFinancing:0,totalDomesticFinancing:13_907_805.028981},
    {year:1404,equity:4_186_827.70,longTermLoanNet:3_906_836.328126,shortTermFinancing:0,totalDomesticFinancing:8_093_664.028126},
    {year:1405,equity:3_309_144.53,longTermLoanNet:-964_925.632872,shortTermFinancing:0,totalDomesticFinancing:2_344_218.897128},
    {year:1406,equity:0,longTermLoanNet:-1_264_820.669515,shortTermFinancing:0,totalDomesticFinancing:-1_264_820.669515},
    {year:1407,equity:0,longTermLoanNet:-1_657_921.886966,shortTermFinancing:0,totalDomesticFinancing:-1_657_921.886966},
    {year:1408,equity:0,longTermLoanNet:-2_173_197.394327,shortTermFinancing:0,totalDomesticFinancing:-2_173_197.394327},
    {year:1409,equity:0,longTermLoanNet:-2_848_618.473426,shortTermFinancing:0,totalDomesticFinancing:-2_848_618.473426},
    ...Array.from({length:10},(_,index)=>({year:1410+index,equity:0,longTermLoanNet:0,shortTermFinancing:0,totalDomesticFinancing:0}))
  ] as const,
  firstOperatingYearWorkingCapitalFunding: {
    comfarEquityContribution:3_309_144.53,
    fullCapacityWorkingCapital:4_595_370.46,
    opexFirstYearWorkingCapitalRequirement:3_216_759.32004,
    excessFundingAgainstOpexFirstYearRequirement:92_385.20996,
    shortTermFinancingInComfarSchedule:0,
    capexWorkbookAlternativeLongTermWorkingCapitalLoan:3_309_144.525623,
    capexWorkbookAlternativeLoanSchedule: {
      fixedAssetLoan1Principal:3_816_495.99,
      fixedAssetLoan2Principal:1_794_354.81,
      workingCapitalLoanPrincipal:3_309_144.525623,
      statedAnnualRatePercent:26,
      effectiveQuarterlyRatePercent:7.333349618787344,
      installmentCount:20,
      quarterlyPayments:[369_636.70168048906,173_787.5253506871,320_498.5072800594],
      aggregateQuarterlyPayment:863_922.7343112356,
      aggregateTotalDebtService:17_278_454.686224714,
      workingCapitalLoanTotalDebtService:6_409_970.145601188
    }
  },
  /** Loan balance and first-year service independently reconstructed from report pp. 129–131 and COMFAR annuity rules. */
  loanRepaymentAudit: {
    principalDisbursed: 5_610_850.80,
    constructionCapitalizedInterest: 3_298_633.06,
    openingRepaymentBalance: 8_909_484.06,
    statedAnnualRatePercent: 28,
    repaymentFrequencyPerYear: 4,
    installmentCount: 20,
    repaymentMethod: 'annuity' as const,
    quarterlyPayment: 840_992.2672863001,
    quarterlySchedule: hrcr200QuarterlyAnnuityReference,
    firstOperatingYearInterest: 2_399_043.4359598644,
    firstOperatingYearPrincipal: 964_925.6331853358,
    firstOperatingYearDebtService: 3_363_969.0691452003,
    annualPrincipalRepaymentsByYear: [
      964_925.632872,1_264_820.669515,1_657_921.886966,2_173_197.394327,2_848_618.473426
    ],
    /** Annual interest reconstructed as four equal quarterly annuity payments less the OPEX-reconciled annual principal. */
    annualInterestByYear: [
      2_399_043.436273,2_099_148.399630,1_706_047.182179,1_190_771.674818,515_350.595719
    ],
    annualDebtServiceByYear: Array(5).fill(3_363_969.069145) as readonly number[],
  },
  equityNpvAt30: 23_579_675.01,
  equityIrrPercent: 57.99,
  equityMirrPercent: 30.90,
  sourceNotes: [
    'Corporate tax is 5% in operating years 1405–1409 and 25% from 1410 through 1419 in the COMFAR cash-flow-for-financial-planning schedule.',
    'The terminal salvage value is printed in a separate 1420 column but discounted at the end-of-final-operating-period date in the COMFAR total-investment discounted cash-flow schedule.',
    'The OPEX workbook sheet جریانات نقدی مالی (کامفار) maps 17 periods to 1403–1419: equity contributions are 8,905,157.30, 4,186,827.70 and 3,309,144.53 in the first three years; short-term financing is zero in all 17 years.',
    'The report PDF conflicts on first-year working-capital funding: printed p.122 says short-term loan, while p.128 says shareholder; the OPEX COMFAR financial-flow schedule classifies 3,309,144.53 as equity and short-term financing as zero.',
    'The CAPEX workbook financing-mechanism/WACC tabs label 3,309,144.53 as a long-term working-capital loan; retain this as a separate workbook alternative, not the COMFAR cash-flow baseline.',
    'The CAPEX workbook repayment schedule separately models three 20-quarter annuity loans at a 7.33335% effective quarterly rate (26% stated annual): fixed-asset tranches 3,816,495.99 and 1,794,354.81, plus a 3,309,144.53 working-capital tranche. Their combined instalment is 863,922.73 per quarter, distinct from the COMFAR-reconstructed 840,992.27; do not combine these scenarios.',
    'The OPEX working-capital sheet calculates first-year net working capital of 3,216,759.32; the COMFAR finance-flow equity contribution is 92,385.21 higher and must remain visible as a cash funding buffer pending detailed source reconciliation.',
    'The active Pishran user scenario with a uniform 25% tax rate is a separate case and must not be labelled as an exact COMFAR tax-basis match.'
  ]
} as const
