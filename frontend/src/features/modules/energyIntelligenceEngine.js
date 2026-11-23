const finite=(value,label)=>{const n=Number(value);if(value===null||value===undefined||value===''||!Number.isFinite(n))throw new Error('مقدار '+label+' معتبر نیست.');return n}
const median=values=>{const a=values.slice().sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
const periodKey=value=>{const parts=String(value??'').match(/\d+/g);return parts?.map(x=>Number(x)).reduce((n,x)=>n*100000+x,0)??Number.MAX_SAFE_INTEGER}
const groupKey=x=>[x.resource,x.site,x.seu].map(v=>String(v??'')).join('::')

export function buildEnergySeries(records,{resource,site,seu}={}) {
 const selected=(Array.isArray(records)?records:[]).filter(x=>(!resource||x.resource===resource)&&(!site||x.site===site)&&(!seu||x.seu===seu))
 const grouped=new Map()
 for(const row of selected){const key=groupKey(row);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(row)}
 const series=[],warnings=[]
 for(const [key,items] of grouped){
  const sorted=items.slice().sort((a,b)=>periodKey(a.period)-periodKey(b.period)||String(a.id??'').localeCompare(String(b.id??'')))
  const duplicates=new Set();for(let i=1;i<sorted.length;i++)if(String(sorted[i].period)===String(sorted[i-1].period))duplicates.add(String(sorted[i].period))
  if(duplicates.size)warnings.push('برای '+key+' دوره تکراری ثبت شده است: '+[...duplicates].join(', '))
  const gasThermal=sorted[0]?.resource==='gas'&&sorted.every(x=>Number(x.gasEnergyKwh)>0&&['gross','net'].includes(x.calorificBasis)&&x.calorificBasis===sorted[0].calorificBasis&&String(x.gasReferenceConditions??'').trim()!==''&&String(x.gasReferenceConditions??'').trim()===String(sorted[0].gasReferenceConditions??'').trim())
  const points=sorted.map((x,index)=>{
   const consumption=gasThermal?Number(x.gasEnergyKwh):Number(x.consumption)
   const production=Number(x.production),cost=Number(x.cost)
   if(!Number.isFinite(consumption)||consumption<0||!Number.isFinite(production)||production<=0||!Number.isFinite(cost)||cost<0){warnings.push('رکورد '+String(x.id??x.period)+' به‌دلیل داده نامعتبر از تحلیل کنار گذاشته شد.');return null}
   const previous=index?sorted[index-1]:null
   const previousConsumption=previous?(gasThermal?Number(previous.gasEnergyKwh):Number(previous.consumption)):null
   const previousIntensity=previous&&Number(previous.production)>0?previousConsumption/Number(previous.production):null
   const intensity=consumption/production,costPerTon=cost/production
   const previousCostPerTon=previous&&Number(previous.production)>0?Number(previous.cost)/Number(previous.production):null
   return {id:x.id,period:x.period,resource:x.resource,site:x.site,seu:x.seu,consumption:Number(x.consumption),analysisConsumption:consumption,production,cost,intensity,costPerTon,unit:gasThermal?'kWh/t':x.resource==='electricity'?'kWh/t':x.resource==='gas'?'Nm³/t':'m³/t',comparisonBasis:gasThermal?'thermal-energy':'volume-or-resource',periodChangePercent:previousConsumption>0?(consumption/previousConsumption-1)*100:null,intensityChangePercent:previousIntensity>0?(intensity/previousIntensity-1)*100:null,costPerTonChangePercent:previousCostPerTon>0?(costPerTon/previousCostPerTon-1)*100:null}
  }).filter(Boolean)
  series.push({key,resource:sorted[0]?.resource,site:sorted[0]?.site,seu:sorted[0]?.seu,comparisonBasis:gasThermal?'thermal-energy':'volume-or-resource',calorificBasis:gasThermal?sorted[0].calorificBasis:null,gasReferenceConditions:gasThermal?sorted[0].gasReferenceConditions:null,points})
  if(sorted[0]?.resource==='gas'&&!gasThermal)warnings.push('سری گاز '+String(sorted[0].site)+' / '+String(sorted[0].seu)+' به‌دلیل تفاوت یا فقدان مبنای HHV/LHV یا شرایط مرجع، فقط بر مبنای Nm³ تحلیل شده است.')
 }
 return {series,warnings}
}

export function detectEnergyAnomalies(records,{resource,site,seu,minimumDeviationPercent=20}={}) {
 const built=buildEnergySeries(records,{resource,site,seu}),anomalies=[]
 for(const s of built.series){
  const p=s.points;if(p.length<5)continue
  const current=p[p.length-1],history=p.slice(-5,-1)
  for(const metric of ['intensity','costPerTon']){
   const values=history.map(x=>x[metric]).filter(Number.isFinite),center=median(values)
   if(values.length<4||center<=0)continue
   const mad=median(values.map(x=>Math.abs(x-center))),robustBand=mad>0?3*1.4826*mad:center*(minimumDeviationPercent/100)
   const minimumBand=center*(minimumDeviationPercent/100),limit=Math.max(robustBand,minimumBand)
   const delta=current[metric]-center
   if(Math.abs(delta)>limit)anomalies.push({seriesKey:s.key,period:current.period,resource:s.resource,site:s.site,seu:s.seu,metric,actual:current[metric],historicalMedian:center,delta,deltaPercent:delta/center*100,direction:delta>0?'above':'below',method:'median-mad-screen',baselinePeriods:history.map(x=>x.period)})
  }
 }
 return {anomalies,warnings:built.warnings,method:'آخرین دوره با میانه چهار دوره قبلی مقایسه شده است؛ حداقل انحراف ۲۰٪ و آستانه مقاوم مبتنی بر MAD اعمال می‌شود. این غربال آماری جایگزین بررسی مهندسی علت نیست.'}
}

export function forecastEnergyIntensity(records,{resource,site,seu,horizon=3,futureProduction=[]}={}) {
 const built=buildEnergySeries(records,{resource,site,seu}),steps=Math.max(1,Math.min(12,Math.floor(Number(horizon)||3))),forecasts=[],warnings=[...built.warnings]
 for(const s of built.series){
  const points=s.points
  if(points.length<3){warnings.push('برای پیش‌بینی '+String(s.site)+' / '+String(s.seu)+' حداقل سه دوره معتبر لازم است.');continue}
  const n=points.length,xMean=(n-1)/2,yMean=points.reduce((sum,p)=>sum+p.intensity,0)/n
  const denominator=points.reduce((sum,p,i)=>sum+(i-xMean)**2,0)
  if(!denominator)continue
  const slope=points.reduce((sum,p,i)=>sum+(i-xMean)*(p.intensity-yMean),0)/denominator
  const intercept=yMean-slope*xMean
  const residuals=points.map((p,i)=>p.intensity-(intercept+slope*i))
  const rmse=Math.sqrt(residuals.reduce((sum,x)=>sum+x*x,0)/n)
  const avgProduction=points.reduce((sum,p)=>sum+p.production,0)/n
  const predicted=[]
  for(let i=0;i<steps;i++){
   const intensity=Math.max(0,intercept+slope*(n+i))
   const production=Number(futureProduction[i])>0?Number(futureProduction[i]):avgProduction
   predicted.push({step:i+1,periodIndex:n+i,predictedIntensity:intensity,predictedProduction:production,predictedConsumption:intensity*production,indicativeLowerIntensity:Math.max(0,intensity-1.96*rmse),indicativeUpperIntensity:intensity+1.96*rmse})
  }
  forecasts.push({seriesKey:s.key,resource:s.resource,site:s.site,seu:s.seu,unit:points[0].unit,comparisonBasis:s.comparisonBasis,method:'ordinary-least-squares-linear-intensity-trend',productionAssumption:futureProduction.length?'user-supplied-by-horizon':'historical-average-production',historicalPeriods:n,rmse,forecast:predicted})
 }
 warnings.push('پیش‌بینی روند خطی روی شدت مصرف است؛ بازه عدم‌قطعیت صرفاً شاخصی مبتنی بر RMSE است و فاصله اطمینان آماری کالیبره‌شده یا تضمین صرفه‌جویی محسوب نمی‌شود.')
 return {forecasts,warnings}
}

const distribute=(amount,consumers,weightKey,label)=>{
 if(amount===0)return consumers.map(()=>0)
 const weights=consumers.map(x=>Math.max(0,Number(x[weightKey])||0)),total=weights.reduce((a,b)=>a+b,0)
 if(total<=0)throw new Error('مبنای تخصیص '+label+' معتبر نیست: '+weightKey)
 let assigned=0
 return weights.map((w,i)=>{const v=i===weights.length-1?amount-assigned:amount*w/total;assigned+=v;return v})
}
export function allocateGasBillCost({bill,consumers}) {
 if(!bill||!Array.isArray(consumers)||!consumers.length)throw new Error('قبض گاز و حداقل یک مرکز هزینه لازم است.')
 const amount=finite(bill.amount,'مبلغ قبض');if(amount<0)throw new Error('مبلغ قبض نمی‌تواند منفی باشد.')
 const fields=['volumeCharge','thermalCharge','transportCharge','fixedCharge','taxCharge']
 const charges=Object.fromEntries(fields.map(k=>[k,bill[k]===null||bill[k]===undefined||bill[k]===''?0:finite(bill[k],k)]))
 if(Object.values(charges).some(x=>x<0))throw new Error('اجزای قبض گاز باید غیرمنفی باشند.')
 const componentTotal=fields.reduce((sum,k)=>sum+charges[k],0)
 if(componentTotal>amount+Math.max(1,amount*.001))throw new Error('جمع اجزای قبض گاز از مبلغ نهایی بیشتر است.')
 const residual=Math.max(0,amount-componentTotal)
 const volume=distribute(charges.volumeCharge,consumers,'gasNm3','حجم گاز')
 const thermal=distribute(charges.thermalCharge,consumers,'gasGJ','انرژی حرارتی')
 const transport=distribute(charges.transportCharge,consumers,'gasNm3','حجم انتقال')
 const fixedWeights=consumers.map(x=>({...x,fixedShare:Number(x.fixedCapacityShare??x.contractedCapacity??0)}))
 const fixedTotal=fixedWeights.reduce((sum,x)=>sum+Math.max(0,x.fixedShare),0)
 const fixed=fixedTotal>0?distribute(charges.fixedCharge,fixedWeights,'fixedShare','ظرفیت قراردادی'):consumers.map(()=>charges.fixedCharge/consumers.length)
 const preTax=consumers.map((_,i)=>volume[i]+thermal[i]+transport[i]+fixed[i])
 const tax=distribute(charges.taxCharge,consumers.map((x,i)=>({...x,taxWeight:preTax[i]})),'taxWeight','پایه مالیات')
 const other=distribute(residual,consumers,'gasNm3','سایر اقلام باقیمانده')
 const allocations=consumers.map((x,i)=>{const totalCost=volume[i]+thermal[i]+transport[i]+fixed[i]+tax[i]+other[i],production=Number(x.productionTon)||0;return {costCenterId:String(x.id??x.name??i+1),name:String(x.name??x.id??'مرکز هزینه '+(i+1)),volumeCharge:volume[i],thermalCharge:thermal[i],transportCharge:transport[i],fixedCharge:fixed[i],taxCharge:tax[i],otherCharges:other[i],totalCost,productionTon:production,costPerTon:production>0?totalCost/production:null}})
 const allocatedTotal=allocations.reduce((sum,x)=>sum+x.totalCost,0)
 if(Math.abs(allocatedTotal-amount)>Math.max(.0001,amount*1e-10))throw new Error('جمع تخصیص قبض گاز با مبلغ نهایی تطبیق ندارد.')
 return {billId:String(bill.id??''),billNumber:String(bill.billNumber??''),period:String(bill.period??''),currencyUnit:'واحد پول قبض',billAmount:amount,componentTotal,residual,allocatedTotal,allocations,allocationRules:{volumeCharge:'gasNm3',thermalCharge:'gasGJ',transportCharge:'gasNm3',fixedCharge:fixedTotal>0?'contractedCapacity':'equal-share',taxCharge:'pre-tax allocated cost',otherCharges:'gasNm3'},warnings:fixedTotal>0?[]:['هزینه ثابت به‌صورت مساوی بین مراکز هزینه توزیع شده است؛ در صورت وجود ظرفیت قراردادی، مبنای ظرفیت را وارد کنید.'],sourceReference:{type:'MOD-05-gas-bill',billId:String(bill.id??''),billNumber:String(bill.billNumber??''),period:String(bill.period??'')},duplicatePostingGuard:'در MOD-02 فقط مبلغ تخصیص‌یافته همین مرکز هزینه را یک بار ثبت کنید؛ کل قبض را مجدداً اضافه نکنید.'}
}
export function prepareModule02GasCostPosting({baseInput,allocation,costCenterId}) {
 if(!baseInput||typeof baseInput!=='object'||!allocation||!Array.isArray(allocation.allocations))throw new Error('ورودی بهای تمام‌شده یا تخصیص قبض گاز معتبر نیست.')
 const selected=allocation.allocations.find(x=>x.costCenterId===String(costCenterId))
 if(!selected)throw new Error('مرکز هزینه انتخاب‌شده در تخصیص قبض گاز وجود ندارد.')
 if(!Number.isFinite(Number(selected.totalCost))||Number(selected.totalCost)<0)throw new Error('مبلغ تخصیص‌یافته گاز معتبر نیست.')
 return {input:{...baseInput,energy:String(Number(baseInput.energy??0)+Number(selected.totalCost))},sourceReferences:{gasBillId:String(allocation.billId??''),billNumber:String(allocation.billNumber??''),billingPeriod:String(allocation.period??''),gasAllocationCost:Number(selected.totalCost),gasAllocationCenter:selected.costCenterId,gasAllocationBasis:JSON.stringify(allocation.allocationRules)},duplicatePostingGuard:'اگر فیلد انرژی قبلاً شامل همین قبض است، آن را دوباره اضافه نکنید؛ ثبت باید با مرجع قبض یکتا کنترل شود.'}
}
