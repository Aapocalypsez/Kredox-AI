import { useState } from 'react';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import { riskReport } from '../../data/mockData.js';
import { useCountUp } from '../../hooks/useCountUp.js';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';

const options = [
  { tenure: 12, emi: 74820, interest: 47840 },
  { tenure: 24, emi: 39440, interest: 96620 },
  { tenure: 36, emi: 27680, interest: 156480 }
];

export function OfferCard() {
  const [selected, setSelected] = useState(36);
  const amount = useCountUp(riskReport.offerAmount);

  return (
    <Card className="border-t-2 border-t-success shadow-[0_0_30px_rgba(16,185,129,0.08)]">
      <h2 className="font-display text-lg font-bold">Personalized Offer - Band A</h2>
      <div className="mt-4 font-display text-5xl font-extrabold">₹ {amount.toLocaleString('en-IN')}</div>
      <p className="mt-2 font-bold text-accent">{riskReport.interestRate}% per annum</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.tenure}
            onClick={() => setSelected(option.tenure)}
            className={`rounded-xl border p-3 text-left transition ${selected === option.tenure ? 'border-accent bg-accent/10 shadow-glow' : 'border-border bg-bg-elevated/50'}`}
          >
            <div className="font-display font-bold">{option.tenure} mo</div>
            <div className="mono mt-1 text-lg font-bold">₹{option.emi.toLocaleString('en-IN')}</div>
            <div className="text-xs text-text-muted">interest ₹{option.interest.toLocaleString('en-IN')}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-text-muted md:grid-cols-2">
        <p>Processing Fee: <span className="mono text-text-primary">₹{riskReport.processingFee.toLocaleString('en-IN')} (1.0%)</span></p>
        <p>Total Payable: <span className="mono text-text-primary">₹{riskReport.totalPayable.toLocaleString('en-IN')}</span></p>
      </div>
      <p className="mt-4 italic leading-relaxed text-text-muted">
        Based on your strong credit profile and stable employment at TCS, we're pleased to offer you our premium loan tier with the lowest available rate.
      </p>
      <Button className="mt-5 w-full" onClick={() => toast.success('Offer sent to Rahul Sharma via WhatsApp')}>
        <Send className="h-4 w-4" /> Send Offer to Customer via WhatsApp
      </Button>
    </Card>
  );
}
