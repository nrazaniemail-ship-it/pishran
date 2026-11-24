import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeBillDigits,parseElectricityBillText,analyzeElectricityBill} from '../src/features/modules/electricityBillMath.js'

test('normalizes Persian and Arabic numerals and separators',()=>{
 assert.equal(normalizeBillDigits('۱۲٬۳۴۵٫۶'), '12345.6')
 assert.equal(normalizeBillDigits('١٢٣٬٤٥٦'), '123456')
})
test('extracts Iranian electricity bill fields and normalizes percent power factor',()=>{
 const parsed=parseElectricityBillText(`شماره اشتراک: 778899
شماره کنتور: M-100
دوره مصرف: 1405/07
شناسه پرداخت: 991122
قرائت قبلی: 12000
قرائت فعلی: 14500
انرژی مصرفی: 2500
تعداد روز دوره: 30
حداکثر دیماند: 450
دیماند قراردادی: 500
ضریب قدرت: 92%
مصرف اوج بار: 500
مصرف میان باری: 1000
مصرف کم باری: 1000
بهای انرژی: 100000
بهای قدرت: 20000
هزینه راکتیو: 0
مالیات و عوارض: 12000
مبلغ قابل پرداخت: 132000`)
 assert.equal(parsed.accountNumber,'778899')
 assert.equal(parsed.paymentId,'991122')
 assert.equal(parsed.meterNumber,'M-100')
 assert.equal(parsed.consumption,2500)
 assert.equal(parsed.powerFactor,.92)
 assert.equal(parsed.peakConsumption,500)
 assert.equal(parsed.offPeakConsumption,1000)
 assert.equal(parsed.amount,132000)
})
test('does not compare bills belonging to different meters',()=>{
 const current={meterNumber:'M-2',accountNumber:'A-2',consumption:120,billingDays:30}
 const history=[{meterNumber:'M-1',accountNumber:'A-1',consumption:900,billingDays:30,createdAt:'2026-11-20'}]
 assert.equal(analyzeElectricityBill(current,history).dailyChange,null)
})
test('compares daily consumption only with the same meter history',()=>{
 const current={meterNumber:'M-2',consumption:150,billingDays:30,production:10,amount:3000}
 const history=[{meterNumber:'M-2',consumption:100,billingDays:25,createdAt:'2026-11-20'}]
 const result=analyzeElectricityBill(current,history)
 assert.equal(result.daily,5)
 assert.equal(result.previousDaily,4)
 assert.equal(result.dailyChange,25)
 assert.equal(result.specificConsumption,15)
 assert.equal(result.amountPerKwh,20)
})
test('flags mismatch in time-of-use buckets and bill components',()=>{
 const result=analyzeElectricityBill({consumption:1000,billingDays:30,peakConsumption:200,midConsumption:300,offPeakConsumption:300,energyCharge:100,demandCharge:50,reactiveCharge:0,taxCharge:10,amount:500},[])
 assert.ok(result.warnings.some(x=>x.includes('اوج‌بار')))
 assert.ok(result.warnings.some(x=>x.includes('اجزای مبلغ')))
})
test('flags negative meter delta and invalid power factor',()=>{
 const result=analyzeElectricityBill({previousReading:200,currentReading:100,consumption:50,powerFactor:1.2},[])
 assert.ok(result.warnings.some(x=>x.includes('کمتر')))
 assert.ok(result.warnings.some(x=>x.includes('ضریب قدرت')))
})

test('extracts values when OCR puts labels and values on separate lines',()=>{
 const parsed=parseElectricityBillText(`شماره کنتور
M-900
قرائت قبلی
5000
قرائت فعلی
6500
انرژی مصرفی
1500
تعداد روز دوره
30
مبلغ قابل پرداخت
450000`)
 assert.equal(parsed.meterNumber,'M-900')
 assert.equal(parsed.previousReading,5000)
 assert.equal(parsed.currentReading,6500)
 assert.equal(parsed.consumption,1500)
 assert.equal(parsed.billingDays,30)
 assert.equal(parsed.amount,450000)
})

test('reconciles meter readings using the meter multiplier',()=>{
 const result=analyzeElectricityBill({previousReading:1000,currentReading:1500,multiplier:5,consumption:2500},[])
 assert.equal(result.meterDerivedConsumption,2500)
 assert.ok(!result.warnings.some(x=>x.includes('ضرب‌در')))
})
test('flags a one-sided meter reading instead of silently skipping reconciliation',()=>{
 const result=analyzeElectricityBill({previousReading:1000,currentReading:null,consumption:250},[])
 assert.ok(result.warnings.some(x=>x.includes('هر دو')))
})
