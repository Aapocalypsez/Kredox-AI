import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, MessageCircle, Send, Smartphone, Upload } from 'lucide-react';
import AppShell from '../components/AppShell.jsx';
import { campaigns, customerPreview } from '../data/mockData.js';

const channelIcon = { SMS: Smartphone, WhatsApp: MessageCircle, Email: Mail };

export default function Campaigns() {
  const [channel, setChannel] = useState('WhatsApp');
  const [expiry, setExpiry] = useState('2hr');
  const [uploaded, setUploaded] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [steps, setSteps] = useState([]);
  const rows = useMemo(() => campaigns.filter((campaign) => campaign.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort.dir === 'asc' ? String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? '')) : String(b[sort.key] ?? '').localeCompare(String(a[sort.key] ?? ''))), [query, sort]);
  const toggleSort = (key) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));

  const launch = () => {
    setSteps([]);
    ['Generating secure JWT links', 'Sending channel messages', 'Campaign launched'].forEach((step, index) => {
      setTimeout(() => setSteps((current) => [...current, step]), index * 650);
    });
    setTimeout(() => toast.success('Campaign launched to 450 customers'), 2100);
  };

  return (
    <AppShell title="Campaigns" subtitle="Secure campaign link generation and delivery">
      <div className="grid campaign-grid">
        <section className="card glow">
          <h2>Create New Campaign</h2>
          <div className="grid" style={{ marginTop: 18 }}>
            <div>
              <p className="muted">Step 1 - Upload Customers</p>
              <button className="btn ghost" style={{ width: '100%', minHeight: 140, marginTop: 10 }} onClick={() => setUploaded(true)}>
                <Upload size={28} /> Drop CSV or click to browse
              </button>
              {uploaded && <p className="trend">450 customers loaded. Preview ready.</p>}
            </div>

            <div>
              <p className="muted">Step 2 - Channel</p>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 10 }}>
                {['SMS', 'WhatsApp', 'Email'].map((item) => {
                  const Icon = channelIcon[item];
                  return (
                    <button key={item} className={`btn ${channel === item ? '' : 'ghost'}`} onClick={() => setChannel(item)}>
                      <Icon size={16} /> {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="muted">Step 3 - Link Expiry</p>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 10 }}>
                {['30min', '1hr', '2hr', '6hr', '12hr', '24hr'].map((option) => <button key={option} className={`btn ${expiry === option ? '' : 'ghost'}`} onClick={() => setExpiry(option)}>{option}</button>)}
              </div>
            </div>

            <textarea className="search" style={{ width: '100%', minHeight: 112, paddingTop: 12 }} defaultValue={`Dear {name}, complete your loan verification with Kredox AI: {link}. Valid for ${expiry}.`} />
            <div className="card" style={{ background: 'var(--bg-base)' }}>
              <p>Customers: <strong>450</strong> · Channel: <strong>{channel}</strong> · Expiry: <strong>{expiry}</strong></p>
              <p className="muted">Estimated cost: ₹270</p>
              <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={launch}><Send size={16} /> Launch Campaign</button>
              <div className="grid" style={{ marginTop: 14 }}>
                {steps.map((step) => <span key={step} className="badge success">Complete: {step}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="topbar" style={{ minHeight: 'auto', marginBottom: 16 }}>
            <div>
              <h2>Active Campaigns</h2>
              <p className="muted">Polling stats every 30 seconds in production mode.</p>
            </div>
            <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns..." />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{['Name', 'Channel', 'Sent', 'Opened', 'Completed', 'Conv', 'Status', 'Date'].map((header) => <th key={header} onClick={() => toggleSort(header.toLowerCase())}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const Icon = channelIcon[row.channel];
                  const conv = Math.round((row.completed / row.sent) * 100);
                  return (
                    <tr key={row.name}>
                      <td><strong>{row.name}</strong></td>
                      <td><Icon size={15} /> {row.channel}</td>
                      <td className="mono">{row.sent}</td>
                      <td className="mono">{row.opened}</td>
                      <td className="mono">{row.completed}</td>
                      <td><div className="progress" style={{ '--value': `${conv}%` }}><span /></div><span className="mono muted">{conv}%</span></td>
                      <td><span className={`badge ${row.status === 'Active' ? 'success' : 'pending'}`}>{row.status}</span></td>
                      <td className="muted">{row.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ marginTop: 18, background: 'var(--bg-base)' }}>
            <h3>Per-customer Preview</h3>
            <div className="grid" style={{ marginTop: 12 }}>
              {customerPreview.map((customer) => <p key={customer.phone} className="muted"><strong style={{ color: 'var(--text-primary)' }}>{customer.name}</strong> · {customer.phone} · {customer.status} · Band {customer.band}</p>)}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
