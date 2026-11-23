const digitMap='۰۱۲۳۴۵۶۷۸۹'
export function normalizeBillDigits(value=''){
 return String(value).replace(/[۰-۹]/g,d=>String(digitMap.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٬،]/g,'').replace(/٫/g,'.').replace(/[−–]/g,'-')
}
function parseNumber(value){
 const cleaned=normalizeBillDigits(value).replace(/[^0-9.-]/g,'')
 if(!cleaned||cleaned==='.'||cleaned==='-')return null
 const result=Number(cleaned)
 return Number.isFinite(result)?result:null
}
function extract(lines,patterns,{numeric=false,nextLine=true}={}){
 for(let i=0;i<lines.length;i++){
  for(const pattern of patterns){
   const match=lines[i].match(pattern)
   if(match?.[1]){
    const value=match[1].trim()
    if(value)return numeric?parseNumber(value):value
   }
   if(nextLine&&pattern.test(lines[i])&&lines[i+1]){
    const value=lines[i+1].trim()
    if(value)return numeric?parseNumber(value):value
   }
  }
 }
 return numeric?null:''
}
const patterns={
 period:[/(?:دوره\s*(?:مصرف|قرائت)?|بازه\s*مصرف|صورتحساب\s*دوره)\s*[:：-]?\s*(.{4,45})?/i,/(?:billing\s*period|period)\s*[:：-]?\s*(.{4,45})?/i],
 billNumber:[/(?:شناسه\s*قبض|شماره\s*قبض|شماره\s*صورتحساب|bill\s*(?:id|no|number))\s*[:：-]?\s*([\w/-]+)?/i],
 accountNumber:[/(?:شماره\s*اشتراک|شناسه\s*مشترک|شماره\s*پرونده|account\s*(?:no|number))\s*[:：-]?\s*([\w/-]+)?/i],
 meterNumber:[/(?:شماره\s*کنتور|شناسه\s*کنتور|meter\s*(?:no|number))\s*[:：-]?\s*([\w/-]+)?/i],\n paymentId:[/(?:شناسه\s*پرداخت|شماره\s*پرداخت|payment\s*(?:id|code))\s*[:：-]?\s*([\w/-]+)?/i],
 previousReading:[/(?:قرائت\s*قبلی|رقم\s*پیشین|previous\s*reading)\D{0,22}([\d,.]+)?/i],
 currentReading:[/(?:قرائت\s*فعلی|رقم\s*فعلی|current\s*reading)\D{0,22}([\d,.]+)?/i],
 consumption:[/(?:(?<!دوره\s)مصرف\s*(?:کل|دوره)?|انرژی\s*مصرفی|انرژی\s*اکتیو|کیلووات\s*ساعت|kwh)\D{0,22}([\d,.]+)?/i],
 billingDays:[/(?:تعداد\s*روز|مدت\s*دوره|روز\s*مصرف|billing\s*days)\D{0,12}(\d{1,3})?/i],
 demand:[/(?:حداکثر\s*دیماند|دیماند\s*(?:مصرفی|ثبت\s*شده)?|قدرت\s*مصرفی|peak\s*demand)\D{0,22}([\d,.]+)?/i],
 contractDemand:[/(?:دیماند\s*قراردادی|قدرت\s*قراردادی|contract\s*demand)\D{0,22}([\d,.]+)?/i],
 reactiveEnergy:[/(?:انرژی\s*راکتیو|مصرف\s*راکتیو|reactive\s*energy)\D{0,22}([\d,.]+)?/i],
 powerFactor:[/(?:ضریب\s*قدرت|cos\s*phi|power\s*factor)\D{0,14}(\d{1,3}(?:\.\d{1,3})?\s*%?)?/i],
 peakConsumption:[/(?:مصرف\s*اوج\s*بار|اوج\s*بار|پیک\s*بار|peak\s*(?:load|consumption))\D{0,22}([\d,.]+)?/i],
 midConsumption:[/(?:مصرف\s*میان\s*باری|میان\s*باری|mid\s*(?:load|consumption))\D{0,22}([\d,.]+)?/i],
 offPeakConsumption:[/(?:مصرف\s*کم\s*باری|کم\s*باری|off\s*peak\s*(?:load|consumption))\D{0,22}([\d,.]+)?/i],
 amount:[/(?:مبلغ\s*قابل\s*پرداخت|جمع\s*کل\s*صورتحساب|مبلغ\s*نهایی|قابل\s*پرداخت|total\s*amount)\D{0,22}([\d,.]+)?/i],
 energyCharge:[/(?:بهای\s*انرژی|هزینه\s*انرژی|energy\s*charge)\D{0,22}([\d,.]+)?/i],
 demandCharge:[/(?:بهای\s*قدرت|هزینه\s*دیماند|demand\s*charge)\D{0,22}([\d,.]+)?/i],
 reactiveCharge:[/(?:بهای\s*راکتیو|جریمه\s*راکتیو|هزینه\s*راکتیو|reactive\s*charge)\D{0,22}([\d,.]+)?/i],
 taxCharge:[/(?:مالیات\s*(?:و\s*عوارض)?|عوارض\s*برق|tax\s*(?:and\s*fee)?|vat)\D{0,22}([\d,.]+)?/i],
 multiplier:[/(?:ضریب\s*کنتور|ضریب\s*قرائت|meter\s*multiplier)\D{0,18}([\d,.]+)?/i],
 tariff:[/(?:تعرفه\s*(?:برق)?|نوع\s*تعرفه|tariff)\s*[:：-]?\s*(.{2,35})/i],
 voltage:[/(?:سطح\s*ولتاژ|ولتاژ\s*تغذیه|voltage)\s*[:：-]?\s*(.{2,25})/i],
 dueDate:[/(?:مهلت\s*پرداخت|تاریخ\s*سررسید|due\s*date)\s*[:：-]?\s*([\d/.-]+)?/i]
}
export function parseElectricityBillText(sourceText=''){
 const lines=normalizeBillDigits(sourceText).replace(/\r/g,'\n').split(/\n+/).map(x=>x.trim()).filter(Boolean)
 const out={}
 for(const [key,rx] of Object.entries(patterns)){
  const numeric=['previousReading','currentReading','consumption','billingDays','demand','contractDemand','reactiveEnergy','powerFactor','peakConsumption','midConsumption','offPeakConsumption','amount','energyCharge','demandCharge','reactiveCharge','taxCharge','multiplier'].includes(key)
  out[key]=extract(lines,rx,{numeric})
 }
 if(out.powerFactor!==null&&out.powerFactor>1&&out.powerFactor<=100)out.powerFactor=out.powerFactor/100
 return out
}
export function analyzeElectricityBill(bill,history=[]){
 const n=k=>typeof bill[k]==='number'&&Number.isFinite(bill[k])?bill[k]:null
 const consumption=n('consumption'),days=n('billingDays'),production=n('production'),amount=n('amount')
 const readingDelta=n('previousReading')!==null&&n('currentReading')!==null?n('currentReading')-n('previousReading'):null
 const meterDerivedConsumption=readingDelta===null?null:readingDelta*(n('multiplier')&&n('multiplier')>0?n('multiplier'):1)
 const daily=days&&consumption!==null?consumption/days:null
 const specificConsumption=production&&consumption!==null?consumption/production:null
 const amountPerKwh=amount!==null&&consumption?amount/consumption:null
 const demandRatio=n('demand')!==null&&n('contractDemand')?n('demand')/n('contractDemand')*100:null
 const identity=bill.meterNumber?.trim()||bill.accountNumber?.trim()
 const previous=identity?history.filter(x=>{
  const sameMeter=bill.meterNumber?.trim()&&x.meterNumber?.trim()===bill.meterNumber.trim()
  const sameAccount=bill.accountNumber?.trim()&&x.accountNumber?.trim()===bill.accountNumber.trim()
  return (sameMeter||sameAccount)&&x.consumption!==null&&x.billingDays>0
 }).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0]:null
 const previousDaily=previous?previous.consumption/previous.billingDays:null
 const dailyChange=previousDaily&&daily!==null?(daily/previousDaily-1)*100:null
 const warnings=[]
 if((n('previousReading')===null)!==(n('currentReading')===null))warnings.push('برای کنترل کنتور باید قرائت قبلی و فعلی هر دو ثبت شوند.')
 if(readingDelta!==null&&readingDelta<0)warnings.push('قرائت فعلی از قرائت قبلی کمتر است.')
 if(n('multiplier')!==null&&n('multiplier')<=0)warnings.push('ضریب کنتور باید بزرگ‌تر از صفر باشد.')
 if(meterDerivedConsumption!==null&&consumption!==null&&Math.abs(meterDerivedConsumption-consumption)>Math.max(1,consumption*.02))warnings.push('مصرف قبض با اختلاف قرائت ضرب‌در ضریب کنتور بیش از تلورانس ۲٪ اختلاف دارد.')
 if(n('powerFactor')!==null&&(n('powerFactor')<0||n('powerFactor')>1))warnings.push('ضریب قدرت خارج از بازه معتبر صفر تا یک است؛ مقدار قبض را بازبینی کنید.')
 else if(n('powerFactor')!==null&&n('powerFactor')<.9)warnings.push('ضریب قدرت کمتر از ۰٫۹ است؛ هزینه یا جریمه راکتیو را بررسی کنید.')
 if(n('ocrConfidence')>0&&n('ocrConfidence')<65)warnings.push('اطمینان OCR پایین است؛ همه ارقام را با تصویر اصلی تطبیق دهید.')
 if(n('demand')!==null&&n('contractDemand')!==null&&n('demand')>n('contractDemand'))warnings.push('حداکثر دیماند از دیماند قراردادی بیشتر است.')
 if(dailyChange!==null&&dailyChange>15)warnings.push('مصرف روزانه نسبت به قبض قبلی بیش از ۱۵٪ افزایش یافته است.')
 if(days!==null&&(days<20||days>45))warnings.push('طول دوره قبض غیرمعمول است؛ مقایسه خام مصرف ممکن است گمراه‌کننده باشد.')
 const tou=[n('peakConsumption'),n('midConsumption'),n('offPeakConsumption')]
 if(tou.every(x=>x!==null)&&consumption!==null&&Math.abs(tou.reduce((a,b)=>a+b,0)-consumption)>Math.max(1,consumption*.02))warnings.push('جمع اوج‌بار، میان‌باری و کم‌باری با مصرف کل قبض تطبیق ندارد.')
 const charges=[n('energyCharge'),n('demandCharge'),n('reactiveCharge'),n('taxCharge')]
 const componentTotal=charges.every(x=>x!==null)?charges.reduce((a,b)=>a+b,0):null
 if(componentTotal!==null&&amount!==null&&Math.abs(componentTotal-amount)>Math.max(1,amount*.03))warnings.push('جمع اجزای مبلغ استخراج‌شده با مبلغ نهایی بیش از تلورانس ۳٪ اختلاف دارد؛ سایر اقلام و بستانکاری‌ها را بررسی کنید.')
 return {daily,previousDaily,dailyChange,previousBill:previous??null,readingDelta,meterDerivedConsumption,specificConsumption,amountPerKwh,demandRatio,componentTotal,warnings}
}
