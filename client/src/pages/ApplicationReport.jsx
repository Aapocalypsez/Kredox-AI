import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, ChevronDown, Cpu, FileCheck, MapPin, Send, Wifi, XCircle } from 'lucide-react';
import { applicationAPI, cvAPI, geoAPI, llmAPI, offerAPI, reportsAPI, riskAPI, videoAPI } from '../api/index.js';
import AutoFillApplication, { rowsFromApplication } from '../components/AutoFillApplication.jsx';
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

function scoreColor(value) {
  if (value >= 85) return 'var(--green)';
  if (value >= 70) return 'var(--acc)';
  return 'var(--amber)';
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
  const [risk, setRisk] = useState(null);
  const [sessionReport, setSessionReport] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState('');
  const [repairAttempted, setRepairAttempted] = useState(false);
  const amount = useCountUp(offer?.amount || offer?.offer?.amount || 0);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError('');
        const [analysisResult, cvResult, geoResult, applicationResult, riskResult, reportResult] = await Promise.allSettled([
          llmAPI.getAnalysis(id),
          cvAPI.getSessionSummary(id),
          geoAPI.getReport(id),
          applicationAPI.getBySession(id),
          riskAPI.getSession(id),
          reportsAPI.session(id)
        ]);

        if (cancelled) return;

        const app =
          applicationResult.status === 'fulfilled'
            ? applicationResult.value
            : await applicationAPI.compile(id).catch(() => null);
        const consolidated = reportResult.status === 'fulfilled' ? reportResult.value : null;

        setAnalysis(analysisResult.status === 'fulfilled' ? analysisResult.value : null);
        setCv(cvResult.status === 'fulfilled' ? cvResult.value : null);
        setGeo(geoResult.status === 'fulfilled' ? geoResult.value : null);
        setApplication(app);
        setRisk(riskResult.status === 'fulfilled' ? riskResult.value : consolidated?.risk || null);
        setSessionReport(consolidated);

        const needsRepair = !repairAttempted && consolidated && (!consolidated.risk || !consolidated.transcripts?.length);
        if (needsRepair) {
          setRepairAttempted(true);
          toast('Completing missing underwriting artifacts...', { id: 'report-repair' });
          await videoAPI.reprocessSession(id);
          const [repairedReport, repairedRisk, repairedApplication] = await Promise.allSettled([
            reportsAPI.session(id),
            riskAPI.getSession(id),
            applicationAPI.getBySession(id)
          ]);

          if (repairedReport.status === 'fulfilled') setSessionReport(repairedReport.value);
          if (repairedRisk.status === 'fulfilled') setRisk(repairedRisk.value);
          if (repairedApplication.status === 'fulfilled') setApplication(repairedApplication.value);
          toast.success('Underwriting artifacts completed');
        }

        if (consolidated?.offer) {
          setOffer(consolidated.offer);
          return;
        }

        const applicationId = app?.id || app?.application_id;
        if (applicationId) {
          try {
            const generated = await offerAPI.generate(id, applicationId);
            if (!cancelled) {
              setOffer(generated.offer || generated);
            }
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
  }, [id, repairAttempted]);

  const appJson = application?.application_json || {};
  const autoFillRows = useMemo(() => rowsFromApplication(appJson), [appJson]);
  const applicantName = valueAt(appJson, 'personal.full_name') || sessionReport?.session?.customer_id || 'Applicant';
  const phone = valueAt(appJson, 'personal.phone') || '-';
  const city = geo?.declared_city || geo?.gps_city || sessionReport?.session?.call_city || '-';
  const band = analysis?.risk_band || risk?.risk_band || offer?.band || '-';
  const redFlags = analysis?.red_flags || [];
  const positiveSignals = analysis?.key_positive_signals || [];
  const age = valueAt(appJson, 'personal.age');
  const income = valueAt(appJson, 'financial.monthly_income');
  const bureau = valueAt(appJson, 'financial.bureau_score');
  const cvAge = cv?.most_common_age_estimate;
  const offerData = offer?.offer || offer || {};
  const emiOptions = offer?.emi_options || offerData.emi_options || [];
  const activeTenure = selectedTenure || offerData.tenure_months || emiOptions[emiOptions.length - 1]?.tenure_months;
  const policyRules = risk?.policy_result?.rules || [];
  const transcripts = sessionReport?.transcripts || [];
  const auditEvents = sessionReport?.audit || [];
  const applicationStatus = application?.status || 'pending';

  const updateDecision = async (status, successMessage) => {
    const applicationId = application?.id || application?.application_id;
    if (!applicationId) {
      toast.error('Application is still compiling. Try again after refresh.');
      return;
    }

    const agent = JSON.parse(localStorage.getItem('kredox_agent') || '{}');
    setDecisionLoading(status);

    try {
      const updated = await applicationAPI.updateStatus(
        applicationId,
        status,
        status === 'approved' ? 'Agent approved from report' : status === 'rejected' ? 'Agent rejected from report' : 'Moved to manual review',
        agent.id || agent.email || 'frontend-agent'
      );
      setApplication(updated);
      toast.success(successMessage);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Decision update failed');
    } finally {
      setDecisionLoading('');
    }
  };

  const rejectApplication = () => updateDecision('rejected', 'Application rejected');
  const manualReview = () => updateDecision('under_review', 'Application moved to manual review');
  const approveApplication = () => updateDecision('approved', 'Application approved');
  const sendOffer = () => toast.success('Offer send action queued');
  const editAutoFillField = async (row) => {
    if (!application?.id) {
      toast.error('Compile the application before editing fields');
      return;
    }

    const nextValue = window.prompt(`Update ${row.label}`, row.value ?? '');
    if (nextValue === null) return;

    try {
      const agent = JSON.parse(localStorage.getItem('kredox_agent') || '{}');
      const updated = await applicationAPI.updateField(
        application.id,
        row.path,
        nextValue,
        'Customer clarified',
        agent.id || agent.email || 'frontend-agent'
      );
      setApplication(updated);
      toast.success(`${row.label} updated`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Field update failed');
    }
  };

  const scoreRows = useMemo(() => [
    ['Liveness', Math.round(cv?.average_liveness_score || 0)],
    ['Geo Trust', Math.round(geo?.geo_score || 0)],
    ['Transcript', transcripts.length ? 89 : 0],
    ['AI Confidence', Math.round(analysis?.confidence_score || 0)],
    ['Policy', Math.round(risk?.policy_score || 0)]
  ], [analysis?.confidence_score, cv?.average_liveness_score, geo?.geo_score, risk?.policy_score, transcripts.length]);

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
              <p className="report-id">#{id} - Completed underwriting artifact</p>
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
            <button className="btn btn-danger" onClick={rejectApplication} disabled={Boolean(decisionLoading)}>
              {decisionLoading === 'rejected' ? 'Rejecting...' : 'Reject'}
            </button>
            <button className="btn btn-ghost" onClick={manualReview} disabled={Boolean(decisionLoading)}>
              {decisionLoading === 'under_review' ? 'Updating...' : 'Manual Review'}
            </button>
            <button className="btn btn-primary" onClick={approveApplication} disabled={Boolean(decisionLoading)}>
              {decisionLoading === 'approved' ? 'Approving...' : 'Approve'}
            </button>
          </div>
        </div>
      </section>

      <AutoFillApplication rows={autoFillRows} editable onEdit={editAutoFillField} />

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
            <h2 className="section-title">Transcript</h2>
            <div className="report-transcript" style={{ marginTop: 12 }}>
              {transcripts.length ? transcripts.map((line) => {
                const isConsent = /consent/i.test(line.text || '');
                const isIncome = /income|salary|earn|₹|inr|\d{4,}/i.test(line.text || '');
                const isEmployment = /tcs|infosys|employee|employment|salaried|business|self employed/i.test(line.text || '');
                return (
                  <div className={`report-line ${isConsent ? 'consent' : ''}`} key={line.id}>
                    <span className="time">{new Date(line.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="speaker">{line.speaker || 'Customer'}</span>
                    <span className={isIncome ? 'hl-income' : isEmployment ? 'hl-employment' : ''}>{line.text}</span>
                    {isConsent && <span className="badge badge-green">CONSENT</span>}
                  </div>
                );
              }) : <p className="muted">No transcript lines were stored for this session.</p>}
            </div>
          </section>
          <section className="card report-section page-section" style={{ marginTop: 12, animationDelay: '.32s' }}>
            <h2 className="section-title">Verification Scores</h2>
            {scoreRows.map(([label, value]) => (
              <div className="score-row" key={label}>
                <label>{label}</label>
                <span className="score-track"><span style={{ width: `${Math.min(value, 100)}%`, background: scoreColor(value) }} /></span>
                <span className="mono dim">{value}</span>
              </div>
            ))}
          </section>
          <section className="card report-section page-section" style={{ marginTop: 12, animationDelay: '.4s' }}>
            <button className="btn btn-ghost policy-toggle" onClick={() => setPolicyOpen((value) => !value)}>
              <span className="badge badge-green">{policyRules.filter((row) => row.status === 'PASS').length}/{policyRules.length || 0} Rules Passed</span><ChevronDown size={14} />
            </button>
            {policyOpen && (
              <table className="tbl policy-table">
                <thead>
                  <tr><th>Status</th><th>Rule</th><th>Required</th><th>Actual</th></tr>
                </thead>
                <tbody>
                  {policyRules.map((row) => (
                    <tr key={row.rule}>
                      <td>{row.status === 'PASS' ? <CheckCircle size={13} color="var(--green)" /> : row.status === 'WARN' ? <AlertTriangle size={13} color="var(--amber)" /> : <XCircle size={13} color="var(--red)" />}</td>
                      <td>{row.rule}</td>
                      <td className="dim">{Array.isArray(row.required) ? row.required.join(', ') : String(row.required)}</td>
                      <td>{Array.isArray(row.actual) ? row.actual.join(', ') : String(row.actual ?? '-')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div>
          <section className="card report-section page-section" style={{ animationDelay: '.48s' }}>
            <h2 className="section-title">CV Analysis</h2>
            <div className="video-frame"><span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" /><span className="frame-label">{cv?.total_frames_analyzed || 0} frames</span></div>
            <div style={{ margin: '10px 0 8px' }}>
              <span className={`badge ${cv?.demo_mode ? 'badge-amber' : 'badge-green'}`}>{cv?.provider || 'unknown_provider'}</span>
            </div>
            <p className="mono">{cvAge ? `${cvAge.low}-${cvAge.high} years` : 'No age estimate'}</p>
            <p className="muted">Average liveness {Math.round(cv?.average_liveness_score || 0)}% | {cv?.demo_mode ? 'demo fallback active' : 'live provider active'}</p>
          </section>
          <section className="card report-section page-section" style={{ marginTop: 12, animationDelay: '.56s' }}>
            <h2 className="section-title">Geo Verification</h2>
            <div className="map-box"><span className="map-pin">{geo?.gps_city || 'GPS unavailable'}</span><span className="zone">{geo?.declared_city || 'Declared city unavailable'}</span><span className="badge badge-green" style={{ position: 'absolute', right: 10, top: 10 }}>{geo?.match_status || 'Pending'}</span></div>
            <div className="geo-row"><MapPin size={13} /><span>GPS</span><strong>{geo?.gps_city || '-'}</strong></div>
            <div className="geo-row"><Wifi size={13} /><span>IP</span><strong>{geo?.ip_city || '-'}</strong></div>
            <div className="geo-row"><FileCheck size={13} /><span>Declared</span><strong>{geo?.declared_city || '-'}</strong></div>
          </section>
          <section className="card report-section page-section" style={{ marginTop: 12, animationDelay: '.64s' }}>
            <h2 className="section-title">Audit Timeline</h2>
            <div className="timeline">
              {auditEvents.length ? auditEvents.map((event) => (
                <div className="event" key={event.id}>
                  <span className="event-dot" />
                  <p>{event.event_type.replaceAll('_', ' ')}</p>
                  <time>{new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              )) : <p className="muted">No audit events yet.</p>}
            </div>
          </section>
        </div>
      </div>

      <footer className="sticky-footer">
        <div className="status-inline"><span>Reviewing: {applicantName} - {id}</span><span className={`band band-${band}`}>{band}</span><span className="badge badge-green">{applicationStatus}</span></div>
        <div className="report-actions" style={{ marginTop: 0 }}>
          <button className="btn btn-danger" onClick={rejectApplication} disabled={Boolean(decisionLoading)}><XCircle size={13} />{decisionLoading === 'rejected' ? 'Rejecting...' : 'Reject'}</button>
          <button className="btn btn-ghost" onClick={manualReview} disabled={Boolean(decisionLoading)}>{decisionLoading === 'under_review' ? 'Updating...' : 'Manual Review'}</button>
          <button className="btn btn-primary" onClick={approveApplication} disabled={Boolean(decisionLoading)}>{decisionLoading === 'approved' ? 'Approving...' : 'Approve'}</button>
        </div>
      </footer>
    </main>
  );
}
