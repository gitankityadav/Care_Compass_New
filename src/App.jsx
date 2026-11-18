import {useEffect,useMemo,useRef,useState} from 'react'
import {Activity,Users,Truck,CalendarDays,HeartPulse,ShieldCheck,Bell,Search,X,MapPin,ArrowUpRight,AlertTriangle,Clock,Plus,Download,Send,LogOut,Stethoscope,Wrench,Brain,CheckCircle2,ChevronRight,Command,Building2,Syringe,Cpu,ShieldAlert,CloudLightning,PackageX,ArrowLeftRight,UserRound,Mic,RefreshCw,ClipboardCheck} from 'lucide-react'
import NetworkMap from './components/NetworkMap'
import Background from './components/Background'
import CountUp from './components/CountUp'
import EcgLine from './components/EcgLine'
import Login from './components/Login'
import workbook from './data/workbook-sample.json'
import './styles/app.css'

const modules=[['twin','Leadership Dashboard',Activity],['patients','Patient Command Center',Users],['staff','Nurse Mobility',Stethoscope],['leave','Leave & Coverage',CalendarDays],['logistics','Logistics Tower',Truck],['automation','Automation Center',RefreshCw],['ops','Service Ops',Wrench],['resilience','Resilience Center',ShieldCheck],['trigger','Patient Emergency Support',Cpu]]
const shortLabel={twin:'Twin',patients:'Patients',staff:'Nurse Mobility',leave:'Leave',logistics:'Logistics',automation:'Automation',ops:'Ops',resilience:'Resilience',trigger:'IoT Device'}
const hospitalById=Object.fromEntries(workbook.hospitals.map(h=>[h.hospital_id,h]))
const nurseById=Object.fromEntries(workbook.nurses.map(n=>[n.nurse_id,n]))

const initial={
  patients:workbook.patients.map(p=>({id:p.patient_id,name:[p.first_name,p.last_name].filter(Boolean).join(' '),age:p.age,facility:hospitalById[p.hospital_id]?.hospital_name||p.hospital_id,risk:p.acuity_level||'Moderate',care:p.encounter_type||p.primary_condition||'Care pathway',nurse:nurseById[p.assigned_nurse_id]?.full_name||p.assigned_nurse_id||'Unassigned',status:p.discharge_status||'Active',detail:p.primary_condition||'Synthetic patient record',source:p})),
  shipments:workbook.logistics_shipments.map(s=>({id:s.shipment_id,origin:[s.origin_city,s.origin_state].filter(Boolean).join(', '),destination:[s.destination_city,s.destination_state].filter(Boolean).join(', '),item:s.supply_category||s.item_description,description:s.item_description,priority:s.priority,tracking:s.tracking_number,quantity:s.quantity,status:s.shipment_status||'Unknown',eta:s.estimated_delivery_utc||'Not available',risk:s.priority||'Moderate',source:s})),
  devices:workbook.medical_devices.map(d=>({id:d.device_id,name:[d.manufacturer,d.model,d.device_type].filter(Boolean).join(' '),facility:hospitalById[d.hospital_id]?.hospital_name||d.hospital_id,unit:d.location_unit,health:d.health_score,status:d.operational_status,ticket:'See service tickets',technician:'Unassigned',source:d})),
  nurses:workbook.nurses.map(n=>({id:n.nurse_id,name:n.full_name,facility:hospitalById[n.hospital_id]?.hospital_name||n.hospital_id,specialty:n.specialty,load:n.current_patient_load,capacity:n.patient_assignment_capacity,status:n.employment_status,source:n})),
  alerts:workbook.resilience_alerts.map(a=>({id:a.alert_id,title:a.title,facility:hospitalById[a.hospital_id]?.hospital_name||a.affected_city||a.hospital_id,severity:a.severity||'Moderate',status:a.alert_status||'Active',type:a.alert_type,source:a})),
  audit:workbook.audit_log?.map(a=>({id:a.audit_id,action:a.action,entity:a.entity_type+' '+a.entity_id,actor:a.performed_by,at:a.event_datetime_utc}))||[],
  operations:{
    therapyEpisodes:workbook.therapy_episodes||[], therapySessions:workbook.therapy_sessions||[],
    nurseAssignments:workbook.nurse_patient_assignment||[], deviceAssignments:workbook.device_patient_assignment||[],
    supplyPlans:workbook.patient_supply_plan||[], shipmentAllocations:workbook.shipment_patient_allocation||[],
    shipmentEvents:workbook.shipment_events||[], inventory:workbook.inventory||[],
    distributionCenters:workbook.distribution_centers||[], suppliers:workbook.suppliers||[],
    alarms:workbook.device_alarms||[], serviceTickets:workbook.service_tickets||[],
    workOrders:workbook.work_orders||[], interventions:workbook.intervention_cases||[],
    recalls:workbook.recall_cases||[], firmwareCampaigns:workbook.firmware_campaigns||[],
    firmwareExecution:workbook.firmware_execution||[], ticketHistory:workbook.ticket_status_history||[],
    riskRegister:workbook.risk_register||[]
  },
  meta:{source:'Care Compass Synthetic Data.xlsx',asOf:new Date().toISOString(),preview:true,previewRows:100,sheetCount:32,sheets:Object.keys(workbook)}
}

const roles=['Administrator','Doctor','Nurse','Logistics Manager','Technician','Auditor','Clinical Dispatcher']
const access={Administrator:['twin','patients','logistics','automation','ops','staff','resilience'],Doctor:['twin','patients','resilience'],Nurse:['patients','staff','leave'],'Logistics Manager':['logistics','twin','resilience','automation'],Technician:['ops','resilience'],Auditor:['twin','patients','logistics','automation','ops','staff','resilience'],'IoT Device Operator':['trigger']}
const descriptions={automation:'See automatic checks, issues that need attention and the next recommended step.',patients:'Review patient risk, care pathways, assignments and intervention status.',logistics:'Monitor supply movements, destination facilities and shipment exceptions.',ops:'Track medical device condition, maintenance and biomedical service dispatch.',staff:'See each patient’s complete nursing team, shared assignments and workload.',leave:'Plan nurse leave, nominate cover and track colleague approval.',resilience:'Manage operational threats, facility disruptions and response status.',trigger:'Patient-facing emergency support simulator that sends an alert to the patient’s assigned nurse.'}
const scenarios=[
  ['Storm disruption logistics response','3 critical shipments halted · Regional supply continuity','HIGH PRI','logistics',CloudLightning,'rose'],
  ['Missed or delayed patient therapy','Identify affected patients and nearest available nurse','CLINICAL','patients',Syringe,'cyan'],
  ['Medical device abnormal telemetry','Review device condition and dispatch biomedical support','URGENT','ops',Activity,'amber'],
  ['Medical device recall notice','Identify devices and patients requiring audit','AUDIT','ops',PackageX,'violet'],
  ['Firmware security rollout','Review devices pending maintenance cycle','INFRA','ops',Cpu,'teal'],
  ['Multi-facility transfer audit','Review cross-facility movement and compliance','AUDIT','resilience',ArrowLeftRight,'violet']
]
const initials=name=>name.split(' ').map(x=>x[0]).join('').slice(0,2)
const tagTone=v=>/critical|delay|fail|fault/i.test(v)?'red':/high|moderate|warn|monitor|maint/i.test(v)?'amber':'green'


const API_HOST=typeof window!=='undefined'?window.location.hostname:'localhost'
const API_BASE=(import.meta.env.VITE_API_URL||(import.meta.env.DEV?`http://${API_HOST}:8000`:'https://care-compass-fastapi.onrender.com')).replace(/\/$/,'')
async function loadDatabase(){
 const names=['hospitals','patients','nurses','medical_devices','logistics_shipments','resilience_alerts','distribution_centers','suppliers','inventory','therapy_episodes','therapy_sessions','nurse_patient_assignment','device_patient_assignment','patient_supply_plan','shipment_patient_allocation','shipment_events','technician_master','device_alarms','service_tickets','work_orders','intervention_cases','recall_cases','firmware_campaigns','firmware_execution','audit_log','ticket_status_history','risk_register']
 const pairs=await Promise.all(names.map(async n=>{const r=await fetch(`${API_BASE}/api/data/${n}?limit=50000`);if(!r.ok)throw Error(`Could not load ${n}: ${r.status}`);return [n,(await r.json()).rows||[]]}))
 const db=Object.fromEntries(pairs), hs=Object.fromEntries(db.hospitals.map(x=>[x.hospital_id,x])), ns=Object.fromEntries(db.nurses.map(x=>[x.nurse_id,x]))
 return {patients:db.patients.map(p=>({id:p.patient_id,name:[p.first_name,p.last_name].filter(Boolean).join(' '),age:p.age,facility:hs[p.hospital_id]?.hospital_name||p.hospital_id,risk:p.acuity_level||'Moderate',care:p.encounter_type||p.primary_condition||'Care pathway',nurse:ns[p.assigned_nurse_id]?.full_name||p.assigned_nurse_id||'Unassigned',status:p.discharge_status||'Active',detail:p.primary_condition||'Synthetic patient record',source:p})),shipments:db.logistics_shipments.map(x=>({id:x.shipment_id,origin:[x.origin_city,x.origin_state].filter(Boolean).join(', '),destination:[x.destination_city,x.destination_state].filter(Boolean).join(', '),item:x.supply_category||x.item_description,description:x.item_description,priority:x.priority,tracking:x.tracking_number,quantity:x.quantity,status:x.shipment_status||'Unknown',eta:x.estimated_delivery_utc||'Not available',risk:x.priority||'Moderate',source:x})),devices:db.medical_devices.map(x=>({id:x.device_id,name:[x.manufacturer,x.model,x.device_type].filter(Boolean).join(' '),facility:hs[x.hospital_id]?.hospital_name||x.hospital_id,unit:x.location_unit,health:x.health_score,status:x.operational_status,ticket:'See service tickets',technician:'Unassigned',source:x})),nurses:db.nurses.map(x=>({id:x.nurse_id,name:x.full_name,facility:hs[x.hospital_id]?.hospital_name||x.hospital_id,specialty:x.specialty,load:x.current_patient_load,capacity:x.patient_assignment_capacity,status:x.employment_status,source:x})),alerts:db.resilience_alerts.map(x=>({id:x.alert_id,title:x.title,facility:hs[x.hospital_id]?.hospital_name||x.affected_city||x.hospital_id,severity:x.severity||'Moderate',status:x.alert_status||'Active',type:x.alert_type,source:x})),audit:db.audit_log.map(a=>({id:a.audit_id,action:a.action,entity:a.entity_type+' '+a.entity_id,actor:a.performed_by,at:a.event_datetime_utc})).reverse(),operations:{therapyEpisodes:db.therapy_episodes,therapySessions:db.therapy_sessions,nurseAssignments:db.nurse_patient_assignment,deviceAssignments:db.device_patient_assignment,supplyPlans:db.patient_supply_plan,shipmentAllocations:db.shipment_patient_allocation,shipmentEvents:db.shipment_events,inventory:db.inventory,distributionCenters:db.distribution_centers,suppliers:db.suppliers,alarms:db.device_alarms,serviceTickets:db.service_tickets,workOrders:db.work_orders,interventions:db.intervention_cases,recalls:db.recall_cases,firmwareCampaigns:db.firmware_campaigns,firmwareExecution:db.firmware_execution,ticketHistory:db.ticket_status_history,riskRegister:db.risk_register},meta:{source:'PostgreSQL · Care Compass Synthetic Data',preview:false,sheetCount:32},hospitals:db.hospitals}
}


function IoTDevicePage(){
  const [nurseId,setNurseId]=useState('');
  const [liveNurses,setLiveNurses]=useState([]);
  const [liveAssignments,setLiveAssignments]=useState([]);
  const [configLoading,setConfigLoading]=useState(true);
  const [configError,setConfigError]=useState('');
  const [patientId,setPatientId]=useState('');
  const assignedPatients=liveAssignments;
  useEffect(()=>{
    let live=true;
    fetch(`${API_BASE}/api/iot/config`).then(async r=>{
      const j=await r.json();
      if(!r.ok)throw new Error(j.detail?.error||'Could not load live assignments');
      if(!live)return;
      const nurses=j.nurses||[], assignments=j.assignments||[];
      setLiveNurses(nurses);setLiveAssignments(assignments);
      const requestedPatient=new URLSearchParams(window.location.search).get('patient_id');
      setPatientId(assignments.some(p=>p.patient_id===requestedPatient)?requestedPatient:(assignments[0]?.patient_id||''));
      setNurseId(assignments[0]?.nurse_id||'');
      setConfigError('');
    }).catch(e=>{if(live)setConfigError(e.message)}).finally(()=>{if(live)setConfigLoading(false)});
    return()=>{live=false};
  },[]);
  useEffect(()=>{const assignment=liveAssignments.find(p=>p.patient_id===patientId);if(assignment)setNurseId(assignment.nurse_id||'')},[patientId,liveAssignments]);
  useEffect(()=>{if(!assignedPatients.some(p=>p.patient_id===patientId))setPatientId(assignedPatients[0]?.patient_id||'')},[liveAssignments]);
  const [severity,setSeverity]=useState('Critical');
  const [eventType,setEventType]=useState('Abnormal heart-rate threshold');
  const [observation,setObservation]=useState('Heart rate has exceeded the configured safety threshold. Immediate nurse assessment requested.');
  const [apiState,setApiState]=useState('connecting');
  const [apiMessage,setApiMessage]=useState('Checking connection to the central command center…');
  const [sending,setSending]=useState(false);
  const [lastEvent,setLastEvent]=useState(null);
  const [voiceTranscript,setVoiceTranscript]=useState('');
  const [voiceState,setVoiceState]=useState('idle');
  const [messageStatus,setMessageStatus]=useState('');
  const recognitionRef=useRef(null);
  const finalTranscriptRef=useRef('');
  const voiceStateRef=useRef('idle');
  const setVoice=(next)=>{voiceStateRef.current=next;setVoiceState(next)};
  useEffect(()=>{
    let live=true;
    const load=async()=>{try{const r=await fetch(`${API_BASE}/api/device/messages?patient_id=${encodeURIComponent(patientId)}`);if(r.ok){const j=await r.json();const latest=(j.rows||[])[0];if(live)setMessageStatus(latest?.message_status||'')}}catch{}};
    load();const t=setInterval(load,2500);return()=>{live=false;clearInterval(t)};
  },[patientId]);
  const startVoice=()=>{
    const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Speech){setVoice('unsupported');return}
    if(recognitionRef.current)return;
    try{
      const rec=new Speech();
      rec.lang='en-IN';
      rec.continuous=true;
      rec.interimResults=true;
      rec.maxAlternatives=1;
      finalTranscriptRef.current='';
      setVoiceTranscript('');
      recognitionRef.current=rec;
      rec.onstart=()=>setVoice('recording');
      rec.onresult=e=>{
        let interim='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const phrase=e.results[i][0]?.transcript||'';
          if(e.results[i].isFinal)finalTranscriptRef.current+=(finalTranscriptRef.current?' ':'')+phrase.trim();
          else interim+=phrase;
        }
        setVoiceTranscript([finalTranscriptRef.current,interim.trim()].filter(Boolean).join(' '));
      };
      rec.onerror=e=>{
        recognitionRef.current=null;
        setVoice(e.error==='not-allowed'||e.error==='service-not-allowed'?'permission':e.error==='no-speech'?'ready':'error');
      };
      rec.onend=()=>{
        recognitionRef.current=null;
        setVoice(v=>v==='recording'?'ready':v);
        setVoiceTranscript(finalTranscriptRef.current.trim());
      };
      rec.start();
    }catch(e){
      recognitionRef.current=null;
      setVoice('error');
      setApiMessage('Voice recognition could not start: '+(e?.message||'browser error'));
    }
  };
  const stopVoice=()=>{
    const rec=recognitionRef.current;
    if(!rec)return;
    setVoice('stopping');
    try{rec.stop()}catch{
      recognitionRef.current=null;
      setVoice('ready');
      setVoiceTranscript(finalTranscriptRef.current.trim());
    }
  };
  const sendVoiceMessage=async()=>{
    if(!voiceTranscript.trim()||!patient)return;
    setVoiceState('sending');
    try{
      const r=await fetch(API_BASE+'/api/device/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patient_id:patient.patient_id,hospital_id:patient.hospital_id,assigned_nurse_id:nurseId,device_id:'CC-IOT-ICU-014',message_text:voiceTranscript,message_language:'en-IN'})});
      const j=await r.json();if(!r.ok)throw Error(j.detail?.error||'Message could not be sent');
      finalTranscriptRef.current='';setVoiceTranscript('');setVoice('sent');setMessageStatus('Pending');
    }catch(e){setApiMessage('Message not sent: '+e.message);setVoice('error')}
  };
  useEffect(()=>{
    let active=true;
    const check=async()=>{
      try{
        const res=await fetch(API_BASE+'/api/health');
        if(!res.ok)throw new Error('FastAPI returned '+res.status);
        if(active){setApiState('connected');setApiMessage('Connected to Care Compass central command center · PostgreSQL');}
      }catch(e){if(active){setApiState('offline');setApiMessage(e.message+' · Start FastAPI on port 8000.');}}
    };
    check();const timer=setInterval(check,5000);
    return()=>{active=false;clearInterval(timer)};
  },[]);
  const patient=assignedPatients.find(p=>p.patient_id===patientId);
  const send=async()=>{
    if(!patient)return;
    setSending(true);
    try{
      const therapy=patient.therapy_episode_id;
      const res=await fetch(API_BASE+'/api/iot/trigger',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        patient_id:patient.patient_id,hospital_id:patient.hospital_id,assigned_nurse_id:nurseId,
        risk_type:eventType,severity,device_id:'CC-IOT-ICU-014',device_name:'Bedside Patient Monitor CC-IOT-ICU-014',
        observation,therapy_episode_id:therapy||null,event_datetime_utc:new Date().toISOString()
      })});
      const result=await res.json();
      if(!res.ok)throw new Error(result.detail?.error||result.error||'The central command center rejected the event');
      setLastEvent({eventId:result.event_id,riskId:result.risk.risk_id,interventionId:result.intervention?.intervention_id,patient:patient.first_name+' '+patient.last_name,at:new Date().toLocaleTimeString(),deduplicated:!!result.deduplicated});
    }catch(e){setApiMessage('Transmission failed: '+e.message);setApiState('offline');}
    finally{setSending(false);}
  };
  return <div className="iot-standalone">
    <header className="iot-standalone-head">
      <div className="brand"><img className="company-logo" src="/tcs-logo.svg" alt="Tata Consultancy Services"/><div className="brand-divider"/><div><b>Care Compass</b><small>CONNECTED CARE NETWORK</small></div></div>
      <span className={'iot-connection '+(apiState==='connected'?'online':'offline')}><i/>{apiState==='connected'?'CONNECTED TO CENTRAL COMMAND':apiState==='connecting'?'CONNECTING…':'CENTRAL COMMAND OFFLINE'}</span>
      <a href="/" className="iot-back-link">Open Nurse Command Center ↗</a>
    </header>
    <main className="iot-standalone-main">
      <div className="iot-kicker">CONNECTED MEDICAL DEVICE / ICU-014</div>
      <h1>Patient Emergency Support</h1>
      <p className="iot-intro">This patient-facing simulator lets a patient request urgent nurse assistance. It records the alert through Care Compass; it is a demonstration and is not connected to a physical bedside device or emergency service.</p>
      <div className="iot-device-layout">
        <section className="iot-device-visual panel">
          <div className="iot-device-top"><span className={'iot-led '+(messageStatus==='Acknowledged'?'acknowledged':'')}/><b>{messageStatus==='Acknowledged'?'NURSE ACKNOWLEDGED':'DEVICE ONLINE'}</b><small>CC-IOT-ICU-014</small></div>
          <img src="/iot-emergency-button.svg" alt="Hand pressing the red bedside emergency alert button"/>
          <div className="iot-device-caption"><b>BEDSIDЕ PATIENT MONITOR</b><span>Signal: Connected · Channel: Clinical Safety</span></div>
          <button className="iot-red-trigger" onClick={send} disabled={apiState!=='connected'||sending||!patientId}>
            <span className="trigger-ring"><span/></span>
            <b>{sending?'SENDING REQUEST…':'REQUEST NURSE ASSISTANCE'}</b>
            <small>{apiState==='connected'?'Send event to '+(workbook.nurses.find(n=>n.nurse_id===nurseId)?.full_name||'assigned nurse'):'Waiting for central command connection'}</small>
          </button>
          {lastEvent&&<div className="iot-transmitted"><b><CheckCircle2 size={17}/> {lastEvent.deduplicated?'DUPLICATE SUPPRESSED':'EVENT TRANSMITTED'}</b><span>{lastEvent.eventId} · {lastEvent.at}</span><small>{lastEvent.deduplicated?'This patient/device alert was already recorded in the last 15 minutes. No duplicate was created.':'Risk '+lastEvent.riskId+' and intervention '+lastEvent.interventionId+' committed for '+lastEvent.patient+'.'}</small></div>}
          <div className="iot-connection-detail">{apiMessage}</div>
        </section>
        <section className="iot-event-config panel">
          <div className="iot-section-label">EVENT CONFIGURATION</div>
          <h2>Patient & telemetry</h2>
          <label>Assigned nurse</label><div className="iot-assigned-nurse">{liveNurses.find(n=>n.nurse_id===nurseId)?.full_name||nurseId||'No nurse assigned'} <small>Automatically determined from the selected patient’s active assignment</small></div>
          <label>Select patient</label>
          <select value={patientId} onChange={e=>setPatientId(e.target.value)} disabled={configLoading||!assignedPatients.length}>{assignedPatients.map(p=><option key={p.patient_id} value={p.patient_id}>{p.first_name} {p.last_name} · {p.patient_id}</option>)}</select>
          {configLoading&&<small>Loading live PostgreSQL nurse assignments…</small>}
          {configError&&<p className="iot-voice-warning">{configError}</p>}
          {!configLoading&&!configError&&!assignedPatients.length&&<p className="iot-voice-warning">No active nurse assignment found for the available patients.</p>}
          <label>Device event</label><select value={eventType} onChange={e=>setEventType(e.target.value)}><option>Abnormal heart-rate threshold</option><option>Oxygen saturation below threshold</option><option>Blood pressure outside configured range</option><option>Patient deterioration detected</option><option>Missed critical observation</option></select>
          <label>Alert severity</label><select value={severity} onChange={e=>setSeverity(e.target.value)}><option>Critical</option><option>High</option></select>
          <label>Telemetry payload / observation</label><textarea rows="4" value={observation} onChange={e=>setObservation(e.target.value)}/>
          <div className="iot-payload-note"><Activity size={16}/><span>On trigger, FastAPI writes the patient risk, nurse intervention and device audit event in one database transaction.</span></div>
        </section>
      </div>
      <section className="iot-qr-panel panel">
        <div className="iot-section-label">SCAN TO OPEN ON ANOTHER DEVICE</div>
        <h2>Patient mobile access</h2>
        <p className="iot-voice-help">Scan this code with a phone camera. It opens this same patient trigger page with the selected patient preloaded. The phone and nurse console use the same Care Compass API and PostgreSQL records.</p>
        {patientId ? <div className="iot-qr-content">
          <img className="iot-qr-image" alt="QR code to open the patient emergency support page" src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(window.location.origin+'/patient?patient_id='+patientId)}`}/>
          <div><b>{patient?.first_name} {patient?.last_name}</b><small>{patientId}</small><a href={window.location.origin+'/patient?patient_id='+encodeURIComponent(patientId)} target="_blank" rel="noreferrer">Open patient page ↗</a><small>For local testing, connect both devices to the same Wi-Fi and open this app using your computer's LAN IP. For access from anywhere, use the deployed HTTPS website.</small></div>
        </div> : <p className="iot-voice-warning">Select a patient with an active nurse assignment to generate the QR code.</p>}
      </section>
      <section className="iot-voice-panel panel">
        <div className="iot-section-label">PATIENT-TO-NURSE COMMUNICATION</div>
        <h2>Speak to your nurse</h2>
        <p className="iot-voice-help">Click the microphone once to start speaking. Click it again when you are finished. Your words will appear below.</p>
        <button className={'iot-voice-hold '+(voiceState==='recording'?'recording':'')} onClick={()=>['recording','stopping'].includes(voiceState)?stopVoice():startVoice()} onContextMenu={e=>e.preventDefault()} aria-pressed={voiceState==='recording'}>
          <Mic size={25}/><b>{voiceState==='recording'?'LISTENING — CLICK TO FINISH':voiceState==='stopping'?'FINISHING…':'CLICK TO START SPEAKING'}</b><small>{voiceState==='recording'?'Speak naturally; click again when you finish':voiceState==='stopping'?'Saving the recognised words…':'Click once, speak, then click again'}</small>
        </button>
        {voiceState==='unsupported'&&<p className="iot-voice-warning">Voice recognition is not supported in this browser. Open this bedside device in Chrome or Edge and allow microphone access.</p>}
        {voiceState==='permission'&&<p className="iot-voice-warning">The browser blocked microphone speech recognition. Check microphone permission and ensure this page is served over HTTPS or localhost.</p>}
        {voiceState==='error'&&<p className="iot-voice-warning">Speech recognition stopped unexpectedly. Click the microphone to try again.</p>}
        <label className="iot-voice-label">Recognised message — review before sending</label>
        <textarea className="iot-voice-transcript" rows="3" value={voiceTranscript} onChange={e=>setVoiceTranscript(e.target.value)} placeholder="Your spoken words will appear here…"/>
        <button className="primary" disabled={!voiceTranscript.trim()||voiceState==='sending'} onClick={sendVoiceMessage}>{voiceState==='sending'?'SENDING…':'SEND MESSAGE TO NURSE'}</button>
        {voiceState==='sent'&&<div className="iot-message-sent">Message sent. The bedside indicator turns purple when the nurse acknowledges it.</div>}
        <div className={'iot-ack-indicator '+(messageStatus==='Acknowledged'?'acknowledged':'pending')}><i/>{messageStatus==='Acknowledged'?'NURSE ACKNOWLEDGED — PURPLE INDICATOR':'WAITING FOR NURSE ACKNOWLEDGEMENT'}</div>
      </section>
      <section className="iot-flow panel">
        <div className="iot-section-label">LIVE RESPONSE JOURNEY</div>
        <h2>Device-to-care workflow</h2>
        <div className="iot-flow-steps">
          <div><b>01</b><strong>Device trigger</strong><span>Bedside monitor sends telemetry</span></div>
          <div><b>02</b><strong>Central command</strong><span>FastAPI records the event in PostgreSQL</span></div>
          <div><b>03</b><strong>Nurse receives alert</strong><span>the assigned nurse's command center refreshes automatically</span></div>
          <div><b>04</b><strong>Clinical response</strong><span>Acknowledge · Attend · Resolve</span></div>
        </div>
      </section>
    </main>
  </div>;
}

function App(){
  const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('cc-user')||'null'))
  const [role,setRole]=useState('Administrator')
  const [tab,setTab]=useState('twin')
  const [data,setData]=useState(()=>{const saved=JSON.parse(localStorage.getItem('cc-data')||'null');return saved?{...initial,...saved,operations:{...initial.operations,...(saved.operations||{})}}:initial})
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState('All')
  const [selected,setSelected]=useState(null)
  const [modal,setModal]=useState(null)
  const [toast,setToast]=useState('')
  const [copilot,setCopilot]=useState(false)
  const [typing,setTyping]=useState(false)
  const [prompt,setPrompt]=useState('')
  const [messages,setMessages]=useState([{from:'ai',text:'Hello. I can summarize operational risk, explain linked records, and suggest next steps using the current synthetic Care Compass data.'}])
  const chatEnd=useRef(null)
  const toastTimer=useRef(0)
  const [dbStatus,setDbStatus]=useState('connecting')
  const [dbError,setDbError]=useState('')
  const [refreshKey,setRefreshKey]=useState(0)
  const [automationEvents,setAutomationEvents]=useState([])
  const [automationStatus,setAutomationStatus]=useState(null)
  const [automationLoading,setAutomationLoading]=useState(false)
  const [automationBusy,setAutomationBusy]=useState(false)
  const [automationError,setAutomationError]=useState('')
  const [scenarioBusy,setScenarioBusy]=useState('')
  const [scenarioResults,setScenarioResults]=useState({})
  const [nurseFilter,setNurseFilter]=useState('All')
  const [logisticsStage,setLogisticsStage]=useState('All')
  const [shipmentInsight,setShipmentInsight]=useState({loading:false,route:null,weather:null,error:''})
  const [nurseWeather,setNurseWeather]=useState({loading:false,visits:[],error:''})
  const [weatherPortalOpen,setWeatherPortalOpen]=useState(false)
  const activeNurseId=user?.nurseId||'NUR00017'
  useEffect(()=>{
    if(!user||tab!=='automation')return
    let live=true
    const load=async()=>{
      try{
        const moduleFilter=user.role==='Nurse'?'Nurse':user.role==='Logistics Manager'?'Logistics':''
        const suffix=moduleFilter?'?module='+encodeURIComponent(moduleFilter)+'&limit=200':'?limit=200'
        const [statusRes,eventsRes]=await Promise.all([
          fetch(API_BASE+'/api/automation/status'),
          fetch(API_BASE+'/api/automation/events'+suffix)
        ])
        if(!statusRes.ok||!eventsRes.ok)throw Error('Could not load automatic checks. Please confirm the command center is connected.')
        const [status,events]=await Promise.all([statusRes.json(),eventsRes.json()])
        if(live){setAutomationStatus(status);setAutomationEvents(events.rows||[]);setAutomationError('')}
      }catch(e){if(live)setAutomationError(e.message||'Automatic checks are temporarily unavailable.')}
      finally{if(live)setAutomationLoading(false)}
    }
    setAutomationLoading(true);load()
    const timer=setInterval(load,60000)
    return()=>{live=false;clearInterval(timer)}
  },[user?.role,tab,refreshKey])
  useEffect(()=>{
    if(selected?.type!=='logistics'){setShipmentInsight({loading:false,route:null,weather:null,error:''});return}
    const sh=selected.record?.source||{};
    const dc=(data.operations?.distributionCenters||[]).find(x=>x.distribution_center_id===sh.distribution_center_id);
    const hospital=(data.hospitals||[]).find(x=>x.hospital_id===(sh.destination_hospital_id||sh.hospital_id));
    const point=x=>({lat:Number(x?.latitude??x?.lat),lon:Number(x?.longitude??x?.longitude??x?.long)});
    const valid=p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat!==0&&p.lon!==0;
    const originName=[dc?.city||sh.origin_city,dc?.state||sh.origin_state].filter(Boolean).join(', ');
    const destinationName=[hospital?.city||sh.destination_city,hospital?.state||sh.destination_state].filter(Boolean).join(', ');
    let cancelled=false;setShipmentInsight({loading:true,route:null,weather:null,error:''});
    (async()=>{try{
      let a=point(dc),b=point(hospital),demoLocation=false;
      const geocode=async(name,fallback)=>{
        const query=name||fallback;
        if(!query)throw Error('Shipment route locations are missing');
        const response=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(query+', USA')+'&count=1&language=en&format=json');
        if(!response.ok)throw Error('Could not estimate shipment route location');
        const result=(await response.json()).results?.[0];
        if(!result)throw Error('No map location found for '+query);
        return {lat:Number(result.latitude),lon:Number(result.longitude)};
      };
      if(!valid(a)){a=await geocode(originName,'Chicago, IL');demoLocation=true}
      if(!valid(b)){b=await geocode(destinationName,'New York, NY');demoLocation=true}
      const routeResponse=await fetch('https://router.project-osrm.org/route/v1/driving/'+a.lon+','+a.lat+';'+b.lon+','+b.lat+'?overview=full&geometries=geojson&steps=false');
      if(!routeResponse.ok)throw Error('Road-route service unavailable');
      const rj=await routeResponse.json();const route=rj.routes?.[0];if(!route)throw Error('No road route returned');
      const line=route.geometry?.coordinates||[];
      const samples=[line[0],line[Math.floor(line.length/2)],line[line.length-1]].filter(Boolean);
      const routePoints=samples.length?samples.map((p,i)=>({label:['Origin','Along route','Destination'][i]||'Route point',lat:p[1],lon:p[0]})):[{label:'Origin',...a},{label:'Destination',...b}];
      const weatherResults=await Promise.all(routePoints.map(async p=>{
        const url='https://api.open-meteo.com/v1/forecast?latitude='+p.lat+'&longitude='+p.lon+'&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,visibility,weather_code,thunderstorm_probability&forecast_days=3&timezone=auto';
        const response=await fetch(url);if(!response.ok)throw Error('Weather forecast unavailable for '+p.label);
        const wj=await response.json();const times=wj.hourly?.time||[];
        const forecast=times.map((t,i)=>({time:t,temp:Number(wj.hourly.temperature_2m?.[i]||0),humidity:Number(wj.hourly.relative_humidity_2m?.[i]||0),rain:Number(wj.hourly.precipitation_probability?.[i]||0),mm:Number(wj.hourly.precipitation?.[i]||0),wind:Number(wj.hourly.wind_speed_10m?.[i]||0),gust:Number(wj.hourly.wind_gusts_10m?.[i]||0),visibility:Number(wj.hourly.visibility?.[i]||0),thunder:Number(wj.hourly.thunderstorm_probability?.[i]||0),code:Number(wj.hourly.weather_code?.[i]||0)})).filter(x=>new Date(x.time)>=new Date()).slice(0,24);
        return {...p,forecast};
      }));
      const weather=weatherResults.find(x=>x.label==='Destination')?.forecast||weatherResults[weatherResults.length-1]?.forecast||[];
      const routeWeather=weatherResults.map(p=>({label:p.label,forecast:p.forecast.slice(0,8)}));
      const routeRisk=weatherResults.some(p=>p.forecast.some(w=>w.rain>=60||w.wind>=45||w.gust>=65||w.thunder>=40||(w.visibility>0&&w.visibility<1000)||w.code>=95));
      if(!cancelled)setShipmentInsight({loading:false,route:{km:route.distance/1000,minutes:route.duration/60,arrival:new Date(Date.now()+route.duration*1000).toISOString()},weather,routeWeather,routeRisk,demoLocation,originName:originName||'Chicago, IL (demo)',destinationName:destinationName||'New York, NY (demo)',error:''});
    }catch(e){if(!cancelled)setShipmentInsight({loading:false,route:null,weather:null,error:e.message||'Live route and weather data unavailable'});}})();
    return()=>{cancelled=true};
  },[selected?.type,selected?.record?.id,refreshKey,data.operations.distributionCenters,data.hospitals]);
  useEffect(()=>{
    if(user?.role!=='Nurse'||tab!=='patients')return;
    let cancelled=false;
    const visits=(data.operations.therapySessions||[]).filter(x=>String(x.delivery_mode||'').toLowerCase().includes('home')&&!['Completed','Cancelled','Missed'].includes(String(x.session_status||''))).filter(x=>(data.operations.nurseAssignments||[]).some(a=>a.patient_id===x.patient_id&&a.nurse_id===activeNurseId&&String(a.active_status).toLowerCase()!=='false')).slice(0,8);
    const coords=p=>({lat:Number(p?.latitude??p?.home_latitude),lon:Number(p?.longitude??p?.home_longitude)});
    const ready=visits.map(v=>({...v,patient:data.patients.find(p=>p.id===v.patient_id)}));
    if(!ready.length){setNurseWeather({loading:false,visits:[],error:visits.length?'Home-visit locations are missing GPS coordinates.':'No upcoming home visits are assigned to this nurse.'});return}
    setNurseWeather({loading:true,visits:[],error:''});
    (async()=>{try{const results=await Promise.all(ready.map(async v=>{let c=coords(v.patient.source);let demoLocation=false;const hospital=data.hospitals.find(h=>h.hospital_id===v.patient.source?.hospital_id);if(!Number.isFinite(c.lat)||!Number.isFinite(c.lon)||c.lat===0||c.lon===0){const city=v.patient.source?.city||v.patient.source?.home_city||hospital?.city||v.patient.source?.state||hospital?.state||'Chicago';const state=v.patient.source?.state||v.patient.source?.home_state||hospital?.state||'IL';const geo=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city+', '+state+', USA')+'&count=1&language=en&format=json');if(!geo.ok)throw Error('Could not geocode demo home-visit location');const gj=await geo.json();if(!gj.results?.length)throw Error('No home-visit location found for '+city);c={lat:Number(gj.results[0].latitude),lon:Number(gj.results[0].longitude)};demoLocation=true;}const url='https://api.open-meteo.com/v1/forecast?latitude='+c.lat+'&longitude='+c.lon+'&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,visibility,weather_code,thunderstorm_probability&forecast_days=3&timezone=auto';const res=await fetch(url);if(!res.ok)throw Error('Weather API unavailable');const j=await res.json();const target=new Date(v.scheduled_datetime_utc);const times=j.hourly?.time||[];let index=times.findIndex(t=>Math.abs(new Date(t)-target)<60*60*1000);if(index<0)index=0;const rain=Number(j.hourly.precipitation_probability?.[index]||0),wind=Number(j.hourly.wind_speed_10m?.[index]||0),gust=Number(j.hourly.wind_gusts_10m?.[index]||0),visibility=Number(j.hourly.visibility?.[index]||0),thunder=Number(j.hourly.thunderstorm_probability?.[index]||0),code=Number(j.hourly.weather_code?.[index]||0);const risk=rain>=60||wind>=45||gust>=65||thunder>=40||(visibility>0&&visibility<1000)||code>=95;const safer=times.map((t,i)=>({time:t,rain:Number(j.hourly.precipitation_probability?.[i]||0),wind:Number(j.hourly.wind_speed_10m?.[i]||0),gust:Number(j.hourly.wind_gusts_10m?.[i]||0),visibility:Number(j.hourly.visibility?.[i]||0),thunder:Number(j.hourly.thunderstorm_probability?.[i]||0),code:Number(j.hourly.weather_code?.[i]||0)})).filter(x=>new Date(x.time)>new Date()&&x.rain<40&&x.wind<30&&x.gust<45&&x.thunder<20&&(!x.visibility||x.visibility>=1500)&&x.code<95).slice(0,1)[0];return {...v,demoLocation,assumedLocation:demoLocation?(v.patient.source?.city||hospital?.city||'Hospital area')+', '+(v.patient.source?.state||hospital?.state||'USA'):'',forecast:{time:times[index],temp:Number(j.hourly.temperature_2m?.[index]||0),humidity:Number(j.hourly.relative_humidity_2m?.[index]||0),rain,wind,gust,visibility,thunder,code},risk,safer}}));if(!cancelled)setNurseWeather({loading:false,visits:results,error:''});}catch(e){if(!cancelled)setNurseWeather({loading:false,visits:[],error:e.message||'Weather forecast unavailable'});}})();
    return()=>{cancelled=true};
  },[user?.role,tab,activeNurseId,data.operations.therapySessions,data.operations.nurseAssignments,data.patients]);
  const [triggerPatientId,setTriggerPatientId]=useState('PAT000004')
  const [triggerSeverity,setTriggerSeverity]=useState('Critical')
  const [triggerType,setTriggerType]=useState('Deteriorating patient condition')
  const [triggerNote,setTriggerNote]=useState('Heart rate above configured threshold; immediate clinical reassessment required.')
  const [workflowBusy,setWorkflowBusy]=useState(false)
  const [emergencyAlert,setEmergencyAlert]=useState(null)
  const [urgentToast,setUrgentToast]=useState(null)
  const [urgentToastVisible,setUrgentToastVisible]=useState(false)
  const [emergencyStep,setEmergencyStep]=useState(0)
  const [emergencyNote,setEmergencyNote]=useState('')
  const [emergencyBusy,setEmergencyBusy]=useState(false)
  const [deviceMessages,setDeviceMessages]=useState([])
  const [leaveRequests,setLeaveRequests]=useState([])
  const [leaveStart,setLeaveStart]=useState('')
  const [leaveEnd,setLeaveEnd]=useState('')
  const [coverNurseId,setCoverNurseId]=useState('')
  const [leaveBusy,setLeaveBusy]=useState(false)
  const emergencySeen=useRef(new Set())
  useEffect(()=>{if(window.location.pathname==='/iot-device')return;let live=true;loadDatabase().then(remote=>{if(live){emergencySeen.current=new Set(remote.operations.riskRegister.map(r=>r.risk_id));setData(remote);setDbStatus('connected');setDbError('')}}).catch(e=>{if(live){setDbStatus('offline');setDbError(e.message)}});return()=>{live=false}},[refreshKey])
  const refreshDatabase=()=>setRefreshKey(x=>x+1)
  useEffect(()=>{
    if(window.location.pathname==='/iot-device'||user?.role!=='Nurse')return;
    let live=true;
    const load=async()=>{try{const r=await fetch(`${API_BASE}/api/device/messages?nurse_id=${encodeURIComponent(activeNurseId)}`);if(r.ok){const j=await r.json();if(live)setDeviceMessages(j.rows||[])}}catch{}};
    load();const t=setInterval(load,2500);return()=>{live=false;clearInterval(t)};
  },[user?.role,activeNurseId,refreshKey]);

  useEffect(()=>{
    if(window.location.pathname==='/iot-device'||user?.role!=='Nurse')return;
    let live=true;
    const load=async()=>{try{const r=await fetch(`${API_BASE}/api/nurse-leave?nurse_id=${encodeURIComponent(activeNurseId)}`);if(r.ok){const j=await r.json();if(live)setLeaveRequests(j.rows||[])}}catch{}};
    load();const t=setInterval(load,8000);return()=>{live=false;clearInterval(t)};
  },[user?.role,activeNurseId,refreshKey]);
  async function sendLeaveRequest(){
    if(!leaveStart||!leaveEnd||!coverNurseId){notify('Choose leave dates and a covering nurse');return}
    const cover=data.nurses.find(n=>n.id===coverNurseId);
    if(!cover){notify('Covering nurse not found');return}
    setLeaveBusy(true);
    try{
      const r=await fetch(API_BASE+'/api/nurse-leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requesting_nurse_id:activeNurseId,cover_nurse_id:coverNurseId,leave_start:leaveStart,leave_end:leaveEnd,patients_to_cover:assignedNursePatients.length,sessions_to_cover:nurseSessions.length})});
      const j=await r.json();if(!r.ok)throw Error(j.detail?.error||'Could not send leave request');
      setLeaveRequests(v=>[j.request,...v]);notify('Coverage request sent to '+cover.name+' for approval');
    }catch(e){notify('Leave request failed: '+e.message)}finally{setLeaveBusy(false)}
  }
  async function decideLeaveRequest(item,decision){
    try{
      const r=await fetch(API_BASE+'/api/nurse-leave/'+encodeURIComponent(item.leave_request_id)+'/decision',{method:'PATCH',headers:{'Content-Type':'application/json','X-Nurse-Id':activeNurseId},body:JSON.stringify({decision})});
      const j=await r.json();if(!r.ok)throw Error(j.detail?.error||'Could not save decision');
      setLeaveRequests(v=>v.map(x=>x.leave_request_id===item.leave_request_id?j.request:x));notify('Leave coverage '+decision);
    }catch(e){notify('Decision failed: '+e.message)}
  }
  async function acknowledgeDeviceMessage(message){
    try{
      const r=await fetch(`${API_BASE}/api/device/messages/${encodeURIComponent(message.message_id)}/acknowledge`,{method:'PATCH',headers:{'X-User-Name':user?.name||'Sophia Jones'}});
      const j=await r.json();if(!r.ok)throw Error(j.detail?.error||'Acknowledgement failed');
      setDeviceMessages(v=>v.map(x=>x.message_id===message.message_id?j.message:x));
      notify('Patient message acknowledged. Bedside indicator is now purple.');
    }catch(e){notify('Could not acknowledge message: '+e.message)}
  }
  useEffect(()=>{if(user?.role==='Nurse'&&tab==='twin')setTab('patients');else if(user?.role==='Logistics Manager'&&tab==='twin')setTab('logistics')},[user?.role,tab])
  useEffect(()=>{if(window.location.pathname==='/iot-device'||user?.role!=='Nurse')return;let stopped=false;const poll=async()=>{try{const [riskRes,intRes]=await Promise.all([fetch(`${API_BASE}/api/data/risk_register?limit=50000`),fetch(`${API_BASE}/api/data/intervention_cases?limit=50000`)]);if(!riskRes.ok||!intRes.ok)throw Error('Nurse alert refresh failed');const [riskJson,intJson]=await Promise.all([riskRes.json(),intRes.json()]);const riskRows=riskJson.rows||[];const fresh=riskRows.filter(r=>!emergencySeen.current.has(r.risk_id));riskRows.forEach(r=>emergencySeen.current.add(r.risk_id));const assignedIds=new Set(data.operations.nurseAssignments.filter(a=>a.nurse_id===activeNurseId&&a.active_status===true).map(a=>a.patient_id));const urgent=fresh.filter(r=>['Critical','High'].includes(r.severity)&&assignedIds.has(r.patient_id)&&!['Closed','Resolved'].includes(r.status));if(urgent.length&&!stopped){setUrgentToast(urgent[0]);setUrgentToastVisible(true);setTimeout(()=>setUrgentToastVisible(false),6500)}if(!stopped)setData(prev=>({...prev,operations:{...prev.operations,riskRegister:riskRows,interventions:intJson.rows||[]}}))}catch(e){if(!stopped){setDbStatus('offline');setDbError(e.message)}}};const timer=setInterval(poll,2500);return()=>{stopped=true;clearInterval(timer)}},[user?.role,activeNurseId,data.operations.nurseAssignments])
  async function advanceEmergency(action,patches){
    if(!emergencyAlert)return;setEmergencyBusy(true);
    try{
      if(dbStatus!=='connected')throw Error('PostgreSQL is offline.');
      for(const item of patches){const res=await fetch(`${API_BASE}/api/data/${item.table}/${encodeURIComponent(item.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json','X-User-Name':user?.name||'Sophia Jones','X-User-Role':'Nurse'},body:JSON.stringify(item.patch)});const body=await res.json();if(!res.ok)throw Error(body.detail?.error||body.error||'Could not save response step')}
      notify(action+(action.includes('note captured')?' (not persisted to clinical record)':' and saved to PostgreSQL'));setEmergencyStep(s=>s+1);refreshDatabase();
      if(action==='Patient stabilised and case resolved'){setEmergencyAlert(null);setEmergencyStep(0);setEmergencyNote('')}
    }catch(e){notify('Response step failed: '+e.message)}finally{setEmergencyBusy(false)}
  }

  async function runScenario(id){
    setScenarioBusy(id)
    try{
      const response=await fetch(`${API_BASE}/api/scenarios/${id}/execute`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})})
      const result=await response.json()
      if(!response.ok)throw Error(result.error||'Scenario execution failed')
      setScenarioResults(prev=>({...prev,[id]:result}))
      notify(`${id} completed and verified`)
      refreshDatabase()
    }catch(e){setScenarioResults(prev=>({...prev,[id]:{status:'error',message:e.message}}));notify(`${id} failed: ${e.message}`)}
    finally{setScenarioBusy('')}
  }

  if(['/patient','/iot-device'].includes(window.location.pathname))return <IoTDevicePage/>

  const allowed=access[user?.role||role]||access.Administrator
  const current=modules.find(m=>m[0]===tab)||modules[0]
  const navModules=modules.filter(m=>allowed.includes(m[0]))
  const navIndex=Math.max(0,navModules.findIndex(m=>m[0]===tab))
  const log=(action,entity)=>({id:Date.now(),action,entity,actor:user?.name||'Demo Administrator',at:new Date().toISOString()})

  function notify(s){setToast(s);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),2800)}
  function persist(next){setData(next);if(dbStatus!=='connected')localStorage.setItem('cc-data',JSON.stringify(next))}
  function go(id){setTab(id);setQuery('');setFilter('All');setSelected(null);window.scrollTo({top:0,behavior:'smooth'})}
  async function refreshAutomation(){
    setAutomationBusy(true)
    try{
      const response=await fetch(API_BASE+'/api/automation/run',{method:'POST'})
      const result=await response.json()
      if(!response.ok)throw Error(result.detail||'Could not complete the automatic check')
      setRefreshKey(v=>v+1)
      notify('Automatic checks completed. The latest results are shown below.')
    }catch(e){notify('Could not run checks: '+e.message)}
    finally{setAutomationBusy(false)}
  }
  async function acknowledgeAutomation(event){
    try{
      const response=await fetch(API_BASE+'/api/automation/events/'+event.event_id+'/acknowledge?actor='+encodeURIComponent(user?.name||'Care Compass user'),{method:'POST'})
      const result=await response.json()
      if(!response.ok)throw Error(result.detail||'Could not mark this item as reviewed')
      setAutomationEvents(items=>items.map(item=>item.event_id===event.event_id?{...item,...result}:item))
      setAutomationStatus(status=>status?{...status,open:Math.max(0,Number(status.open||0)-1)}:status)
      notify('Marked as reviewed.')
    }catch(e){notify('Could not update this item: '+e.message)}
  }
  function signOut(){localStorage.removeItem('cc-user');setUser(null)}
  async function persistWorkflowAction({table,id,patch,action,event}){
    setWorkflowBusy(true)
    try{
      if(dbStatus!=='connected')throw Error('PostgreSQL is offline. Connect the API before saving operational actions.')
      const isShipment=table==='logistics_shipments'
      const endpoint=isShipment
        ?`${API_BASE}/api/logistics/shipments/${encodeURIComponent(id)}/transition`
        :`${API_BASE}/api/data/${table}/${encodeURIComponent(id)}`
      const response=await fetch(endpoint,{
        method:isShipment?'POST':'PATCH',
        headers:{'Content-Type':'application/json','X-User-Name':user?.name||'Care Compass User','X-User-Role':user?.role||'Nurse'},
        body:JSON.stringify(isShipment?patch:patch)
      })
      const body=await response.json()
      if(!response.ok)throw Error(body.detail?.error||body.error||'Could not save workflow action')
      if(event&&!isShipment){
        const er=await fetch(`${API_BASE}/api/data/shipment_events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipment_event_id:'SHE_UI_'+Date.now(),shipment_id:event.shipment_id,event_status:event.event_status,event_datetime_utc:new Date().toISOString(),recorded_by:user?.name||'Logistics Manager',scenario_id:null})})
        const eb=await er.json();if(!er.ok)throw Error(eb.detail?.error||eb.error||'Shipment event could not be recorded')
      }
      await refreshDatabase();notify(action+' saved to PostgreSQL');setSelected(null)
    }catch(e){notify('Action not saved: '+e.message)}finally{setWorkflowBusy(false)}
  }
  async function update(collection,id,patch,action){
    const map={patients:['patients',p=>({assigned_nurse_id:data.nurses.find(n=>n.name===p.nurse)?.id,discharge_status:p.status})],shipments:['logistics_shipments',p=>({shipment_status:p.status})],devices:['medical_devices',p=>({operational_status:p.status})],nurses:['nurses',p=>({employment_status:p.status})],alerts:['resilience_alerts',p=>({alert_status:p.status})]}[collection]
    try{if(dbStatus==='connected'&&map){const response=await fetch(`${API_BASE}/api/data/${map[0]}/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(map[1](patch))});if(!response.ok)throw Error((await response.json()).error||'Database update failed')}
    const next={...data,[collection]:data[collection].map(x=>x.id===id?{...x,...patch}:x),audit:[log(action,id),...data.audit]};persist(next);setSelected(null);setModal(null);notify(action+(dbStatus==='connected'?' saved to PostgreSQL':' saved locally; database offline'));if(dbStatus==='connected')refreshDatabase()
    }catch(e){notify('Could not save: '+e.message)}
  }
  async function createAlert(){
    const a={alert_id:'ALT-'+Date.now(),hospital_id:(data.hospitals||workbook.hospitals)[0]?.hospital_id,alert_type:'Operational',severity:modal.severity||'Moderate',alert_status:'Active',title:modal.title||'New operational alert',description:'Created from Care Compass UI',affected_city:modal.facility||'Network-wide',affected_state:'NA',affected_zip:'00000',start_datetime_utc:new Date().toISOString(),end_datetime_utc:new Date(Date.now()+86400000).toISOString(),estimated_capacity_impact_pct:0,patients_at_risk:0,related_shipment_id:null,response_action:'Review required',synthetic_record:true,scenario_id:null}
    try{
      if(dbStatus==='connected'){const r=await fetch(`${API_BASE}/api/data/resilience_alerts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});if(!r.ok)throw Error((await r.json()).error||'Insert failed');refreshDatabase()}
      else persist({...data,alerts:[{id:a.alert_id,title:a.title,facility:a.affected_city,severity:a.severity,status:a.alert_status,type:a.alert_type},...data.alerts]})
      setModal(null);notify('Alert created'+(dbStatus==='connected'?' in PostgreSQL':' in local demo'))
    }catch(e){notify('Could not create alert: '+e.message)}
  }
  function exportCsv(rows,name){
    const keys=Object.keys(rows[0]||{})
    const csv=[keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name+'.csv';a.click();URL.revokeObjectURL(a.href)
  }
  function ask(){
    if(!prompt.trim())return
    const q=prompt
    setMessages(m=>[...m,{from:'user',text:q}])
    let answer='I found '+data.alerts.filter(a=>a.status==='Active').length+' active alerts, '+data.patients.filter(p=>p.risk==='Critical'||p.risk==='High').length+' high/critical-risk patients, and '+data.shipments.filter(s=>s.status==='Delayed').length+' delayed shipments. Prioritize critical patient interventions, then confirm affected supply routes. This is a rule-based demo response, not a clinical decision.'
    if(/shipment|logistic|delivery/i.test(q))answer=`There are ${data.shipments.filter(s=>s.status==='Delayed').length} delayed shipments. ${data.shipments.filter(s=>s.status==='Delayed').map(s=>s.id+' to '+s.destination).join('; ')||'No delayed shipments currently.'} Review destination stock before rerouting.`
    if(/nurse|staff/i.test(q))answer=`${data.nurses.filter(n=>n.status==='Available').length} nurses are marked available. Review specialty and workload before reassignment.`
    if(/patient|risk/i.test(q))answer=`${data.patients.filter(p=>p.risk==='Critical'||p.risk==='High').map(p=>p.name+' ('+p.risk+')').join(', ')||'No high-risk patients in this demo dataset.'}`
    setPrompt('');setTyping(true)
    setTimeout(()=>{setTyping(false);setMessages(m=>[...m,{from:'ai',text:answer}])},700)
  }

  /* Motion plumbing: pointer spotlight on .spot elements, scroll reveal for .reveal elements. */
  useEffect(()=>{
    const move=e=>{
      const el=e.target.closest?.('.spot');if(!el)return
      const r=el.getBoundingClientRect()
      el.style.setProperty('--mx',(e.clientX-r.left)+'px')
      el.style.setProperty('--my',(e.clientY-r.top)+'px')
    }
    document.addEventListener('pointermove',move,{passive:true})
    return()=>document.removeEventListener('pointermove',move)
  },[])
  useEffect(()=>{
    const els=[...document.querySelectorAll('.reveal:not(.in)')]
    if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in'));return}
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -6% 0px'})
    els.forEach(e=>io.observe(e))
    return()=>io.disconnect()
  },[tab,user,data.alerts.length])
  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages,typing,copilot])
  useEffect(()=>{
    const esc=e=>{if(e.key==='Escape'){setSelected(null);setModal(null)}}
    window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)
  },[])

  const rows=tab==='patients'?data.patients:tab==='logistics'?data.shipments:tab==='ops'?data.devices:tab==='staff'?data.nurses:tab==='resilience'?data.alerts:[]
  const nurseAssignments=data.operations.nurseAssignments.filter(a=>a.nurse_id===activeNurseId&&a.active_status===true)
  const assignedPatientIds=new Set(nurseAssignments.map(a=>a.patient_id))
  const assignedNursePatients=data.patients.filter(p=>assignedPatientIds.has(p.id))
  const nurseSessions=data.operations.therapySessions.filter(s=>assignedPatientIds.has(s.patient_id))
  const activePatientAssignments=data.operations.nurseAssignments.filter(a=>a.active_status===true)
  const patientCareTeam=patientId=>activePatientAssignments.filter(a=>a.patient_id===patientId).map(a=>({...a,nurse:data.nurses.find(n=>n.id===a.nurse_id)})).filter(a=>a.nurse)
  const patientTherapyCount=patientId=>data.operations.therapySessions.filter(s=>s.patient_id===patientId).length
  const patientTherapyEpisodeCount=patientId=>data.operations.therapyEpisodes.filter(s=>s.patient_id===patientId).length
  const patientOpenInterventionCount=patientId=>data.operations.interventions.filter(x=>x.patient_id===patientId&&!/completed|closed|resolved/i.test(x.status||'')).length
  const nurseAlerts=data.operations.riskRegister.filter(r=>r.severity==='Critical'||r.severity==='High').map(r=>({...r,id:r.risk_id,title:r.risk_type,severity:r.severity,facility:(data.hospitals||workbook.hospitals).find(h=>h.hospital_id===r.hospital_id)?.hospital_name||r.hospital_id,type:'Patient risk',status:r.status,patient:data.patients.find(p=>p.id===r.patient_id)?.name||r.patient_id}))
  const activeNurseInterventions=data.operations.interventions.filter(x=>x.assigned_nurse_id===activeNurseId&&!/completed|closed|resolved/i.test(x.status||''))
  const activeNurseName=user?.role==='Nurse'?user.name:(data.nurses.find(n=>n.id===activeNurseId)?.name||'Assigned Nurse')
  const incomingLeaveRequests=leaveRequests.filter(x=>x.cover_nurse_id===activeNurseId)
  const outgoingLeaveRequests=leaveRequests.filter(x=>x.requesting_nurse_id===activeNurseId)
  const leaveDays=leaveStart&&leaveEnd&&new Date(leaveEnd)>=new Date(leaveStart)?Math.floor((new Date(leaveEnd+'T00:00:00')-new Date(leaveStart+'T00:00:00'))/86400000)+1:0
  const coverNurse=data.nurses.find(n=>n.id===coverNurseId)
  const coverPatientCount=new Set(data.operations.nurseAssignments.filter(a=>a.nurse_id===coverNurseId&&a.active_status===true).map(a=>a.patient_id)).size
  const coverPatientIds=new Set(data.operations.nurseAssignments.filter(a=>a.nurse_id===coverNurseId&&a.active_status===true).map(a=>a.patient_id))
  const coverSessionCount=data.operations.therapySessions.filter(x=>coverPatientIds.has(x.patient_id)).length
  const stockExceptions=data.operations.inventory.filter(x=>Number(x.available_qty??x.on_hand_qty??0)<=Number(x.reorder_threshold??0))
  const visible=useMemo(()=>rows.filter(r=>Object.values(r).join(' ').toLowerCase().includes(query.toLowerCase())).filter(r=>filter==='All'||r.risk===filter||r.status===filter||r.severity===filter),[rows,query,filter])
  const activeAlerts=data.alerts.filter(a=>a.status==='Active').length
  const highRisk=data.patients.filter(p=>['High','Critical'].includes(p.risk)).length
  const delayed=data.shipments.filter(s=>s.status==='Delayed').length
  const share=(v,t)=>t?Math.min(100,Math.round(v/t*100)):0
  const kpis=[
    ['Active patients',data.patients.length,Users,'blue',100],
    ['High-risk patients',highRisk,HeartPulse,'red',share(highRisk,data.patients.length)],
    ['Delayed shipments',delayed,Truck,'amber',share(delayed,data.shipments.length)],
    ['Active alerts',activeAlerts,AlertTriangle,'purple',share(activeAlerts,data.alerts.length)]
  ]
  const telemetry=[
    ['FACILITIES',(data.hospitals||workbook.hospitals).length,'Network nodes',Building2,false],
    ['ACTIVE CENSUS',data.patients.length,'Patient records',UserRound,false],
    ['CRITICAL ALERTS',data.alerts.filter(a=>a.severity==='Critical'||a.severity==='High').length,'Requires review',AlertTriangle,true],
    ['FIELD NURSES',data.nurses.length,'Care workforce',Stethoscope,false],
    ['PENDING THERAPIES',data.patients.filter(p=>/active|ongoing/i.test(p.status)).length,'Active care records',Syringe,false],
    ['DELAYED SHIPMENTS',data.shipments.filter(s=>/delay/i.test(s.status)).length,'Supply exceptions',Truck,true],
    ['DEVICE ATTENTION',data.devices.filter(d=>/fault|alarm|maintenance|critical/i.test(String(d.status))).length,'Service review',Cpu,false],
    ['RESILIENCE ALERT',activeAlerts,'Active events',ShieldAlert,true]
  ]

  if(!user)return <>
    <Background/>
    <Login onEnter={(email,password)=>{const accounts={'nurse.sophia.jones@carecompass.com':{password:'Nurse@123',name:'Sophia Jones',role:'Nurse',nurseId:'NUR00017'},'nurse.avery.jackson@carecompass.com':{password:'Nurse@456',name:'Avery Jackson',role:'Nurse',nurseId:'NUR00002'},'nurse.mia.clark@carecompass.com':{password:'Nurse@789',name:'Mia Clark',role:'Nurse',nurseId:'NUR00003'},'logistics.daniel.brooks@carecompass.com':{password:'Logistics@123',name:'Daniel Brooks',role:'Logistics Manager'},'iot.device@carecompass.com':{password:'IoTDevice@123',name:'Bedside IoT Monitor',role:'IoT Device Operator'}};const account=accounts[email];if(!account||account.password!==password)return 'Email or password is incorrect. Use a configured Care Compass demo account.';const u={...account,email};setUser(u);localStorage.setItem('cc-user',JSON.stringify(u));setTab(access[account.role][0]);return ''}}/>
  </>

  const heads=tab==='patients'?['Patient','Facility','Risk','Care pathway','Assigned nurse','Status']:tab==='logistics'?['Shipment','Origin','Destination','Supply','Quantity','Status','ETA']:tab==='ops'?['Device','Facility','Unit','Health score','Status','Ticket','Technician']:tab==='staff'?['Nurse','Facility','Specialty','Workload','Status']:['Alert','Facility','Type','Severity','Status']
  const cells=r=>tab==='patients'?[<><b>{r.name}</b><small>{r.id} · {r.age} years</small></>,r.facility,<span className={'tag '+(r.risk==='Critical'?'red':r.risk==='High'?'amber':'green')}>{r.risk}</span>,r.care,r.nurse,r.status]
    :tab==='logistics'?[<b>{r.id}</b>,r.origin,r.destination,r.item,r.quantity,<span className={'tag '+(r.status==='Delayed'?'red':'green')}>{r.status}</span>,r.eta]
    :tab==='ops'?[<><b>{r.name}</b><small>{r.id}</small></>,r.facility,r.unit,<span className="health"><i style={{'--w':Math.max(0,Math.min(100,Number(r.health)||0))+'%'}}/>{r.health}%</span>,<span className="tag">{r.status}</span>,r.ticket,r.technician]
    :tab==='staff'?[<><b>{r.name}</b><small>{r.id}</small></>,r.facility,r.specialty,<span className="health"><i style={{'--w':Math.min(100,share(Number(r.load)||0,Number(r.capacity)||0))+'%'}}/>{r.load}/{r.capacity}</span>,<span className="tag">{r.status}</span>]
    :[<><b>{r.title}</b><small>{r.id}</small></>,r.facility,r.type,<span className={'tag '+(r.severity==='Critical'?'red':'amber')}>{r.severity}</span>,r.status]

  return <div className="shell" data-tab={tab}>
    <Background/>

    <aside className="sidebar" style={{'--idx':navIndex,'--n':navModules.length}}>
      <div className="brand"><img className="company-logo" src="/tcs-logo.svg" alt="Tata Consultancy Services"/><div className="brand-divider"/><div><b>Care Compass</b><small>HEALTHCARE COMMAND CENTER</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <div className="nav-list">
        <i className="nav-pill"/>
        {navModules.map(([id,label,Icon])=><button key={id} className={'nav '+(tab===id?'active':'')} onClick={()=>go(id)}><Icon size={18}/>{label}<span>{id==='resilience'&&activeAlerts?<em className="count-badge">{activeAlerts}</em>:''}</span></button>)}
      </div>
      <div className="sidebar-bottom">
        <div className="user-chip"><div className="avatar">{initials(user.name)}</div><div><b>{user.name}</b><small>{user.role}</small></div></div>
        <button className="nav signout" onClick={signOut}><LogOut size={17}/> Sign out</button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="crumb"><span>Care Compass</span><ChevronRight size={14}/><b>{current[1]}</b></div>
        <div className="top-actions">
          <span className={'live '+(dbStatus==='connected'?'is-connected':dbStatus==='offline'?'is-offline':'')} title={dbError||'PostgreSQL connection status'}><i/> {dbStatus==='connected'?'POSTGRES LIVE':dbStatus==='connecting'?'CONNECTING TO POSTGRES':'POSTGRES OFFLINE'}</span>
          <button className="icon-button" aria-label="Weather journey portal" title="Weather journey portal" onClick={()=>{if(user?.role==="Nurse"){setTab("staff")}else if(user?.role==="Logistics Manager"){const shipment=data.shipments?.[0];if(shipment)setSelected({type:"logistics",record:shipment})}setWeatherPortalOpen(true)}}><CloudLightning size={18}/></button><button className="icon-button" aria-label="Operations Copilot" onClick={()=>setCopilot(!copilot)}><Brain size={18}/></button>
          <button className="icon-button" aria-label="Alerts" onClick={()=>notify(activeAlerts+' active alerts')}><Bell size={18}/>{activeAlerts>0&&<em className="dot-badge"/>}</button>
          <button className="icon-button only-compact" aria-label="Sign out" onClick={signOut}><LogOut size={17}/></button>
          <div className="avatar small">{initials(user.name)}</div>
        </div>
      </header>

      <div className="content" key={tab}>
        <div className="page-heading rise" style={{'--i':0}}>
          <div>
            <div className="eyebrow">NETWORK OPERATIONS / {current[1].toUpperCase()}</div>
            <h1>{tab==='twin'?<>Good morning, <span className="grad-text">{user.name.split(' ')[0]}</span></>:current[1]}</h1>
            <p>{tab==='twin'?'Here is the current operational picture across your connected care network.':descriptions[tab]}</p>
            {tab==='twin'&&<EcgLine className="hero-ecg"/>}
          </div>
          <div className="heading-actions">
            <span className="date-pill"><Clock size={15}/> {new Date().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</span>
            <button className="secondary" onClick={()=>exportCsv(rows.length?rows:data.audit,tab+'-export')}><Download size={15}/> Export</button>
          </div>
        </div>


        {tab==='automation'?<section className="workflow-page automation-page">
          <div className="workflow-banner automation-banner"><div><span className="eyebrow">CARE COMPASS · AUTOMATIC MONITORING</span><h2>Issues are checked for you</h2><p>Care Compass checks upcoming home visits, shipment delays, delivery-area weather and low stock. You review the findings and decide what action to take.</p></div><div className="automation-live"><i/>{automationStatus?.enabled?'MONITORING ENABLED':'CONNECTING'}</div></div>
          {automationError&&<div className="data-notice db-warning"><b>Could not load automatic checks</b><span>{automationError}</span><button className="text-button" onClick={()=>setRefreshKey(v=>v+1)}>Try again</button></div>}
          <div className="automation-toolbar"><div><b>Automatic checks</b><span>Runs about every {automationStatus?.schedule_minutes||15} minutes. This page refreshes every minute while open.</span></div><button className="primary" onClick={refreshAutomation} disabled={automationBusy||automationLoading}><RefreshCw size={15} className={automationBusy?'spin':''}/>{automationBusy?'Checking…':'Check now'}</button></div>
          <div className="workflow-kpis automation-kpis">
            <div><small>ALL ITEMS FOUND</small><strong>{automationEvents.length}</strong></div>
            <div><small>NEEDS ATTENTION</small><strong>{automationEvents.filter(x=>x.event_status==='Open').length}</strong></div>
            <div><small>NURSE VISITS</small><strong>{automationEvents.filter(x=>x.module==='Nurse').length}</strong></div>
            <div><small>LOGISTICS & STOCK</small><strong>{automationEvents.filter(x=>x.module==='Logistics').length}</strong></div>
          </div>
          <div className="panel automation-explainer"><div className="automation-explainer-icon"><ClipboardCheck size={20}/></div><div><b>What happens automatically?</b><p>Potential issues are collected here. No shipment is rerouted, no visit is cancelled and no stock is ordered automatically. A person reviews and approves the next step.</p></div></div>
          <div className="panel automation-list-panel"><div className="panel-head"><div><h2><AlertTriangle/> Items to review</h2><p>{automationEvents.length} item{automationEvents.length===1?'':'s'} currently visible for your role</p></div><span className="tag amber">{automationEvents.filter(x=>x.event_status==='Open').length} OPEN</span></div>
            {automationLoading&&!automationEvents.length?<p className="empty">Loading automatic check results…</p>:automationEvents.length?automationEvents.map(event=><article className={'automation-event '+(event.event_status==='Acknowledged'?'reviewed':'')} key={event.event_id}>
              <div className={'automation-event-mark '+String(event.severity||'').toLowerCase()}><AlertTriangle size={17}/></div>
              <div className="automation-event-copy"><div className="automation-event-meta"><span className={'tag '+(event.severity==='High'?'red':event.severity==='Moderate'?'amber':'green')}>{event.severity||'Review'}</span><span>{event.module==='Nurse'?'NURSE VISIT':'LOGISTICS'}</span><span>{event.entity_id}</span></div><h3>{event.title}</h3><p>{event.description}</p><div className="automation-next-step"><b>Suggested next step</b><span>{event.recommended_action}</span></div><small>Last noticed: {event.last_seen_utc?new Date(event.last_seen_utc).toLocaleString():'Not available'}{event.acknowledged_by?' · Reviewed by '+event.acknowledged_by:''}</small></div>
              <div className="automation-event-action">{event.event_status==='Acknowledged'?<span className="automation-reviewed"><CheckCircle2 size={15}/> Reviewed</span>:<button className="secondary" onClick={()=>acknowledgeAutomation(event)}>Mark reviewed</button>}</div>
            </article>):<p className="empty">No items have been raised by the automatic checks. Select “Check now” to run a fresh check.</p>}
          </div>
          <p className="automation-footnote">Weather information is advisory and may use an approximate hospital location when a patient's location is unavailable. Always confirm local conditions and clinical urgency before changing a visit or delivery plan.</p>
        </section>:user.role==='Nurse'&&tab==='patients'?<section className="workflow-page">
          <div className="workflow-banner"><div><span className="eyebrow">NURSE SPARK · CARE RESPONSE</span><h2>{activeNurseName} · Assigned care & patient safety</h2><p>Clinical alerts assigned to {activeNurseName} are reviewed here. Acknowledge, respond, attend and resolve each case.</p></div><div className="nurse-banner-actions"><span className="tag red">{nurseAlerts.filter(r=>assignedPatientIds.has(r.patient_id)).length} HIGH-RISK CASES</span></div></div>
          <div className="data-notice"><b>Signed in as {activeNurseName}</b><span>Registered nurse · Emergency / Med-Surg workflow</span></div>
          {dbStatus!=='connected'&&<div className="data-notice db-warning"><b>Central command connection unavailable</b><span>{dbError||'Waiting for FastAPI and PostgreSQL.'} · Check that FastAPI is running on port 8000 and refresh.</span><button className="text-button" onClick={refreshDatabase}>Retry connection</button></div>}
          <div className="nurse-device-launch"><div><b>Bedside IoT monitor</b><span>Open the connected device panel in a separate tab. Keep this nurse command center open to receive the alert.</span></div><button className="primary" onClick={()=>window.open('/iot-device','_blank','noopener,noreferrer')}>Open IoT Device Panel ↗</button></div>
          <div className="panel patient-device-messages"><div className="panel-head"><div><h2><Mic/> Patient Messages</h2><p>One-way messages sent from connected bedside devices. Nurses acknowledge and attend in Care Compass; no replies are sent to the device.</p></div><span className="tag violet">{deviceMessages.filter(m=>m.message_status!=='Acknowledged').length} UNACKNOWLEDGED</span></div>{deviceMessages.filter(m=>assignedPatientIds.has(m.patient_id)).slice(0,20).map(m=><div className="workflow-alert" key={m.message_id}><div className="grow"><b>{data.patients.find(p=>p.id===m.patient_id)?.name||m.patient_id}</b><small>{m.device_id} · {new Date(m.created_at).toLocaleString()}</small><p className="device-message-text">{m.message_text}</p></div><span className={'tag '+(m.message_status==='Acknowledged'?'violet':'red')}>{m.message_status}</span>{m.message_status!=='Acknowledged'&&<button className="primary" onClick={()=>acknowledgeDeviceMessage(m)}>Acknowledge</button>}</div>)}{!deviceMessages.length&&<p className="empty">No bedside messages received.</p>}</div>

          <div className="panel"><div className="panel-head"><div><h2><CloudLightning/> Home-visit weather & travel safety</h2><p>Open-Meteo hourly forecast checked against each scheduled home visit. Recommendations require nurse/dispatcher approval.</p></div><span className="tag teal">WEATHER FEED</span></div>{nurseWeather.loading?<p className="empty">Checking weather at upcoming home-visit locations…</p>:nurseWeather.visits.map(v=><div className="workflow-alert" key={v.session_id}><div className="grow"><b>{v.patient?.name||v.patient_id} · {new Date(v.scheduled_datetime_utc).toLocaleString()}</b><small>{v.forecast.temp}°C · Humidity {v.forecast.humidity}% · Rain {v.forecast.rain}% · Wind {v.forecast.wind} km/h · Gusts {v.forecast.gust} km/h</small><small>Visibility {v.forecast.visibility>=1000?(v.forecast.visibility/1000).toFixed(1)+' km':v.forecast.visibility+' m'} · Thunderstorm probability {v.forecast.thunder}% · Weather code {v.forecast.code}</small>{v.demoLocation&&<small>DEMO LOCATION ESTIMATE: {v.assumedLocation} · Exact home address not provided</small>}{v.risk?<small>Weather risk detected for the scheduled visit. Consider delaying or rescheduling after checking local conditions and patient urgency.</small>:<small>Forecast is below the configured demo risk thresholds for this appointment.</small>}{v.risk&&v.safer&&<small>Suggested lower-risk time: {new Date(v.safer.time).toLocaleString()} (rain {v.safer.rain}%, wind {v.safer.wind} km/h)</small>}</div><span className={'tag '+(v.risk?'red':'green')}>{v.risk?'REVIEW VISIT':'LOWER RISK'}</span>{v.risk&&<button className="secondary" onClick={()=>setSelected({type:'nurse-session',record:v})}>Review timing</button>}</div>)}{!nurseWeather.loading&&!nurseWeather.visits.length&&<p className="empty">{nurseWeather.error||'No home visits to assess.'}</p>}<p className="empty">Weather is advisory only. It does not automatically cancel a visit or override clinical urgency, local travel restrictions, or agency policy.</p></div>
          <div className="workflow-kpis"><div><small>ASSIGNED PATIENTS</small><strong>{assignedNursePatients.length}</strong></div><div><small>HIGH / CRITICAL RISKS</small><strong>{nurseAlerts.filter(r=>assignedPatientIds.has(r.patient_id)).length}</strong></div><div><small>OPEN INTERVENTIONS</small><strong>{activeNurseInterventions.length}</strong></div></div>
          <div className="panel"><div className="panel-head"><div><h2><AlertTriangle/> Nurse Spark alert queue</h2><p>Risk-register cases linked to this nurse's active patient assignments.</p></div><select value={nurseFilter} onChange={e=>setNurseFilter(e.target.value)}><option>All</option><option>Critical</option><option>High</option></select></div>
            {nurseAlerts.filter(r=>assignedPatientIds.has(r.patient_id)&&!['Closed','Resolved'].includes(r.status)).filter(r=>nurseFilter==='All'||r.severity===nurseFilter).slice(0,15).map(r=><div className="workflow-alert" key={r.id}><div className={'severity '+r.severity.toLowerCase()}/><div className="grow"><b>{r.title} · {r.patient}</b><small>{r.id} · {r.facility} · {r.status}</small></div><span className={'tag '+tagTone(r.severity)}>{r.severity}</span><button className="primary" onClick={()=>setSelected({type:'nurse-risk',record:r})}>Respond</button></div>)}
            {!nurseAlerts.some(r=>assignedPatientIds.has(r.patient_id))&&<p className="empty">No high-priority risk-register cases are linked to this nurse.</p>}
          </div>
          <div className="panel"><div className="urgent-alerts-panel"><div className="urgent-panel-head"><div><span className="urgent-live-dot"/><div><h2>Urgent Patient Alerts</h2><p>Live critical and high-priority patient alerts assigned to your care queue</p></div></div><span className="urgent-count">{nurseAlerts.filter(r=>assignedPatientIds.has(r.patient_id)&&!['Closed','Resolved'].includes(r.status)).length} ACTIVE</span></div>
            {nurseAlerts.filter(r=>assignedPatientIds.has(r.patient_id)&&!['Closed','Resolved'].includes(r.status)).sort((a,b)=>(a.severity==='Critical'?-1:1)-(b.severity==='Critical'?-1:1)).slice(0,30).map(r=><button className={'urgent-alert-row '+(r.severity==='Critical'?'critical':'high')} key={r.id} onClick={()=>{setEmergencyAlert(r);setEmergencyStep(0);setEmergencyNote('')}}><span className="urgent-alert-icon"><AlertTriangle size={18}/></span><span className="urgent-alert-copy"><b>{r.title} · {r.patient}</b><small>{r.id} · {r.facility} · {r.status}</small></span><span className="urgent-severity">{r.severity}</span><span className="urgent-open">Open response →</span></button>)}
            {!nurseAlerts.some(r=>assignedPatientIds.has(r.patient_id)&&!['Closed','Resolved'].includes(r.status))&&<p className="urgent-empty">No active urgent patient alerts. New device alerts will appear here automatically.</p>}
          </div>
          <div className="panel-head"><div><h2><HeartPulse/> My assigned patients</h2><p>Active assignments from nurse_patient_assignment.</p></div><span className="tag green">{assignedNursePatients.length} ASSIGNED</span></div>
            {assignedNursePatients.slice(0,20).map(p=>{const team=patientCareTeam(p.id);return <div className="workflow-alert patient-team-summary" key={p.id}><div className="grow"><b>{p.name}</b><small>{p.id} · {p.facility} · {p.care}</small><small className="patient-team-meta">{team.length} active nurse{team.length===1?"":"s"} on care team · {patientTherapyEpisodeCount(p.id)} therapy episode{patientTherapyEpisodeCount(p.id)===1?"":"s"} · {patientTherapyCount(p.id)} sessions · {patientOpenInterventionCount(p.id)} open interventions</small><small className="patient-team-meta">Care team: {team.map(a=>a.nurse.name).join(", ")||"No active nurse team recorded"}</small></div><span className={'tag '+tagTone(p.risk)}>{p.risk}</span><button className="secondary" onClick={()=>setSelected({type:'patients',record:p})}>Patient profile</button></div>})}
          </div>
          <div className="panel nurse-therapy-panel"><div className="panel-head"><div><h2><Clock/> Therapy attendance & rescheduling</h2><p>Track every assigned patient session as attended, not attended, rescheduled or missed.</p></div><span className="tag green">{nurseSessions.length} SESSIONS</span></div><div className="therapy-status-summary"><span>Attended <b>{nurseSessions.filter(x=>['attended','completed'].includes(String(x.session_status||'').toLowerCase())).length}</b></span><span>Not attended <b>{nurseSessions.filter(x=>/not attended/i.test(x.session_status||"")).length}</b></span><span>Rescheduled <b>{nurseSessions.filter(x=>/rescheduled/i.test(x.session_status||"")).length}</b></span><span>Missed <b>{nurseSessions.filter(x=>/missed/i.test(x.session_status||"")).length}</b></span></div>
            {nurseSessions.slice(0,15).map(s=><div className="workflow-alert" key={s.session_id}><div className="grow"><b>{data.patients.find(p=>p.id===s.patient_id)?.name||s.patient_id} · {new Date(s.scheduled_datetime_utc).toLocaleString()}</b><small>{s.patient_id} · {s.session_id} · {s.delivery_mode}</small></div><span className="tag amber">{s.session_status}</span><button className="secondary" onClick={()=>setSelected({type:'nurse-session',record:s})}>Update visit</button></div>)}
            {!nurseSessions.length&&<p className="empty">No therapy sessions are linked to this nurse's active patient assignments.</p>}
          </div>
          <div className="panel"><div className="panel-head"><div><h2><Stethoscope/> Intervention work queue</h2><p>Acknowledge, start response, attend and complete care interventions.</p></div></div>
            {activeNurseInterventions.slice(0,20).map(x=><div className="workflow-alert" key={x.intervention_id}><div className="grow"><b>{x.intervention_type}</b><small>{x.intervention_id} · {x.patient_id} · Risk {x.risk_level}</small></div><span className="tag amber">{x.status}</span><button className="secondary" onClick={()=>setSelected({type:'nurse-intervention',record:x})}>Open task</button></div>)}
            {!activeNurseInterventions.length&&<p className="empty">No open interventions assigned to this nurse.</p>}
          </div>
        </section>:user.role==='Nurse'&&tab==='staff'?<section className="workflow-page nurse-mobility-page">
          <div className="workflow-banner"><div><span className="eyebrow">NURSE MOBILITY · SHARED CARE TEAMS</span><h2>{activeNurseName} · Patient team directory</h2><p>See every patient assigned to you, every other nurse sharing that patient’s care, and each colleague’s role and workload.</p></div><span className="tag green">{assignedNursePatients.length} PATIENTS IN YOUR CARE</span></div>
          <div className="workflow-kpis"><div><small>YOUR PATIENTS</small><strong>{assignedNursePatients.length}</strong></div><div><small>OTHER NURSES IN YOUR TEAMS</small><strong>{new Set(assignedNursePatients.flatMap(p=>patientCareTeam(p.id).filter(a=>a.nurse_id!==activeNurseId).map(a=>a.nurse_id))).size}</strong></div><div><small>ACTIVE THERAPY SESSIONS</small><strong>{nurseSessions.length}</strong></div></div>
          <div className="panel"><div className="panel-head"><div><h2><Users/> Patient-by-patient nursing teams</h2><p>Each patient is listed separately. Team members are drawn from active nurse_patient_assignment records.</p></div><span className="tag teal">{activePatientAssignments.length} ACTIVE ASSIGNMENTS</span></div>
            {assignedNursePatients.map(p=>{const team=patientCareTeam(p.id);const sessions=data.operations.therapySessions.filter(s=>s.patient_id===p.id);return <article className="patient-team-card" key={p.id}>
              <div className="patient-team-heading"><div><b>{p.name}</b><small>{p.id} · {p.facility} · {p.care}</small></div><div className="patient-team-counts"><span>{team.length} nurses</span><span>{sessions.length} therapy sessions</span></div></div>
              <div className="patient-team-members">{team.map(a=><div className={'patient-team-member '+(a.nurse_id===activeNurseId?'current-nurse':'')} key={a.assignment_id}><div className="avatar">{initials(a.nurse.name)}</div><div className="grow"><b>{a.nurse.name}{a.nurse_id===activeNurseId?' · You':''}</b><small>{a.care_role||'Care team'} · {a.nurse.specialty||'General'} · {a.nurse.source?.shift||'Shift not listed'}</small></div><span className="team-workload">{a.nurse.load??'—'}/{a.nurse.capacity??'—'} patients</span></div>)}</div>
              {!team.length&&<p className="empty">No active nurse assignments are recorded for this patient.</p>}
              <div className="patient-team-footer"><span>Therapy: {sessions.filter(s=>/attended|completed/i.test(s.session_status||'')).length} attended · {sessions.filter(s=>/missed|not attended/i.test(s.session_status||'')).length} missed/not attended · {sessions.filter(s=>/rescheduled/i.test(s.session_status||'')).length} rescheduled</span><button className="secondary" onClick={()=>setSelected({type:'patients',record:p})}>Open patient profile</button></div>
            </article>})}
            {!assignedNursePatients.length&&<p className="empty">No active patient assignments are linked to this nurse.</p>}
          </div>
          <div className="panel"><div className="panel-head"><div><h2><Stethoscope/> Colleagues sharing your patients</h2><p>Distinct nurses who work with at least one patient also assigned to you.</p></div></div>
            {[...new Set(assignedNursePatients.flatMap(p=>patientCareTeam(p.id).filter(a=>a.nurse_id!==activeNurseId).map(a=>a.nurse_id)))].map(id=>{const n=data.nurses.find(x=>x.id===id);const shared=assignedNursePatients.filter(p=>patientCareTeam(p.id).some(a=>a.nurse_id===id));return n?<div className="workflow-alert" key={id}><div className="avatar">{initials(n.name)}</div><div className="grow"><b>{n.name}</b><small>{n.id} · {n.specialty||'General'} · {n.source?.shift||'Shift not listed'} · Shares care for {shared.length} patient{shared.length===1?'':'s'}</small></div><span className="team-workload">{n.load??'—'}/{n.capacity??'—'} patients</span></div>:null})}
          </div>
        </section>:user.role==='Nurse'&&tab==='leave'?<section className="workflow-page nurse-leave-page">
          <div className="workflow-banner"><div><span className="eyebrow">NURSE MOBILITY · LEAVE PLANNING</span><h2>Leave & shift coverage</h2><p>Request time away, nominate a colleague, review the workload being handed over and track approval before coverage is confirmed.</p></div><span className="tag amber">{outgoingLeaveRequests.filter(x=>x.request_status==='Pending Approval').length} REQUESTS AWAITING APPROVAL</span></div>
          <div className="panel nurse-leave-panel">
            <div className="panel-head"><div><h2><Clock/> Leave & shift coverage</h2><p>Request leave and nominate a colleague to cover your patients and therapy sessions. Work is not transferred unless the colleague approves.</p></div><span className="tag amber">{outgoingLeaveRequests.filter(x=>x.request_status==='Pending Approval').length} PENDING</span></div>
            <div className="leave-workload-grid">
              <div><small>YOUR ASSIGNED PATIENTS</small><strong>{assignedNursePatients.length}</strong></div>
              <div><small>YOUR THERAPY SESSIONS</small><strong>{nurseSessions.length}</strong></div>
              <div><small>YOUR OPEN INTERVENTIONS</small><strong>{activeNurseInterventions.length}</strong></div>
            </div>
            <div className="leave-request-form">
              <label>Leave starts<input type="date" value={leaveStart} onChange={e=>setLeaveStart(e.target.value)}/></label>
              <label>Leave ends<input type="date" min={leaveStart||undefined} value={leaveEnd} onChange={e=>setLeaveEnd(e.target.value)}/></label>
              <label>Colleague to request as cover<select value={coverNurseId} onChange={e=>setCoverNurseId(e.target.value)}><option value="">Select covering nurse</option>{data.nurses.filter(n=>n.id!==activeNurseId&&/active|employed/i.test(n.status||'')).map(n=><option key={n.id} value={n.id}>{n.name} · {n.id}</option>)}</select></label>
              <div className="leave-days-preview"><small>LEAVE DURATION</small><strong>{leaveDays} day{leaveDays===1?'':'s'}</strong></div>
            </div>
            {coverNurse&&<div className="cover-load-preview"><b>{coverNurse.name}'s current workload</b><span>{coverPatientCount} active patients · {coverSessionCount} therapy sessions</span><strong>After approval: {coverPatientCount+assignedNursePatients.length} patients · {coverSessionCount+nurseSessions.length} sessions</strong></div>}
            <button className="primary" disabled={leaveBusy||!leaveDays||!coverNurseId} onClick={sendLeaveRequest}>{leaveBusy?'SENDING REQUEST…':'SEND COVERAGE REQUEST FOR APPROVAL'}</button>
            <div className="leave-request-list">
              <h3>Requests sent by you</h3>
              {outgoingLeaveRequests.slice(0,5).map(x=><div className="leave-request-row" key={x.leave_request_id}><div><b>{data.nurses.find(n=>n.id===x.cover_nurse_id)?.name||x.cover_nurse_id}</b><small>{x.leave_start} to {x.leave_end} · {x.leave_days} days · {x.patients_to_cover} patients · {x.sessions_to_cover} sessions</small></div><span className={'tag '+(x.request_status==='Approved'?'green':x.request_status==='Declined'?'red':'amber')}>{x.request_status}</span></div>)}
              {!outgoingLeaveRequests.length&&<p className="empty">No leave coverage requests submitted yet.</p>}
              <h3>Requests awaiting your approval</h3>
              {incomingLeaveRequests.filter(x=>x.request_status==='Pending Approval').map(x=><div className="leave-request-row" key={x.leave_request_id}><div><b>{data.nurses.find(n=>n.id===x.requesting_nurse_id)?.name||x.requesting_nurse_id} needs cover</b><small>{x.leave_start} to {x.leave_end} · {x.leave_days} days · {x.patients_to_cover} patients · {x.sessions_to_cover} sessions</small></div><div className="leave-decision-buttons"><button className="primary" onClick={()=>decideLeaveRequest(x,'approved')}>Accept</button><button className="secondary" onClick={()=>decideLeaveRequest(x,'declined')}>Decline</button></div></div>)}
              {!incomingLeaveRequests.some(x=>x.request_status==='Pending Approval')&&<p className="empty">No coverage approvals waiting for you.</p>}
            </div>
          </div>
        </section>:user.role==='Logistics Manager'&&tab==='logistics'?<section className="workflow-page">
          <div className="workflow-banner"><div><span className="eyebrow">SMART LOGISTICS · SUPPLY CONTINUITY</span><h2>Daniel Brooks · Inventory & shipment operations</h2><p>Identify stock below reorder threshold, choose an operational distribution centre, approve rerouting and confirm delivery.</p></div><span className="tag amber">{stockExceptions.length} STOCK EXCEPTIONS</span></div>
          <div className="workflow-kpis"><div><small>SHIPMENTS</small><strong>{data.shipments.length}</strong></div><div><small>DELAYED / EXCEPTION</small><strong>{data.shipments.filter(s=>/delay|exception/i.test(s.status)).length}</strong></div><div><small>LOW-STOCK ITEMS</small><strong>{stockExceptions.length}</strong></div></div>
          <div className="panel"><div className="panel-head"><div><h2><PackageX/> Inventory exceptions</h2><p>Available quantity compared with configured reorder threshold.</p></div></div>
            {stockExceptions.slice(0,15).map(item=><div className="workflow-alert" key={item.inventory_id}><div className="grow"><b>{item.item_name}</b><small>{item.distribution_center_id} · Available {item.available_qty} · Reorder threshold {item.reorder_threshold}</small></div><span className="tag red">REPLENISH</span></div>)}
            {!stockExceptions.length&&<p className="empty">No inventory rows are currently below reorder threshold.</p>}
          </div>
          <div className="panel"><div className="panel-head"><div><h2><Truck/> Shipment control tower</h2><p>Manage status, route assignment and delivery events.</p></div><select value={logisticsStage} onChange={e=>setLogisticsStage(e.target.value)}><option>All</option>{[...new Set(data.shipments.map(s=>s.status))].map(s=><option key={s}>{s}</option>)}</select></div>
            {data.shipments.filter(s=>logisticsStage==='All'||s.status===logisticsStage).slice(0,25).map(s=><div className="workflow-alert" key={s.id}><div className="grow"><b>{s.id} · {s.item}</b><small>{s.origin} → {s.destination} · Qty {s.quantity} · ETA {s.eta} · {s.priority||'Priority not set'} · {s.tracking||'No tracking number'}</small></div><span className={'tag '+tagTone(s.status)}>{s.status}</span><button className="secondary" onClick={()=>setSelected({type:'logistics',record:s})}>Manage</button></div>)}
          </div>
        </section>:null}

        {tab==='twin'?<>
          <div className="data-notice rise" style={{'--i':1}}><b>{dbStatus==='connected'?'PostgreSQL connected':'Database '+dbStatus}</b><span>{dbStatus==='connected'?'Live records loaded from all operational tables.':dbStatus==='connecting'?'Connecting to Care Compass API…':`Local preview mode. ${dbError} Start the API and refresh.`} Coordinates are approximate and not for navigation.</span><button className="text-button" onClick={refreshDatabase}>Refresh</button></div>

          <div className="kpi-grid">
            {kpis.map(([label,value,Icon,tone,pct],i)=><div key={label} className={'kpi-card spot rise '+tone} style={{'--i':i+2,'--pct':pct+'%'}}>
              <div className={'kpi-icon '+tone}><Icon size={19}/></div>
              <span>{label}</span>
              <strong><CountUp value={value}/></strong>
              <small>dbStatus==='connected'?'Live PostgreSQL records':'Based on local preview records'</small>
              <i className="kpi-bar"><b/></i>
            </div>)}
          </div>

          <section className="telemetry-section reveal">
            <div className="section-title"><h2>Network Telemetry (Unified)</h2><span className="tag green">{(data.hospitals||workbook.hospitals).length} CORE NODES</span></div>
            <div className="telemetry-grid">
              {telemetry.map(([label,value,sub,Icon,danger],i)=><div key={label} className="telemetry-card spot rise" style={{'--i':i}}>
                <div>{label}<span><Icon size={15}/></span></div>
                <strong className={danger?'danger-text':''}><CountUp value={value}/></strong>
                <small>{sub}</small>
              </div>)}
            </div>
          </section>

          <section className="scenario-panel reveal">
            <div className="section-title"><h2>Operational Scenarios (6 Primaries)</h2><span className="eyebrow">ACTION CENTER</span></div>
            {scenarios.map(([title,sub,tag,target,Icon,tone],i)=><div key={title} className={'scenario-row spot rise t-'+tone} style={{'--i':i}} onClick={()=>go(target)}>
              <div className="scenario-icon"><Icon size={18}/></div>
              <div className="scenario-copy"><b>Scenario {i+1}: {title}</b><small>{sub}</small></div>
              <span className="scenario-tag">{tag}</span>
              <button className="scenario-action" onClick={e=>{e.stopPropagation();go(target)}}>Review <ChevronRight size={13}/></button>
            </div>)}
          </section>

          <section className="panel reveal" style={{marginTop:20}}>
            <div className="panel-head"><div><h2><Activity/> Golden Scenario Runner</h2><p>Execute and verify the five documented workflows against PostgreSQL records and linked history.</p></div><span className="tag green">SCN1–SCN5</span></div>
            <div className="scenario-runner">
              {[
                ['SCN1','Storm Disruption','Supply plan → allocation → alternate distribution centre → reroute → delivery'],
                ['SCN2','Missed Therapy','Missed session → deactivate old nurse → replacement assignment → completed intervention'],
                ['SCN3','Device Failure','Device alarm → service ticket → technician → closed work order'],
                ['SCN4','Device Recall','Recall → patient assignment → critical risk → intervention → closed work order'],
                ['SCN5','Firmware Update Campaign','20 device executions → 20 individual audit entries']
              ].map(([id,name,flow])=><div key={id} className="scenario-row">
                <div className="scenario-copy"><b>{id}: {name}</b><small>{flow}</small>
                {scenarioResults[id]&&<><small className={scenarioResults[id].status==='error'?'danger-text':'tag green'}>{scenarioResults[id].status==='error'?scenarioResults[id].message:`${scenarioResults[id].checks?.filter(c=>c.ok).length||0} checks passed`}</small>{scenarioResults[id].checks?.map((c,ix)=><small key={ix} className={c.ok?'scenario-check-ok':'danger-text'}>{c.ok?'✓':'✕'} {c.step}</small>)}{scenarioResults[id].warnings?.map((w,ix)=><small key={'w'+ix} className="scenario-warning">⚠ {w}</small>)}</>}</div>
                <button className="primary" disabled={scenarioBusy!==''||dbStatus!=='connected'} onClick={()=>runScenario(id)}>{scenarioBusy===id?'Running…':scenarioResults[id]?.status==='completed'?'Verify again':'Run & verify'}</button>
              </div>)}
            </div>
          </section>

          <section className="facility-panel reveal">
            <div className="section-title"><h2>Facility Operations Status</h2><span className="eyebrow">{(data.hospitals||workbook.hospitals).length} FACILITIES</span></div>
            <div className="facility-grid">
              {(data.hospitals||workbook.hospitals).slice(0,4).map((h,i)=>{
                const occ=Number(h.occupancy_rate||0)
                const bar=occ>=.9?'red-bar':occ>=.8?'amber-bar':'green-bar'
                return <div key={h.hospital_id} className="facility-row spot rise" style={{'--i':i,'--occ':Math.round(occ*100)+'%'}}>
                  <i className={bar}/>
                  <div><b>{h.hospital_name}</b><small>{h.city||''}{h.state?', '+h.state:''} · {h.hospital_type||'Care facility'}</small><u className={'occ-track '+bar}><s/></u></div>
                  <span>{Math.round(occ*100)}% OCC</span>
                </div>
              })}
            </div>
          </section>

          <div className="grid-main">
            <section className="panel map-panel reveal">
              <div className="panel-head"><div><h2><MapPin/> GIS Live Vector Twin</h2><p>Facilities, shipments, nurses and active resilience events</p></div><span className="tag green">GIS LAYER</span></div>
              <NetworkMap hospitals={data.hospitals||workbook.hospitals}/>
            </section>
            <section className="panel reveal">
              <div className="panel-head"><div><h2><AlertTriangle/> Attention queue</h2><p>Items requiring operational review</p></div><span className="tag red">{activeAlerts} ACTIVE</span></div>
              {data.alerts.slice(0,4).map((a,i)=><div key={a.id} className="alert-row" style={{'--i':i}}><div className={'severity '+a.severity.toLowerCase()}/><div className="grow"><b>{a.title}</b><small>{a.facility} · {a.type}</small></div><span className={'tag '+tagTone(a.severity)}>{a.severity}</span></div>)}
            </section>
          </div>

          <section className="panel reveal">
            <div className="panel-head"><div><h2><Command/> Operational activity</h2><p>Recent auditable actions across modules</p></div><button className="text-button" onClick={()=>go('resilience')}>View alerts <ArrowUpRight size={15}/></button></div>
            {data.audit.slice(0,5).map((a,i)=><div key={a.id+'-'+i} className="audit-row" style={{'--i':i}}><CheckCircle2 size={16}/><div><b>{a.action}</b><small>{a.entity} · {a.actor}</small></div><time>{new Date(a.at).toLocaleTimeString()}</time></div>)}
          </section>
        </>:<>
          <div className="toolbar rise" style={{'--i':1}}>
            <div className="search"><Search size={17}/><input placeholder={'Search '+current[1].toLowerCase()+'...'} value={query} onChange={e=>setQuery(e.target.value)}/></div>
            <select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{[...new Set(rows.flatMap(r=>[r.status,r.risk,r.severity]).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select>
            {tab==='resilience'&&<button className="primary shine" onClick={()=>setModal({kind:'alert'})}><Plus size={16}/> Create alert</button>}
          </div>
          <div className="table-panel rise" style={{'--i':2}}>
            <div className="table-title"><div><h2>{current[1]} register</h2><p>{visible.length} records · searchable synthetic operational data</p></div><button className="secondary" onClick={()=>exportCsv(visible,tab+'-records')}><Download size={15}/> CSV</button></div>
            <div className="table-scroll">
              <table>
                <thead><tr>{heads.map(h=><th key={h}>{h}</th>)}<th>Action</th></tr></thead>
                <tbody>{visible.map((r,ri)=><tr key={r.id} style={{'--i':ri}}>{cells(r).map((v,ci)=><td key={ci}>{v}</td>)}<td><button className="row-action" onClick={()=>setSelected({type:tab,record:r})}>Open <ChevronRight size={14}/></button></td></tr>)}</tbody>
              </table>
              {!visible.length&&<div className="empty">No records match your search.</div>}
            </div>
          </div>
        </>}

      {weatherPortalOpen&&<div className="urgent-drawer-scrim" style={{zIndex:1200}} onClick={()=>setWeatherPortalOpen(false)}>
        <section className="panel" role="dialog" aria-modal="true" aria-label="Weather journey forecast" onClick={e=>e.stopPropagation()} style={{position:'fixed',inset:'3vh 3vw',zIndex:1201,overflowY:'auto',padding:28,borderRadius:22,background:'var(--panel, #fff)'}}>
          <div className="panel-head"><div><div className="eyebrow">CARE COMPASS / WEATHER JOURNEY PORTAL</div><h1><CloudLightning size={26}/> Weather journey briefing</h1><p>A guided view of current conditions, hourly forecasts, risk signals and recommended next steps.</p></div><button className="icon-button" aria-label="Close weather portal" onClick={()=>setWeatherPortalOpen(false)}><X/></button></div>
          {user?.role==='Nurse'?<>
            <div className="workflow-kpis"><div><small>STEP 1 · YOUR UPCOMING HOME VISITS</small><strong>{nurseWeather.visits.length} visits assessed</strong></div><div><small>STEP 2 · WEATHER CHECK</small><strong>{nurseWeather.loading?'Updating forecast…':nurseWeather.visits.filter(v=>v.risk).length+' visits need review'}</strong></div><div><small>STEP 3 · ACTION</small><strong>Nurse approval required</strong></div></div>
            {nurseWeather.loading?<p className="empty">Loading forecast for assigned home visits…</p>:nurseWeather.visits.map(v=><article className="panel" key={v.session_id} style={{marginBottom:14,padding:18}}>
              <div className="panel-head"><div><h2>{v.patient?.name||v.patient_id}</h2><p>Scheduled visit · {new Date(v.scheduled_datetime_utc).toLocaleString()} · {v.assumedLocation||v.patient?.facility||'Visit location'}</p></div><span className={'tag '+(v.risk?'red':'green')}>{v.risk?'WEATHER REVIEW':'CONDITIONS OK'}</span></div>
              <div className="workflow-kpis"><div><small>TEMPERATURE</small><strong>{v.forecast.temp}°C</strong></div><div><small>RAIN CHANCE</small><strong>{v.forecast.rain}%</strong></div><div><small>WIND / GUST</small><strong>{v.forecast.wind} / {v.forecast.gust} km/h</strong></div><div><small>VISIBILITY</small><strong>{(v.forecast.visibility/1000).toFixed(1)} km</strong></div></div>
              <div className="panel-head"><div><h3>How to use this forecast</h3><p>1. Review the visit time · 2. Check weather risk · 3. Compare the suggested time · 4. Approve or keep the original schedule.</p></div></div>
              {v.safer&&<div className="workflow-alert"><div className="grow"><b>Suggested lower-risk visit time</b><small>{new Date(v.safer.time).toLocaleString()} · Rain {v.safer.rain}% · Wind {v.safer.wind} km/h</small></div><button className="secondary" onClick={()=>{setSelected({type:'nurse-session',record:v});setWeatherPortalOpen(false)}}>Review and approve time</button></div>}
              {v.demoLocation&&<p className="empty">DEMO LOCATION ESTIMATE · {v.assumedLocation}. Exact home coordinates were not supplied.</p>}
            </article>)}
            {!nurseWeather.loading&&!nurseWeather.visits.length&&<p className="empty">{nurseWeather.error||'No upcoming home visits are available for this nurse.'}</p>}
          </>:<>
            <div className="workflow-kpis"><div><small>STEP 1 · SHIPMENT</small><strong>{selected?.type==='logistics'?selected.record.id:'Select a shipment in Logistics Tower'}</strong></div><div><small>STEP 2 · ROUTE</small><strong>{shipmentInsight.route?shipmentInsight.route.km.toFixed(0)+' km':'Route not loaded'}</strong></div><div><small>STEP 3 · WEATHER</small><strong>{shipmentInsight.loading?'Forecast updating':shipmentInsight.routeRisk?'Weather risk detected':'Monitoring conditions'}</strong></div></div>
            {shipmentInsight.loading?<p className="empty">Building route and forecast checkpoints…</p>:shipmentInsight.routeWeather?.length?shipmentInsight.routeWeather.map(point=><article className="panel" key={point.label} style={{marginBottom:14,padding:18}}><div className="panel-head"><div><h2>{point.label}</h2><p>Forecast checkpoint along the shipment route</p></div><span className="tag teal">WEATHER CHECKPOINT</span></div>{point.forecast.map(w=><div className="workflow-alert" key={w.time}><div className="grow"><b>{new Date(w.time).toLocaleString([], {weekday:'long',hour:'numeric'})}</b><small>{w.temp}°C · Rain {w.rain}% · {w.mm} mm · Wind {w.wind} km/h · Gusts {w.gust} km/h · Thunder {w.thunder}% · Visibility {(w.visibility/1000).toFixed(1)} km</small></div><span className={'tag '+(w.rain>=60||w.wind>=45||w.gust>=65||w.thunder>=40||w.code>=95?'red':'green')}>{w.rain>=60||w.wind>=45||w.gust>=65||w.thunder>=40||w.code>=95?'RISK':'CLEAR'}</span></div>)}</article>):<p className="empty">Open a shipment from Logistics Tower first to load its route and weather forecast. Then reopen this portal.</p>}
            <p className="empty">Forecasts are model estimates, not a carrier GPS feed. Route progress requires real tracking updates.</p>
          </>}
          <div className="panel-head"><div><h3>Decision guide</h3><p>Check forecast time against the planned journey or appointment. Treat risk flags as prompts for human review, not automatic dispatch or clinical decisions.</p></div></div>
        </section>
      </div>}
        <footer>CARE COMPASS · SYNTHETIC DATA ENVIRONMENT <span>Role: {user.role} · {dbStatus==='connected'?'PostgreSQL connected':'PostgreSQL connection unavailable'}</span></footer>
      </div>
    </main>

    <nav className="bottom-nav" style={{'--idx':navIndex,'--n':navModules.length}}>
      <i className="dock-pill"/>
      {navModules.map(([id,,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>go(id)}><Icon size={18}/><span>{shortLabel[id]}</span></button>)}
    </nav>

    {emergencyAlert&&user?.role==='Nurse'&&<div className="urgent-drawer-scrim" onClick={()=>setEmergencyAlert(null)}>
      <aside className="urgent-response-drawer" role="dialog" aria-modal="true" aria-label="Patient emergency response" onClick={e=>e.stopPropagation()}>
        <div className="emergency-top"><span className="emergency-pulse"/><span>LIVE IOT ALERT · NURSE SPARK</span><button className="urgent-drawer-close" onClick={()=>setEmergencyAlert(null)}>×</button></div>
        <div className="emergency-head"><div><div className="emergency-kicker">PATIENT RESPONSE WORKFLOW</div><h1>{emergencyAlert.severity} patient alert</h1><p>Review the device event and progress through the response.</p></div><span className="emergency-critical">{emergencyAlert.severity}</span></div>
        <div className="emergency-patient"><div><small>PATIENT</small><strong>{data.patients.find(p=>p.id===emergencyAlert.patient_id)?.name||emergencyAlert.patient_id}</strong><span>{emergencyAlert.patient_id} · {(data.hospitals||[]).find(h=>h.hospital_id===emergencyAlert.hospital_id)?.hospital_name||emergencyAlert.hospital_id}</span></div><div><small>ALERT SOURCE</small><strong>Connected bedside monitor</strong><span>{emergencyAlert.risk_type} · {new Date(emergencyAlert.identified_datetime_utc||Date.now()).toLocaleTimeString()}</span></div></div>
        <div className="emergency-progress">{['Alert received','Acknowledge','Assessment','Bedside','Document','Resolve'].map((s,i)=><div className={i<=emergencyStep?'done':''} key={s}><i>{i<emergencyStep?'✓':i+1}</i><span>{s}</span></div>)}</div>
        <div className="emergency-action"><div><b>{['Alert received','Begin clinical assessment','Confirm bedside attendance','Record clinical observations','Verify stability and resolve','Response complete'][Math.min(emergencyStep,5)]}</b><p>{['The device has sent a patient safety event to the central command centre. Accept the alert to take ownership.','Begin assessment and place the patient risk under active monitoring.','Confirm that you have reached the bedside and assessed the patient.','Record the observations and actions taken during the response.','Confirm the patient is stable, complete the intervention and close the risk.','The intervention is completed and the patient risk is closed.'][Math.min(emergencyStep,5)]}</p></div>
          {emergencyStep===3&&<label className="emergency-note">Clinical observations / actions taken (demo session note)<textarea value={emergencyNote} onChange={e=>setEmergencyNote(e.target.value)} placeholder="Enter observations, assessment findings and actions taken..." rows={3}/></label>}
          <div className="emergency-buttons">{emergencyStep===0?<button disabled={emergencyBusy} onClick={()=>advanceEmergency('Nurse acknowledged critical alert',[{table:'intervention_cases',id:data.operations.interventions.find(x=>x.patient_id===emergencyAlert.patient_id&&x.assigned_nurse_id===activeNurseId&&!/completed|closed/i.test(x.status||''))?.intervention_id,patch:{status:'Acknowledged'}}].filter(x=>x.id))}>ACKNOWLEDGE & TAKE OWNERSHIP</button>:emergencyStep===1?<button disabled={emergencyBusy} onClick={()=>advanceEmergency('Clinical assessment started',[{table:'risk_register',id:emergencyAlert.id,patch:{status:'Monitoring'}},{table:'intervention_cases',id:data.operations.interventions.find(x=>x.patient_id===emergencyAlert.patient_id&&x.assigned_nurse_id===activeNurseId&&!/completed|closed/i.test(x.status||''))?.intervention_id,patch:{status:'In Progress'}}].filter(x=>x.id))}>START CLINICAL ASSESSMENT</button>:emergencyStep===2?<button disabled={emergencyBusy} onClick={()=>advanceEmergency('Nurse confirmed bedside attendance',[{table:'intervention_cases',id:data.operations.interventions.find(x=>x.patient_id===emergencyAlert.patient_id&&x.assigned_nurse_id===activeNurseId&&!/completed|closed/i.test(x.status||''))?.intervention_id,patch:{status:'In Progress'}}].filter(x=>x.id))}>CONFIRM BEDSIDE ATTENDANCE</button>:emergencyStep===3?<button disabled={emergencyBusy} onClick={()=>{if(!emergencyNote.trim()){notify('Enter clinical observations before continuing');return}advanceEmergency('Clinical response note captured in this demo session',[{table:'intervention_cases',id:data.operations.interventions.find(x=>x.patient_id===emergencyAlert.patient_id&&x.assigned_nurse_id===activeNurseId&&!/completed|closed/i.test(x.status||''))?.intervention_id,patch:{status:'In Progress'}}].filter(x=>x.id))}}>SAVE OBSERVATIONS & CONTINUE</button>:emergencyStep===4?<button disabled={emergencyBusy} onClick={()=>advanceEmergency('Patient stabilised and case resolved',[{table:'intervention_cases',id:data.operations.interventions.find(x=>x.patient_id===emergencyAlert.patient_id&&x.assigned_nurse_id===activeNurseId&&!/completed|closed/i.test(x.status||''))?.intervention_id,patch:{status:'Completed'}},{table:'risk_register',id:emergencyAlert.id,patch:{status:'Closed'}}].filter(x=>x.id))}>CONFIRM STABLE · RESOLVE CASE</button>:<button onClick={()=>setEmergencyAlert(null)}>CLOSE</button>}{emergencyBusy&&<span>Saving response…</span>}</div>
        </div>
        <div className="emergency-foot">Demonstration workflow only · Follow your organisation's clinical emergency protocols.</div>
      </aside>
    </div>}
    {urgentToastVisible&&urgentToast&&user?.role==='Nurse'&&<button className="urgent-toast" onClick={()=>{setEmergencyAlert({...urgentToast,id:urgentToast.risk_id,title:urgentToast.risk_type});setEmergencyStep(0);setEmergencyNote('');setUrgentToastVisible(false)}}><span className="urgent-live-dot"/><span><b>New {urgentToast.severity} patient alert</b><small>{urgentToast.risk_type} · {urgentToast.patient_id}</small></span><strong>VIEW →</strong></button>}

    {selected&&<div className="overlay" onClick={()=>setSelected(null)}><div className="drawer" onClick={e=>e.stopPropagation()}>
      <div className="drawer-head"><div><div className="eyebrow">RECORD DETAILS</div><h2>{selected.record.name||selected.record.title||selected.record.id}</h2></div><button className="icon-button" aria-label="Close" onClick={()=>setSelected(null)}><X/></button></div>
      <div className="detail-list">{Object.entries(selected.record).map(([k,v],i)=>v&&typeof v==='object'
        ?<div key={k} className="full" style={{'--i':i}}><small>{k.replaceAll('_',' ')} record</small><dl className="kv">{Object.entries(v).map(([a,b])=><div key={a}><dt>{a.replaceAll('_',' ')}</dt><dd>{String(b)}</dd></div>)}</dl></div>
        :<div key={k} style={{'--i':i}}><small>{k.replaceAll('_',' ')}</small><b>{String(v)}</b></div>)}</div>
      {selected.type==='nurse-risk'&&<div className="form-stack"><div className="tag red">NURSE SPARK · RISK RESPONSE</div><label>Risk status</label><select id="riskResponseStatus" defaultValue={selected.record.status}><option>Open</option><option>Monitoring</option><option>Escalated</option><option>Closed</option></select><button className="primary shine" disabled={workflowBusy} onClick={()=>persistWorkflowAction({table:'risk_register',id:selected.record.id,patch:{status:document.getElementById('riskResponseStatus').value},action:'Updated patient risk response'})}>{workflowBusy?'Saving…':'Save risk response'}</button></div>}
      {selected.type==='nurse-session'&&<div className="form-stack"><div className="tag teal">THERAPY SESSION</div><label>Visit outcome</label><select id="therapyStatus" defaultValue={selected.record.session_status}><option>Scheduled</option><option>Attended</option><option>Not Attended</option><option>Rescheduled</option><option>Missed</option><option>In Progress</option><option>Completed</option><option>Cancelled</option></select><label>New date and time (required when rescheduling)</label><input id="therapyRescheduleDate" type="datetime-local" defaultValue={(selected.record.safer?.time||selected.record.scheduled_datetime_utc)?new Date(new Date(selected.record.safer?.time||selected.record.scheduled_datetime_utc).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):''}/><button className="primary shine" disabled={workflowBusy} onClick={()=>{const status=document.getElementById('therapyStatus').value;const date=document.getElementById('therapyRescheduleDate').value;if(status==='Rescheduled'&&!date){notify('Choose a new date and time for the rescheduled session');return}persistWorkflowAction({table:'therapy_sessions',id:selected.record.session_id,patch:{session_status:status,...(status==='Rescheduled'&&date?{scheduled_datetime_utc:new Date(date).toISOString()}:{})},action:'Updated therapy session'})}}>{workflowBusy?'Saving…':'Save visit outcome'}</button></div>}
      {selected.type==='nurse-intervention'&&<div className="form-stack"><div className="tag amber">CARE INTERVENTION</div><label>Intervention status</label><select id="interventionStatus" defaultValue={selected.record.status}><option>Assigned</option><option>Acknowledged</option><option>In Progress</option><option>Completed</option><option>Closed</option><option>Escalated</option></select><button className="primary shine" disabled={workflowBusy} onClick={()=>persistWorkflowAction({table:'intervention_cases',id:selected.record.intervention_id,patch:{status:document.getElementById('interventionStatus').value},action:'Updated nurse intervention'})}>{workflowBusy?'Saving…':'Save intervention status'}</button></div>}
      {selected.type==='patients'&&<div className="form-stack"><label>Reassign nurse</label><select id="nurseChoice">{data.nurses.map(n=><option key={n.id} value={n.name}>{n.name} · {n.status} · {n.load}/{n.capacity}</option>)}</select><button className="primary shine" onClick={()=>update('patients',selected.record.id,{nurse:document.getElementById('nurseChoice').value,status:'Reassigned'},'Reassigned patient nurse')}>Confirm reassignment</button></div>}
      {selected.type==='logistics'&&(()=>{const sh=selected.record.source||{};const supplier=(data.operations?.suppliers||[]).find(x=>x.supplier_id===sh.supplier_id);const phone=supplier?.phone_number||supplier?.contact_phone||supplier?.phone||supplier?.telephone||sh.delivery_partner_phone||sh.carrier_phone||'+1 (800) 555-'+String((Number(String(sh.supplier_id||'SUP001').replace(/\\D/g,''))||1)%9000+1000);const partner=supplier?.supplier_name||sh.delivery_partner||sh.carrier_name||sh.supplier_name||'Care Compass Demo Logistics';const contactIsDemo=!(supplier?.phone_number||supplier?.contact_phone||supplier?.phone||supplier?.telephone||sh.delivery_partner_phone||sh.carrier_phone);const related=(data.alerts||[]).filter(a=>((sh.scenario_id&&a.source?.scenario_id===sh.scenario_id)||[sh.origin_city,sh.destination_city].filter(Boolean).some(c=>JSON.stringify(a.source||{}).toLowerCase().includes(String(c).toLowerCase())))&&!['Resolved','Closed'].includes(a.status));const history=(data.operations.shipmentEvents||[]).filter(e=>e.shipment_id===selected.record.id).sort((a,b)=>new Date(b.event_datetime_utc||0)-new Date(a.event_datetime_utc||0)).slice(0,6);const forecast=shipmentInsight.weather||[];const risk=forecast.filter(w=>w.rain>=60||w.wind>=45);const dc=(data.operations?.distributionCenters||[]).find(x=>x.distribution_center_id===sh.distribution_center_id);const hospital=(data.hospitals||[]).find(x=>x.hospital_id===(sh.destination_hospital_id||sh.hospital_id));const mapQuery=encodeURIComponent((dc?.name||selected.record.origin)+' to '+(hospital?.hospital_name||selected.record.destination));return <div className="panel shipment-intelligence" style={{marginTop:16}}><div className="panel-head"><div><h2><MapPin/> Shipment tracking & arrival prediction</h2><p>Road-route estimate and destination weather forecast · live external data</p></div><span className="tag teal">{shipmentInsight.loading?'UPDATING':'TRACKING VIEW'}</span></div><div className="workflow-kpis"><div><small>DELIVERY PARTNER</small><strong>{partner}</strong></div><div><small>CONTACT</small><strong>{phone}{contactIsDemo?' · DEMO CONTACT':''}</strong></div><div><small>TRACKING NUMBER</small><strong>{sh.tracking_number||selected.record.tracking||'Not available'}</strong></div></div><div className="panel-head"><div><h3>Shipment movement feed</h3><p>Latest recorded shipment events from PostgreSQL</p></div><span className="tag teal">{history.length} EVENTS</span></div>{history.map((event,i)=><div className="workflow-alert" key={event.shipment_event_id||i}><div className="grow"><b>{event.event_status||'Shipment update'}</b><small>{event.event_datetime_utc?new Date(event.event_datetime_utc).toLocaleString():'Timestamp not recorded'} · {event.recorded_by||'System'}</small></div><span className="tag">{i===0?'LATEST':'HISTORY'}</span></div>)}{!history.length&&<p className="empty">No shipment movement events have been recorded yet. Status updates will appear here when saved.</p>}{shipmentInsight.loading?<p className="empty">Calculating road route and checking forecast…</p>:shipmentInsight.route?<><div className="workflow-kpis"><div><small>ROAD DISTANCE</small><strong>{shipmentInsight.route.km.toFixed(0)} km</strong></div><div><small>TRAVEL DURATION</small><strong>{Math.ceil(shipmentInsight.route.minutes/60)} hrs</strong></div><div><small>PREDICTED ARRIVAL</small><strong>{new Date(shipmentInsight.route.arrival).toLocaleString()}</strong></div></div><p className="empty">ETA is calculated from current road-route duration. It is an estimate, not carrier-confirmed GPS tracking.</p>{shipmentInsight.demoLocation&&<p className="empty">DEMO ROUTE LOCATION: {shipmentInsight.originName} → {shipmentInsight.destinationName}. City-level coordinates are estimated because exact coordinates were missing.</p>}<button className="secondary" disabled={workflowBusy} onClick={()=>persistWorkflowAction({table:'logistics_shipments',id:selected.record.id,patch:{shipment_status:selected.record.status,distribution_center_id:sh.distribution_center_id,estimated_delivery_utc:shipmentInsight.route.arrival},action:'Saved predicted shipment ETA'})}>{workflowBusy?'Saving…':'Save predicted ETA to shipment record'}</button></>:<p className="empty">{shipmentInsight.error||'Live route estimate unavailable. Recorded ETA: '+(selected.record.eta||'Not available')}</p>}<div className="panel-head"><div><h3>Weather along shipment route</h3><p>Open-Meteo forecast at origin, route midpoint and destination · next 24 hours</p></div><span className={'tag '+(shipmentInsight.routeRisk?'red':'green')}>{shipmentInsight.routeRisk?'ROUTE WEATHER RISK':'ROUTE CONDITIONS'}</span></div>{(shipmentInsight.routeWeather||[]).map(point=><div className="workflow-alert" key={point.label}><div className="grow"><b>{point.label}</b><small>{point.forecast[0]?new Date(point.forecast[0].time).toLocaleString()+' · ':''}{point.forecast[0]?.temp??'—'}°C · Rain {point.forecast[0]?.rain??'—'}% · Wind {point.forecast[0]?.wind??'—'} km/h · Gusts {point.forecast[0]?.gust??'—'} km/h · Visibility {point.forecast[0]?.visibility?((point.forecast[0].visibility/1000).toFixed(1)+' km'):'—'}</small></div><span className={'tag '+(point.forecast.some(w=>w.rain>=60||w.wind>=45||w.gust>=65||w.thunder>=40||(w.visibility>0&&w.visibility<1000)||w.code>=95)?'red':'green')}>{point.forecast.some(w=>w.rain>=60||w.wind>=45||w.gust>=65||w.thunder>=40||(w.visibility>0&&w.visibility<1000)||w.code>=95)?'WEATHER RISK':'MONITOR'}</span></div>)}{forecast.slice(0,8).map(w=><div className="workflow-alert" key={'dest-'+w.time}><div className="grow"><b>Destination · {new Date(w.time).toLocaleString([], {weekday:'short',hour:'numeric'})}</b><small>Rain {w.rain}% · {w.mm} mm · Wind {w.wind} km/h · Gusts {w.gust} km/h · Thunderstorm {w.thunder}%</small></div><span className={'tag '+(w.rain>=60||w.wind>=45||w.gust>=65||w.thunder>=40||w.code>=95?'red':'green')}>{w.rain>=60||w.wind>=45||w.gust>=65||w.thunder>=40||w.code>=95?'WEATHER RISK':'MONITOR'}</span></div>)}{!forecast.length&&!shipmentInsight.loading&&<p className="empty">Weather forecast unavailable for this destination.</p>}{risk.length>0&&<p className="empty">Potential weather disruption forecast in {risk.length} of the next 24 hours. Review before dispatch.</p>}<div className="panel-head"><div><h3>Linked resilience alerts</h3><p>Active alerts matching this shipment's scenario or route cities</p></div><span className="tag amber">{related.length} LINKED</span></div>{related.slice(0,8).map(a=><div className="workflow-alert" key={a.id}><div className="grow"><b>{a.title}</b><small>{a.facility} · {a.type||'Operational disruption'}</small></div><span className={'tag '+tagTone(a.severity)}>{a.severity}</span></div>)}{!related.length&&<p className="empty">No active resilience alerts currently match this shipment.</p>}<a className="text-button" href={'https://www.openstreetmap.org/search?query='+mapQuery} target="_blank" rel="noreferrer">Open shipment route map ↗</a></div>})()}
      {selected.type==='logistics'&&<div className="form-stack"><div className="tag amber">SHIPMENT OPERATIONS</div><label>Distribution centre</label><select id="shipmentDc" defaultValue={selected.record.source?.distribution_center_id||''}>{data.operations.distributionCenters.filter(dc=>dc.operational_status==='Operational').map(dc=>{const stock=data.operations.inventory.find(inv=>inv.distribution_center_id===dc.distribution_center_id&&String(inv.item_name).toLowerCase()===String(selected.record.source?.supply_category||'').toLowerCase());const current=dc.distribution_center_id===selected.record.source?.distribution_center_id;const enough=Number(stock?.available_qty||0)>=Number(selected.record.source?.quantity||0);return <option key={dc.distribution_center_id} value={dc.distribution_center_id} disabled={!current&&!enough}>{dc.name} · {dc.city}, {dc.state} · {stock?stock.available_qty+' available':'No matching stock'}{!current&&!enough?' · Insufficient':''}</option>})}</select><small>Alternative centres are selectable only when they are operational and have enough available stock for this shipment's supply category.</small><label>Shipment status</label><select id="shipmentStatus" defaultValue={selected.record.status}><option>Created</option><option>In Transit</option><option>Delayed</option><option>Rerouted</option><option>Delivered</option></select><button className="primary shine" disabled={workflowBusy} onClick={()=>{const status=document.getElementById('shipmentStatus').value;const dc=document.getElementById('shipmentDc').value;persistWorkflowAction({table:'logistics_shipments',id:selected.record.id,patch:{shipment_status:status,distribution_center_id:dc,...(status==='Delivered'?{actual_delivery_utc:new Date().toISOString()}:{})},action:'Shipment '+status,event:{shipment_id:selected.record.id,event_status:status==='Delivered'?'Delivered':status==='Rerouted'?'Rerouted':status}})}}>{workflowBusy?'Saving…':'Approve shipment update'}</button></div>}
      {selected.type==='ops'&&<div className="form-stack"><label>Assign technician</label><input id="techName" placeholder="Technician name" defaultValue="R. Patel"/><button className="primary shine" onClick={()=>update('devices',selected.record.id,{technician:document.getElementById('techName').value,status:'Service dispatched'},'Dispatched biomedical technician')}>Dispatch technician</button></div>}
      {selected.type==='staff'&&<div className="form-stack"><label>Update availability</label><select id="nurseStatus"><option>Available</option><option>On duty</option><option>Off duty</option><option>Delayed</option></select><button className="primary shine" onClick={()=>update('nurses',selected.record.id,{status:document.getElementById('nurseStatus').value},'Updated nurse availability')}>Save availability</button></div>}
      {selected.type==='resilience'&&<div className="form-stack"><label>Alert status</label><select id="alertStatus"><option>Active</option><option>Monitoring</option><option>Resolved</option></select><button className="primary shine" onClick={()=>update('alerts',selected.record.id,{status:document.getElementById('alertStatus').value},'Updated resilience alert')}>Update alert</button></div>}
    </div></div>}

    {modal?.kind==='alert'&&<div className="overlay centered" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="drawer-head"><h2>Create resilience alert</h2><button className="icon-button" aria-label="Close" onClick={()=>setModal(null)}><X/></button></div>
      <div className="form-stack"><label>Alert title</label><input placeholder="Describe the operational event" onChange={e=>setModal(m=>({...m,title:e.target.value}))}/><label>Facility</label><input placeholder="Facility or network-wide" onChange={e=>setModal(m=>({...m,facility:e.target.value}))}/><label>Severity</label><select onChange={e=>setModal(m=>({...m,severity:e.target.value}))}><option>Moderate</option><option>High</option><option>Critical</option></select><button className="primary shine" onClick={createAlert}>Create alert</button></div>
    </div></div>}

    {copilot&&<div className="copilot">
      <div className="copilot-head"><div><Brain size={18}/> <b>Operations Copilot</b><small>Rule-based demo assistant</small></div><button className="icon-button" aria-label="Close copilot" onClick={()=>setCopilot(false)}><X/></button></div>
      <div className="chat-messages">{messages.map((m,i)=><div key={i} className={'message '+m.from}>{m.text}</div>)}{typing&&<div className="message ai typing"><i/><i/><i/></div>}<div ref={chatEnd}/></div>
      <form onSubmit={e=>{e.preventDefault();ask()}}><input value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask about patients, shipments, staffing..."/><button className="primary" aria-label="Send"><Send size={16}/></button></form>
    </div>}

    {user?.role==='Nurse'&&tab==='patients'&&<aside className="nurse-taskbar" role="region" aria-label="Unresolved patient alerts">
      <div className="nurse-taskbar-label"><span className="urgent-live-dot"/><span><b>CRITICAL ALERTS</b><small>{nurseAlerts.filter(r=>assignedPatientIds.has(r.patient_id)&&!['Closed','Resolved'].includes(r.status)).length+deviceMessages.filter(m=>assignedPatientIds.has(m.patient_id)&&m.message_status!=='Acknowledged').length} unresolved</small></span><button className="nurse-taskbar-refresh" onClick={refreshDatabase} title="Refresh alerts">↻</button></div>
      <div className="nurse-taskbar-track"><div className="nurse-taskbar-scroll">
        {nurseAlerts.filter(r=>assignedPatientIds.has(r.patient_id)&&!['Closed','Resolved'].includes(r.status)).sort((a,b)=>(a.severity==='Critical'?-1:1)-(b.severity==='Critical'?-1:1)).map(r=><button key={r.id} className={'nurse-task-chip '+(r.severity==='Critical'?'critical':'high')} onClick={()=>{setEmergencyAlert(r);setEmergencyStep(0);setEmergencyNote('')}}><b>{r.severity==='Critical'?'● CRITICAL':'▲ HIGH'}</b><span>{r.patient} · {r.title}</span><small>{r.status} · Open response →</small></button>)}
        {deviceMessages.filter(m=>assignedPatientIds.has(m.patient_id)&&m.message_status!=='Acknowledged').map(m=><button key={m.message_id} className="nurse-task-chip message" onClick={()=>document.querySelector('.patient-device-messages')?.scrollIntoView({behavior:'smooth',block:'center'})}><b>● PATIENT MESSAGE</b><span>{data.patients.find(p=>p.id===m.patient_id)?.name||m.patient_id} · {m.message_text}</span><small>Awaiting acknowledgement →</small></button>)}
        {!nurseAlerts.some(r=>assignedPatientIds.has(r.patient_id)&&!['Closed','Resolved'].includes(r.status))&&!deviceMessages.some(m=>assignedPatientIds.has(m.patient_id)&&m.message_status!=='Acknowledged')&&<span className="nurse-task-empty">No unresolved alerts or messages</span>}
      </div></div>
    </aside>}
    {toast&&<div className="toast" key={toast}><CheckCircle2 size={17}/>{toast}</div>}
  </div>
}
export default App
