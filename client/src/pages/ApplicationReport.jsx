import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, ChevronDown, Cpu, FileCheck, MapPin, Send, Wifi, XCircle } from 'lucide-react';
import { applicationAPI, cvAPI, geoAPI, llmAPI, offerAPI } from '../api/index.js';
import { useCountUp } from '../hooks/useCountUp.js';

function money(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN')}`;
}

function valueAt(application, path) {
  return path.split('.').reduce((target, key) => target?.[key], application)?.value ?? null;
}

function ConfidenceRing({ score = 0 }) {
  const radius = 40;
  const dash = 251;
  const offset = dash * (1 - Number(score || 0) / 100);
  return (
    <div className="ring-wrap">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
        <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--acc)" strokeWidth="6" strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 44 44)" style={{ animation: 'ring-draw 1s ease forwards' }} />
        <text x="44" y="42" textAnchor="middle" className="ring-text">{Math.round(score)}%</text>
        <text x="44" y="58" textAnchor="middle" className="ring-label">Confidence</text>
      </svg>
    </div>
  );
}

function ScoreRows({ cv, geo, analysis }) {
  const rows = [
    ['Liveness', Math.round(cv?.average_liveness_score || 0), 'var(--green)'],
    ['Geo Trust', Math.round(geo?.geo_score || 0), 'var(--green)'],
    ['AI Confidence', Math.round(analysis?.confidence_score || 0), 'var(--acc)'],
    ['Policy', 0, 'var(--amber)']
  ];
  return rows.map(([label, value, color]) => (
    <div className="score-row" key={label}>
      <label>{label}</label>
      <span className="score-track"><span style={{ width: `${Math.min(value, 100)}%`, background: color }} /></span>
      <span className="mono dim">{value}</span>
    </div>
  ));
}

export default function ApplicationReport() {
  const { id } = useParams();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [selectedTenure, setSelectedTenure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [cv, setCv] = useState(null);
  const [geo, setGeo] = useState(null);
  const [application, setApplication] = useState(null);
  const [offer, setOffer] = useState(null);
  const amount = useCountUp(offer?.offer?.amount || offer?.amount || 0);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError('');
        const [analysisResult, cvResult, geoResult, applicationResult] = await Promise.allSettled([
          llmAPI.getAnalysis(id),
          cvAPI.getSessionSummary(id),
          geoAPI.getReport(id),
          applicationAPI.compile(id)
        ]);

        if (cancelled) return;

        const app = applicationResult.status === 'fulfilled' ? applicationResult.value : null;
        setAnalysis(analysisResult.status === 'fulfilled' ? analysisResult.value : null);
        setCv(cvResult.status === 'fulfilled' ? cvResult.value : null);
        setGeo(geoResult.status === 'fulfilled' ? geoResult.value : null);
        setApplication(app);

        const applicationId = app?.id || app?.application_id;
        if (applicationId) {
          try {
            setOffer(await offerAPI.generate(id, applicationId));
          } catch {
            setOffer(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Failed to load application report');
          toast.error('Failed to load application report');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReport();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const appJson = application?.application_json || {};
  const applicantName = valueAt(appJson, 'personal.full_name') || application?.customer_id || 'Applicant';
  const phone = valueAt(appJson, 'personal.phone') || '-';
  const city = geo?.declared_city || geo?.gps_city || '-';
  const band = analysis?.risk_band || offer?.offer?.band || offer?.band || '-';
  const redFlags = analysis?.red_flags || [];
  const positiveSignals = analysis?.key_positive_signals || [];
  const age = valueAt(appJson, 'personal.age');
  const income = valueAt(appJson, 'financial.monthly_income');
  const bureau = valueAt(appJson, 'financial.bureau_score');
  const cvAge = cv?.most_common_age_estimate;
  const offerData = offer?.offer || offer || {};
  const emiOptions = offer?.emi_options || offerData.emi_options || [];
  const activeTenure = selectedTenure || offerData.tenure_months || emiOptions[emiOptions.length - 1]?.tenure_months;

  const rejectApplication = () => toast.success('Application marked for rejection review');
  const manualReview = () => toast.success('Application moved to manual review queue');
  const approveApplication = async () => {
    if (offerData.id) {
      try {
        await offerAPI.accept(offerData.id);
        toast.success('Offer accepted and application approved');
        return;
      } catch (err) {
        toast.error(err.response?.data?.error || 'Approval API failed');
        return;
      }
    }
    toast.success('Approval action queued');
  };
  const sendOffer = () => toast.success('Offer send action queued');

  const policyRows = useMemo(() => [
    ['Session compiled', 'Required', application ? 'Yes' : 'No', Boolean(application)],
    ['AI analysis', 'Stored', analysis ? 'Yes' : 'No', Boolean(analysis)],
    ['CV summary', 'Available', cv ? 'Yes' : 'No', Boolean(cv)],
    ['Geo report', 'Available', geo ? 'Yes' : 'No', Boolean(geo)]
  ], [analysis, application, cv, geo]);

  if (loading) {
    return (
      <main className="page">
        <section className="card report-header skeleton" style={{ height: 160 }} />
        <div className="report-grid" style={{ marginTop: 16 }}>
          {[0, 1, 2].map((item) => <section className="card report-section skeleton" style={{ height: 360 }} key={item} />)}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <section className="card report-section">
          <h1 className="section-title">Report unavailable</h1>
          <p className="muted" style={{ marginTop: 8 }}>{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card report-header page-section">
        <div>
          <div className="applicant-head">
            <div className="report-avatar">{String(applicantName).slice(0, 2).toUpperCase()}</div>
            <div>
              <h1 className="report-name">{applicantName}</h1>
              <p className="report-sub">{city} - {phone}</p>
              <p className="report-id">#{id} - Backend report</p>
            </div>
          </div>
          <div className="quick-stats">
            {[
              [bureau || '-', 'CIBIL'],
              [income ? money(income) : '-', 'Income'],
              [age || '-', 'Age'],
              [`${Math.round(cv?.average_liveness_score || 0)}%`, 'Liveness'],
              [geo?.match_status || '-', 'Geo']
            ].map(([value, label]) => <span className="quick-chip" key={label}><strong>{value}</strong><span>{label}</span></span>)}
          </div>
        </div>
        <div>
          <div className={`band-large ${band !== '-' ? `band-${band}` : ''}`}>{band}</div>
          <p className="persona">{analysis?.persona || 'Awaiting AI persona'}</p>
          <div className="recommend"><Cpu size={12} />Kredox AI: {analysis?.recommended_action || 'Pending'}</div>
          <div className="report-actions">
            <button className="btn btn-danger" onClick={rejectApplication}>Reject</button>
            <button className="btn btn-ghost" onClick={manualReview}>Manual Review</button>
            <button className="btn btn-primary" onClick={approveApplication}>Approve</button>
          </div>
        </div>
      </section>

      <div className="report-grid">
        <div>
          <section className="card report-section page-section" style={{ animationDelay: '.08s' }}>
            <div className="persona-badge">{analysis?.persona || 'Risk analysis not generated yet'}</div>
            <ConfidenceRing score={analysis?.confidence_score || 0} />
            <p className="risk-summary">{analysis?.summary || 'No LLM analysis has been stored for this session yet.'}</p>
            <div className="micro-label">Red Flags</div>
            {redFlags.length ? redFlags.map((flag) => <span className="badge badge-amber" key={flag}><AlertTriangle size={10} />{flag}</span>) : <p className="muted">No red flags returned.</p>}
            <div className="micro-label">Signals</div>
            {positiveSignals.length ? positiveSignals.map((signal) => <div className="signal-row" key={signal}><CheckCircle size={11} color="var(--green)" />{signal}</div>) : <p className="muted">No positive signals returned.</p>}
          </section>

          <section className="card offer-card page-section" style={{ animationDelay: '.16s' }}>
            <h2 className="section-title">Loan Offer</h2>
            <div className="offer-amount">{money(amount)}</div>
            <p className="muted">{offerData.interest_rate || '-'}% per annum - {offerData.tenure_months || '-'} months</p>
            <div className="emi-row">
              {emiOptions.length ? emiOptions.map((option) => (
                <button key={option.tenure_months} className={`emi-pill ${option.tenure_months === activeTenure ? 'active' : ''}`} onClick={() => setSelectedTenure(option.tenure_months)}>
                  <strong>{option.tenure_months}mo</strong><br /><span className="mono">{money(option.emi)}</span>
                </button>
              )) : <p className="muted">Offer generation has not returned EMI options.</p>}
            </div>
            <p className="dim">{money(offerData.processing_fee)} processing fee</p>
            <p className="explain">{offerData.explanation_text || offer?.explanation || 'Offer explanation not generated yet.'}</p>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={sendOffer}><Send size={13} />Send offer</button>
          </section>
        </div>

        <div>
          <section className="card report-section page-section" style={{ animationDelay: '.24s' }}>
            <h2 className="section-title">Application Fields</h2>
            <div className="report-transcript" style={{ marginTop: 12 }}>
              {[
                ['Name', applicantName],
                ['Phone', phone],
                ['Income', income ? money(income) : '-'],
                ['Employment', valueAt(appJson, 'financial.employment_type') || '-'],
                ['Loan Purpose', valueAt(appJson, 'loan.purpose') || '-']
              ].map(([label, value]) => (
                <div className="report-line" key={label}>
                  <span className="speaker">{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card report-section page-section" style={{ marginTop: 12, animationDelay: '.32s' }}>
            <h2 className="section-title">Verification Scores</h2>
            <ScoreRows cv={cv} geo={geo} analysis={analysis} />
          </section>
          <section className="card report-section page-section" style={{ marginTop: 12, animationDelay: '.4s' }}>
            <button className="btn btn-ghost policy-toggle" onClick={() => setPolicyOpen((value) => !value)}>
              <span className="badge badge-green">{policyRows.filter((row) => row[3]).length}/{policyRows.length} Data Sources Ready</span><ChevronDown size={14} />
            </button>
            {policyOpen && (
              <table className="tbl policy-table">
                <tbody>
                  {policyRows.map(([rule, req, actual, ok]) => <tr key={rule}><td>{ok ? <CheckCircle size={13} color="var(--green)" /> : <AlertTriangle size={13} color="var(--amber)" />}</td><td>{rule}</td><td className="dim">{req}</td><td>{actual}</td></tr>)}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div>
          <section className="card report-section page-section" style={{ animationDelay: '.48s' }}>
            <h2 className="section-title">CV Analysis</h2>
            <div className="video-frame"><span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" /><span className="frame-label">{cv?.total_frames_analyzed || 0} frames</span></div>
            <p className="mono">{cvAge ? `${cvAge.low}-${cvAge.high} years` : 'No age estimate'}</p>
            <p className="muted">Average liveness {Math.round(cv?.average_liveness_score || 0)}%</p>
          </section>
          <section className="card report-section page-section" style={{ marginTop: 12, animationDelay: '.56s' }}>
            <h2 className="section-title">Geo Verification</h2>
            <div className="map-box"><span className="map-pin">{geo?.gps_city || 'GPS unavailable'}</span><span className="zone">{geo?.declared_city || 'Declared city unavailable'}</span><span className="badge badge-green" style={{ position: 'absolute', right: 10, top: 10 }}>{geo?.match_status || 'Pending'}</span></div>
            <div className="geo-row"><MapPin size={13} /><span>GPS</span><strong>{geo?.gps_city || '-'}</strong></div>
            <div className="geo-row"><Wifi size={13} /><span>IP</span><strong>{geo?.ip_city || '-'}</strong></div>
            <div className="geo-row"><FileCheck size={13} /><span>Declared</span><strong>{geo?.declared_city || '-'}</strong></div>
          </section>
          <section className="card report-section page-section" style={{ marginTop: 12, animationDelay: '.64s' }}>
            <h2 className="section-title">Review Notes</h2>
            <p className="muted">This page is populated from live backend endpoints. Missing sections mean the session pipeline has not produced that artifact yet.</p>
          </section>
        </div>
      </div>

      <footer className="sticky-footer">
        <div className="status-inline"><span>Reviewing: {applicantName} - {id}</span><span className={`band band-${band}`}>{band}</span><span className="badge badge-green">{analysis?.recommended_action || 'Pending'}</span></div>
        <div className="report-actions" style={{ marginTop: 0 }}>
          <button className="btn btn-danger" onClick={rejectApplication}><XCircle size={13} />Reject</button>
          <button className="btn btn-ghost" onClick={manualReview}>Manual Review</button>
          <button className="btn btn-primary" onClick={approveApplication}>Approve</button>
        </div>
      </footer>
    </main>
  );
}
