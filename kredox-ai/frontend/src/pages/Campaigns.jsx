import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, MessageCircle, Send, Smartphone, UploadCloud } from 'lucide-react';
import { campaignAPI } from '../api/index.js';

const channelIcons = { sms: Smartphone, whatsapp: MessageCircle, email: Mail, SMS: Smartphone, WhatsApp: MessageCircle, Email: Mail };
const expiryMinutes = { '30m': 30, '1h': 60, '2h': 120, '6h': 360, '12h': 720, '24h': 1440 };

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    return {
      name: row.name || row.full_name || row.customer_name || 'Unknown',
      phone: row.phone || row.mobile || '',
      email: row.email || ''
    };
  }).filter((customer) => customer.phone || customer.email);
}

function normalizeCampaign(row) {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    sent: Number(row.total_sent || 0),
    opened: Number(row.opened || 0),
    completed: Number(row.completed || 0),
    status: row.status || 'active',
    created_at: row.created_at
  };
}

export default function Campaigns() {
  const [customers, setCustomers] = useState([]);
  const [fileName, setFileName] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [expiry, setExpiry] = useState('2h');
  const [drawer, setDrawer] = useState(null);
  const [drawerLinks, setDrawerLinks] = useState([]);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  const loadCampaigns = async () => {
    try {
      setError('');
      const data = await campaignAPI.getAll();
      setCampaigns((data.campaigns || []).map(normalizeCampaign));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load campaigns');
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(loadCampaigns, 30000);
    return () => clearInterval(interval);
  }, []);

  const rows = useMemo(() => {
    return [...campaigns].sort((a, b) =>
      sort.dir === 'asc'
        ? String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''))
        : String(b[sort.key] ?? '').localeCompare(String(a[sort.key] ?? ''))
    );
  }, [campaigns, sort]);

  const toggle = (key) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    setCustomers(parsed);
    setFileName(file.name);
    toast.success(`${parsed.length} customers loaded`);
  };

  const launchCampaign = async () => {
    if (!customers.length) {
      toast.error('Upload a CSV with customers first');
      return;
    }

    try {
      setLaunching(true);
      await campaignAPI.create({
        lender_id: 'kredox-demo',
        customer_list: customers,
        channel,
        expiry_minutes: expiryMinutes[expiry]
      });
      toast.success('Campaign launched');
      setCustomers([]);
      setFileName('');
      await loadCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Campaign launch failed');
    } finally {
      setLaunching(false);
    }
  };

  const openDrawer = async (row) => {
    setDrawer(row);
    setDrawerLinks([]);
    try {
      const data = await campaignAPI.getLinks(row.id);
      setDrawerLinks(data.links || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load campaign links');
    }
  };

  const showStats = async (event, row) => {
    event.stopPropagation();
    try {
      const stats = await campaignAPI.getStats(row.id);
      const total = stats.total_sent ?? row.sent;
      const opened = stats.opened ?? row.opened;
      const completed = stats.completed ?? row.completed;
      toast.success(`${row.name}: ${opened}/${total} opened, ${completed} completed`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load campaign stats');
    }
  };

  return (
    <main className="page">
      <div className="campaign-grid">
        <section className="card campaign-card page-section">
          <h1 className="section-title">New Campaign</h1>

          <div className="wizard-step">
            <span className="step-no">1</span>
            <div>
              <div className="label">Upload CSV</div>
              <label className="drop-zone">
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFile} />
                <div>
                  <UploadCloud size={24} />
                  <div>Upload CSV</div>
                  <small>Name, Phone, Email format</small>
                  {customers.length > 0 && <div className="badge badge-green" style={{ marginTop: 8 }}>{fileName} - {customers.length} loaded</div>}
                </div>
              </label>
            </div>
          </div>

          <div className="wizard-step">
            <span className="step-no">2</span>
            <div>
              <div className="label">Channel</div>
              <div className="channel-row">
                {[
                  ['sms', 'INR 0.30/msg', Smartphone],
                  ['whatsapp', 'INR 0.60/msg', MessageCircle],
                  ['email', 'Free', Mail]
                ].map(([name, price, Icon]) => (
                  <button key={name} className={`channel-card ${channel === name ? 'active' : ''}`} onClick={() => setChannel(name)}>
                    <Icon size={15} /><br /><strong>{name.toUpperCase()}</strong><br /><small>{price}</small>
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
                {Object.keys(expiryMinutes).map((item) => <button key={item} className={`expiry-pill ${expiry === item ? 'active' : ''}`} onClick={() => setExpiry(item)}>{item}</button>)}
              </div>
            </div>
          </div>

          <div className="wizard-step">
            <span className="step-no">4</span>
            <div>
              <div className="label">Message Preview</div>
              <textarea className="inp" rows="4" readOnly value={`Dear {name}, complete your loan verification with Kredox AI: {link}. Valid for ${expiry}.`} />
              <div className="char-count">Backend sends final channel message</div>
            </div>
          </div>

          <div className="launch-summary">
            <div className="summary-row"><span>count</span><strong>{customers.length}</strong></div>
            <div className="summary-row"><span>channel</span><strong>{channel}</strong></div>
            <div className="summary-row"><span>expiry</span><strong>{expiry}</strong></div>
            <div className="summary-row"><span>est. cost</span><strong>{channel === 'email' ? 'INR 0' : `INR ${Math.round(customers.length * (channel === 'sms' ? 0.3 : 0.6))}`}</strong></div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={launchCampaign} disabled={launching}>
            {launching ? 'Launching...' : 'Launch Campaign'} <Send size={13} />
          </button>
        </section>

        <section className="card page-section" style={{ animationDelay: '.08s' }}>
          <div className="card-header">
            <h2 className="section-title">Campaigns</h2>
            <span className="badge badge-blue">Polling 30s</span>
          </div>
          <div className="table-scroll">
            <table className="tbl">
              <thead><tr>{['Name', 'Channel', 'Sent', 'Opened', 'Conv%', 'Status', 'Actions'].map((head) => <th key={head} onClick={() => toggle(head.toLowerCase().replace('%', ''))}>{head}</th>)}</tr></thead>
              <tbody>
                {rows.map((row) => {
                  const Icon = channelIcons[row.channel] || Smartphone;
                  const conv = row.sent ? Math.round((row.completed / row.sent) * 100) : 0;
                  return (
                    <tr key={row.id} onClick={() => openDrawer(row)}>
                      <td className="mono">{row.name}</td>
                      <td><Icon size={13} /> {row.channel}</td>
                      <td className="mono">{row.sent}</td>
                      <td className="mono">{row.opened}</td>
                      <td><span className="conv-bar"><span style={{ width: `${conv}%` }} /></span><span className="mono">{conv}%</span></td>
                      <td><span className={`badge ${row.status === 'active' ? 'badge-green' : 'badge-dim'}`}>{row.status}</span></td>
                      <td><button className="btn btn-ghost" type="button" onClick={(event) => showStats(event, row)}>Stats</button></td>
                    </tr>
                  );
                })}
                {!loading && !rows.length && <tr><td colSpan="7" className="muted">No campaigns returned by the backend yet.</td></tr>}
                {loading && <tr><td colSpan="7" className="muted">Loading campaigns...</td></tr>}
                {error && <tr><td colSpan="7" className="muted">{error}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className={`drawer ${drawer ? 'open' : ''}`}>
        <div className="card-header" style={{ padding: '0 0 12px' }}>
          <h2 className="section-title">{drawer?.name || 'Campaign'} Links</h2>
          <button className="btn btn-ghost" onClick={() => setDrawer(null)}>Close</button>
        </div>
        <table className="tbl">
          <tbody>
            {drawerLinks.map((link) => (
              <tr key={link.id}>
                <td>{link.name}</td>
                <td className="mono dim">{link.phone || link.email || '-'}</td>
                <td><span className="badge badge-dim">{link.status}</span></td>
              </tr>
            ))}
            {drawer && !drawerLinks.length && <tr><td colSpan="3" className="muted">No links returned for this campaign.</td></tr>}
          </tbody>
        </table>
      </aside>
    </main>
  );
}
