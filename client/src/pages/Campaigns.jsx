import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Mail, MessageCircle, Send, Smartphone, UploadCloud } from 'lucide-react';
import { campaignAPI } from '../api/index.js';

const channelIcons = { sms: Smartphone, whatsapp: MessageCircle, email: Mail, SMS: Smartphone, WhatsApp: MessageCircle, Email: Mail };
const expiryMinutes = { '30m': 30, '1h': 60, '2h': 120, '6h': 360, '12h': 720, '24h': 1440 };
const defaultMessage = (expiry) => `Dear {name}, complete your loan verification with Kredox AI: {link}. Valid for ${expiry}.`;

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((item) => item.trim().toLowerCase());
  const value = (row, keys) => keys.map((key) => row[key]).find((item) => item !== undefined && item !== '') || '';
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    return {
      name: value(row, ['name', 'full_name', 'customer_name']) || 'Unknown',
      phone: value(row, ['phone', 'mobile', 'phone_number']),
      email: value(row, ['email', 'email_address']),
      declared_age: value(row, ['declared_age', 'age']),
      declared_monthly_income: value(row, ['declared_monthly_income', 'monthly_income', 'income', 'salary']),
      employment_type: value(row, ['employment_type', 'employment', 'job_type']),
      loan_purpose: value(row, ['loan_purpose', 'purpose']),
      city: value(row, ['city', 'declared_city']),
      declared_state: value(row, ['declared_state', 'state']),
      pincode: value(row, ['pincode', 'pin', 'postal_code']),
      bureau_score: value(row, ['bureau_score', 'cibil', 'cibil_score']),
      existing_loans: value(row, ['existing_loans', 'active_loans']),
      loan_amount_requested: value(row, ['loan_amount_requested', 'loan_amount', 'requested_amount'])
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
    delivered: Number(row.delivered || 0),
    status: row.status || 'active',
    created_at: row.created_at
  };
}

function deliveryIssueText(reason) {
  if (!reason) return '';
  if (reason === 'sendgrid_not_configured') {
    return 'Email provider is not configured on Render. Add SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.';
  }
  if (reason === 'missing_email') return 'CSV row is missing an email address.';
  if (reason.includes('authenticated sender')) {
    return 'SendGrid sender is not verified. Verify SENDGRID_FROM_EMAIL in SendGrid.';
  }
  return reason;
}

export default function Campaigns() {
  const [customers, setCustomers] = useState([]);
  const [fileName, setFileName] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [expiry, setExpiry] = useState('2h');
  const [messageTemplate, setMessageTemplate] = useState(defaultMessage('2h'));
  const [drawer, setDrawer] = useState(null);
  const [drawerLinks, setDrawerLinks] = useState([]);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');
  const [messagingStatus, setMessagingStatus] = useState(null);

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
    campaignAPI.messagingStatus()
      .then(setMessagingStatus)
      .catch(() => setMessagingStatus(null));
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

  const chooseExpiry = (nextExpiry) => {
    setExpiry(nextExpiry);
    setMessageTemplate(defaultMessage(nextExpiry));
  };

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

    const missingEmail = channel === 'email' && customers.some((customer) => !customer.email);
    const missingPhone = ['sms', 'whatsapp'].includes(channel) && customers.some((customer) => !customer.phone);
    if (missingEmail) {
      toast.error('Email campaign needs an email column for every customer');
      return;
    }
    if (missingPhone) {
      toast.error(`${channel.toUpperCase()} campaign needs a phone column for every customer`);
      return;
    }

    try {
      setLaunching(true);
      const result = await campaignAPI.create({
        lender_id: 'kredox-demo',
        customer_list: customers,
        channel,
        expiry_minutes: expiryMinutes[expiry],
        message_template: messageTemplate
      });
      const failed = (result.dispatch_results || []).filter((item) => item.status !== 'sent');
      if (failed.length) {
        const reason = failed[0]?.reason ? ` Reason: ${deliveryIssueText(failed[0].reason)}` : '';
        toast.error(`${failed.length} message not delivered.${reason} Use Copy Link from the drawer.`);
      } else {
        toast.success('Campaign launched and messages sent');
      }
      setCustomers([]);
      setFileName('');
      setMessageTemplate(defaultMessage(expiry));
      if (result.links?.length) {
        setDrawer(normalizeCampaign({ ...result.campaign, total_sent: result.total_sent, opened: 0, completed: 0, delivered: result.dispatch_results?.filter((item) => item.status === 'sent').length || 0 }));
        setDrawerLinks(result.links);
      }
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

  const copyLink = async (event, link) => {
    event.stopPropagation();
    if (!link.verification_url) {
      toast.error('Verification link is not available');
      return;
    }

    try {
      await navigator.clipboard.writeText(link.verification_url);
      toast.success('Verification link copied');
    } catch {
      window.prompt('Copy verification link', link.verification_url);
    }
  };

  const selectedChannelStatus = messagingStatus?.[channel];
  const isSelectedChannelMissing = selectedChannelStatus && !selectedChannelStatus.configured;

  return (
    <main className="page">
      <div className="campaign-grid">
        <section className="card campaign-card page-section">
          <h1 className="section-title">New Campaign</h1>
          {isSelectedChannelMissing && (
            <div className="config-warning">
              <strong>{channel.toUpperCase()} delivery is not configured.</strong>
              <span>Add {selectedChannelStatus.missing.join(' and ')} in Render Environment. Links will still be created for manual copy.</span>
            </div>
          )}

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
                  <button
                    key={name}
                    className={`channel-card ${channel === name ? 'active' : ''}`}
                    onClick={() => {
                      setChannel(name);
                      setMessageTemplate(defaultMessage(expiry));
                    }}
                  >
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
                {Object.keys(expiryMinutes).map((item) => <button key={item} className={`expiry-pill ${expiry === item ? 'active' : ''}`} onClick={() => chooseExpiry(item)}>{item}</button>)}
              </div>
            </div>
          </div>

          <div className="wizard-step">
            <span className="step-no">4</span>
            <div>
              <div className="label">Editable Message</div>
              <textarea
                className="inp"
                rows="4"
                value={messageTemplate}
                onChange={(event) => {
                  setMessageTemplate(event.target.value);
                }}
              />
              <div className="char-count">
                {messageTemplate.length}/320 - Auto-filled from expiry. Use {'{name}'} and {'{link}'}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginLeft: 8, padding: '4px 8px', fontSize: 11 }}
                  onClick={() => {
                    setMessageTemplate(defaultMessage(expiry));
                  }}
                >
                  Reset
                </button>
              </div>
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
              <thead><tr>{['Name', 'Channel', 'Links', 'Delivered', 'Opened', 'Opened %', 'Status', 'Actions'].map((head) => <th key={head} onClick={() => toggle(head.toLowerCase().replace('%', ''))}>{head}</th>)}</tr></thead>
              <tbody>
                {rows.map((row) => {
                  const Icon = channelIcons[row.channel] || Smartphone;
                  const openedPct = row.sent ? Math.round((row.opened / row.sent) * 100) : 0;
                  const completedPct = row.sent ? Math.round((row.completed / row.sent) * 100) : 0;
                  return (
                    <tr key={row.id} onClick={() => openDrawer(row)}>
                      <td className="mono">{row.name}</td>
                      <td><Icon size={13} /> {row.channel}</td>
                      <td className="mono">{row.sent}</td>
                      <td className="mono">{row.delivered}</td>
                      <td className="mono">{row.opened}</td>
                      <td>
                        <span className="conv-bar"><span style={{ width: `${openedPct}%` }} /></span>
                        <span className="mono">{openedPct}%</span>
                        <div className="campaign-submetric">{completedPct}% completed</div>
                      </td>
                      <td><span className={`badge ${row.status === 'active' ? 'badge-green' : 'badge-dim'}`}>{row.status}</span></td>
                      <td><button className="btn btn-ghost" type="button" onClick={(event) => showStats(event, row)}>Stats</button></td>
                    </tr>
                  );
                })}
                {!loading && !rows.length && <tr><td colSpan="8" className="muted">No campaigns returned by the backend yet.</td></tr>}
                {loading && <tr><td colSpan="8" className="muted">Loading campaigns...</td></tr>}
                {error && <tr><td colSpan="8" className="muted">{error}</td></tr>}
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
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Pending means the customer has not opened the verification link yet.</p>
        <div className="link-card-list">
          {drawerLinks.map((link) => (
            <article className="link-card" key={link.id}>
              <div>
                <strong>{link.name}</strong>
                <span className="mono dim">{link.email || link.phone || '-'}</span>
                {link.token_preview && <span className="link-token">{link.token_preview}</span>}
                {link.dispatch_reason && <span className="delivery-reason">Delivery issue: {deliveryIssueText(link.dispatch_reason)}</span>}
              </div>
              <div className="link-badges">
                <span className={`badge ${link.status === 'completed' ? 'badge-green' : link.status === 'opened' ? 'badge-blue' : link.status === 'expired' ? 'badge-red' : 'badge-dim'}`}>{link.status}</span>
                <span className={`badge ${link.dispatch_status === 'sent' ? 'badge-green' : link.dispatch_status === 'failed' || link.dispatch_status === 'skipped' ? 'badge-red' : 'badge-dim'}`}>{link.dispatch_status || 'pending'}</span>
              </div>
              <button className="btn btn-primary" type="button" onClick={(event) => copyLink(event, link)}>
                <Copy size={12} />Copy Link
              </button>
            </article>
          ))}
          {drawer && !drawerLinks.length && <p className="muted">No links returned for this campaign.</p>}
        </div>
      </aside>
    </main>
  );
}
