const source='OPEX-HRCR200.Kashan.1402.07.10. rev01.xlsx · 1402/07/10'
const capexSource='CAPEX-HRCR200.Kashan.1402.07.10.rev01.xlsx · 1402/07/10'
const row=(id:string,name:string,quantity:number,unit:string,unitPrice:number,period:string,costGroup?:string)=>({
  id,name,quantity,unit,unitPrice,currency:'میلیون ریال',fxRate:1,period,source,sourceType:'گزارش/مستند',sourceDate:'1402-07-10',confidence:100,
  ...(costGroup?{costGroup}:{})
})
const department=(id:string,department:string,expert:number,technician:number,secretary:number,operator:number,driver:number,laborer:number)=>({id,department,expert,technician,secretary,operator,driver,laborer})

export const EXCEL_HOT_ROLLING_200KT = {
  name:'پروژه آزمون مرجع نورد کلاف گرم ۲۰۰ هزار تن',
  location:'کاشان، ایران',
  owner:'مطالعه مرجع HRCR200',
  startYear:1402,
  constructionYears:2,
  life:15,
  currency:'میلیون ریال',
  fx:1,
  discountMode:'manual' as const,
  manualRate:21,
  equity:16.993324050777078,
  debt:83.00667594922292,
  ke:30,
  kd:26,
  tax:5,
  waccTax:25,
  financeRate:26,
  reinvestmentRate:30,
  loans:[
    {id:'excel-loan-fixed',name:'وام بلندمدت سرمایه‌گذاری ثابت',amount:14962268.286823574,currency:'میلیون ریال',fxRate:1,fxDate:'1402-07-10',annualRate:26,drawYear:1,graceYears:2,tenorYears:5,method:'اصل مساوی' as const,feeRate:0},
    {id:'excel-loan-wc',name:'تسهیلات سرمایه در گردش',amount:3309144.525623,currency:'میلیون ریال',fxRate:1,fxDate:'1402-07-10',annualRate:26,drawYear:3,graceYears:0,tenorYears:5,method:'اصل مساوی' as const,feeRate:0}
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
    {...row('capex-machinery','ماشین‌آلات و تجهیزات',1,'مجموع',10472740,'یک‌باره','ماشین‌آلات'),source:capexSource,origin:'داخلی'},
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
  notes:'پروژه آزمون مرجع بر مبنای دو فایل Excel HRCR200 کاشان با تاریخ ۱۴۰۲/۰۷/۱۰ ساخته شده است. ظرفیت ۲۰۰٬۰۰۰ تن در سال، قیمت موزون فروش ۳۱۱٫۲۹۸ میلیون ریال بر تن، هزینه‌های عملیاتی، نیروی انسانی و سرمایه در گردش از شیت‌های مرجع استخراج شده‌اند. مالیات عملیاتی ۵٪ از شیت قیمت فروش و نرخ مالیات سپر WACC برابر ۲۵٪ از شیت نرخ تنزیل جداگانه نگهداری شده‌اند. نرخ تنزیل محاسباتی WACC برابر ۲۱٫۲۸۴۳٪ است؛ شیت IRR-NPV نرخ را به ۲۱٪ گرد کرده است. جریان‌های نقدی مرجع COMFAR در آزمون مستقل شاخص‌های مالی استفاده می‌شوند و نباید با جریان نقدی تولیدشده توسط موتور پیشران یکی فرض شوند.'
} as const


/** Cached reference values from the original Excel sheets and the COMFAR cash-flow export. */
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
  comfarIrrNpvNetDiscountedCashFlows:[
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
    'IRR-NPV cash flows are imported from COMFAR and are not calculated by the source Excel workbook from the operating-cost tabs.'
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
