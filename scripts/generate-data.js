import fs from 'fs'
import path from 'path'
import { HDate } from '@hebcal/core'
import SunCalc from 'suncalc'

const TEL_AVIV = { lat: 32.0853, lon: 34.7818 }
const START = new Date('1948-01-01T00:00:00Z')
const END = new Date('2030-01-01T00:00:00Z')
const OUT_DIR = path.resolve(process.cwd(), 'data')

function fmtLocalHM(d){ if(!d) return null; const h = d.getHours(); const m = d.getMinutes(); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }
function toISODate(d){ return d.toISOString().slice(0,10) }

function hebrewDayLetters(n){
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
  if (n === 15) return 'ט״ו'
  if (n === 16) return 'ט״ז'
  if (n < 10) return ones[n] + '׳'
  if (n === 10) return 'י׳'
  if (n < 20) return `י״${ones[n-10]}`
  if (n < 30) return `כ״${ones[n-20] || ''}`
  return 'ל׳'
}

function normalizeMonthName(name){
  return name
    .toLowerCase()
    .replace(/\s+/g,'')
    .replace(/["'\u05F3\u05F4\.]/g,'') // remove quotes/gershayim/dots
}

function englishMonthToHebrew(name){
  const key = normalizeMonthName(name)
  const map = {
    nisan: 'ניסן',
    iyar: 'אייר', iyyar: 'אייר',
    sivan: 'סיון',
    tamuz: 'תמוז', tammuz: 'תמוז',
    av: 'אב',
    elul: 'אלול',
    tishrei: 'תשרי',
    cheshvan: 'חשון', heshvan: 'חשון', marcheshvan: 'חשון', marheshvan: 'חשון',
    kislev: 'כסלו',
    tevet: 'טבת', teveth: 'טבת',
    shevat: 'שבט', shvat: 'שבט', shebat: 'שבט',
    adar: 'אדר',
    adari: 'אדר א׳', adar1: 'אדר א׳',
    adarii: 'אדר ב׳', adar2: 'אדר ב׳',
  }
  return map[key] || name
}

function hebrewYearLetters(yearNum){
  let n = yearNum % 1000
  const letters = []
  const values = [400,300,200,100,90,80,70,60,50,40,30,20,10]
  const glyphs  = ['ת','ש','ר','ק','צ','פ','ע','ס','נ','מ','ל','כ','י']
  for (let i=0;i<values.length;i++){
    while (n >= values[i]){ letters.push(glyphs[i]); n -= values[i] }
  }
  if (n === 15){ letters.push('ט','ו'); n = 0 }
  if (n === 16){ letters.push('ט','ז'); n = 0 }
  const onesMap = ['','א','ב','ג','ד','ה','ו','ז','ח','ט']
  if (n > 0){ letters.push(onesMap[n]) }
  if (letters.length >= 2){
    const last = letters.pop()
    letters[letters.length-1] = letters[letters.length-1] + '״'
    letters.push(last)
  } else if (letters.length === 1){
    letters[0] = letters[0] + '׳'
  }
  return letters.join('')
}

function hebrewLabel(hd){
  const dayNum = hd.getDate()
  const day = hebrewDayLetters(dayNum)
  const enMonth = hd.getMonthName('en')
  const month = englishMonthToHebrew(enMonth)
  const year = hebrewYearLetters(hd.getFullYear())
  const full = `${day} ב${month} ${year}`
  return { dayNum, day, month, year, full }
}

function* days(start, end){
  const d = new Date(start)
  while(d < end){
    yield new Date(d)
    d.setUTCDate(d.getUTCDate()+1)
  }
}

async function main(){
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, {recursive:true})
  const onlyYear = process.env.YEAR ? Number(process.env.YEAR) : null
  let currentYear = 0
  let bucket = {}

  const iterStart = onlyYear ? new Date(`${onlyYear}-01-01T00:00:00Z`) : START
  const iterEnd = onlyYear ? new Date(`${onlyYear+1}-01-01T00:00:00Z`) : END

  for (const d of days(iterStart, iterEnd)) {
    const local = new Date(d)
    const y = Number(toISODate(d).slice(0,4))
    if (currentYear !== y){
      if (currentYear !== 0){
        const outFile = path.join(OUT_DIR, `${currentYear}.json`)
        fs.writeFileSync(outFile, JSON.stringify(bucket))
        bucket = {}
      }
      currentYear = y
      console.log('year', y)
    }

    const hd = new HDate(local)
    const heb = hebrewLabel(hd)

    const sunTimes = SunCalc.getTimes(local, TEL_AVIV.lat, TEL_AVIV.lon)
    const sunrise = sunTimes.sunrise ? fmtLocalHM(sunTimes.sunrise) : null
    const sunset = sunTimes.sunset ? fmtLocalHM(sunTimes.sunset) : null

    const moonTimes = SunCalc.getMoonTimes(local, TEL_AVIV.lat, TEL_AVIV.lon, true)
    const moonrise = moonTimes.rise ? fmtLocalHM(moonTimes.rise) : null
    const moonset = moonTimes.set ? fmtLocalHM(moonTimes.set) : null

    const illum = SunCalc.getMoonIllumination(local)
    const illumination = Math.max(0, Math.min(1, illum.fraction))
    const synodic = 29.530588853
    const age = illum.phase * synodic
    const waxing = illum.phase < 0.5

    const key = toISODate(local)
    bucket[key] = {
      gregorian: key,
      hebrew_date: heb.full,
      hebrew_day: heb.dayNum,
      hebrew_month: heb.month,
      hebrew_year: heb.year,
      moon: { illumination: Number(illumination.toFixed(3)), age: Number(age.toFixed(2)), waxing },
      sun: { sunrise, sunset },
      moon_times: { moonrise, moonset },
    }
  }
  if (currentYear !== 0){
    const outFile = path.join(OUT_DIR, `${currentYear}.json`)
    fs.writeFileSync(outFile, JSON.stringify(bucket))
  }
  console.log('Done. Data in', OUT_DIR)
}

main().catch(e=>{ console.error(e); process.exit(1) }) 