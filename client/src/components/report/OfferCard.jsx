import { useState } from 'react';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp.js';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';

export function OfferCard({ offer }) {
  const offerData = offer?.offer || offer || {};
  const options = offer?.emi_options || offerData.emi_options || [];
  const [selected, setSelected] = useState(offerData.tenure_months || options[0]?.tenure_months || 36);
  const amount = useCountUp(offerData.amount || 0);

  return (
    <Card className="border-t-2 border-t-success shadow-[0_0_30px_rgba(16,185,129,0.08)]">
      <h2 className="font-display text-lg font-bold">Personalized Offer - Band {offerData.band || '-'}</h2>
      <div className="mt-4 font-display text-5xl font-extrabold">INR {amount.toLocaleString('en-IN')}</div>
      <p className="mt-2 font-bold text-accent">{offerData.interest_rate || '-'}% per annum</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.tenure_months}
            onClick={() => setSelected(option.tenure_months)}
            className={`rounded-xl border p-3 text-left transition ${selected === option.tenure_months ? 'border-accent bg-accent/10 shadow-glow' : 'border-border bg-bg-elevated/50'}`}
          >
            <div className="font-display font-bold">{option.tenure_months} mo</div>
            <div className="mono mt-1 text-lg font-bold">INR {Number(option.emi || 0).toLocaleString('en-IN')}</div>
            <div className="text-xs text-text-muted">interest INR {Number(option.total_interest || 0).toLocaleString('en-IN')}</div>
          </button>
        ))}
        {!options.length && <p className="text-sm text-text-muted">Offer API has not returned EMI options yet.</p>}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-text-muted md:grid-cols-2">
        <p>Processing Fee: <span className="mono text-text-primary">INR {Number(offerData.processing_fee || 0).toLocaleString('en-IN')}</span></p>
        <p>Total Payable: <span className="mono text-text-primary">INR {Number(options.find((item) => item.tenure_months === selected)?.total_payable || 0).toLocaleString('en-IN')}</span></p>
      </div>
      <p className="mt-4 italic leading-relaxed text-text-muted">
        {offerData.explanation_text || offer?.explanation || 'Offer explanation has not been returned by the backend yet.'}
      </p>
      <Button className="mt-5 w-full" onClick={() => toast.success('Offer send action queued')}>
        <Send className="h-4 w-4" /> Send Offer to Customer via WhatsApp
      </Button>
    </Card>
  );
}
