import {useRef,useState} from 'react'
import {HeartPulse,ChevronRight} from 'lucide-react'
import EcgLine from './EcgLine'

/* Compass emblem: counter-rotating rings, a pulsing core and a needle that seeks north. */
function CompassArt(){
  const ticks=Array.from({length:72},(_,i)=>i)
  return <div className="compass" aria-hidden="true">
    <div className="compass-halo"/>
    <svg viewBox="-200 -200 400 400" className="compass-svg">
      <g className="ring r1">
        <circle r="184" className="ring-line"/>
        {ticks.map(i=><line key={i} x1="0" y1={i%6===0?-184:-178} x2="0" y2="-170" transform={`rotate(${i*5})`} className={i%6===0?'tick major':'tick'}/>)}
      </g>
      <g className="ring r2">
        <circle r="146" className="ring-line dashed"/>
      </g>
      {[['N',0,-150],['E',150,5],['S',0,160],['W',-150,5]].map(([t,x,y])=><text key={t} x={x} y={y} className="cardinal" textAnchor="middle">{t}</text>)}
      <g className="ring r3"><circle r="108" className="ring-line faint"/><circle r="4" cx="0" cy="-108" className="orbit-dot"/></g>
      <g className="needle">
        <polygon points="0,-96 11,0 0,14 -11,0" className="needle-n"/>
        <polygon points="0,96 11,0 0,-14 -11,0" className="needle-s"/>
      </g>
      <circle r="9" className="hub"/><circle r="3" className="hub-core"/>
    </svg>
  </div>
}

export default function Login({onEnter}){
  const card=useRef(null)
  const [email,setEmail]=useState("")
  const [password,setPassword]=useState("")
  const [error,setError]=useState('')
  const submit=e=>{e.preventDefault();setError(onEnter(email.trim().toLowerCase(),password)||'')}
  const tilt=e=>{
    const el=card.current;if(!el)return
    const r=el.getBoundingClientRect()
    const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5
    el.style.setProperty('--rx',(-y*7).toFixed(2)+'deg')
    el.style.setProperty('--ry',(x*9).toFixed(2)+'deg')
    el.style.setProperty('--mx',((x+.5)*100).toFixed(1)+'%')
    el.style.setProperty('--my',((y+.5)*100).toFixed(1)+'%')
  }
  const reset=()=>{const el=card.current;if(!el)return;el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg')}
  return <div className="login">
    <CompassArt/>
    <div className="login-stage" onPointerMove={tilt} onPointerLeave={reset}>
      <form className="login-card" ref={card} onSubmit={submit}>
        <div className="login-glare"/>
        <img className="login-company-logo" src="https://www.tcs.com/content/dam/global-tcs/en/images/who-we-are/media-kit/logo-rgb-black.png" alt="Tata Consultancy Services"/>
        <div className="eyebrow">TATA CONSULTANCY SERVICES · HEALTHCARE GIS COMMAND CENTER</div>
        <h1><span className="grad-text">Care Compass</span></h1>
        <EcgLine className="login-ecg"/>
        <p>Unified operational intelligence for connected care networks.</p>
        <label htmlFor="loginEmail">Email address</label>
        <input id="loginEmail" type="email" autoComplete="username" placeholder="Enter your assigned email" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <label htmlFor="loginPassword">Password</label>
        <input id="loginPassword" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} required/>
        <div className="eyebrow" style={{marginTop:14}}>ROLE IS LINKED TO YOUR ACCOUNT</div>
        {error&&<p role="alert" style={{color:"#fb7185",marginTop:10}}>{error}</p>}
        <button className="primary wide shine" type="submit">Sign in to command center <ChevronRight size={17}/></button>
        <small>Use your assigned Care Compass credentials.</small>
      </form>
    </div>
  </div>
}
