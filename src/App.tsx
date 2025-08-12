import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DayRecord, YearData } from './types'

const SLIDER_SLOWDOWN_FACTOR = 4

// DEBUG: simple grid for days 1–9
function DebugMoonGrid(){
  const days = Array.from({length:31}, (_,i)=>i) // 0..30
  return (
    <div style={{padding:20, direction:'rtl', fontFamily:'Rubik, Varela Round, system-ui'}}>
      <h1 style={{textAlign:'center'}}>דיבוג: מצב הירח לימי החודש 0–30</h1>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:12, alignItems:'center'}}>
        {days.map((d)=>{
          const phi = (2*Math.PI*d)/29.530588853
          const illumination = (1 - Math.cos(phi))/2
          const waxing = d <= 15
          const label = d === 0 ? '0' : hebrewDayLetters(d)
          return (
            <div key={d} style={{textAlign:'center', padding:10, background:'#0f1025', borderRadius:12, color:'#e2e8f0'}}>
              <div style={{display:'inline-block'}}>
                <MoonPhasePath illumination={illumination} waxing={waxing} idSuffix={`-${d}`} />
              </div>
              <div style={{marginTop:6, fontWeight:700}}>{label}</div>
              <div style={{fontSize:12}}>I={illumination.toFixed(2)} {waxing? '↗︎' : '↘︎'}</div>
            </div>
          )
        })}
      </div>
      <div style={{marginTop:16, textAlign:'center', color:'#64748b'}}>ימין מואר בתחילת חודש, מלא באמצע, שמאל מואר בסוף</div>
    </div>
  )
}

function DebugTamuzList(){
  const [items, setItems] = useState<Array<{ key:string; rec: DayRecord }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    let ignore=false
    async function load(){
      setLoading(true)
      try{
        const res = await fetch(`${import.meta.env['BASE_URL']}data/dates/1993.json`)
        const data = await res.json() as YearData
        if (ignore) return
        const entries = Object.entries(data)
          .filter(([,rec]) => rec.hebrew_month === 'תמוז')
          .sort(([a],[b]) => a.localeCompare(b))
          .map(([key, rec]) => ({ key, rec }))
        setItems(entries)
      } finally { if (!ignore) setLoading(false) }
    }
    load()
    return ()=>{ ignore=true }
  },[])

  return (
    <div style={{padding:20, direction:'rtl', fontFamily:'Rubik, Varela Round, system-ui'}}>
      <h1 style={{textAlign:'center'}}>דיבוג: כל ימי תמוז (1993)</h1>
      {loading && <div style={{textAlign:'center'}}>טוען…</div>}
      {!loading && (
        <div style={{maxWidth:800, margin:'0 auto', background:'#0f1025', color:'#e2e8f0', padding:16, borderRadius:12}}>
          {items.length === 0 && <div style={{textAlign:'center'}}>אין נתונים לחודש תמוז</div>}
          {items.map(({key, rec}) => (
            <div key={key} style={{display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid #1f2442'}}>
              <div style={{width:50, display:'flex', justifyContent:'center'}}>
                {(() => {
                  let dayNum = rec.hebrew_day
                  if (dayNum === 1) dayNum = 2
                  if (dayNum === 30) dayNum = 29
                  const { illumination, rightLit } = appearanceFromHebrewDay(dayNum)
                  return <MoonPhasePath illumination={illumination} waxing={rightLit} hebrewDay={dayNum} idSuffix={`-${key}`} />
                })()}
              </div>
              <span style={{display:'inline-block', minWidth:110, fontVariantNumeric:'tabular-nums'}} dir="ltr">{rec.gregorian}</span>
              <span style={{marginInlineStart:12}}>{rec.hebrew_date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function timeToMinutes(t: string | null): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToHM(min:number){
  const h = Math.floor(min/60)
  const m = min%60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function formatYMDLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}

function toLocalDateAtTime(dateISO:string, hm:string|null): Date | null {
  if (!hm) return null
  const [hh, mm] = hm.split(':').map(Number)
  const d = new Date(dateISO)
  d.setHours(hh, mm, 0, 0)
  return d
}
function addMinutesToDate(d: Date, minutes:number): Date {
  return new Date(d.getTime() + minutes*60000)
}

function lerp(a:number,b:number,t:number){ return a + (b-a)*t }
function clamp(x:number, a:number, b:number){ return Math.max(a, Math.min(b, x)) }

function hexToRgb(hex:string){
  const m = hex.replace('#','')
  const bigint = parseInt(m.length===3? m.split('').map(c=>c+c).join('') : m, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return {r,g,b}
}
function rgbToHex(r:number,g:number,b:number){
  const h = (n:number)=> n.toString(16).padStart(2,'0')
  return `#${h(r)}${h(g)}${h(b)}`
}
function mixColor(a:string,b:string,t:number){
  const A = hexToRgb(a), B = hexToRgb(b)
  const r = Math.round(lerp(A.r,B.r,t))
  const g = Math.round(lerp(A.g,B.g,t))
  const bch = Math.round(lerp(A.b,B.b,t))
  return rgbToHex(r,g,bch)
}
function mixGradient(aTop:string,aBot:string,bTop:string,bBot:string,t:number){
  return `linear-gradient(180deg, ${mixColor(aTop,bTop,t)}, ${mixColor(aBot,bBot,t)})`
}

// Sea gradient with the same stages as the sky, but can be called with a time offset to lag by 30 min
function seaGradient(minutes:number, sunrise:number|null, sunset:number|null){
  const nightTop = '#1c3550', nightBot = '#0e2744'
  const dawnTop = '#4f99c7', dawnBot = '#1f5a90'
  const dayTop = '#8fd5ff', dayBot = '#2c79b8'
  const duskTop = '#4f99c7', duskBot = '#1f5a90'
  if (sunrise==null || sunset==null){
    return `linear-gradient(180deg, ${nightTop}, ${nightBot})`
  }
  // Sunrise background transition: sunrise − 30 → sunrise + 90
  const dawnInStart = sunrise - 30
  const dawnInEnd = sunrise + 90
  const duskOutStart = sunset - 30
  const duskOutEnd = sunset + 120
  if (minutes < dawnInStart) return `linear-gradient(180deg, ${nightTop}, ${nightBot})`
  if (minutes <= dawnInEnd){
    const t1 = clamp((minutes - dawnInStart) / (dawnInEnd - dawnInStart), 0, 1)
    if (t1 < 0.5){
      const tt = t1/0.5
      return mixGradient(nightTop, nightBot, dawnTop, dawnBot, tt)
    } else {
      const tt = (t1-0.5)/0.5
      return mixGradient(dawnTop, dawnBot, dayTop, dayBot, tt)
    }
  }
  if (minutes < duskOutStart) return `linear-gradient(180deg, ${dayTop}, ${dayBot})`
  if (minutes <= duskOutEnd){
    const t2 = clamp((minutes - duskOutStart) / (duskOutEnd - duskOutStart), 0, 1)
    if (t2 < 0.5){
      const tt = t2/0.5
      return mixGradient(dayTop, dayBot, duskTop, duskBot, tt)
    } else {
      const tt = (t2-0.5)/0.5
      return mixGradient(duskTop, duskBot, nightTop, nightBot, tt)
    }
  }
  return `linear-gradient(180deg, ${nightTop}, ${nightBot})`
}

// Mountain colors that blend like the sky; day colors are intentionally light
function mountainColors(minutes:number, sunrise:number|null, sunset:number|null){
  const night = { top: '#3f3168', bot: '#1a1538', shade: '#251b4a' }
  const dawn  = { top: '#c99d74', bot: '#8e623b', shade: '#a37248' }
  const day   = { top: '#f1dfc8', bot: '#c7925e', shade: '#d39a61' } // lighter day
  const dusk  = { top: '#7a4f8a', bot: '#3b2a59', shade: '#4a356a' }
  if (sunrise==null || sunset==null) return night
  const dawnInStart = sunrise - 120
  const dawnInEnd = sunrise + 30
  const duskOutStart = sunset - 30
  const duskOutEnd = sunset + 120
  if (minutes < dawnInStart) return night
  if (minutes <= dawnInEnd){
    const t1 = clamp((minutes - dawnInStart) / (dawnInEnd - dawnInStart), 0, 1)
    if (t1 < 0.5){
      const tt = t1/0.5
      return {
        top: mixColor(night.top, dawn.top, tt),
        bot: mixColor(night.bot, dawn.bot, tt),
        shade: mixColor(night.shade, dawn.shade, tt),
      }
    } else {
      const tt = (t1-0.5)/0.5
      return {
        top: mixColor(dawn.top, day.top, tt),
        bot: mixColor(dawn.bot, day.bot, tt),
        shade: mixColor(dawn.shade, day.shade, tt),
      }
    }
  }
  if (minutes < duskOutStart) return day
  if (minutes <= duskOutEnd){
    const t2 = clamp((minutes - duskOutStart) / (duskOutEnd - duskOutStart), 0, 1)
    if (t2 < 0.5){
      const tt = t2/0.5
      return {
        top: mixColor(day.top, dusk.top, tt),
        bot: mixColor(day.bot, dusk.bot, tt),
        shade: mixColor(day.shade, dusk.shade, tt),
      }
    } else {
      const tt = (t2-0.5)/0.5
      return {
        top: mixColor(dusk.top, night.top, tt),
        bot: mixColor(dusk.bot, night.bot, tt),
        shade: mixColor(dusk.shade, night.shade, tt),
      }
    }
  }
  return night
}

function hebrewDayLetters(n:number): string {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
  const tens = ['', 'י', 'כ', 'ל']
  if (n <= 0 || n > 30) return ''
  if (n === 15) return 'ט״ו'
  if (n === 16) return 'ט״ז'
  if (n < 10) return ones[n] + '׳'
  if (n === 10) return 'י׳'
  if (n < 20) return `י״${ones[n-10]}`
  if (n < 30) return `כ״${ones[n-20] || ''}`
  return 'ל׳'
}

function skyMode(minutes:number, sunrise:number|null, sunset:number|null): 'mode-day'|'mode-dusk'|'mode-night' {
  if (sunrise==null || sunset==null) return 'mode-night'
  const dawnStart = sunrise - 120
  const duskEnd = sunset + 120
  if (minutes < dawnStart || minutes > duskEnd) return 'mode-night'
  // End day 30 minutes before sunset to enter dusk earlier on evening only
  const eveningDayEnd = sunset - 30
  if (minutes >= sunrise && minutes <= eveningDayEnd) return 'mode-day'
  return 'mode-dusk'
}

function skyColor(
  minutes:number,
  sunrise:number|null,
  sunset:number|null,
  centers?: { dawnCenter?: string|null; duskCenter?: string|null }
){
  const nightTop = '#0f1025', nightBot = '#000000'
  const dawnTop = '#2b1242', dawnBot = '#8a2e4e'
  const dayTop = '#a6d8ff', dayBot = '#e9f6ff'
  const duskTop = '#ffb36b', duskBot = '#2b1242'

  if (sunrise==null || sunset==null){
    return `linear-gradient(180deg, ${nightTop}, ${nightBot})`
  }

  const dawnInStart = sunrise - 120
  const dawnInEnd = sunrise + 30
  // Sunset background transition: sunset − 160 → sunset + 90
  const duskOutStart = sunset - 160
  const duskOutEnd = sunset + 90

  // Helper to add a soft radial focus overlay centered at a given point
  const addFocus = (base:string, center:string|undefined|null, weight:number = 1) => {
    if (!center || weight <= 0) return base
    const w = Math.max(0, Math.min(1, weight))
    // Tighter glow aligned with sun radius; scale opacity by weight
    const glow = `radial-gradient(circle at ${center}, rgba(255,179,107,${(0.45*w).toFixed(3)}) 0%, rgba(255,179,107,${(0.25*w).toFixed(3)}) 10%, rgba(255,179,107,0) 22%)`
    return `${glow}, ${base}`
  }

  if (minutes < dawnInStart) {
    return `linear-gradient(180deg, ${nightTop}, ${nightBot})`
  }
  if (minutes <= dawnInEnd) {
    const t1 = clamp((minutes - dawnInStart) / (dawnInEnd - dawnInStart), 0, 1)
    if (t1 < 0.5){
      const tt = t1 / 0.5
      const g = mixGradient(nightTop, nightBot, dawnTop, dawnBot, tt)
      // Focus sunrise fades in from 30 minutes before sunrise to sunrise, then stays at 1 until dawn end
      let weight = 0
      if (sunrise!=null){
        const start = sunrise - 30
        if (minutes >= start && minutes <= sunrise){
          weight = (minutes - start) / 30
        } else if (minutes > sunrise && minutes <= dawnInEnd){
          weight = 1
        }
      }
      return addFocus(g, centers?.dawnCenter ?? '30% 96%', weight)
    } else {
      const tt = (t1 - 0.5) / 0.5
      const g = mixGradient(dawnTop, dawnBot, dayTop, dayBot, tt)
      let weight = 0
      if (sunrise!=null){
        const start = sunrise - 30
        if (minutes >= start && minutes <= sunrise){
          weight = (minutes - start) / 30
        } else if (minutes > sunrise && minutes <= dawnInEnd){
          weight = 1
        }
      }
      return addFocus(g, centers?.dawnCenter ?? '30% 96%', weight)
    }
  }
  if (minutes < duskOutStart) {
    // Daytime base
    const base = `linear-gradient(180deg, ${dayTop}, ${dayBot})`
    // After sunrise completes, fade out focus over 30 minutes
    const dawnFadeStart = dawnInEnd
    const dawnFadeEnd = dawnFadeStart + 30
    let weight = 0
    if (sunrise!=null && minutes > dawnFadeStart && minutes < dawnFadeEnd){
      weight = 1 - (minutes - dawnFadeStart) / (dawnFadeEnd - dawnFadeStart)
    }
    return addFocus(base, centers?.dawnCenter, weight)
  }
  if (minutes <= duskOutEnd) {
    const t2 = clamp((minutes - duskOutStart) / (duskOutEnd - duskOutStart), 0, 1)
    if (t2 < 0.5){
      const tt = t2 / 0.5
      // Sunset: swap dusk colors order
      const g = mixGradient(dayTop, dayBot, duskBot, duskTop, tt)
      // Focus sunset fades in from 45 minutes before sunset to sunset, then stays at 1 until dusk end
      let weight = 0
      if (sunset!=null){
        const start = sunset - 45
        if (minutes >= start && minutes <= sunset){
          weight = (minutes - start) / 45
        } else if (minutes > sunset && minutes <= duskOutEnd){
          weight = 1
        }
      }
      return addFocus(g, centers?.duskCenter ?? '80% 96%', weight)
    } else {
      const tt = (t2 - 0.5) / 0.5
      // Sunset: swap dusk colors order
      const g = mixGradient(duskBot, duskTop, nightTop, nightBot, tt)
      let weight = 0
      if (sunset!=null){
        const start = sunset - 45
        if (minutes >= start && minutes <= sunset){
          weight = (minutes - start) / 45
        } else if (minutes > sunset && minutes <= duskOutEnd){
          weight = 1
        }
      }
      return addFocus(g, centers?.duskCenter ?? '80% 96%', weight)
    }
  }
  // Night base; after sunset completes, fade out focus over 30 minutes
  const baseNight = `linear-gradient(180deg, ${nightTop}, ${nightBot})`
  const duskFadeStart = duskOutEnd
  const duskFadeEnd = duskFadeStart + 30
  let duskWeight = 0
  if (sunset!=null && minutes > duskFadeStart && minutes < duskFadeEnd){
    duskWeight = 1 - (minutes - duskFadeStart) / (duskFadeEnd - duskFadeStart)
  }
  return addFocus(baseNight, centers?.duskCenter, duskWeight)
}

function arcPosition(minutes:number, rise:number|null, set:number|null, width:number, height:number){
  if (rise==null || set==null) return null
  const wraps = set < rise
  const isVisible = wraps ? (minutes >= rise || minutes <= set) : (minutes >= rise && minutes <= set)
  if (!isVisible) return null
  const total = wraps ? (1440 - rise) + set : (set - rise)
  const elapsed = wraps ? (minutes >= rise ? (minutes - rise) : (1440 - rise) + minutes) : (minutes - rise)
  const t = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0
  
  // Left-to-right (east on left → west on right)
  const cx = lerp(12, 88, t)
  
  // Calculate arc based on dimensions with mobile/PC adjustments
  // Arc spans from 12% to 88% of width = 76% of container width
  const arcWidthPercent = 76 // from 12% to 88%
  const arcWidthPixels = (arcWidthPercent / 100) * width
  
  // Base circular arc height (radius = arcWidth / 2)
  const baseCircularArcHeightPixels = arcWidthPixels / 2
  
  // Adjust based on aspect ratio for better appearance
  const aspectRatio = width / height
  let adjustedArcHeightPixels
  
  if (aspectRatio < 1.0) {
    // Mobile portrait - make arc bit more than width for better appearance
    adjustedArcHeightPixels = baseCircularArcHeightPixels * 1.15
  } else if (aspectRatio >= 1.6) {
    // PC/Desktop - make arc bit less than width for better appearance  
    adjustedArcHeightPixels = baseCircularArcHeightPixels * 0.85
  } else {
    // Tablet - keep close to circular
    adjustedArcHeightPixels = baseCircularArcHeightPixels
  }
  
  // Convert back to percentage of container height
  const arcHeightPercent = (adjustedArcHeightPixels / height) * 100
  
  // Calculate clearance for overlay-top based on screen size
  // Mobile needs more clearance due to larger overlay elements
  let topClearancePercent
  if (aspectRatio < 1.0) {
    // Mobile portrait - more clearance needed
    topClearancePercent = 18
  } else if (aspectRatio >= 1.6) {
    // Desktop - less clearance needed
    topClearancePercent = 12
  } else {
    // Tablet - medium clearance
    topClearancePercent = 15
  }
  
  // Clamp the arc height to reasonable bounds, accounting for top clearance
  // Arc should not exceed (85% - topClearance) to avoid covering the moon
  const maxArcHeight = Math.min(85 - topClearancePercent, arcHeightPercent)
  const clampedArcHeightPercent = Math.max(25, maxArcHeight)
  
  // Adjust the base position to account for clearance (start arc lower)
  const baseY = 90 + topClearancePercent * 0.3 // Move base position down slightly
  const cy = baseY - Math.sin(t * Math.PI) * clampedArcHeightPercent
  return { x: (cx/100)*width, y: (cy/100)*height }
}

function appearanceFromHebrewDay(hebrewDay:number){
  const synodic = 29.530588853
  // Align day 15 (ט"ו) with full moon and day 1 with a thin waxing crescent.
  // We offset the astronomical phase by ~0.765 days so that:
  //   hebrewDay=15 → phaseAngle ≈ π (full), hebrewDay=1 → small positive illumination (thin on right)
  const offsetDays = synodic/2 - 14 // ≈ 0.7653
  // Wrap around the synodic cycle instead of clamping
  const dayIdx = ((hebrewDay - 1 + offsetDays) % synodic + synodic) % synodic
  const phaseAngle = (2 * Math.PI * dayIdx) / synodic
  const illumination = (1 - Math.cos(phaseAngle)) / 2
  const rightLit = phaseAngle <= Math.PI
  return { illumination, rightLit }
}

function MoonSVG({illumination, rightLit, idSuffix}:{illumination:number; rightLit:boolean; idSuffix?: string}){
  const r = 40
  // Use radius proportional to shadow width so full moon has tiny shadow, new moon large
  const rx = Math.max(0.0001, r * (1 - illumination))
  // In northern hemisphere: waxing (rightLit=true) means bright on right, so shadow on left (negative shift)
  const side = rightLit ? -1 : 1
  const maskId = `m${idSuffix ?? ''}`

  return (
    <svg width={80} height={80} viewBox="0 0 80 80" aria-label="מצב הירח">
      <defs>
        <mask id={maskId}>
          <rect width="80" height="80" fill="black"/>
          <circle cx="40" cy="40" r="40" fill="white"/>
          <ellipse cx={40 + side*40*(1-illumination)} cy="40" rx={rx} ry={40} fill="black"/>
        </mask>
      </defs>
      <circle cx="40" cy="40" r="40" fill="#e2e8f0" mask={`url(#${maskId})`} />
    </svg>
  )
}

function MoonTwoCircle({t, idSuffix}:{t:number; idSuffix?: string}){
  const R = 40
  const maskId = `mtc${idSuffix ?? ''}`
  const tt = clamp(t, 0, 1)
  const L = 2*R
  let v: number
  if (tt <= 0.5) {
    v = -2 * L * tt          // 0 -> -L
  } else {
    v = 4 * L * tt - 3 * L   // -L -> +L
  }
  const x = v
  const y = v
  return (
    <svg width={80} height={80} viewBox="0 0 80 80" aria-label="מצב הירח">
      <defs>
        <mask id={maskId}>
          <rect width="80" height="80" fill="black"/>
          <circle cx="40" cy="40" r={R} fill="white"/>
          <circle cx={40 + x} cy={40 + y} r={R} fill="black"/>
        </mask>
      </defs>
      <circle cx="40" cy="40" r={R} fill="#e2e8f0" mask={`url(#${maskId})`} />
    </svg>
  )
}

function MoonPhasePath({ illumination, waxing, hebrewDay, idSuffix, disableTilt }: { illumination: number; waxing: boolean; hebrewDay?: number; idSuffix?: string; disableTilt?: boolean }) {
  const R = 40
  const cx = 40
  const cy = 40
  // Clamp away from exact 0/1 to avoid degenerate arcs: very small/new and very full are special-cased below
  const i = clamp(illumination, 0.001, 0.999)
  // Reverse geometry progression so waxing/waning day lists are in the expected visual order
  const iGeom = 1 - i
  const k = 2 * iGeom - 1 // -1=new, 0=half, 1=full (for geometry)
  const absK = Math.abs(k)
  let rx = R * absK
  const isEdgeDay = typeof hebrewDay === 'number' && (hebrewDay <= 2 || hebrewDay >= 29)
  if (isEdgeDay) {
    rx = Math.max(Math.round(R * 0.28), rx) // make the first two and last two days thicker
  } else if (i < 0.06 || i > 0.94) {
    rx = Math.max(Math.round(R * 0.15), rx) // slightly thicken ultra-thin crescent for visibility
  }

  if (illumination <= 0.001) {
    return (
      <svg width={80} height={80} viewBox="0 0 80 80" aria-label="ירח חדש">
        <circle cx={cx} cy={cy} r={R} fill="transparent" />
      </svg>
    )
  }
  if (illumination >= 0.999) {
    return (
      <svg width={80} height={80} viewBox="0 0 80 80" aria-label="ירח מלא">
        <circle cx={cx} cy={cy} r={R} fill="#e2e8f0" />
      </svg>
    )
  }

  const isCrescent = iGeom < 0.5
  let d: string
  if (waxing) {
    const innerSweep = isCrescent ? 1 : 0
    d = [
      `M ${cx} ${cy - R}`,
      `A ${R} ${R} 0 0 1 ${cx} ${cy + R}`,
      `A ${rx} ${R} 0 0 ${innerSweep} ${cx} ${cy - R}`,
      'Z',
    ].join(' ')
  } else {
    const innerSweep = isCrescent ? 0 : 1
    d = [
      `M ${cx} ${cy - R}`,
      `A ${R} ${R} 0 0 0 ${cx} ${cy + R}`,
      `A ${rx} ${R} 0 0 ${innerSweep} ${cx} ${cy - R}`,
      'Z',
    ].join(' ')
  }

  const baseTilt = 35
  const tilt = disableTilt ? 0 : (typeof hebrewDay === 'number' ? (hebrewDay <= 15 ? baseTilt : -baseTilt) : 0)

  const svgTransform = disableTilt ? undefined : `rotate(${tilt}deg) scaleX(-1)`
  return (
    <svg width={80} height={80} viewBox="0 0 80 80" aria-label="מצב הירח" style={{ transform: svgTransform, transformOrigin: '50% 50%' }}>
      <defs>
        <radialGradient id={`glow${idSuffix ?? ''}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.9" />
        </radialGradient>
        {/* Clip to illuminated shape for surface texture */}
        <clipPath id={`clipLit${idSuffix ?? ''}`}>
          <path d={d} />
        </clipPath>
        {/* Soft vignette to add depth inside lit area */}
        <radialGradient id={`texGrad${idSuffix ?? ''}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.08" />
        </radialGradient>
      </defs>
      <path d={d} fill={`url(#glow${idSuffix ?? ''})`} />
      {/* Subtle crater texture clipped to the lit region */}
      <g clipPath={`url(#clipLit${idSuffix ?? ''})`}>
        {/* Vignette */}
        <rect x="0" y="0" width="80" height="80" fill={`url(#texGrad${idSuffix ?? ''})`} />
        {/* Craters */}
        <g fill="#cbd5e1" opacity="0.3">
          <circle cx="28" cy="36" r="3.6" />
          <circle cx="34" cy="30" r="1.8" />
          <circle cx="46" cy="34" r="2.8" />
          <circle cx="52" cy="42" r="2.2" />
          <circle cx="38" cy="46" r="1.8" />
          <circle cx="44" cy="26" r="1.6" />
          {/* additional larger craters */}
          <circle cx="32" cy="44" r="4.2" />
          <circle cx="48" cy="28" r="3.8" />
          <circle cx="56" cy="36" r="3.4" />
          <circle cx="40" cy="40" r="2.6" />
          <circle cx="24" cy="32" r="2.4" />
          <circle cx="50" cy="46" r="2.8" />
          <circle cx="60" cy="30" r="2.2" />
          <circle cx="36" cy="24" r="1.8" />
          <circle cx="30" cy="50" r="2.0" />
        </g>
        {/* Inner shadows on some craters for depth */}
        <g stroke="#94a3b8" strokeOpacity="0.3" fill="none">
          <circle cx="28" cy="36" r="3.2" />
          <circle cx="46" cy="34" r="2.2" />
          <circle cx="52" cy="42" r="1.8" />
        </g>
      </g>
    </svg>
  )
}

function Stars(){
  const stars = useMemo(()=>{
    const arr:{left:string;top:string;size:number;opacity:number}[] = []
    for(let i=0;i<220;i++){
      const left = Math.random()*100
      const top = Math.random()*100
      const size = Math.random()*2 + 0.8
      const opacity = 0.6 + Math.random()*0.4
      arr.push({ left: `${left}%`, top: `${top}%`, size, opacity })
    }
    return arr
  },[])
  return (
    <div className="stars">
      {stars.map((s,idx)=> (
        <div key={idx} className="star" style={{left:s.left, top:s.top, width:s.size, height:s.size, opacity:s.opacity}}/>
      ))}
    </div>
  )
}

function Clouds(){
  const clouds = useMemo(()=>{
    const count = 8
    return Array.from({length: count}, (_,i)=>{
      const baseTop = 5 + (i/(count-1)) * 60 // distribute from 5% to 65%
      const jitter = (Math.random()*10) - 5   // ±5% jitter
      const top = Math.max(0, Math.min(80, baseTop + jitter))
      return {
        top,
        scale: 0.6 + Math.random()*0.8,
        duration: 60 + Math.random()*40,
        delay: Math.random()*-30,
      }
    })
  },[])
  return (
    <div className="clouds" aria-hidden>
      {clouds.map((c,idx)=> (
        <div key={idx} className="cloud" style={{ top: `${c.top}%`, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s`, transform: `scale(${c.scale})` }}>
          <div className="puff a"/>
          <div className="puff b"/>
          <div className="puff c"/>
        </div>
      ))}
    </div>
  )
}

function Mountains(){
  return (
    <div className="mountains" aria-hidden>
      <svg preserveAspectRatio="none" viewBox="0 0 100 40">
        <defs>
          <linearGradient id="mgrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--mtn-top)"/>
            <stop offset="100%" stopColor="var(--mtn-bot)"/>
          </linearGradient>
        </defs>
        {/* Back mountain and front ridge fully opaque to avoid showing the moon through */}
        <path d="M0 28 L10 18 L20 24 L30 16 L42 22 L53 14 L66 22 L80 17 L92 23 L96 32 L99 38 L100 39 L100 40 L0 40 Z" fill="var(--mtn-shade)" opacity="1"/>
        <path d="M0 31 L12 22 L24 27 L36 20 L48 25 L60 19 L74 25 L88 21 L94 33 L97.5 37 L99 39 L100 40 L0 40 Z" fill="url(#mgrad)" opacity="1"/>
      </svg>
    </div>
  )
}

function Ground(){
  // Green land extending under trees, descending toward the sea without a cliff
  return (
    <div className="ground" aria-hidden>
      <svg preserveAspectRatio="none" viewBox="0 0 100 40">
        <defs>
          <linearGradient id="ggrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#25442a"/>
            <stop offset="100%" stopColor="#162618"/>
          </linearGradient>
        </defs>
        {/* Plateau then gentle descent all the way to the right edge (mountains end) */}
        <path d="M0 36 L 82 36 C 92 36, 96 38, 100 40 L 0 40 Z" fill="url(#ggrad)"/>
      </svg>
    </div>
  )
}

function Trees(){
  const count = 8
  return (
    <div className="trees" aria-hidden>
      <svg preserveAspectRatio="none" viewBox="0 0 100 40">
        {new Array(count).fill(0).map((_,i)=>{
          const xBase = (i/(count-1)) * 100
          const x = xBase + (i === 2 ? 4 : 0) // nudge 3rd tree a bit more to the right
          const h = 9 + (i%3)*3
          return (
            <g key={i} transform={`translate(${x} 0)`}>
              <rect x="0" y={34-h} width="2" height={h} fill="#4a3a24"/>
              {/* back/bottom layer (rendered first to stay behind) */}
              <polygon points={`-4,${38-h} 1,${28-h} 6,${38-h}`} fill="#2b7a3c"/>
              {/* front layers */}
              <polygon points={`-3,${34-h} 1,${24-h} 5,${34-h}`} fill="#2f6b3a"/>
              <polygon points={`-2,${30-h} 1,${22-h} 4,${30-h}`} fill="#3b7a40"/>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Birds overlay removed per request

export default function App(){
  // Route: /debug shows debug grid
  const isDebug = typeof window !== 'undefined' && window.location && window.location.pathname === '/debug'
  if (isDebug){
    return <DebugTamuzList />
  }

  const [date, setDate] = useState('1969-07-20')
  const [hour, setHour] = useState('00:00')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingIllum, setLoadingIllum] = useState(0)
  const [loadingWaxing, setLoadingWaxing] = useState(true)
  const rafRef = useRef<number | null>(null)

  const [yearData, setYearData] = useState<YearData | null>(null)
  const [record, setRecord] = useState<DayRecord | null>(null)
  const [prevRecord, setPrevRecord] = useState<DayRecord | null>(null)
  const [nextRecord, setNextRecord] = useState<DayRecord | null>(null)
  const [minutes, setMinutes] = useState(0)
  const [sliderPos, setSliderPos] = useState(0)
  const [hebrewStart, setHebrewStart] = useState<number | null>(null)
  const [hebrewEnd, setHebrewEnd] = useState<number | null>(null)
  const [hebrewBoundary, setHebrewBoundary] = useState<number | null>(null) // today's sunset+offset
  const HEBREW_DAY_OFFSET_MIN = 20
  const [loading, setLoading] = useState(false)
  const year = useMemo(()=> Number(date.slice(0,4)), [date])

  const heroRef = useRef<HTMLDivElement|null>(null)
  const skyRef = useRef<HTMLDivElement|null>(null)
  const dateInputRef = useRef<HTMLInputElement|null>(null)
  const timeInputRef = useRef<HTMLInputElement|null>(null)
  const [skySize, setSkySize] = useState<{width:number;height:number}>({width: 900, height: 360})

  // Single source of truth for [A, B] based on yearData/date and hour vs sunset(D)
  const abWindow = useMemo(()=>{
    if (!yearData || !record) return { A: null as DayRecord|null, B: null as DayRecord|null }
    const d = new Date(date)
    const prev = new Date(d); prev.setDate(d.getDate()-1)
    const next = new Date(d); next.setDate(d.getDate()+1)
    const prevKey = formatYMDLocal(prev)
    const nextKey = formatYMDLocal(next)
    const prevRec = yearData[prevKey] ?? null
    const nextRec = yearData[nextKey] ?? null
    if (!showTimePicker){
      // No hour selected: always [D-1, D]
      return { A: prevRec ?? record, B: record }
    }
    const sunsetToday = timeToMinutes(record.sun.sunset ?? null)
    const birthMin = timeToMinutes(hour) ?? null
    if (sunsetToday!=null && birthMin!=null){
      if (birthMin < sunsetToday){
        // H before sunset: [D-1, D]
        return { A: prevRec ?? record, B: record }
      } else {
        // H after sunset: [D, D+1]
        return { A: record, B: nextRec ?? record }
      }
    }
    // Fallback when hour malformed: treat as no hour → [D-1, D]
    return { A: prevRec ?? record, B: record }
  }, [yearData, date, record, showTimePicker, hour])

  const activeHebrewRecord = abWindow.B
  useEffect(()=>{
    if (!skyRef.current) return
    const el = skyRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setSkySize({ width: rect.width || 900, height: rect.height || 360 })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('orientationchange', update)
    window.addEventListener('resize', update)
    return ()=>{
      ro.disconnect()
      window.removeEventListener('orientationchange', update)
      window.removeEventListener('resize', update)
    }
  }, [skyRef.current])

  // Focus the date input and pre-select the day (DD) segment for quick typing
  function focusDateDay(){
    const el = dateInputRef.current
    if (!el) return
    el.focus()
    try {
      const val = el.value || '0000-00-00'
      const lastHyphen = val.lastIndexOf('-')
      const dayStart = lastHyphen >= 0 ? lastHyphen + 1 : 8
      const dayEnd = dayStart + 2
      el.setSelectionRange?.(dayStart, dayEnd)
    } catch {}
  }

  // On initial load (and whenever we return to hero), focus the day segment
  useEffect(()=>{
    if (!submitted) {
      const id = window.setTimeout(focusDateDay, 0)
      return ()=> window.clearTimeout(id)
    }
  }, [submitted])

  // When enabling time picker, focus the time input and select the hour (HH)
  useEffect(()=>{
    if (showTimePicker){
      const id = window.setTimeout(()=>{
        const el = timeInputRef.current
        if (!el) return
        el.focus()
        try { el.setSelectionRange?.(0, 2) } catch {}
      }, 0)
      return ()=> window.clearTimeout(id)
    }
  }, [showTimePicker])

  useEffect(()=>{
    let ignore=false
    async function load(){
      setLoading(true)
      try{
        const res = await fetch(`${import.meta.env['BASE_URL']}data/dates/${year}.json`)
        const json = await res.json() as YearData
        if (!ignore) setYearData(json)
      } finally { setLoading(false) }
    }
    load()
    return ()=>{ ignore=true }
  },[year])

  useEffect(()=>{
    if (!yearData) return
    const rec = yearData[date] ?? null
    setRecord(rec)
    // compute Hebrew day window: sunset(today) → sunset(next day)
    if (rec){
      const d = new Date(date)
      const prev = new Date(d)
      const next = new Date(d)
      prev.setDate(d.getDate()-1)
      next.setDate(d.getDate()+1)
      const prevKey = formatYMDLocal(prev)
      const nextKey = formatYMDLocal(next)
      const prevRec = yearData[prevKey] ?? null
      const nextRec = yearData[nextKey] ?? null
      setPrevRecord(prevRec)
      setNextRecord(nextRec)
      const ssPrevRaw = timeToMinutes(prevRec?.sun.sunset ?? null)
      const ssCurrRaw = timeToMinutes(rec.sun.sunset ?? null)
      const ssNextRaw = timeToMinutes(nextRec?.sun.sunset ?? null)
      // Boundary for calculation (no offset)
      setHebrewBoundary(ssCurrRaw ?? null)
      // Determine A,B per spec: if hour < sunset(D) → [D-1, D], else [D, D+1]
      const birthMin = timeToMinutes(hour) ?? null
      // Use abWindow as the single source of truth for [A, B]
      const AstartRaw: number | null = timeToMinutes((abWindow.A?.sun.sunset ?? null))
      const BendRaw: number | null = timeToMinutes((abWindow.B?.sun.sunset ?? null))
      // Apply +20 only to displayed slider endpoints
      const winStart = AstartRaw!=null ? (AstartRaw + HEBREW_DAY_OFFSET_MIN) % 1440 : null
      const winEnd = BendRaw!=null ? (BendRaw + HEBREW_DAY_OFFSET_MIN) % 1440 : null
      setHebrewStart(winStart)
      setHebrewEnd(winEnd)

      if (!submitted){
        const bm = timeToMinutes(hour) ?? null
        const offset = (bm!=null && winStart!=null)
          ? ((bm - winStart + 1440) % 1440)
          : 0
        setSliderPos(Math.floor(offset * SLIDER_SLOWDOWN_FACTOR))
        const curMin = winStart!=null ? (winStart + Math.floor(offset)) % 1440 : (bm ?? 0)
        setMinutes(curMin)
      }
    }
  }, [yearData, date, hour, abWindow.A, abWindow.B])

  const slideRafRef = useRef<number | null>(null)
  const [showHints, setShowHints] = useState(false) // hand hint visibility (after auto-scroll ends)
  const [hintActive, setHintActive] = useState(false) // illumination label fade-in/out state
  const hintTimerRef = useRef<number | null>(null)
  const [thumbLeftPct, setThumbLeftPct] = useState(0)
  const [userInteractedWithSlider, setUserInteractedWithSlider] = useState(false)
  const iconTimerRef = useRef<number | null>(null)
  const [overrideGregToB, setOverrideGregToB] = useState(false)

  // Max slider value depends on the active Hebrew day window
  const maxSliderVal = useMemo(()=>{
    const ss0 = hebrewStart
    const ss1 = hebrewEnd
    const duration = (ss0!=null && ss1!=null) ? ((1440 - ss0) + ss1) : 1440
    return duration * SLIDER_SLOWDOWN_FACTOR
  }, [hebrewStart, hebrewEnd])

  // Helpers for interval intersection on circular 0..1440 timeline
  function toSegments(start:number, end:number): Array<{s:number,e:number}>{
    if (start==null || end==null) return []
    if (end >= start) return [{ s: start, e: end }]
    return [{ s: start, e: 1440 }, { s: 0, e: end }]
  }
  function intersectSegments(a: Array<{s:number,e:number}>, b: Array<{s:number,e:number}>){
    const out: Array<{s:number,e:number}> = []
    for (const sa of a){
      for (const sb of b){
        const s = Math.max(sa.s, sb.s)
        const e = Math.min(sa.e, sb.e)
        if (e > s) out.push({ s, e })
      }
    }
    return out
  }
  function midpointOfSegment(seg:{s:number,e:number}){
    return Math.floor(seg.s + (seg.e - seg.s)/2)
  }
  function midpointOfInterval(start:number, end:number){
    if (end >= start) return Math.floor(start + (end - start)/2)
    const span = (1440 - start) + end
    return (start + Math.floor(span/2)) % 1440
  }

  // Compute default auto target: intersection of [A sunset→B sunset] and [moonrise→moonset] for B.
  // If no intersection: use the earliest available moon time of B (moonrise or moonset).
  // If B has no moon times at all: fallback to the Hebrew window midpoint.
  const defaultAutoTargetMinutes = useMemo(()=>{
    // No-hour case: choose a target within B (D) closest to the midpoint
    // between moonrise and moonset of D, restricted to when the moon is visible.
    const endRaw = timeToMinutes(abWindow.B?.sun.sunset ?? null)
    const mrB = timeToMinutes(abWindow.B?.moon_times.moonrise ?? null)
    const msB = timeToMinutes(abWindow.B?.moon_times.moonset ?? null)
    if (endRaw==null) return null
    // Daytime of B (D) on the slider is [0..endRaw]
    const daySeg = [{ s: 0, e: endRaw }]
    // Build visible segments for D
    let visibleSegs: Array<{s:number,e:number}> = []
    if (mrB!=null && msB!=null){
      visibleSegs = toSegments(mrB, msB)
    } else if (mrB!=null){
      visibleSegs = [{ s: mrB, e: 1440 }]
    } else if (msB!=null){
      visibleSegs = [{ s: 0, e: msB }]
    }
    if (visibleSegs.length){
      // Intersect with B daytime
      const inter = intersectSegments(visibleSegs, daySeg)
      if (inter.length){
        // Compute midpoint of D's full visible window
        let midVisible: number
        if (mrB!=null && msB!=null){
          midVisible = midpointOfInterval(mrB, msB)
        } else if (mrB!=null){
          // Only moonrise known: approximate midpoint of [mrB..end of day]
          midVisible = midpointOfInterval(mrB, 1440)
        } else { // only msB
          midVisible = midpointOfInterval(0, msB as number)
        }
        // Snap to the nearest point within the intersection segments
        let best = inter[0]
        let bestDist = Infinity
        let bestPoint = inter[0].s
        for (const seg of inter){
          const within = (midVisible >= seg.s && midVisible <= seg.e)
          const candidate = within ? midVisible : (Math.abs(midVisible - seg.s) < Math.abs(midVisible - seg.e) ? seg.s : seg.e)
          const dist = Math.min(Math.abs(candidate - midVisible), Math.abs((candidate + 1440) - midVisible))
          if (dist < bestDist){
            best = seg
            bestDist = dist
            bestPoint = candidate
          }
        }
        return bestPoint
      }
    }
    // Fallback: midpoint of B daytime
    return Math.floor(endRaw / 2)
  }, [abWindow.B])

  // Keep hand-hint position proportional to slider value
  useEffect(()=>{
    const pct = maxSliderVal>0 ? (sliderPos / maxSliderVal) : 0
    setThumbLeftPct(Math.max(0, Math.min(1, pct))*100)
  }, [sliderPos, maxSliderVal])
  useEffect(()=>{
    if (!submitted) return
    // Animate slider from window start (left) to the selected hour within Hebrew window
    const startPos = 0
    const winStart = hebrewStart
    const winEnd = hebrewEnd
    const birthMin = showTimePicker ? (timeToMinutes(hour) ?? null) : (defaultAutoTargetMinutes ?? null)
    let targetOffDisp = 0
    if (winStart!=null && winEnd!=null && birthMin!=null){
      const durationDisp = ((1440 - winStart) + winEnd)
      const offDisp = (birthMin - winStart + 1440) % 1440
      targetOffDisp = Math.min(offDisp, durationDisp)
    }
    const targetPos = targetOffDisp * SLIDER_SLOWDOWN_FACTOR
    setSliderPos(startPos)
    if (hebrewStart!=null){ setMinutes(hebrewStart) }
    // During auto-scroll with no hour: start at A, flip to B at midnight via label logic
    setOverrideGregToB(false)
    const animStart = performance.now()
    // Dynamic auto-scroll duration: fraction * 8s, clamped to [1.5s, 5s]
    const fraction = maxSliderVal > 0 ? (targetPos / maxSliderVal) : 0
    const animDur = Math.max(1500, Math.min(5000, 8000 * fraction))
    // Start illumination label 2s after auto-scroll begins
    hintTimerRef.current && clearTimeout(hintTimerRef.current as unknown as number)
    hintTimerRef.current = window.setTimeout(()=> setHintActive(true), 2000)
    const animateSlide = (now:number) => {
      const t = Math.min(1, (now - animStart)/animDur)
      const eased = t*t*(3 - 2*t) // smoothstep
      const pos = startPos + (targetPos - startPos) * eased
      setSliderPos(pos)
      if (hebrewStart!=null){
        const off = Math.floor(pos/SLIDER_SLOWDOWN_FACTOR)
        const m = (hebrewStart + off) % 1440
        setMinutes(m)
      }
      if (t < 1){
        slideRafRef.current = requestAnimationFrame(animateSlide)
      } else {
        slideRafRef.current && cancelAnimationFrame(slideRafRef.current)
        slideRafRef.current = null
        // compute final percent for both text and icon before reveal
        const finalPct = maxSliderVal > 0 ? (targetPos / maxSliderVal) : 0
        setThumbLeftPct(Math.max(0, Math.min(1, finalPct)) * 100)
        setShowHints(false)
        iconTimerRef.current && clearTimeout(iconTimerRef.current as unknown as number)
        iconTimerRef.current = window.setTimeout(()=> {
          setShowHints(true)
        }, 500)
        // restore normal Gregorian label behavior after auto-scroll
        setOverrideGregToB(false)
      }
    }
    slideRafRef.current && cancelAnimationFrame(slideRafRef.current)
    slideRafRef.current = requestAnimationFrame(animateSlide)
    skyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return ()=>{
      hintTimerRef.current && clearTimeout(hintTimerRef.current as unknown as number)
      hintTimerRef.current = null
    }
  }, [submitted, maxSliderVal])

  const sunrise = timeToMinutes(record?.sun.sunrise ?? null)
  const sunset = timeToMinutes(record?.sun.sunset ?? null)
  const moonrise = timeToMinutes(record?.moon_times.moonrise ?? null)
  const moonset = timeToMinutes(record?.moon_times.moonset ?? null)

  const mode = skyMode(minutes, sunrise, sunset)
  const sky = useMemo(()=>{
    // Compute dynamic center on the same arc as the sun, based on current minutes
    const toCenterPct = (t:number): string => {
      const tt = Math.max(0, Math.min(1, t))
      const xPct = 12 + (88 - 12) * tt
      const yPct = 90 - Math.sin(Math.PI * tt) * 72
      return `${xPct}% ${yPct}%`
    }
    const dynamicCenter = (()=>{
      if (sunrise==null || sunset==null) return null
      if (sunset >= sunrise){
        // Normal case: day is [sunrise .. sunset]
        if (minutes <= sunrise) return toCenterPct(0)
        if (minutes >= sunset) return toCenterPct(1)
        const t = (minutes - sunrise) / (sunset - sunrise)
        return toCenterPct(t)
      } else {
        // Rare wrap case (polar): day spans midnight
        const total = (1440 - sunrise) + sunset
        if (minutes >= sunrise){
          const t = (minutes - sunrise) / total
          return toCenterPct(t)
        }
        if (minutes <= sunset){
          const t = ((1440 - sunrise) + minutes) / total
          return toCenterPct(t)
        }
        // Night outside the day span: clamp to start
        return toCenterPct(0)
      }
    })()
    return { background: skyColor(minutes, sunrise, sunset, { dawnCenter: dynamicCenter, duskCenter: dynamicCenter }) }
  }, [minutes, sunrise, sunset])
  // 30-minute visual lag for sea and mountains relative to sky transitions
  const minutesLag = minutes - 30
  const seaStyle = useMemo(()=>({ background: seaGradient(minutesLag, sunrise, sunset) }), [minutes, sunrise, sunset])
  const mtnCols = useMemo(()=> mountainColors(minutesLag, sunrise, sunset), [minutes, sunrise, sunset])

  const [facts, setFacts] = useState<string[]>([])
  const [funFact, setFunFact] = useState<string>('')

  useEffect(()=>{
    let ignore=false
    fetch(`${import.meta.env['BASE_URL']}data/facts/facts.json`)
      .then(r=> r.ok ? r.json() : [])
      .then((arr)=>{ if (!ignore && Array.isArray(arr)) setFacts(arr as string[]) })
      .catch(()=>{})
    return ()=>{ ignore=true }
  },[])

  function pickRandomFact(){
    const pool = facts.length ? facts : [
      'הירח תמיד מראה לנו את אותו הצד.',
      'אור הירח הוא בעצם אור שמש שמוחזר ממנו.',
      'ליקוי ירח מלא צובע את הירח באדום נחושת!',
    ]
    if (!pool.length) return
    let next = pool[Math.floor(Math.random()*pool.length)]
    if (pool.length > 1){
      let attempts = 0
      while (next === funFact && attempts < 5){
        next = pool[Math.floor(Math.random()*pool.length)]
        attempts++
      }
    }
    setFunFact(next)
  }

  function stageSentenceForDay(day:number): string{
    if (day >= 1 && day <= 3) return 'תחילת החודש – הירח נולד'
    if (day >= 4 && day <= 7) return 'הירח מתמלא – כל יום הוא גדול יותר'
    if (day >= 8 && day <= 13) return 'הירח כמעט מלא – צורתו עגולה כמעט לגמרי'
    if (day >= 14 && day <= 16) return 'ירח מלא – הלילה הכי מואר בחודש'
    if (day >= 17 && day <= 21) return 'הירח מתמעט – הלילה מתחיל להתכהות'
    if (day >= 22 && day <= 27) return 'הירח נעלם – כמעט ואינו נראה'
    return 'סוף החודש – הירח דק מאוד ונעלם בקרוב'
  }

  const handleSubmit = () => {
    // Loading animation: 3 cycles, 2s each (2x slower), new→full (waxing) then full→new (waning)
    setIsLoading(true)
    setUserInteractedWithSlider(false)
    // If user did not select a specific hour, default to midpoint between moonrise and moonset of selected date
    if (!showTimePicker && defaultAutoTargetMinutes!=null) {
      setHour(minutesToHM(defaultAutoTargetMinutes))
    }
    pickRandomFact()
    const start = performance.now()
    const cycleMs = 1000
    const durationMs = 2 * cycleMs
    const animate = (now:number) => {
      const elapsed = now - start
      const tCycle = Math.min(1, (elapsed % cycleMs) / cycleMs) // per-cycle 0..1
      const illum = (1 - Math.cos(2*Math.PI*tCycle)) / 2 // 0→1→0 smoothly
      setLoadingIllum(illum)
      setLoadingWaxing(tCycle < 0.5)
      if (elapsed < durationMs){
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setIsLoading(false)
        setSubmitted(true)
        rafRef.current && cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    rafRef.current && cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animate)
  }
  const handleStartOver = () => {
    rafRef.current && cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    slideRafRef.current && cancelAnimationFrame(slideRafRef.current)
    slideRafRef.current = null
    setIsLoading(false)
    setSubmitted(false)
    setUserInteractedWithSlider(false)
    setShowHints(false)
    // no separate icon hint flag; both elements controlled by showHints + userInteractedWithSlider
    setShowTimePicker(false)
    setHour('00:00')
    setMinutes(0)
    setSliderPos(0)
    // left percentage recalculated as sliderPos updates
    setThumbLeftPct(0)
    iconTimerRef.current && clearTimeout(iconTimerRef.current as unknown as number)
    iconTimerRef.current = null
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Refocus date input for immediate typing
    focusDateDay()
  }

  const hebrewDay = record?.hebrew_day ? record.hebrew_day : 1
  const moonAppearance = appearanceFromHebrewDay(hebrewDay)

  return (
    <div className="container">
      <div ref={heroRef} className={submitted ? 'hero hidden' : 'hero'}>
        <div className="hero-inline" style={isLoading ? {pointerEvents:'none', opacity:0.9} : undefined}>
          <h1 className="caption">איפה התחבאה לבנה ביום בו נולדתם?</h1>
          <span className="label">מתי נולדתם?</span>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'12px'}}>
            {/* Date picker - centered */}
            <div style={{display:'flex', justifyContent:'center'}} dir="ltr">
              <input
                className="input"
                style={{minWidth:'auto'}}
                type="date"
                min="1948-01-01"
                max="2030-01-01"
                value={date}
                ref={dateInputRef}
                onKeyDown={e=>{
                  if (e.key === 'Enter'){
                    e.preventDefault()
                    if (record && !loading && !isLoading){
                      handleSubmit()
                    }
                  }
                }}
                onChange={e=>{ const v=e.target.value; if (v) { setDate(v); setSubmitted(false) } }}
                onBlur={e=>{
                  const raw = (e.target as HTMLInputElement).value.trim()
                  const m = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/)
                  if (m){
                    const y = m[1]
                    const mm = String(Math.min(12, Math.max(1, Number(m[2])))).padStart(2,'0')
                    const dd = String(Math.min(31, Math.max(1, Number(m[3])))).padStart(2,'0')
                    const norm = `${y}-${mm}-${dd}`
                    if (norm >= '1948-01-01' && norm <= '2030-01-01'){
                      setDate(norm)
                    }
                  }
                }}
                disabled={isLoading}
              />
            </div>
            
            {/* Hour picker/button - below date picker */}
            <div style={{display:'flex', justifyContent:'center'}} dir="ltr">
              {showTimePicker ? (
                <input
                  className="input"
                  style={{minWidth:'auto'}}
                  type="time"
                  value={hour}
                  ref={timeInputRef}
                  onKeyDown={e=>{
                    if (e.key === 'Enter'){
                      e.preventDefault()
                      if (record && !loading && !isLoading){
                        handleSubmit()
                      }
                    }
                  }}
                  onChange={e=>{ setHour(e.target.value); setSubmitted(false) }}
                  disabled={isLoading}
                />
              ) : (
                <button className="button button-small" onClick={()=> setShowTimePicker(true)} disabled={isLoading}>הוסף שעה מדוייקת</button>
              )}
            </div>
          </div>
          <div className="row" style={{justifyContent:'center', marginTop: 'clamp(16px, 4vw, 24px)', padding: 'clamp(8px, 2vw, 16px)'}}>
            <button className="button" style={{padding: 'clamp(10px, 2.5vw, 14px) clamp(20px, 5vw, 32px)'}} onClick={handleSubmit} disabled={!record || loading || isLoading}>גלו</button>
          </div>
          {isLoading && (
            <div style={{marginTop:18}}>
              <div className="loading-moon" style={{display:'inline-block'}}>
                <MoonPhasePath illumination={loadingIllum} waxing={loadingWaxing} hebrewDay={loadingWaxing ? 8 : 23} idSuffix="-loading" disableTilt />
              </div>
              <div style={{marginTop:8, fontSize:13, color:'#cbd5e1'}}>מחשב…</div>
            </div>
          )}
        </div>
      </div>

      <div className={submitted ? '' : 'hidden'}>
        <div ref={skyRef} className={`sky ${mode}`} style={sky}>
          <div className="overlay-top">
            <div className="overlay-top-inner">
              {/* Hour moved below to slider area */}
              <div className="date-wrap">
                <div className="hebrew-date">
                  {(() => {
                    // Hebrew date follows B (end of Hebrew-day window) per spec
                    const hebDay = abWindow.B?.hebrew_day
                    const hebMonth = abWindow.B?.hebrew_month
                    const hebYear = abWindow.B?.hebrew_year
                    return (
                      <>
                        <span className="day-highlight">
                          {hebDay ? hebrewDayLetters(hebDay) : ''}
                          {hebDay ? ` (${hebDay})` : ''}
                        </span>
                        <span> ב{hebMonth || ''} {hebYear || ''}</span>
                      </>
                    )
                  })()}
                </div>
                <div className="greg-date" dir="ltr" style={{textAlign:'center'}}>
                  {(() => {
                    if (!record) return ''
                    const fmt = (g:Date)=>{
                      const y = g.getFullYear()
                      const m = String(g.getMonth()+1).padStart(2,'0')
                      const dd = String(g.getDate()).padStart(2,'0')
                      return `${dd}/${m}/${y}`
                    }
                    // Gregorian label:
                    // - During auto-scroll with no explicit hour: temporarily show B to match user focus on D.
                    // - Otherwise: before 00:00 show A; after 00:00 show B (midnight flip by raw interval).
                    const gA = new Date(date)
                    const gB = new Date(date)
                    if (abWindow.A === record) {
                      // A is D
                    } else {
                      // A is D-1
                      gA.setDate(gA.getDate()-1)
                    }
                    if (abWindow.B === record) {
                      // B is D
                    } else {
                      // B is D+1
                      gB.setDate(gB.getDate()+1)
                    }
                    if (overrideGregToB) return fmt(gB)
                    // Flip at midnight (00:00) exactly. The slider starts at displayed start (A sunset + offset),
                    // so adjust the raw midnight threshold by the display offset (HEBREW_DAY_OFFSET_MIN).
                    const startRaw = timeToMinutes(abWindow.A?.sun.sunset ?? null)
                    const endRaw = timeToMinutes(abWindow.B?.sun.sunset ?? null)
                    if (startRaw!=null && endRaw!=null){
                      let durRaw = (1440 - startRaw) + endRaw
                      if (durRaw <= 0) durRaw = 1440
                      const thresholdRaw = (1440 - startRaw) % 1440
                      const thresholdDisp = (thresholdRaw - HEBREW_DAY_OFFSET_MIN + 1440) % 1440
                      const off = Math.floor(sliderPos / SLIDER_SLOWDOWN_FACTOR)
                      const afterMidnight = off >= thresholdDisp
                      return afterMidnight ? fmt(gB) : fmt(gA)
                    }
                    return fmt(gA)
                  })()}
                </div>
                {/* Removed stage sentence per request */}
              </div>
            </div>
          </div>

          <Stars/>
          <Clouds/>
          {/* Birds overlay removed */}
          <div style={{
            // provide CSS vars to Mountains SVG for dynamic colors
            ['--mtn-top' as any]: mtnCols.top,
            ['--mtn-bot' as any]: mtnCols.bot,
            ['--mtn-shade' as any]: mtnCols.shade,
          } as React.CSSProperties}>
            <Mountains/>
          </div>
          <Ground/>
          <div className="sea" style={seaStyle}>
            <div className="wave"/>
            <div className="wave b"/>
            <div className="wave c"/>
            <div className="wave d"/>
            <div className="wave e"/>
            <div className="boat"/>
          </div>
          {/* Trees appear only on the mountain side (right) */}
          <Trees/>
          {/* East/West labels anchored inside the sky canvas */}
          <div className="west-label">מערב</div>
          <div className="east-label">מזרח</div>
          {(
            <div className={`illum-label ${hintActive ? 'show' : ''}`}>
              {(() => {
                const illum = Math.round(((activeHebrewRecord?.moon.illumination ?? 0) * 100))
                return `ביום שנולדת לבנה הייתה מוארת ב${illum}%`
              })()}
            </div>
          )}

          {(()=>{ 
            // Sun path uses sunrise of B-day (end day) per spec
            const sunriseB = timeToMinutes(abWindow.B?.sun.sunrise ?? null)
            const sunsetB = timeToMinutes(abWindow.B?.sun.sunset ?? null)
            const pos = arcPosition(minutes, sunriseB, sunsetB, skySize.width, skySize.height); 
            return pos && <div className="sun" style={{left:pos.x, top:pos.y}}/> 
          })()}

          {(() => {
            // Moon path across the Hebrew window: prefer A's rise, and B's set if A's set is missing (wrap across midnight)
            const moonriseA = timeToMinutes(abWindow.A?.moon_times.moonrise ?? null)
            const moonsetA = timeToMinutes(abWindow.A?.moon_times.moonset ?? null)
            const moonsetB = timeToMinutes(abWindow.B?.moon_times.moonset ?? null)
            const effectiveRise = moonriseA ?? timeToMinutes(abWindow.B?.moon_times.moonrise ?? null)
            const effectiveSet = (moonsetA != null ? moonsetA : moonsetB)
            const pos = arcPosition(minutes, effectiveRise, effectiveSet, skySize.width, skySize.height)
            // Night-glow fade around night mode: fade in 30 min BEFORE night starts, fade out 30 min AFTER night ends
            let nightGlowWeight = 0
            if (sunrise!=null && sunset!=null){
              const dawnStart = sunrise - 120
              const duskEnd = sunset + 120
              const fade = 90
              // Fade-in window before night starts on the evening side
              if (minutes > (duskEnd - fade) && minutes <= duskEnd){
                nightGlowWeight = (minutes - (duskEnd - fade)) / fade
              }
              // Full night between duskEnd and dawnStart (wrap over midnight)
              if (minutes > duskEnd || minutes < dawnStart){
                nightGlowWeight = 1
              }
              // Fade-out window AFTER night ends on the morning side
              if (minutes >= dawnStart && minutes < (dawnStart + fade)){
                nightGlowWeight = 1 - ((minutes - dawnStart) / fade)
              }
              nightGlowWeight = Math.max(0, Math.min(1, nightGlowWeight))
            }
            return pos && (
              <div className="moon" style={{
                left: pos.x,
                top: pos.y,
                filter: nightGlowWeight>0
                  ? `drop-shadow(0 0 12px rgba(210,230,255,${(1.0*nightGlowWeight).toFixed(3)})) drop-shadow(0 0 28px rgba(170,210,255,${(0.75*nightGlowWeight).toFixed(3)}))`
                  : undefined
              }}>
                {(() => {
                  let hebrewDayNum = record?.hebrew_day ?? 1
                  if (hebrewDayNum === 1) hebrewDayNum = 2
                  if (hebrewDayNum === 30) hebrewDayNum = 29
                  const { illumination, rightLit } = appearanceFromHebrewDay(hebrewDayNum)
                  // Invert to fix mirrored appearance
                  return <MoonPhasePath illumination={illumination} waxing={!rightLit} hebrewDay={hebrewDayNum} />
                })()}
              </div>
            )
          })()}
        </div>

        <div className="overlay-controls">
          <div className="overlay-grid">
            <div className="overlay-left" dir="ltr">
              <button className="button" onClick={handleStartOver}>התחילו מחדש</button>
            </div>
            <div className="overlay-center">
              <div className="time-badge" style={{fontSize:18}}>{minutesToHM(minutes)}</div>
              <div dir="ltr" style={{width:'100%'}}>
              {(() => {
                const ss0 = hebrewStart
                const ss1 = hebrewEnd
                const duration = (ss0!=null && ss1!=null) ? ((1440 - ss0) + ss1) : 1440
                const maxVal = duration * SLIDER_SLOWDOWN_FACTOR
                return (
                  <>
                  <div className="slider-wrap">
                  {showHints && !userInteractedWithSlider && (
                    <div className="hand-hint-text" style={{left: `${thumbLeftPct}%`, opacity: 1}}>גלו איפה הירח היה בשעות שונות של היום</div>
                  )}
                  {/* removed duplicate summary inside slider */}
                  <input className="slider" type="range" min={0} max={maxVal} step={1} value={sliderPos}
                    onChange={e=>{
                      const v = Number(e.target.value)
                      setSliderPos(v)
                      const off = Math.floor(v/SLIDER_SLOWDOWN_FACTOR)
                      if (ss0!=null){
                        const m = (ss0 + off) % 1440
                        setMinutes(m)
                      } else {
                        setMinutes(off)
                      }
                      const pct = maxVal>0 ? (v/maxVal) : 0
                      setThumbLeftPct(Math.max(0, Math.min(1, pct))*100)
                      // On user interaction: fade-out illumination label (2s via CSS transition) and hide hand hint
                      if (hintActive) setHintActive(false)
                      if (showHints) setShowHints(false)
                      setUserInteractedWithSlider(true)
                    }}/>
                  </div>
                  {/* Dedicated row to reserve space for the hand icon between slider and actions */}
                  <div className="hand-hint-row">
                    {showHints && !userInteractedWithSlider && (
                      <div className="hand-hint" style={{left: `calc(${thumbLeftPct}% + 5px)`}}>
                        <img className="icon" src={`${import.meta.env['BASE_URL']}data/icons/hand-swipe.svg`} alt="" />
                      </div>
                    )}
                  </div>
                  </>
                )
              })()}
              </div>
            </div>
            <div className="overlay-right">
              <div className="facts">
                <div className="facts-title" onClick={pickRandomFact} style={{cursor:'pointer'}} title="לחצו כדי לראות עובדה נוספת">הידעת?</div>
                <div className="facts-text">{funFact}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}