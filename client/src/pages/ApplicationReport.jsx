import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import {
  applicationAPI,
  cvAPI,
  geoAPI,
  llmAPI,
  offerAPI
} from '../api/index.js';
import { useCountUp } from '../hooks/useCountUp.js';

function bandClass(band) {
  return `band-badge band-${String(band || 'unknown').toLowerCase()}`;
}

function currency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(value) || 0
  );
}

function flattenFields(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && 'value' in item) {
      return [{ path, ...item }];
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return flattenFields(item, path);
    }
    return [{ path, value: item, source: 'api', confidence: 1, needs_review: false }];
  });
}

function ConfidenceField({ applicationId, field, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(field.value ?? '');
  const [reason, setReason] = useState('Customer clarified');
  const confidence = Math.round((Number(field.confidence) || 0) * 100);
  const tone = field.needs_review ? 'low' : confidence >= 85 ? 'high' : confidence >= 60 ? 'medium' : 'low';

  const save = async () => {
    try {
      await applicationAPI.updateField(applicationId, field.path, value, reason);
      toast.success('Field updated');
      setEditing(false);
      onUpdated?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update field');
    }
  };

  return (
    <article className={`field-card ${tone}`}>
      <div>
        <span>{field.path}</span>
        <strong>{editing ? <input value={value} onChange={(event) => setValue(event.target.value)} /> : String(field.value ?? '-')}</strong>
      </div>
      <small>{field.source || 'api'} · {confidence}%</small>
      {field.needs_review && <em>Review needed</em>}
      {editing ? (
        <div className="inline-actions">
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            <option>Typo correction</option>
            <option>Customer clarified</option>
            <option>Source conflict</option>
            <option>Other</option>
          </select>
          <button type="button" onClick={save}>Save</button>
        </div>
      ) : (
        <button type="button" className="text-button" onClick={() => setEditing(true)}>Edit</button>
      )}
    </article>
  );
}

export function ApplicationReport() {
  const { sessionId } = useParams();
  const [llm, setLlm] = useState(null);
  const [cv, setCv] = useState(null);
  const [geo, setGeo] = useState(null);
  const [application, setApplication] = useState(null);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const [llmData, cvData, appData, geoData] = await Promise.all([
        llmAPI.getAnalysis(sessionId),
        cvAPI.getSessionSummary(sessionId),
        applicationAPI.compile(sessionId),
        geoAPI.getReport(sessionId).catch(() => null)
      ]);

      const normalizedApplication = appData.application || appData.loan_application || appData;
      const applicationId = normalizedApplication.id;
      const offerData = applicationId ? await offerAPI.generate(sessionId, applicationId) : null;

      setLlm(llmData.analysis || llmData);
      setCv(cvData.summary || cvData);
      setGeo(geoData?.verification || geoData);
      setApplication(normalizedApplication);
      setOffer(offerData?.offer || offerData);
    } catch (err) {
      setError(err);
      toast.error(err.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  const offerAmount = useCountUp(offer?.amount);
  const fields = useMemo(() => flattenFields(application?.application_json || application?.fields || application), [application]);
  const reviewFields = fields.filter((field) => field.needs_review);

  const approveOffer = async () => {
    if (!offer?.id) return;
    try {
      setApproving(true);
      await offerAPI.accept(offer.id);
      setOffer((current) => ({ ...current, status: 'accepted' }));
      toast.success('Application approved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept offer');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <main className="page-shell">
        <div className="skeleton-page">
          <p>AI is analyzing the interview...</p>
          <div className="skeleton-block" />
          <div className="skeleton-block" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <Link to="/dashboard">Back to dashboard</Link>
        <p className="error-text">Report could not be loaded from the API.</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="page-header split">
        <div>
          <p className="eyebrow">Post-call decisioning</p>
          <h1>Application Report</h1>
        </div>
        <Link to="/dashboard">Dashboard</Link>
      </section>

      <section className="report-grid">
        <article className="panel">
          <div className="panel-title-row">
            <h2>Risk Assessment</h2>
            <span className={bandClass(llm?.risk_band)}>{llm?.risk_band || '-'}</span>
          </div>
          <h3>{llm?.persona || 'Persona pending'}</h3>
          <div className="confidence-ring">{llm?.confidence_score ?? 0}%</div>
          <p>{llm?.summary || 'No LLM summary returned yet.'}</p>
          <h4>Red Flags</h4>
          {(llm?.red_flags || []).length ? (
            <div className="badge-row">{llm.red_flags.map((flag) => <span className="danger-badge" key={flag}>{flag}</span>)}</div>
          ) : (
            <p className="empty-state">No red flags returned.</p>
          )}
          <h4>Positive Signals</h4>
          {(llm?.key_positive_signals || []).length ? (
            <ul>{llm.key_positive_signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
          ) : (
            <p className="empty-state">No positive signals returned.</p>
          )}
          <strong className="action-banner">{llm?.recommended_action || 'No recommendation'}</strong>
        </article>

        <article className="panel">
          <h2>Loan Offer</h2>
          {offer ? (
            <>
              <strong className="offer-amount">{currency(offerAmount)}</strong>
              <p>{offer.interest_rate}% per annum · {offer.tenure_months} months</p>
              <p>{offer.explanation || offer.explanation_text || 'Offer explanation pending.'}</p>
              <div className="emi-grid">
                {(offer.emi_options || []).map((emi) => (
                  <article className="mini-card" key={emi.tenure_months}>
                    <span>{emi.tenure_months} months</span>
                    <strong>{currency(emi.emi || emi.monthly_emi)}</strong>
                    <small>Total {currency(emi.total_payable)}</small>
                  </article>
                ))}
              </div>
              <button type="button" disabled={approving || offer.status === 'accepted'} onClick={approveOffer}>
                {offer.status === 'accepted' ? 'Offer Accepted' : approving ? 'Approving...' : 'Approve & Offer'}
              </button>
            </>
          ) : (
            <p className="empty-state">Offer API did not return an offer.</p>
          )}
        </article>

        <article className="panel">
          <h2>Computer Vision</h2>
          <p>Age estimate: <strong>{cv?.age_range || cv?.most_common_age_estimate || '-'}</strong></p>
          <p>Liveness: <strong>{cv?.average_liveness_score ?? cv?.liveness_score ?? 0}/100</strong></p>
          <p>Frames analyzed: <strong>{cv?.total_frames_analyzed ?? cv?.frame_count ?? 0}</strong></p>
        </article>

        <article className="panel">
          <h2>Geo Verification</h2>
          {geo ? (
            <>
              <p>Calling from: <strong>{geo.gps_city || geo.city || '-'}</strong></p>
              <p>Declared: <strong>{geo.declared_city || '-'}</strong></p>
              <p>Trust score: <strong>{geo.geo_score ?? '-'}</strong></p>
              <p>Status: <strong>{geo.match_status || '-'}</strong></p>
            </>
          ) : (
            <p className="empty-state">No geo verification report returned.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>Auto-filled Application</h2>
          <span>{reviewFields.length} fields need review</span>
        </div>
        {reviewFields.length > 0 && <p className="review-banner">Resolve highlighted fields before final submission.</p>}
        <div className="field-grid">
          {fields.length ? (
            fields.map((field) => (
              <ConfidenceField
                key={field.path}
                applicationId={application?.id}
                field={field}
                onUpdated={loadReport}
              />
            ))
          ) : (
            <p className="empty-state">No compiled application fields returned.</p>
          )}
        </div>
      </section>
    </main>
  );
}
