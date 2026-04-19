import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart2, Mail, MessageCircle, Pause, Search, Send, Smartphone, Upload } from 'lucide-react';
import { campaigns, customerPreview } from '../data/mockData.js';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Drawer } from '../components/ui/Drawer.jsx';
import { Input } from '../components/ui/Input.jsx';

const expiryOptions = ['30min', '1hr', '2hr', '6hr', '12hr', '24hr'];
const channelIcons = { SMS: Smartphone, WhatsApp: MessageCircle, Email: Mail };

export function Campaigns() {
  const [channel, setChannel] = useState('WhatsApp');
  const [expiry, setExpiry] = useState('2hr');
  const [uploaded, setUploaded] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [progress, setProgress] = useState([]);

  const rows = useMemo(() => {
    return campaigns
      .filter((campaign) => campaign.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => sort.dir === 'asc' ? String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? '')) : String(b[sort.key] ?? '').localeCompare(String(a[sort.key] ?? '')));
  }, [search, sort]);

  const toggleSort = (key) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));

  const launch = () => {
    setProgress([]);
    ['Generating links...', 'Sending WhatsApp messages...', 'Campaign launched'].forEach((step, index) => {
      setTimeout(() => setProgress((current) => [...current, step]), index * 750);
    });
    setTimeout(() => toast.success('WhatsApp_Campaign_May launched to 450 customers'), 2300);
  };

  return (
    <div className="grid gap-5 p-5 xl:grid-cols-[0.55fr_1fr]">
      <Card>
        <h2 className="font-display text-xl font-bold">Create New Campaign</h2>
        <div className="mt-5 space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-text-muted">Step 1 - Upload Customers</h3>
            <button onClick={() => setUploaded(true)} className="w-full rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-8 text-center transition hover:bg-accent/10">
              <Upload className="mx-auto mb-3 h-10 w-10 text-accent" />
              <p className="font-bold">Drop CSV or click to browse</p>
              <p className="text-sm text-text-muted">Expected: Name, Phone, Email columns</p>
            </button>
            {uploaded && (
              <div className="mt-3 rounded-xl border border-border bg-bg-elevated p-3">
                <p className="mb-2 text-sm font-bold text-success">450 customers loaded</p>
                <table className="w-full text-xs"><tbody>{customerPreview.slice(0, 5).map((customer) => <tr key={customer.phone} className="border-t border-border"><td className="py-1">{customer.name}</td><td>{customer.phone}</td></tr>)}</tbody></table>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold text-text-muted">Step 2 - Channel</h3>
            <div className="grid grid-cols-3 gap-2">
              {['SMS', 'WhatsApp', 'Email'].map((item) => {
                const Icon = channelIcons[item];
                return (
                  <button key={item} onClick={() => setChannel(item)} className={`rounded-xl border p-3 font-bold transition ${channel === item ? 'border-accent bg-accent/10 shadow-glow' : 'border-border bg-bg-elevated'}`}>
                    <Icon className="mx-auto mb-2 h-5 w-5" />{item}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold text-text-muted">Step 3 - Link Settings</h3>
            <div className="mb-3 flex flex-wrap gap-2">{expiryOptions.map((option) => <button key={option} onClick={() => setExpiry(option)} className={`rounded-lg px-3 py-2 text-sm font-bold ${expiry === option ? 'bg-accent text-white' : 'bg-bg-elevated text-text-muted'}`}>{option}</button>)}</div>
            <textarea className="min-h-28 w-full rounded-xl border border-border bg-bg-elevated p-3 text-sm outline-none focus:border-accent" defaultValue={`Dear {name}, complete your loan verification with Kredox AI: {link}. Valid for ${expiry}.`} />
            <div className="text-right text-xs text-text-muted">96 characters</div>
          </section>

          <section className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="grid grid-cols-3 gap-2 text-sm"><span>Customers: <b>450</b></span><span>Channel: <b>{channel}</b></span><span>Expiry: <b>{expiry}</b></span></div>
            <p className="mt-2 text-sm text-text-muted">Est. cost: ₹270</p>
            <Button className="mt-4 w-full" onClick={launch}><Send className="h-4 w-4" /> Launch Campaign</Button>
            <div className="mt-3 space-y-1 text-sm text-success">{progress.map((step) => <p key={step}>Complete: {step}</p>)}</div>
          </section>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Active Campaigns</h2>
          <Input icon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns..." className="w-56" />
        </div>
        <div className="dark-scrollbar overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="text-left text-text-muted">
              <tr>{['Name', 'Channel', 'Sent', 'Opened', 'Completed', 'Conv%', 'Status', 'Date', 'Actions'].map((header) => <th key={header} className="cursor-pointer px-3 py-3" onClick={() => toggleSort(header.toLowerCase().replace('%', ''))}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const conv = Math.round((row.completed / row.sent) * 100);
                const Icon = channelIcons[row.channel];
                return (
                  <tr key={row.name} onClick={() => setDrawer(true)} className="table-row-hover border-t border-border">
                    <td className="px-3 py-4 font-bold">{row.name}</td>
                    <td className="px-3 py-4"><Icon className="mr-2 inline h-4 w-4 text-accent" />{row.channel}</td>
                    <td className="mono px-3 py-4">{row.sent}</td>
                    <td className="mono px-3 py-4">{row.opened}</td>
                    <td className="mono px-3 py-4">{row.completed}</td>
                    <td className="px-3 py-4"><div className="h-2 w-24 rounded-full bg-white/5"><div className="h-full rounded-full bg-accent" style={{ width: `${conv}%` }} /></div><span className="mono text-xs">{conv}%</span></td>
                    <td className="px-3 py-4"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${row.status === 'Active' ? 'bg-success' : 'bg-text-muted'}`} />{row.status}</td>
                    <td className="px-3 py-4 text-text-muted">{row.date}</td>
                    <td className="px-3 py-4"><Button variant="ghost" className="py-1"><BarChart2 className="h-4 w-4" /> Stats</Button> <Button variant="ghost" className="py-1"><Pause className="h-4 w-4" /> Pause</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Campaign: WhatsApp_Campaign_May">
        <table className="w-full text-xs">
          <thead className="text-left text-text-muted"><tr><th>Name</th><th>Phone</th><th>Link</th><th>Session</th><th>Band</th></tr></thead>
          <tbody>{customerPreview.map((customer) => <tr key={customer.phone} className="border-t border-border"><td className="py-2">{customer.name}</td><td>{customer.phone}</td><td>{customer.status}</td><td>{customer.session}</td><td>{customer.band}</td></tr>)}</tbody>
        </table>
      </Drawer>
    </div>
  );
}
