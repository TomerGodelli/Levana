import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DayRecord, YearData } from './types'

const SLIDER_SLOWDOWN_FACTOR = 4

// Auto-scroll speed parameters (reverted to single speed)
const UNIFORM_SPEED = 1.0              // Single speed for all auto-scroll

// Simplified function that returns uniform speed
function getUniformScrollSpeed(): number {
  return UNIFORM_SPEED
}

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
  // Updated background transition timing
  const dawnInStart = sunrise - 60
  const dawnInEnd = sunrise + 30
  const duskOutStart = sunset - 45
  const duskOutEnd = sunset + 30
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
  const dawnInStart = sunrise - 60
  const dawnInEnd = sunrise + 30
  const duskOutStart = sunset - 45
  const duskOutEnd = sunset + 30
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
  const dawnStart = sunrise - 60
  const duskEnd = sunset + 30
  if (minutes < dawnStart || minutes > duskEnd) return 'mode-night'
  // End day 45 minutes before sunset to match dusk transition start
  const eveningDayEnd = sunset - 45
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

  const dawnInStart = sunrise - 60
  const dawnInEnd = sunrise + 30
  // Updated background transition timing
  const duskOutStart = sunset - 45
  const duskOutEnd = sunset + 30

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
    const sunCenter = centers?.dawnCenter ?? '30% 96%'
    
    if (t1 < 0.5){
      const tt = t1 / 0.5
      // Create radial gradient centered at sun position for sunrise (inverted colors)
      const g = `radial-gradient(circle at ${sunCenter}, ${mixColor(nightBot, dawnBot, tt)}, ${mixColor(nightTop, dawnTop, tt)})`
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
      return addFocus(g, sunCenter, weight)
    } else {
      const tt = (t1 - 0.5) / 0.5
      // Create radial gradient centered at sun position transitioning to day (inverted colors)
      const g = `radial-gradient(circle at ${sunCenter}, ${mixColor(dawnBot, dayBot, tt)}, ${mixColor(dawnTop, dayTop, tt)})`
      let weight = 0
      if (sunrise!=null){
        const start = sunrise - 30
        if (minutes >= start && minutes <= sunrise){
          weight = (minutes - start) / 30
        } else if (minutes > sunrise && minutes <= dawnInEnd){
          weight = 1
        }
      }
      return addFocus(g, sunCenter, weight)
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
    const sunCenter = centers?.duskCenter ?? '80% 96%'
    
    if (t2 < 0.5){
      const tt = t2 / 0.5
      // Create radial gradient centered at sun position for sunset (inverted colors)
      const g = `radial-gradient(circle at ${sunCenter}, ${mixColor(dayBot, duskTop, tt)}, ${mixColor(dayTop, duskBot, tt)})`
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
      return addFocus(g, sunCenter, weight)
    } else {
      const tt = (t2 - 0.5) / 0.5
      // Create radial gradient centered at sun position transitioning to night (inverted colors)
      const g = `radial-gradient(circle at ${sunCenter}, ${mixColor(duskTop, nightBot, tt)}, ${mixColor(duskBot, nightTop, tt)})`
      let weight = 0
      if (sunset!=null){
        const start = sunset - 45
        if (minutes >= start && minutes <= sunset){
          weight = (minutes - start) / 45
        } else if (minutes > sunset && minutes <= duskOutEnd){
          weight = 1
        }
      }
      return addFocus(g, sunCenter, weight)
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
  // Body is visible from rise to set (inclusive of set time)
  const isVisible = wraps ? (minutes >= rise || minutes <= set) : (minutes >= rise && minutes <= set)
  if (!isVisible) return null
  
  // Calculate t based on rise/set times
  const total = wraps ? (1440 - rise) + set : (set - rise)
  const elapsed = wraps ? (minutes >= rise ? (minutes - rise) : (1440 - rise) + minutes) : (minutes - rise)
  let t = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0
  
  // Ensure t reaches exactly 1.0 at set time (so body reaches 95% at sunset)
  if (minutes >= set) {
    t = 1.0
  }
  
  // Left-to-right (east on left → west on right)
  const cx = lerp(5, 95, t)  // Reduced padding further: 5% to 95% for maximum arc width
  
  // Calculate arc based on dimensions with mobile/PC adjustments
  // Arc spans from 5% to 95% of width = 90% of container width
  const arcWidthPercent = 90 // from 5% to 95%
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
  
  // Calculate clearance for overlay-top + moon size based on screen size
  // Need to account for date-wrap element AND provide moon-size clearance below it
  let topClearancePercent
  if (aspectRatio < 1.0) {
    // Mobile portrait - more clearance needed (date-wrap + moon size)
    topClearancePercent = 25
  } else if (aspectRatio >= 1.6) {
    // Desktop - moderate clearance needed
    topClearancePercent = 20
  } else {
    // Tablet - medium clearance
    topClearancePercent = 22
  }
  
  // Clamp the arc height to reasonable bounds, accounting for top clearance
  // Arc should not exceed (85% - topClearance) to avoid covering the moon
  const maxArcHeight = Math.min(85 - topClearancePercent, arcHeightPercent)
  const clampedArcHeightPercent = Math.max(25, maxArcHeight)
  
  // Calculate sea div position (bottom: 0, height: 15%) = top at 85%
  const seaTopPercent = 85
  
  // Set arc baseline exactly at sea top level for proper horizon alignment
  const baseY = seaTopPercent
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

  // Calculate tilt and transform before early returns to ensure consistency
  const baseTilt = 35
  const tilt = disableTilt ? 0 : (typeof hebrewDay === 'number' ? (hebrewDay <= 15 ? baseTilt : -baseTilt) : 0)

  if (illumination <= 0.001) {
    const svgTransform = disableTilt ? undefined : `rotate(${tilt}deg) scaleX(-1)`
    return (
      <svg width={80} height={80} viewBox="0 0 80 80" aria-label="ירח חדש" style={{ transform: svgTransform, transformOrigin: '50% 50%' }}>
        <circle cx={cx} cy={cy} r={R} fill="transparent" />
      </svg>
    )
  }
  if (illumination >= 0.999) {
    const svgTransform = disableTilt ? undefined : `rotate(${tilt}deg) scaleX(-1)`
    return (
      <svg width={80} height={80} viewBox="0 0 80 80" aria-label="ירח מלא" style={{ transform: svgTransform, transformOrigin: '50% 50%' }}>
        <defs>
          <radialGradient id={`glowFull${idSuffix ?? ''}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.9" />
          </radialGradient>
          {/* Soft vignette for full moon */}
          <radialGradient id={`texGradFull${idSuffix ?? ''}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.08" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill={`url(#glowFull${idSuffix ?? ''})`} />
        {/* Full moon craters - not clipped since entire moon is visible */}
        <g>
          {/* Vignette */}
          <circle cx={cx} cy={cy} r={R} fill={`url(#texGradFull${idSuffix ?? ''})`} />
          {/* Craters */}
          <g fill="#cbd5e1" opacity="0.3">
            {/* Top area craters */}
            <circle cx="35" cy="15" r="2.4" />
            <circle cx="50" cy="18" r="1.6" />
            <circle cx="25" cy="20" r="1.8" />
            <circle cx="42" cy="12" r="1.4" />
            <circle cx="60" cy="15" r="1.2" />
            {/* Upper-middle area */}
            <circle cx="18" cy="28" r="3.2" />
            <circle cx="62" cy="25" r="2.8" />
            <circle cx="45" cy="28" r="1.8" />
            <circle cx="32" cy="22" r="1.5" />
            <circle cx="68" cy="32" r="1.6" />
            {/* Middle area (main large craters) */}
            <circle cx="28" cy="38" r="4.2" />
            <circle cx="55" cy="35" r="3.8" />
            <circle cx="40" cy="42" r="2.6" />
            <circle cx="15" cy="45" r="2.4" />
            <circle cx="65" cy="40" r="2.0" />
            {/* Lower-middle area */}
            <circle cx="22" cy="48" r="2.2" />
            <circle cx="58" cy="48" r="2.8" />
            <circle cx="38" cy="55" r="1.8" />
            <circle cx="45" cy="52" r="1.4" />
            <circle cx="28" cy="58" r="1.6" />
            {/* Bottom area craters */}
            <circle cx="32" cy="62" r="2.0" />
            <circle cx="48" cy="60" r="1.6" />
            <circle cx="55" cy="65" r="1.3" />
            <circle cx="40" cy="68" r="1.5" />
            {/* Edge craters */}
            <circle cx="12" cy="40" r="1.8" />
            <circle cx="70" cy="50" r="1.4" />
            <circle cx="10" cy="25" r="1.2" />
          </g>
          {/* Inner shadows on some craters for depth */}
          <g stroke="#94a3b8" strokeOpacity="0.3" fill="none">
            <circle cx="18" cy="28" r="2.8" />
            <circle cx="28" cy="38" r="3.8" />
            <circle cx="55" cy="35" r="3.4" />
            <circle cx="15" cy="45" r="2.0" />
            <circle cx="58" cy="48" r="2.4" />
          </g>
        </g>
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
          {/* Top area craters */}
          <circle cx="35" cy="15" r="2.4" />
          <circle cx="50" cy="18" r="1.6" />
          <circle cx="25" cy="20" r="1.8" />
          <circle cx="42" cy="12" r="1.4" />
          <circle cx="60" cy="15" r="1.2" />
          {/* Upper-middle area */}
          <circle cx="18" cy="28" r="3.2" />
          <circle cx="62" cy="25" r="2.8" />
          <circle cx="45" cy="28" r="1.8" />
          <circle cx="32" cy="22" r="1.5" />
          <circle cx="68" cy="32" r="1.6" />
          {/* Middle area (main large craters) */}
          <circle cx="28" cy="38" r="4.2" />
          <circle cx="55" cy="35" r="3.8" />
          <circle cx="40" cy="42" r="2.6" />
          <circle cx="15" cy="45" r="2.4" />
          <circle cx="65" cy="40" r="2.0" />
          {/* Lower-middle area */}
          <circle cx="22" cy="48" r="2.2" />
          <circle cx="58" cy="48" r="2.8" />
          <circle cx="38" cy="55" r="1.8" />
          <circle cx="45" cy="52" r="1.4" />
          <circle cx="28" cy="58" r="1.6" />
          {/* Bottom area craters */}
          <circle cx="32" cy="62" r="2.0" />
          <circle cx="48" cy="60" r="1.6" />
          <circle cx="55" cy="65" r="1.3" />
          <circle cx="40" cy="68" r="1.5" />
          {/* Edge craters */}
          <circle cx="12" cy="40" r="1.8" />
          <circle cx="70" cy="50" r="1.4" />
          <circle cx="10" cy="25" r="1.2" />
        </g>
        {/* Inner shadows on some craters for depth */}
        <g stroke="#94a3b8" strokeOpacity="0.3" fill="none">
          <circle cx="18" cy="28" r="2.8" />
          <circle cx="28" cy="38" r="3.8" />
          <circle cx="55" cy="35" r="3.4" />
          <circle cx="15" cy="45" r="2.0" />
          <circle cx="58" cy="48" r="2.4" />
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
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingIllum, setLoadingIllum] = useState(0)
  const [loadingWaxing, setLoadingWaxing] = useState(true)
  const rafRef = useRef<number | null>(null)

  const [yearData, setYearData] = useState<YearData | null>(null)
  const [yearCache, setYearCache] = useState<Map<number, YearData>>(new Map())
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
  const [skySize, setSkySize] = useState<{width:number;height:number}>({width: 900, height: 360})
  const [isLandscape, setIsLandscape] = useState(false)
  const [eastClickCount, setEastClickCount] = useState(0)
  const [showDebugMode, setShowDebugMode] = useState(false)

  // Simplified: Only keep A/B for Hebrew day labels (the exception)
  const abWindow = useMemo(()=>{
    if (!yearData || !record) return { A: null as DayRecord|null, B: null as DayRecord|null }
    const d = new Date(date)
    const prev = new Date(d); prev.setDate(d.getDate()-1)
    const prevKey = formatYMDLocal(prev)
    const prevRec = yearData[prevKey] ?? null
    
    // Only used for Hebrew day labels now - all other logic uses record directly
    return { A: prevRec ?? record, B: record }
  }, [yearData, date, record])

  const activeHebrewRecord = record  // Simplified: use record directly for active Hebrew display
  
  // Year data cache and preloading system
  const loadYearData = async (targetYear: number): Promise<YearData | null> => {
    try {
      const res = await fetch(`${import.meta.env['BASE_URL']}data/dates/${targetYear}.json`)
      if (!res.ok) return null
      const data = await res.json() as YearData
      
      // Cache the loaded data
      setYearCache(prev => new Map(prev).set(targetYear, data))
      
      return data
    } catch (error) {
      console.warn(`Failed to load year ${targetYear}:`, error)
      return null
    }
  }

  // Background preloading of all years (non-blocking)
  useEffect(() => {
    const availableYears = Array.from({length: 82}, (_, i) => 1948 + i) // 1948-2029
    
    const preloadYears = async () => {
      // Load current year first for immediate UX
      if (!yearCache.has(year)) {
        await loadYearData(year)
      }
      
      // Then start with most common years (around current date and default 1969)
      const priorityYears = [2024, 2023, 2025, 1969, 1970, 1968, 2022, 2026]
      const otherYears = availableYears.filter(y => !priorityYears.includes(y) && y !== year)
      const allYears = [year, ...priorityYears.filter(y => y !== year), ...otherYears]
      
      for (const targetYear of allYears) {
        // Skip if already cached
        if (yearCache.has(targetYear)) continue
        
        // Small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 50))
        await loadYearData(targetYear)
      }
    }
    
    // Start preloading immediately
    preloadYears()
  }, [year]) // Re-run when year changes to prioritize new year

  // Handle east label clicks for debug mode (hidden easter egg)
  const handleEastLabelClick = () => {
    // Don't do anything if debug mode is already active - users shouldn't know they can click to close
    if (showDebugMode) {
      return
    }
    
    const newCount = eastClickCount + 1
    setEastClickCount(newCount)
    
    if (newCount >= 10) {
      setShowDebugMode(true)
      // Reset counter after activating debug mode
      setEastClickCount(0)
    }
  }

  // Fix real viewport height for mobile devices
  useEffect(() => {
    const updateRealViewport = () => {
      // Get the actual viewport height (excluding address bars, etc.)
      const vh = window.innerHeight * 0.01
      const fullVh = window.innerHeight
      
      // Set CSS custom properties for real viewport height
      document.documentElement.style.setProperty('--real-vh', `${vh}px`)
      document.documentElement.style.setProperty('--real-100vh', `${fullVh}px`)
    }
    
    updateRealViewport()
    window.addEventListener('resize', updateRealViewport)
    window.addEventListener('orientationchange', () => {
      // Delay to let orientation change complete
      setTimeout(updateRealViewport, 250)
    })
    
    return () => {
      window.removeEventListener('resize', updateRealViewport)
      window.removeEventListener('orientationchange', updateRealViewport)
    }
  }, [])

  // Enhanced orientation and size detection for Android compatibility
  useEffect(()=>{
    if (!skyRef.current) return
    const el = skyRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setSkySize({ width: rect.width || 900, height: rect.height || 360 })
      
      // Multi-method landscape detection for Android compatibility
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      const aspectRatio = windowWidth / windowHeight
      
      const isLandscapeByOrientation = window.orientation === 90 || window.orientation === -90
      const isLandscapeByDimensions = windowWidth > windowHeight
      const isLandscapeByAspectRatio = aspectRatio > 1.0
      const isMobileSize = Math.max(windowWidth, windowHeight) <= 1000 && Math.min(windowWidth, windowHeight) <= 767
      
      const detectedLandscape = isMobileSize && (isLandscapeByOrientation || isLandscapeByDimensions || isLandscapeByAspectRatio)
      setIsLandscape(detectedLandscape)
      
      // Apply landscape class to document for CSS targeting
      if (detectedLandscape) {
        document.documentElement.classList.add('js-landscape')
        document.documentElement.classList.remove('js-portrait')
      } else {
        document.documentElement.classList.add('js-portrait') 
        document.documentElement.classList.remove('js-landscape')
      }
    }
    
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('orientationchange', update)
    window.addEventListener('resize', update)
    
    // Also listen for orientation change events
    if ('onorientationchange' in window) {
      window.addEventListener('orientationchange', () => {
        // Delay update to allow orientation change to complete
        setTimeout(update, 100)
      })
    }
    
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



  // Watch for cache updates and immediately set data if available
  useEffect(() => {
    const cached = yearCache.get(year)
    if (cached) {
      setYearData(cached)
      setLoading(false)
    }
  }, [year, yearCache])

  // Load year data if not in cache
  useEffect(() => {
    let ignore = false
    
    const loadYear = async () => {
      // Skip if already in cache
      if (yearCache.has(year)) return
      
      // Load it
      setLoading(true)
      try {
        const data = await loadYearData(year)
        if (!ignore && data) {
          setYearData(data)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    
    loadYear()
    return () => { ignore = true }
  }, [year])

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
      const birthMin = null // No specific birth time since hour picker was removed
      // Use abWindow as the single source of truth for [A, B]
      const AstartRaw: number | null = timeToMinutes((abWindow.A?.sun.sunset ?? null))
      const BendRaw: number | null = timeToMinutes((abWindow.B?.sun.sunset ?? null))
      // Apply +20 only to displayed slider endpoints
      const winStart = AstartRaw!=null ? (AstartRaw + HEBREW_DAY_OFFSET_MIN) % 1440 : null
      const winEnd = BendRaw!=null ? (BendRaw + HEBREW_DAY_OFFSET_MIN) % 1440 : null
      setHebrewStart(winStart)
      setHebrewEnd(winEnd)

      if (!submitted){
        // No hour picker, start at midnight (00:00)
        setSliderPos(0)
        setMinutes(0)
      }
    }
  }, [yearData, date, record, prevRecord])

  const slideRafRef = useRef<number | null>(null)
  const [showHints, setShowHints] = useState(false) // hand hint visibility (after auto-scroll ends)
  const [hintActive, setHintActive] = useState(false) // illumination label fade-in/out state
  const hintTimerRef = useRef<number | null>(null)
  const [thumbLeftPct, setThumbLeftPct] = useState(0)
  const [userInteractedWithSlider, setUserInteractedWithSlider] = useState(false)
  const iconTimerRef = useRef<number | null>(null)
  const [overrideGregToB, setOverrideGregToB] = useState(false)

  // Max slider value now represents Georgian date (23:59 = 1439 minutes)
  const maxSliderVal = useMemo(()=>{
    return 1439 * SLIDER_SLOWDOWN_FACTOR // 00:00 to 23:59
  }, [])

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
    const endRaw = timeToMinutes(record?.sun.sunset ?? null)
    const mrD = timeToMinutes(record?.moon_times.moonrise ?? null)
    const msD = timeToMinutes(record?.moon_times.moonset ?? null)
    if (endRaw==null) return null
    // Daytime of B (D) on the slider is [0..endRaw]
    const daySeg = [{ s: 0, e: endRaw }]
    // Build visible segments for D
    let visibleSegs: Array<{s:number,e:number}> = []
    if (mrD!=null && msD!=null){
      visibleSegs = toSegments(mrD, msD)
    } else if (mrD!=null){
      visibleSegs = [{ s: mrD, e: 1440 }]
    } else if (msD!=null){
      visibleSegs = [{ s: 0, e: msD }]
    }
    if (visibleSegs.length){
      // Intersect with B daytime
      const inter = intersectSegments(visibleSegs, daySeg)
      if (inter.length){
        // Compute midpoint of D's full visible window
        let midVisible: number
        if (mrD!=null && msD!=null){
          midVisible = midpointOfInterval(mrD, msD)
        } else if (mrD!=null){
          // Only moonrise known: approximate midpoint of [mrD..end of day]
          midVisible = midpointOfInterval(mrD, 1440)
        } else { // only msD
          midVisible = midpointOfInterval(0, msD as number)
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
  }, [record])

  // Keep hand-hint position proportional to slider value
  useEffect(()=>{
    const pct = maxSliderVal>0 ? (sliderPos / maxSliderVal) : 0
    setThumbLeftPct(Math.max(0, Math.min(1, pct))*100)
    // Update minutes based on Georgian time (0-1439 minutes in a day)
    const georgianMinutes = Math.round(sliderPos / SLIDER_SLOWDOWN_FACTOR)
    setMinutes(Math.min(1439, georgianMinutes)) // Ensure never exceeds 23:59
  }, [sliderPos, maxSliderVal])
  useEffect(()=>{
    if (!submitted) return
    
    // 24-hour circular scroll: moonrise-30 → full circle → moonrise+75 OR midnight
    const moonriseTime = timeToMinutes(record?.moon_times.moonrise ?? null)
    const moonsetTime = timeToMinutes(record?.moon_times.moonset ?? null)
    const sunsetTime = timeToMinutes(record?.sun.sunset ?? null)
    if (!moonriseTime) return
    
    const startMinutes = moonriseTime - 30  // Start 30 minutes before moonrise
    
    // Determine end point: if moonrise > sunset, end at midnight; otherwise moonrise+75
    const shouldEndAtMidnight = sunsetTime !== null && moonriseTime > sunsetTime
    const endMinutes = shouldEndAtMidnight ? 1440 : (moonriseTime + 75)
    const totalMinutes = shouldEndAtMidnight ? 
      (1440 + (1440 - ((startMinutes % 1440 + 1440) % 1440))) : // Full cycle to midnight
      (1440 + 105) // Normal 25.75 hours
    
    // Handle the circular nature - start position might be negative or > 1440
    const normalizedStart = ((startMinutes % 1440) + 1440) % 1440
    const startPos = normalizedStart * SLIDER_SLOWDOWN_FACTOR
    
    // Set initial position  
    setSliderPos(startPos)
    setMinutes(normalizedStart)
    setOverrideGregToB(false)
    
    const animStart = performance.now()
    const duration = 10000 // 10 seconds for full 25-hour cycle
    
    // Clear any existing illumination label timer
    hintTimerRef.current && clearTimeout(hintTimerRef.current as unknown as number)
    setHintActive(false)
    
    const animate = (now: number) => {
      const elapsed = now - animStart
      const progress = Math.min(1, elapsed / duration)
      const eased = progress * progress * (3 - 2 * progress) // smoothstep
      
      // Calculate current position in the 25-hour cycle
      const currentMinutesInCycle = startMinutes + eased * totalMinutes
      
      // Normalize to 0-1439 range for display (circular wrap)
      const currentMinutes = ((currentMinutesInCycle % 1440) + 1440) % 1440
      const currentPos = currentMinutes * SLIDER_SLOWDOWN_FACTOR
      
      setSliderPos(currentPos)
      setMinutes(Math.round(currentMinutes))
      
      if (progress < 1) {
        slideRafRef.current = requestAnimationFrame(animate)
      } else {
        // Animation complete - should end at moonrise + 75
        slideRafRef.current = null
        setShowHints(false)
        iconTimerRef.current && clearTimeout(iconTimerRef.current as unknown as number)
        iconTimerRef.current = window.setTimeout(()=> {
          setShowHints(true)
        }, 500)
        // Show illumination label after auto-scroll completes
        hintTimerRef.current && clearTimeout(hintTimerRef.current as unknown as number)
        hintTimerRef.current = window.setTimeout(()=> setHintActive(true), 1000)
        setOverrideGregToB(false)
      }
    }
    
    slideRafRef.current && cancelAnimationFrame(slideRafRef.current)
    slideRafRef.current = requestAnimationFrame(animate)
    
    // Ensure we're at the top of the viewport for landscape mode
    window.scrollTo({ top: 0, behavior: 'smooth' })
    skyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    
    return ()=>{
      slideRafRef.current && cancelAnimationFrame(slideRafRef.current)
      slideRafRef.current = null
      hintTimerRef.current && clearTimeout(hintTimerRef.current as unknown as number)
      hintTimerRef.current = null
    }
  }, [submitted, maxSliderVal, record])

  const sunrise = timeToMinutes(record?.sun.sunrise ?? null)
  const sunset = timeToMinutes(record?.sun.sunset ?? null)
  const moonrise = timeToMinutes(record?.moon_times.moonrise ?? null)
  const moonset = timeToMinutes(record?.moon_times.moonset ?? null)

  const mode = skyMode(minutes, sunrise, sunset)
  const sky = useMemo(()=>{
    // Compute dynamic center on the same arc as the sun, based on current minutes
    // Use selected date sun times to match actual sun position
    const sunriseD = timeToMinutes(record?.sun.sunrise ?? null)
    const sunsetD = timeToMinutes(record?.sun.sunset ?? null)
    
    const dynamicCenter = (()=>{
      if (sunriseD==null || sunsetD==null) return { position: null, opacity: 0 }
      
      // Check if we're in background transition periods (when glow should be active)
      const dawnStart = sunriseD - 60
      const dawnEnd = sunriseD + 30  
      const duskStart = sunsetD - 45
      const duskEnd = sunsetD + 30
      
      const inDawnTransition = minutes >= dawnStart && minutes <= dawnEnd
      const inDuskTransition = minutes >= duskStart && minutes <= duskEnd
      
      // Calculate opacity based on transition progress
      let opacity = 0
      if (inDawnTransition) {
        // Fade in during first 15 minutes, full opacity during sunrise, fade out during last 15 minutes
        const dawnDuration = dawnEnd - dawnStart // 90 minutes
        const fadeInEnd = dawnStart + 15
        const fadeOutStart = dawnEnd - 15
        
        if (minutes <= fadeInEnd) {
          opacity = (minutes - dawnStart) / 15 // Fade in
        } else if (minutes >= fadeOutStart) {
          opacity = (dawnEnd - minutes) / 15 // Fade out
        } else {
          opacity = 1 // Full opacity
        }
      } else if (inDuskTransition) {
        // Fade in during first 15 minutes, full opacity during sunset, fade out to end at sunset + 10
        const duskDuration = duskEnd - duskStart // 75 minutes
        const fadeInEnd = duskStart + 15
        const fadeOutStart = duskEnd - 35  // Start fade out to end at sunset + 10 (instead of sunset + 30)
        
        if (minutes <= fadeInEnd) {
          opacity = (minutes - duskStart) / 15 // Fade in
        } else if (minutes >= fadeOutStart) {
          opacity = (duskEnd - 20 - minutes) / 15 // Fade out over 15 minutes, ending at sunset + 10
        } else {
          opacity = 1 // Full opacity
        }
      }
      
      opacity = Math.max(0, Math.min(1, opacity)) // Clamp to 0-1
      
      // Always calculate position during transition periods, even if opacity is 0
      // Use the same arcPosition function as the actual sun
      const pos = arcPosition(minutes, sunriseD, sunsetD, skySize.width, skySize.height)
      
      if (pos) {
        // Normal case: sun is visible, use actual position
        const xPct = (pos.x / skySize.width) * 100
        const yPct = (pos.y / skySize.height) * 100
        return { position: `${xPct.toFixed(1)}% ${yPct.toFixed(1)}%`, opacity }
      } else {
        // Sun is not visible but we're in transition - use transition-specific position
        if (inDawnTransition) {
          // During dawn transition but before sunrise: use sunrise position
          const startPos = arcPosition(sunriseD, sunriseD, sunsetD, skySize.width, skySize.height)
          if (startPos) {
            const xPct = (startPos.x / skySize.width) * 100
            const yPct = (startPos.y / skySize.height) * 100
            return { position: `${xPct.toFixed(1)}% ${yPct.toFixed(1)}%`, opacity }
          }
          return { position: "5.0% 85.0%", opacity }
        } else if (inDuskTransition) {
          // During dusk transition but after sunset: use sunset position
          const endPos = arcPosition(sunsetD, sunriseD, sunsetD, skySize.width, skySize.height)
          if (endPos) {
            const xPct = (endPos.x / skySize.width) * 100
            const yPct = (endPos.y / skySize.height) * 100
            return { position: `${xPct.toFixed(1)}% ${yPct.toFixed(1)}%`, opacity }
          }
          return { position: "95.0% 85.0%", opacity }
        }
        return { position: null, opacity: 0 }
      }
    })()
    return { 
      background: skyColor(minutes, sunrise, sunset, { dawnCenter: dynamicCenter.position, duskCenter: dynamicCenter.position }),
      glowCenter: dynamicCenter 
    }
  }, [minutes, sunrise, sunset, record, skySize])
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
    // Hour picker removed - no need to set specific hour
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

    setMinutes(0)
    setSliderPos(0)
    // left percentage recalculated as sliderPos updates
    setThumbLeftPct(0)
    iconTimerRef.current && clearTimeout(iconTimerRef.current as unknown as number)
    iconTimerRef.current = null
    // Ensure we're at the top of the viewport  
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
          {/* Left section: Title and inputs */}
          <div className="hero-left" style={{display:'flex', flexDirection:'column', alignItems:'center', flex:'1', maxWidth:'60%'}}>
            <h1 className="caption">איפה התחבאה לבנה ביום בו נולדתם?</h1>
            <span className="label">מתי נולדתם?</span>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', width:'100%'}}>
              {/* Date picker */}
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
              

              
              {/* Submit button */}
              <div style={{marginTop:'8px'}}>
                <button className="button button-small" onClick={handleSubmit} disabled={!record || loading || isLoading}>גלו</button>
              </div>
            </div>
          </div>

          {/* Right section: Loading animation placeholder */}
          <div className="hero-right" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:'1', maxWidth:'40%'}}>
            <div style={{textAlign:'center', minHeight:'120px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
              {isLoading ? (
                <>
                  <div className="loading-moon" style={{display:'inline-block'}}>
                    <MoonPhasePath illumination={loadingIllum} waxing={loadingWaxing} hebrewDay={loadingWaxing ? 8 : 23} idSuffix="-loading" disableTilt />
                  </div>
                  <div style={{marginTop:'8px', fontSize:'clamp(11px, 2.5vw, 13px)', color:'#cbd5e1'}}>מחשב…</div>
                </>
              ) : (
                /* Invisible placeholder to maintain space */
                <div style={{width:'70px', height:'70px', opacity:0}}>
                  <div style={{width:'70px', height:'70px'}}></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={submitted ? '' : 'hidden'}>
        <div ref={skyRef} className={`sky ${mode}`} style={{
          background: sky.background,
          ...(showDebugMode ? {
            border: '3px solid #00ff00',
            boxSizing: 'border-box'
          } : {})
        }}>
          {/* Debug screen mode info - only show when debug mode is activated */}
          {showDebugMode && (
          <div className="debug-screen-mode" style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.8)',
            color: '#00ff00',
            padding: '8px 12px',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.4',
            zIndex: 15,
            maxWidth: '300px',
            direction: 'ltr',
            border: '1px solid #00ff00'
          }}>
            <div style={{
              position: 'absolute',
              top: '2px',
              right: '6px',
              cursor: 'pointer',
              color: '#ff0000',
              fontWeight: 'bold',
              fontSize: '16px',
              lineHeight: '1'
            }}
            onClick={() => setShowDebugMode(false)}
            title="Close debug mode"
            >
              ×
            </div>
            {(() => {
              if (typeof window === 'undefined') {
                return <div>Debug info loading...</div>
              }
              
              const windowWidth = window.innerWidth
              const windowHeight = window.innerHeight
              const aspectRatio = windowWidth / windowHeight
              const orientation = (window.orientation === 90 || window.orientation === -90 ? 'landscape' : 'portrait')
              
              const isLandscapeByOrientation = window.orientation === 90 || window.orientation === -90
              const isLandscapeByDimensions = windowWidth > windowHeight
              const isLandscapeByAspectRatio = aspectRatio > 1.0
              const isMobileSize = Math.max(windowWidth, windowHeight) <= 1000 && Math.min(windowWidth, windowHeight) <= 767
              
              const detectedLandscape = isMobileSize && (isLandscapeByOrientation || isLandscapeByDimensions || isLandscapeByAspectRatio)
              
              let screenMode = 'PC/Desktop'
              if (isMobileSize) {
                screenMode = detectedLandscape ? 'Mobile Landscape' : 'Mobile Portrait'
              }
              

              
              return (
                <>
                  <div style={{fontWeight: 'bold', color: '#00ffff'}}>Screen Mode: {screenMode}</div>
                  <div style={{marginTop: '4px', fontSize: '10px', color: '#ffff00'}}>
                    Size: {windowWidth}x{windowHeight} | Ratio: {aspectRatio.toFixed(2)}
                  </div>

                  <div style={{marginTop: '8px', fontSize: '10px', color: '#00ff88'}}>
                    Sun Arc: {sunrise && sunset ? `${minutesToHM(sunrise)}-${minutesToHM(sunset)}` : 'N/A'}
                    <br/>Moon Arc: {moonrise && moonset ? `${minutesToHM(moonrise)}-${minutesToHM(moonset)}` : 'N/A'}
                  </div>
                  <div style={{marginTop: '6px', fontSize: '9px', color: '#cccccc'}}>
                    <div>🟢 Sky container</div>
                    <div>🔴 Overlay-controls</div>
                    <div>🟡 Overlay-grid</div>
                    <div>🔵 Grid sections</div>
                  </div>
                </>
              )
            })()}
          </div>
          )}
          
          {/* Debug glow center marker */}
          {showDebugMode && sky.glowCenter.position && (
            <div style={{
              position: 'absolute',
              left: sky.glowCenter.position.split(' ')[0],
              top: sky.glowCenter.position.split(' ')[1],
              width: '12px',
              height: '12px',
              background: '#ff00ff',
              border: '2px solid #ffffff',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
              pointerEvents: 'none',
              boxShadow: '0 0 8px rgba(255, 0, 255, 0.8)',
              opacity: sky.glowCenter.opacity,
              transition: 'opacity 2s ease-in-out, left 0.3s ease-out, top 0.3s ease-out'
            }}
            title="Glow Center"
            />
          )}
          
          <div className="overlay-top">
            <div className="overlay-top-inner">
              {/* Hour moved below to slider area */}
              <div className="date-wrap">
                <div className="hebrew-date">
                  {(() => {
                    // New logic: show Georgian date's Hebrew date until sunset, then D+1's Hebrew date
                    const sunsetMinutes = timeToMinutes(record?.sun.sunset ?? null)
                    const currentMinutes = minutes
                    
                    let hebRecord
                    if (sunsetMinutes != null && currentMinutes >= sunsetMinutes) {
                      // After sunset: show D+1 Hebrew date (next day)
                      const d = new Date(date)
                      const next = new Date(d)
                      next.setDate(d.getDate() + 1)
                      const nextKey = formatYMDLocal(next)
                      hebRecord = yearData?.[nextKey] ?? null
                    } else {
                      // Before sunset: show current Georgian date's Hebrew date  
                      hebRecord = record
                    }
                    
                    const hebDay = hebRecord?.hebrew_day
                    const hebMonth = hebRecord?.hebrew_month
                    const hebYear = hebRecord?.hebrew_year
                    
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
                    // Simplified: always show D (the selected Georgian date)
                    // since slider now represents Georgian date 00:00-23:59
                    const gregorianDate = new Date(date)
                    return fmt(gregorianDate)
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
          {/* Invisible click area over east label for debug mode - completely hidden from users */}
          <div 
            onClick={handleEastLabelClick}
            style={{
              position: 'absolute',
              top: '50%',
              left: 'clamp(10px, 5vw, 60px)',
              transform: 'translateY(-50%)',
              padding: 'clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px)',
              background: 'transparent',
              border: 'none',
              cursor: 'default',
              zIndex: 11,
              fontSize: 'clamp(12px, 3vw, 16px)',
              color: 'transparent',
              userSelect: 'none'
            }}
            aria-hidden="true"
          >
            מזרח
          </div>
          {(() => {
            // Position illumination label to the right of the moon
            const moonriseD = timeToMinutes(record?.moon_times.moonrise ?? null)
            const moonsetD = timeToMinutes(record?.moon_times.moonset ?? null)
            
            let moonPos = null
            if (moonriseD != null && moonsetD != null) {
              const moonWraps = moonsetD < moonriseD
              
              if (moonWraps) {
                if (minutes >= moonriseD || minutes <= moonsetD) {
                  const totalDuration = (1440 - moonriseD) + moonsetD
                  let elapsed
                  
                  if (minutes >= moonriseD) {
                    elapsed = minutes - moonriseD
                  } else {
                    elapsed = (1440 - moonriseD) + minutes
                  }
                  
                  const progress = elapsed / totalDuration
                  const continuousTime = progress * 1440
                  moonPos = arcPosition(continuousTime, 0, 1440, skySize.width, skySize.height)
                }
              } else {
                moonPos = arcPosition(minutes, moonriseD, moonsetD, skySize.width, skySize.height)
              }
            }
            
            // Only show label if moon is visible
            if (!moonPos) return null
            
            const rawIllum = (activeHebrewRecord?.moon.illumination ?? 0) * 100
            const illum = Math.round(rawIllum)
            const hebrewDay = activeHebrewRecord?.hebrew_day
            
            // Format illumination percentage with special handling for very low values
            const illuminationText = illum < 1 ? 'בפחות מ1%' : `ב${illum}%`
            
            let text = ''
            if (hebrewDay === 1) {
              text = `נולדת בראש חודש! ביום זה לבנה מוארת ${illuminationText}`
            } else if (hebrewDay === 15) {
              text = `ביום שנולדת הירח היה מלא!`
            } else {
              text = `ביום שנולדת לבנה הייתה מוארת ${illuminationText}`
            }
            
            // Calculate moon div size and positioning
            const moonDivSize = Math.min(Math.max(64, skySize.width * 0.12), 84) // clamp(64px, 12vw, 84px)
            const moonDivHalfSize = moonDivSize / 2
            const padding = 8
            const labelMaxWidth = Math.min(300, skySize.width - 20) // Max label width
            
            // Position label to the right of the moon DIV
            const labelTop = moonPos.y - moonDivHalfSize // Align with top of moon div
            
            // X-axis: Position to the right of the moon div
            const labelLeft = moonPos.x + moonDivHalfSize + padding // Right edge + padding
            
            // Ensure label doesn't go off right screen edge - if it does, position to the left
            let adjustedLeft = labelLeft
            if (labelLeft + labelMaxWidth > skySize.width - 10) {
              // Position to the left of the moon instead
              adjustedLeft = moonPos.x - moonDivHalfSize - padding - labelMaxWidth
              // Ensure it doesn't go off the left edge either
              adjustedLeft = Math.max(10, adjustedLeft)
            }
            
            // Debug logging
            console.log('Moon positioning debug:', {
              moonPosX: moonPos.x,
              labelMaxWidth,
              labelLeft,
              adjustedLeft,
              skyWidth: skySize.width
            })
            
            return (
              <>
                {/* Illumination Label */}
                <div 
                  className={`illum-label moon-positioned ${hintActive ? 'show' : ''}`}
                  style={{
                    '--moon-label-left': `${adjustedLeft}px`,
                    '--moon-label-top': `${labelTop}px`,
                    direction: 'ltr' // Force LTR to avoid RTL mirroring issues
                  } as React.CSSProperties}
                >
                  {text}
                </div>
                
                {/* Moon Highlight Circle - only when label is visible */}
                {hintActive && (
                  <div 
                    className="moon-highlight-circle show"
                    style={{
                      left: `${moonPos.x - moonDivHalfSize - 4}px`, // Center on moon with extra padding
                      top: `${moonPos.y - moonDivHalfSize - 4}px`,
                      width: `${moonDivSize + 8}px`, // Moon size + padding
                      height: `${moonDivSize + 8}px`,
                      position: 'absolute',
                      borderRadius: '50%',
                      border: `3px solid ${sky.isDaylight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'}`,
                      pointerEvents: 'none',
                      zIndex: 5, // Below the moon but above sky
                      boxShadow: sky.isDaylight 
                        ? '0 0 20px rgba(0, 0, 0, 0.7), 0 0 40px rgba(0, 0, 0, 0.4), inset 0 0 8px rgba(0, 0, 0, 0.3)' 
                        : '0 0 20px rgba(255, 255, 255, 0.6), 0 0 40px rgba(255, 255, 255, 0.3), inset 0 0 8px rgba(255, 255, 255, 0.2)'
                    }}
                  />
                )}
              </>
            )
          })()}

          {(()=>{ 
            // Sun path uses the selected date's sunrise/sunset
            const sunriseD = timeToMinutes(record?.sun.sunrise ?? null)
            const sunsetD = timeToMinutes(record?.sun.sunset ?? null)
            const pos = arcPosition(minutes, sunriseD, sunsetD, skySize.width, skySize.height); 
            return pos && <div className="sun" style={{left:pos.x, top:pos.y}}/> 
          })()}

          {(() => {
            // Moon path uses the selected date's moonrise/moonset with proper midnight crossing handling
            const moonriseD = timeToMinutes(record?.moon_times.moonrise ?? null)
            const moonsetD = timeToMinutes(record?.moon_times.moonset ?? null)
            
            let pos = null
            if (moonriseD != null && moonsetD != null) {
              const moonWraps = moonsetD < moonriseD // Moon crosses midnight
              
              if (moonWraps) {
                // Moon crosses midnight - check which part of the cycle we're in
                if (minutes >= moonriseD || minutes <= moonsetD) {
                  // Moon is visible - calculate position on continuous arc
                  const totalDuration = (1440 - moonriseD) + moonsetD
                  let elapsed
                  
                  if (minutes >= moonriseD) {
                    // From moonrise to midnight
                    elapsed = minutes - moonriseD
                  } else {
                    // From midnight to moonset (continuing the arc)
                    elapsed = (1440 - moonriseD) + minutes
                  }
                  
                  // Map to a continuous arc (using a full 24-hour reference for smooth circular motion)
                  const progress = elapsed / totalDuration
                  const continuousTime = progress * 1440 // Map to full day cycle
                  pos = arcPosition(continuousTime, 0, 1440, skySize.width, skySize.height)
                }
              } else {
                // Normal case - moon doesn't cross midnight
                pos = arcPosition(minutes, moonriseD, moonsetD, skySize.width, skySize.height)
              }
            }
            // Night-glow fade around night mode: fade in 30 min BEFORE night starts, fade out 30 min AFTER night ends
            let nightGlowWeight = 0
            if (sunrise!=null && sunset!=null){
              const dawnStart = sunrise - 60
              const duskEnd = sunset + 30
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
                  // Use actual moon data instead of synthetic calculation
                  const actualIllumination = record?.moon.illumination ?? 0
                  const actualWaxing = record?.moon.waxing ?? true
                  const hebrewDayNum = record?.hebrew_day ?? 1
                  
                  // Set minimum 3% visibility for moon element (while keeping real data for label)
                  const moonDisplayIllumination = Math.max(actualIllumination, 0.03)
                  
                  // Special handling for Hebrew day 1: force waxing crescent for visual consistency
                  // Other days use real astronomical data
                  let displayWaxing
                  if (hebrewDayNum === 1) {
                    // Hebrew day 1 should always appear as waxing crescent (beginning of month)
                    displayWaxing = true
                  } else {
                    // Use real waxing data for other days
                    displayWaxing = actualWaxing
                  }
                  
                  // Use real moon data for accurate rendering
                  // Invert waxing to fix mirrored appearance (same logic as before)
                  return <MoonPhasePath 
                    illumination={moonDisplayIllumination} 
                    waxing={!displayWaxing} 
                    hebrewDay={hebrewDayNum} 
                  />
                })()}
              </div>
            )
          })()}

          {/* Debug mode: Visual arc indicators */}
          {showDebugMode && (
            <>
              {/* Sun Arc Indicator */}
              {(() => {
                // Static sun arc - always the same path regardless of rise/set times
                const points = []
                const step = 5 // Sample every 5 minutes
                const staticSunrise = 6 * 60  // 06:00 - fixed reference sunrise
                const staticSunset = 18 * 60  // 18:00 - fixed reference sunset
                
                for (let m = staticSunrise; m <= staticSunset; m += step) {
                  const pos = arcPosition(m, staticSunrise, staticSunset, skySize.width, skySize.height)
                  if (pos) points.push(`${pos.x},${pos.y}`)
                }
                
                if (points.length < 2) return null
                
                return (
                  <svg
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: 20
                    }}
                  >
                    <polyline
                      points={points.join(' ')}
                      fill="none"
                      stroke="#ffaa00"
                      strokeWidth="2"
                      strokeDasharray="5,3"
                      opacity="0.8"
                    />
                  </svg>
                )
              })()}

              {/* Moon Arc Indicator */}
              {(() => {
                // Static moon arc - identical to sun arc, completely independent of moon times
                const points = []
                const step = 10 // Sample every 10 minutes
                const staticSunrise = 6 * 60  // 06:00 - same reference as sun arc
                const staticSunset = 18 * 60  // 18:00 - same reference as sun arc
                
                for (let m = staticSunrise; m <= staticSunset; m += step) {
                  const pos = arcPosition(m, staticSunrise, staticSunset, skySize.width, skySize.height)
                  if (pos) points.push(`${pos.x},${pos.y}`)
                }
                
                if (points.length < 2) return null
                
                return (
                  <svg
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: 21
                    }}
                  >
                    <polyline
                      points={points.join(' ')}
                      fill="none"
                      stroke="#88ccff"
                      strokeWidth="2"
                      strokeDasharray="3,5"
                      opacity="0.7"
                    />
                  </svg>
                )
              })()}
            </>
          )}
        </div>

        <div className="overlay-controls" style={showDebugMode ? {
          border: '3px solid #ff0000',
          boxSizing: 'border-box'
        } : {}}>
          <div className="overlay-grid" style={showDebugMode ? {
            border: '2px solid #ffff00',
            boxSizing: 'border-box'
          } : {}}>
            <div className="overlay-left" dir="ltr" style={showDebugMode ? {
              border: '1px solid #00ffff',
              boxSizing: 'border-box'
            } : {}}>
              <button className="button" onClick={handleStartOver}>התחילו מחדש</button>
            </div>
            <div className="overlay-center" style={showDebugMode ? {
              border: '1px solid #00ffff',
              boxSizing: 'border-box'
            } : {}}>
              <div className="time-badge">{minutesToHM(minutes)}</div>
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
                    <div className="hand-hint-text" style={{
                      left: `${thumbLeftPct}%`, 
                      opacity: 1,
                      transform: thumbLeftPct < 15 ? 'translateX(0%)' : 
                                thumbLeftPct > 85 ? 'translateX(-100%)' : 
                                'translateX(-50%)'
                    }}>גלו איפה הירח היה בשעות שונות של היום</div>
                  )}
                  {/* removed duplicate summary inside slider */}
                  <input className="slider" type="range" min={0} max={maxVal} step={1} value={sliderPos}
                    onChange={e=>{
                      const v = Number(e.target.value)
                      setSliderPos(v)
                      // Minutes are now directly Georgian time (0-1439)
                      const georgianMinutes = Math.floor(v/SLIDER_SLOWDOWN_FACTOR)
                      setMinutes(georgianMinutes)
                      const pct = maxVal>0 ? (v/maxVal) : 0
                      setThumbLeftPct(Math.max(0, Math.min(1, pct))*100)
                      // On user interaction: hide hand hint and fade out illumination label
                      if (showHints) setShowHints(false)
                      if (hintActive) setHintActive(false)
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
            <div className="overlay-right" style={showDebugMode ? {
              border: '1px solid #00ffff',
              boxSizing: 'border-box'
            } : {}}>
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