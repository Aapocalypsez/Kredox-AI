const incomeWords = ['income', 'salary', 'earn', 'महीना', 'लाख'];
const employmentWords = ['salaried', 'self-employed', 'business', 'naukri'];
const employerWords = ['tcs', 'infosys', 'wipro', 'hdfc', 'icici', 'axis', 'sbi', 'tech mahindra', 'accenture', 'cognizant'];
const purposeWords = ['home renovation', 'business expansion', 'education', 'medical', 'wedding', 'vehicle', 'personal expense', 'debt consolidation'];
const riskWords = ['fraud', 'fake', 'late payment', 'default', 'bounce', 'overdue', 'धोखा'];
const consentPhrase = 'i consent to this loan application';

function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasNearbyKeyword(text, matchIndex, keywords, windowSize = 36) {
  const start = Math.max(0, matchIndex - windowSize);
  const end = Math.min(text.length, matchIndex + windowSize);
  const nearby = normalize(text.slice(start, end));
  return keywords.some((word) => nearby.includes(word));
}

function extractIncome(text) {
  const normalized = normalize(text);
  const numberPattern = /(?:₹|rs\.?|inr)?\s*(\d{2,3}(?:,\d{3})+|\d{4,7})(?:\s*(?:per month|monthly|month|महीना))?/gi;
  const lakhPattern = /(\d+(?:\.\d+)?)\s*(?:lakh|लाख)/gi;
  const detections = [];

  for (const match of normalized.matchAll(numberPattern)) {
    if (hasNearbyKeyword(normalized, match.index || 0, incomeWords)) {
      detections.push({
        field: 'income',
        value: match[1].replace(/,/g, ''),
        display_value: `₹${Number(match[1].replace(/,/g, '')).toLocaleString('en-IN')} / month`
      });
    }
  }

  for (const match of normalized.matchAll(lakhPattern)) {
    if (hasNearbyKeyword(normalized, match.index || 0, incomeWords, 50)) {
      const monthlyValue = Math.round((Number(match[1]) * 100000) / 12);
      detections.push({
        field: 'income',
        value: String(monthlyValue),
        display_value: `₹${monthlyValue.toLocaleString('en-IN')} / month`
      });
    }
  }

  return detections.slice(0, 1);
}

function extractEmployment(text) {
  const normalized = normalize(text);
  const match = employmentWords.find((word) => normalized.includes(word));
  if (!match) return [];

  return [{
    field: 'employment',
    value: match === 'naukri' ? 'salaried' : match,
    display_value: match === 'naukri' ? 'Salaried' : match
  }];
}

function extractEmployer(text) {
  const normalized = normalize(text);
  const match = employerWords.find((word) => normalized.includes(word));
  if (!match) return [];

  return [{
    field: 'employer_name',
    value: match.toUpperCase(),
    display_value: match.toUpperCase()
  }];
}

function extractYearsEmployed(text) {
  const normalized = normalize(text);
  const match = normalized.match(/(\d{1,2})\s*(?:years?|yrs?|saal)/i);
  if (!match || !hasNearbyKeyword(normalized, match.index || 0, ['work', 'working', 'employed', 'job', 'company', 'kaam', 'naukri'], 60)) {
    return [];
  }

  return [{
    field: 'years_employed',
    value: Number(match[1]),
    display_value: `${match[1]} years`
  }];
}

function extractLoanPurpose(text) {
  const normalized = normalize(text);
  const match = purposeWords.find((word) => normalized.includes(word));
  if (!match) return [];

  return [{
    field: 'loan_purpose',
    value: match,
    display_value: match.replace(/\b\w/g, (letter) => letter.toUpperCase())
  }];
}

function extractConsent(text) {
  return normalize(text).includes(consentPhrase)
    ? [{
        field: 'consent',
        value: 'true',
        display_value: 'Consent detected'
      }]
    : [];
}

function extractRisk(text) {
  const normalized = normalize(text);
  const match = riskWords.find((word) => normalized.includes(word));
  if (!match) return [];

  return [{
    field: 'risk',
    value: match,
    display_value: match
  }];
}

export function extractTranscriptEntities(text) {
  return [
    ...extractIncome(text),
    ...extractEmployment(text),
    ...extractEmployer(text),
    ...extractYearsEmployed(text),
    ...extractLoanPurpose(text),
    ...extractConsent(text),
    ...extractRisk(text)
  ];
}

