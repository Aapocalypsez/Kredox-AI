import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, MessageCircle, Send, Smartphone, UploadCloud } from 'lucide-react';
import { applications } from '../data/mockData.js';

const campaigns = [
  { name:'WA_May', channel:'WhatsApp', sent:450, opened:338, completed:214, status:'Active' },
  { name:'SMS_Apr', channel:'SMS', sent:820, opened:514, completed:301, status:'Active' },
  { name:'Em_May', channel:'Email', sent:620, opened:279, completed:142, status:'Completed' },
];

const channelIcons = { SMS: Smartphone, WhatsApp: MessageCircle, Email: Mail };

export default function Campaigns() {
  const [uploaded, setUploaded] = useState(false);
  const [channel, setChannel] = useState('WhatsApp');
  const [expiry, setExpiry] = useState('2h');
  const [drawer, setDrawer] = useState(false);
  const [sort, setSort] = useState({key:'name',dir:'asc'});
  const rows = useMemo(() => [...campaigns].sort((a,b) => sort.dir === 'asc' ? String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? '')) : String(b[sort.key] ?? '').localeCompare(String(a[sort.key] ?? ''))), [sort]);
  const toggle = (key) => setSort((current) => ({key,dir:current.key === key && current.dir === 'asc' ? 'desc' : 'asc'}));

  return (
    <main className="page">
      <div className="campaign-grid">
        <section className="card campaign-card page-section">
          <h1 className="section-title">New Campaign</h1>

          <div className="wizard-step">
            <span className="step-no">1</span>
            <div>
              <div className="label">Upload CSV</div>
              <button className="drop-zone" onClick={() => setUploaded(true)}>
                <div>
                  <UploadCloud size={24} />
                  <div>Upload CSV</div>
                  <small>Name, Phone, Email format</small>
                  {uploaded && <div className="badge badge-green" style={{marginTop:8}}>customers_may.csv · 450 loaded</div>}
                </div>
              </button>
            </div>
          </div>

          <div className="wizard-step">
            <span className="step-no">2</span>
            <div>
              <div className="label">Channel</div>
              <div className="channel-row">
                {[
                  ['SMS','₹0.30/msg',Smartphone],
                  ['WhatsApp','₹0.60/msg',MessageCircle],
                  ['Email','Free',Mail],
                ].map(([name,price,Icon]) => (
                  <button key={name} className={`channel-card ${channel === name ? 'active' : ''}`} onClick={() => setChannel(name)}>
                    <Icon size={15} /><br /><strong>{name}</strong><br /><small>{price}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="wizard-step">
            <span className="step-no">3</span>
            <div>
              <div className="label">Expiry</div>
              <div className="expiry-row">
                {['30m','1h','2h','6h','12h','24h'].map((item) => <button key={item} className={`expiry-pill ${expiry === item ? 'active' : ''}`} onClick={() => setExpiry(item)}>{item}</button>)}
              </div>
            </div>
          </div>

          <div className="wizard-step">
            <span className="step-no">4</span>
            <div>
              <div className="label">Message Preview</div>
              <textarea className="inp" rows="4" defaultValue={`Dear {name}, complete your loan verification with Kredox AI: {link}. Valid for ${expiry}.`} />
              <div className="char-count">96 characters</div>
            </div>
          </div>

          <div className="launch-summary">
            <div className="summary-row"><span>count</span><strong>450</strong></div>
            <div className="summary-row"><span>channel</span><strong>{channel}</strong></div>
            <div className="summary-row"><span>expiry</span><strong>{expiry}</strong></div>
            <div className="summary-row"><span>est. cost</span><strong>₹270</strong></div>
          </div>
          <button className="btn btn-primary" style={{width:'100%',marginTop:12}} onClick={() => toast.success('Campaign launched')}>
            Launch Campaign <Send size={13} />
          </button>
        </section>

        <section className="card page-section" style={{animationDelay:'.08s'}}>
          <div className="card-header">
            <h2 className="section-title">Campaigns</h2>
            <span className="badge badge-blue">Polling 30s</span>
          </div>
          <div className="table-scroll">
            <table className="tbl">
              <thead><tr>{['Name','Channel','Sent','Opened','Conv%','Status','Actions'].map((head) => <th key={head} onClick={() => toggle(head.toLowerCase().replace('%',''))}>{head}</th>)}</tr></thead>
              <tbody>
                {rows.map((row) => {
                  const Icon = channelIcons[row.channel];
                  const conv = Math.round(row.completed / row.sent * 100);
                  return (
                    <tr key={row.name} onClick={() => setDrawer(true)}>
                      <td className="mono">{row.name}</td>
                      <td><Icon size={13} /> {row.channel}</td>
                      <td className="mono">{row.sent}</td>
                      <td className="mono">{row.opened}</td>
                      <td><span className="conv-bar"><span style={{width:`${conv}%`}} /></span><span className="mono">{conv}%</span></td>
                      <td><span className={`badge ${row.status === 'Active' ? 'badge-green' : 'badge-dim'}`}>{row.status}</span></td>
                      <td><button className="btn btn-ghost">Stats</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className={`drawer ${drawer ? 'open' : ''}`}>
        <div className="card-header" style={{padding:'0 0 12px'}}>
          <h2 className="section-title">WA_May Links</h2>
          <button className="btn btn-ghost" onClick={() => setDrawer(false)}>Close</button>
        </div>
        <table className="tbl">
          <tbody>
            {applications.slice(0,5).map((app) => <tr key={app.id}><td>{app.name}</td><td className="mono dim">{app.phone}</td><td>{app.band ? <span className={`band band-${app.band}`}>{app.band}</span> : <span className="dim">—</span>}</td></tr>)}
          </tbody>
        </table>
      </aside>
    </main>
  );
}
