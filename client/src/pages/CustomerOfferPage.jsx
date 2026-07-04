import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle, ShieldCheck } from 'lucide-react';
import { offerAPI } from '../api/index.js';

function money(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function CustomerOfferPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offer, setOffer] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [terms, setTerms] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOffer() {
      try {
        setLoading(true);
        const data = await offerAPI.getPublic(token);
        if (cancelled) return;
        setOffer(data.offer);
        setCustomer(data.customer);
        setAccepted(data.offer?.status === 'accepted');
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'This offer link is invalid or expired.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOffer();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function acceptOffer() {
    if (!offer?.id) return;
    setAccepting(true);
    try {
      const updated = await offerAPI.accept(offer.id);
      setOffer(updated);
      setAccepted(true);
      toast.success('Offer accepted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not accept offer');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="customer-offer-page">
        <section className="card customer-offer-card skeleton" />
      </main>
    );
  }

  if (error || !offer) {
    return (
      <main className="customer-offer-page">
        <section className="card customer-offer-card">
          <h1>Offer unavailable</h1>
          <p className="muted">{error || 'No offer was found for this link.'}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="customer-offer-page">
      <section className="card customer-offer-card">
        <div className="customer-offer-brand">
          <strong>Kredox</strong><span>AI</span>
        </div>
        <div className="customer-offer-secure"><ShieldCheck size={14} /> Secure loan offer</div>

        {accepted ? (
          <div className="accepted-panel">
            <CheckCircle size={52} />
            <h1>Offer Accepted</h1>
            <p>Thank you, {customer?.name || 'Customer'}. Kredox AI has recorded your acceptance.</p>
            <button className="btn btn-ghost" style={{ marginTop: 16, width: '100%' }} onClick={() => window.print()}>
              Print & Save Receipt
            </button>
          </div>
        ) : (
          <>
            <p className="micro-label">Loan offer for</p>
            <h1>{customer?.name || 'Customer'}</h1>
            <div className="customer-offer-amount">{money(offer.amount)}</div>
            <div className="customer-offer-grid">
              <div><span>Interest</span><strong>{offer.interest_rate}%</strong></div>
              <div><span>Tenure</span><strong>{offer.tenure_months} months</strong></div>
              <div><span>EMI</span><strong>{money(offer.emi)}</strong></div>
              <div><span>Fee</span><strong>{money(offer.processing_fee)}</strong></div>
            </div>
            <p className="customer-offer-explain">{offer.explanation_text}</p>
            <label className="terms-check">
              <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
              I agree to the loan terms and processing fee.
            </label>
            <button className="btn btn-primary" type="button" disabled={!terms || accepting} onClick={acceptOffer}>
              {accepting ? 'Accepting...' : 'Accept Offer'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
