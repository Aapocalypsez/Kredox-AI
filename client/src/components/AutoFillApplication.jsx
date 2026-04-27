import { Pencil, Sparkles } from 'lucide-react';

const sourceLabels = {
  declared: 'Campaign',
  stt_extracted: 'STT',
  bureau: 'Bureau',
  cv: 'CV',
  geo: 'Geo',
  llm: 'LLM',
  risk_engine: 'Risk',
  manual: 'Manual',
  demo_fallback: 'Demo',
  empty: 'Missing',
  live_stt: 'Live STT',
  live_geo: 'Live Geo',
  live_cv: 'Live CV'
};

const sourceBadges = {
  declared: 'badge-blue',
  stt_extracted: 'badge-green',
  bureau: 'badge-blue',
  cv: 'badge-amber',
  geo: 'badge-green',
  llm: 'badge-blue',
  risk_engine: 'badge-blue',
  manual: 'badge-green',
  demo_fallback: 'badge-amber',
  empty: 'badge-dim',
  live_stt: 'badge-green',
  live_geo: 'badge-green',
  live_cv: 'badge-amber'
};

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'number') return Number(value).toLocaleString('en-IN');
  return String(value);
}

function normalizeField(field = {}) {
  return {
    value: field.value,
    source: field.source || 'empty',
    confidence: Number(field.confidence || 0),
    needs_review: Boolean(field.needs_review),
    conflicts: field.conflicts || []
  };
}

function getPath(root, path) {
  return path.split('.').reduce((target, key) => target?.[key], root);
}

export const applicationFieldMap = [
  ['personal.full_name', 'Full Name', 'Identity'],
  ['personal.phone', 'Phone', 'Identity'],
  ['personal.email', 'Email', 'Identity'],
  ['personal.age', 'Age', 'Identity'],
  ['financial.monthly_income', 'Monthly Income', 'Income'],
  ['financial.employment_type', 'Employment Type', 'Income'],
  ['financial.employer_name', 'Employer', 'Income'],
  ['financial.years_employed', 'Years Employed', 'Income'],
  ['financial.bureau_score', 'CIBIL Score', 'Risk'],
  ['loan.amount_requested', 'Loan Amount', 'Loan'],
  ['loan.purpose', 'Loan Purpose', 'Loan'],
  ['verification.liveness_score', 'Liveness Score', 'Verification'],
  ['verification.consent_confirmed', 'Verbal Consent', 'Verification'],
  ['verification.geo_verified', 'Geo Verified', 'Verification'],
  ['verification.cv_age_estimate', 'CV Age Estimate', 'Verification'],
  ['verification.cv_age_declared_match', 'CV Age Match', 'Verification'],
  ['risk.risk_band', 'Risk Band', 'Decision'],
  ['risk.policy_passed', 'Policy Passed', 'Decision'],
  ['risk.ml_score', 'ML / Risk Score', 'Decision'],
  ['risk.recommended_action', 'Recommendation', 'Decision']
];

export function rowsFromApplication(applicationJson = {}) {
  return applicationFieldMap.map(([path, label, group]) => ({
    path,
    label,
    group,
    ...normalizeField(getPath(applicationJson, path))
  }));
}

export default function AutoFillApplication({ title = 'Auto-Filled Application', rows = [], editable = false, onEdit }) {
  const filled = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '').length;
  const review = rows.filter((row) => row.needs_review).length;

  return (
    <section className="card autofill-card page-section">
      <div className="autofill-head">
        <div>
          <h2 className="section-title"><Sparkles size={14} />{title}</h2>
          <p className="muted">Fields are populated from campaign data, live transcript, CV, geo, bureau, risk, and LLM outputs.</p>
        </div>
        <div className="autofill-stats">
          <span className="badge badge-green">{filled}/{rows.length} filled</span>
          <span className={`badge ${review ? 'badge-amber' : 'badge-blue'}`}>{review} review</span>
        </div>
      </div>
      <div className="autofill-grid">
        {rows.map((row) => {
          const source = row.source || 'empty';
          const confidence = Math.round(Number(row.confidence || 0) * 100);
          return (
            <div className={`autofill-row ${row.needs_review ? 'needs-review' : ''}`} key={row.path || row.label}>
              <div>
                <span className="micro-label">{row.group}</span>
                <strong>{row.label}</strong>
                {row.conflicts?.length > 0 && <small>Conflict: {row.conflicts.map((item) => `${item.source}=${formatValue(item.value)}`).join(', ')}</small>}
              </div>
              <div>
                <span className="autofill-value">{formatValue(row.displayValue ?? row.value)}</span>
                <div className="autofill-meta">
                  <span className={`badge ${sourceBadges[source] || 'badge-dim'}`}>{sourceLabels[source] || source}</span>
                  <span className="confidence-track"><span style={{ width: `${Math.min(confidence, 100)}%` }} /></span>
                  <span className="mono dim">{confidence}%</span>
                </div>
              </div>
              {editable && (
                <button className="btn btn-ghost autofill-edit" type="button" onClick={() => onEdit?.(row)}>
                  <Pencil size={12} />Edit
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
