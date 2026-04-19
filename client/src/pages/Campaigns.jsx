import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { campaignAPI } from '../api/index.js';

function normalizeCampaigns(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.campaigns || payload?.data || [];
}

function normalizeRows(rows) {
  return rows
    .map((row) => ({
      name: row.name || row.Name || '',
      phone: row.phone || row.Phone || '',
      email: row.email || row.Email || ''
    }))
    .filter((row) => row.name && (row.phone || row.email));
}

export function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({});
  const [customers, setCustomers] = useState([]);
  const [channel, setChannel] = useState('sms');
  const [expiry, setExpiry] = useState(30);
  const [lenderId, setLenderId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadCampaigns = async (showToast = false) => {
    try {
      const data = await campaignAPI.getAll();
      const list = normalizeCampaigns(data);
      setCampaigns(list);
      const statEntries = await Promise.all(
        list.map((campaign) =>
          campaignAPI
            .getStats(campaign.id)
            .then((campaignStats) => [campaign.id, campaignStats])
            .catch(() => [campaign.id, null])
        )
      );
      setStats(Object.fromEntries(statEntries));
    } catch (error) {
      if (showToast) toast.error(error.response?.data?.error || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns(true);
    const interval = setInterval(() => loadCampaigns(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCsv = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = normalizeRows(result.data);
        setCustomers(parsed);
        toast.success(`${parsed.length} customers parsed`);
      },
      error: () => toast.error('Failed to parse CSV')
    });
  };

  const launch = async (event) => {
    event.preventDefault();
    if (!customers.length) {
      toast.error('Upload a CSV before launch');
      return;
    }
    try {
      setLaunching(true);
      setProgress(20);
      await campaignAPI.create({
        lender_id: lenderId,
        name,
        customer_list: customers,
        channel,
        expiry_minutes: Number(expiry)
      });
      setProgress(100);
      toast.success('Campaign launched');
      setCustomers([]);
      await loadCampaigns(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to launch campaign');
    } finally {
      setLaunching(false);
      setTimeout(() => setProgress(0), 1200);
    }
  };

  return (
    <main className="page-shell">
      <section className="page-header split">
        <div>
          <p className="eyebrow">Campaign links</p>
          <h1>Campaigns</h1>
        </div>
        <Link to="/dashboard">Dashboard</Link>
      </section>

      <section className="campaign-layout">
        <form className="panel campaign-form" onSubmit={launch}>
          <h2>Create Campaign</h2>
          <label>
            Campaign name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="April verification batch" />
          </label>
          <label>
            Lender ID
            <input required value={lenderId} onChange={(event) => setLenderId(event.target.value)} />
          </label>
          <label>
            Upload CSV
            <input type="file" accept=".csv" onChange={handleCsv} />
          </label>
          <div className="toggle-row">
            {['sms', 'whatsapp', 'email'].map((option) => (
              <button
                type="button"
                className={channel === option ? 'active' : ''}
                key={option}
                onClick={() => setChannel(option)}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <label>
            Expiry: {expiry} minutes
            <input
              type="range"
              min="30"
              max="1440"
              step="30"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
            />
          </label>
          {progress > 0 && <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>}
          <button type="submit" disabled={launching}>
            {launching ? 'Launching...' : 'Confirm & Launch'}
          </button>
        </form>

        <article className="panel">
          <h2>CSV Preview</h2>
          {customers.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Phone</th><th>Email</th></tr>
                </thead>
                <tbody>
                  {customers.slice(0, 8).map((customer) => (
                    <tr key={`${customer.email}-${customer.phone}`}>
                      <td>{customer.name}</td>
                      <td>{customer.phone}</td>
                      <td>{customer.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">Upload a CSV to preview customers.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Campaign List</h2>
        {loading ? (
          <div className="skeleton-block" />
        ) : campaigns.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Channel</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Completed</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const campaignStats = stats[campaign.id] || campaign.stats || {};
                  return (
                    <tr key={campaign.id}>
                      <td>{campaign.name || campaign.id}</td>
                      <td>{campaign.channel}</td>
                      <td>{campaignStats.total_sent ?? '-'}</td>
                      <td>{campaignStats.opened ?? '-'}</td>
                      <td>{campaignStats.completed ?? '-'}</td>
                      <td>{campaign.expires_at ? new Date(campaign.expires_at).toLocaleString() : '-'}</td>
                      <td>{campaign.status || Number(campaignStats.pending) > 0 ? 'Active' : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No campaigns returned by the API.</p>
        )}
      </section>
    </main>
  );
}
