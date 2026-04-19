import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, BarChart2, CheckCircle, ChevronDown, Cpu, DollarSign, Eye, FileCheck, Link as LinkIcon, MapPin, Mic, Send, Video, Wifi, XCircle } from 'lucide-react';
import { riskReport } from '../data/mockData.js';
import { useCountUp } from '../hooks/useCountUp.js';

const iconMap = { link: LinkIcon, eye: Eye, video: Video, 'map-pin': MapPin, 'bar-chart': BarChart2, mic: Mic, check: CheckCircle, cpu: Cpu, dollar: DollarSign };

function money(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function ConfidenceRing() {
  const radius = 40;
  const dash = 251;
  const offset = dash * (1 - riskReport.confidenceScore / 100);
  return (
    <div className="ring-wrap">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
        <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--acc)" strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 44 44)" style={{animation:'ring-draw 1s ease forwards'}} />
        <text x="44" y="42" textAnchor="middle" className="ring-text">{riskReport.confidenceScore}%</text>
        <text x="44" y="58" textAnchor="middle" className="ring-label">Confidence</text>
      </svg>
    </div>
  );
}

function TranscriptLine({ line }) {
  const cls = line.highlight === 'consent' ? 'report-line consent' : 'report-line';
  let text = line.text;
  if (line.highlight === 'income') text = text.replace('₹68,000', '<span class="hl-income">₹68,000</span>');
  if (line.highlight === 'employment') text = text.replace('TCS', '<span class="hl-employment">TCS</span>');
  return (
    <div className={cls}>
      <span className="time">{line.time}</span>
      <span className="speaker" style={{color:line.speaker === 'Agent' ? 'var(--t2)' : 'var(--t0)'}}>{line.speaker}</span>
      <span dangerouslySetInnerHTML={{__html:text}} />
      {line.highlight === 'consent' && <span className="badge badge-green">✓ CONSENT</span>}
    </div>
  );
}

function ScoreRows() {
  const rows = [
    ['Liveness',94,'var(--green)'],
    ['Geo Trust',96,'var(--green)'],
    ['Transcript',89,'var(--green)'],
    ['AI Confidence',84,'var(--acc)'],
    ['Policy',100,'var(--green)'],
  ];
  return rows.map(([label,value,color]) => (
    <div className="score-row" key={label}>
      <label>{label}</label>
      <span className="score-track"><span style={{width:`${value}%`,background:color}} /></span>
      <span className="mono dim">{value}</span>
    </div>
  ));
}

export default function ApplicationReport() {
  const [emi, setEmi] = useState(36);
  const [policyOpen, setPolicyOpen] = useState(false);
  const amount = useCountUp(riskReport.offerAmount);

  return (
    <main className="page">
      <section className="card report-header page-section">
        <div>
          <div className="applicant-head">
            <div className="report-avatar">RS</div>
            <div>
              <h1 className="report-name">{riskReport.name}</h1>
              <p className="report-sub">{riskReport.city} · {riskReport.phone}</p>
              <p className="report-id">#{riskReport.id} · Completed {riskReport.completedAt}</p>
            </div>
          </div>
          <div className="quick-stats">
            {[
              ['741','CIBIL'],
              ['₹68K','Income'],
              ['32','Age'],
              ['94%','Liveness'],
              ['Match','Geo'],
            ].map(([value,label]) => <span className="quick-chip" key={label}><strong>{value}</strong><span>{label}</span></span>)}
          </div>
        </div>
        <div>
          <div className="band-large">A</div>
          <p className="persona">{riskReport.persona}</p>
          <div className="recommend"><Cpu size={12} />Kredox AI: Auto Approve</div>
          <div className="report-actions">
            <button className="btn btn-danger">Reject</button>
            <button className="btn btn-ghost">Manual Review</button>
            <button className="btn btn-primary" onClick={() => toast.success('Application approved')}>Approve</button>
          </div>
        </div>
      </section>

      <div className="report-grid">
        <div>
          <section className="card report-section page-section" style={{animationDelay:'.08s'}}>
            <div className="persona-badge">{riskReport.persona}</div>
            <ConfidenceRing />
            <p className="risk-summary">{riskReport.summary}</p>
            <div className="micro-label">Red Flags</div>
            {riskReport.redFlags.map((flag) => <span className="badge badge-amber" key={flag}><AlertTriangle size={10} />{flag}</span>)}
            <div className="micro-label">Signals</div>
            {riskReport.positiveSignals.map((signal) => <div className="signal-row" key={signal}><CheckCircle size={11} color="var(--green)" />{signal}</div>)}
          </section>

          <section className="card offer-card page-section" style={{animationDelay:'.16s'}}>
            <h2 className="section-title">Loan Offer</h2>
            <div className="offer-amount">{money(amount)}</div>
            <p className="muted">{riskReport.interestRate}% per annum · {riskReport.tenure} months</p>
            <div className="emi-row">
              {[[12,'₹74,820'],[24,'₹39,440'],[36,`₹${riskReport.emi.toLocaleString('en-IN')}`]].map(([months,value]) => (
                <button key={months} className={`emi-pill ${emi === months ? 'active' : ''}`} onClick={() => setEmi(months)}>
                  <strong>{months}mo</strong><br /><span className="mono">{value}</span>
                </button>
              ))}
            </div>
            <p className="dim">{money(riskReport.processingFee)} processing fee (1.0%)</p>
            <p className="explain">Based on verified employment, strong bureau profile, and clean consent capture, this offer is eligible for direct presentation to the customer.</p>
            <button className="btn btn-primary" style={{width:'100%',marginTop:12}}><Send size={13} />Send offer</button>
          </section>
        </div>

        <div>
          <section className="card report-section page-section" style={{animationDelay:'.24s'}}>
            <h2 className="section-title">Transcript</h2>
            <input className="inp" placeholder="Search transcript..." style={{margin:'12px 0'}} />
            <div className="report-transcript">
              {riskReport.transcript.map((line) => <TranscriptLine key={`${line.time}-${line.text}`} line={line} />)}
            </div>
            <button className="btn btn-ghost" style={{marginTop:8}}>Download transcript</button>
          </section>
          <section className="card report-section page-section" style={{marginTop:12,animationDelay:'.32s'}}>
            <h2 className="section-title">Verification Scores</h2>
            <ScoreRows />
          </section>
          <section className="card report-section page-section" style={{marginTop:12,animationDelay:'.4s'}}>
            <button className="btn btn-ghost policy-toggle" onClick={() => setPolicyOpen((value) => !value)}>
              <span className="badge badge-green">8/8 Rules Passed</span><ChevronDown size={14} />
            </button>
            {policyOpen && (
              <table className="tbl policy-table">
                <tbody>
                  {[
                    ['Min Age','21+','32'],
                    ['Bureau Score','650+','741'],
                    ['Income','₹15K+','₹68K'],
                    ['Consent','Required','Yes'],
                  ].map(([rule,req,actual]) => <tr key={rule}><td><CheckCircle size={13} color="var(--green)" /></td><td>{rule}</td><td className="dim">{req}</td><td>{actual}</td></tr>)}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div>
          <section className="card report-section page-section" style={{animationDelay:'.48s'}}>
            <h2 className="section-title">CV Analysis</h2>
            <div className="video-frame"><span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" /><span className="frame-label">Frame 14/18</span></div>
            <p className="mono">28–36 years</p>
            <p className="muted">Confidence 91% · Calm (88%)</p>
          </section>
          <section className="card report-section page-section" style={{marginTop:12,animationDelay:'.56s'}}>
            <h2 className="section-title">Geo Verification</h2>
            <div className="map-box"><span className="map-pin">Andheri East, Mumbai</span><span className="zone">Declared Zone</span><span className="badge badge-green" style={{position:'absolute',right:10,top:10}}>Match</span></div>
            <div className="geo-row"><MapPin size={13} /><span>GPS</span><strong>Mumbai, MH</strong></div>
            <div className="geo-row"><Wifi size={13} /><span>IP</span><strong>Jio Fiber</strong></div>
            <div className="geo-row"><FileCheck size={13} /><span>Declared</span><strong>Mumbai</strong></div>
          </section>
          <section className="card report-section page-section" style={{marginTop:12,animationDelay:'.64s'}}>
            <h2 className="section-title">Audit Timeline</h2>
            <div className="timeline">
              {riskReport.auditTimeline.map((event) => {
                const Icon = iconMap[event.icon] || CheckCircle;
                return <div className="event" key={`${event.time}-${event.event}`}><span className="event-dot" /><p><Icon size={11} /> {event.event}</p><time>{event.time}</time></div>;
              })}
            </div>
          </section>
        </div>
      </div>

      <footer className="sticky-footer">
        <div className="status-inline"><span>Reviewing: Rahul Sharma — KYC-2024-0847</span><span className="band band-A">A</span><span className="badge badge-green">Auto Approve</span></div>
        <div className="report-actions" style={{marginTop:0}}>
          <button className="btn btn-danger"><XCircle size={13} />Reject</button>
          <button className="btn btn-ghost">Manual Review</button>
          <button className="btn btn-primary" onClick={() => toast.success('Approved and queued')}>Approve</button>
        </div>
      </footer>
    </main>
  );
}
