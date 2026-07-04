const incomeWords = ['income', 'salary', 'earn', 'earning', 'monthly', 'per month', 'month', 'mahina', 'lakh'];
const ageWords = ['age', 'years old', 'year old', 'old', 'aged'];
const employmentWords = ['salaried', 'self-employed', 'self employed', 'business', 'naukri', 'job'];
const employerWords = ['tcs', 'infosys', 'wipro', 'hdfc', 'icici', 'axis', 'sbi', 'tech mahindra', 'accenture', 'cognizant'];
const purposeWords = ['home renovation', 'business expansion', 'education', 'medical', 'wedding', 'vehicle', 'personal expense', 'personal finance', 'debt consolidation'];
const riskWords = ['fraud', 'fake', 'late payment', 'default', 'bounce', 'overdue', 'dhokha'];
const consentPhrase = 'i consent to this loan application';

function normalize(text = '') {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasNearbyKeyword(text, matchIndex, keywords, windowSize = 42) {
  const start = Math.max(0, matchIndex - windowSize);
  const end = Math.min(text.length, matchIndex + windowSize);
  const nearby = normalize(text.slice(start, end));
  return keywords.some((word) => nearby.includes(word));
}

function formatIncome(value) {
  return `INR ${Number(value).toLocaleString('en-IN')} / month`;
}

const ones = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
};

const tens = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

function numberFromWords(phrase) {
  const tokens = normalize(phrase.replace(/-/g, ' '))
    .split(' ')
    .filter((token) => token && token !== 'and');
  let total = 0;
  let current = 0;

  for (const token of tokens) {
    if (ones[token] !== undefined) current += ones[token];
    else if (tens[token] !== undefined) current += tens[token];
    else if (token === 'hundred') current *= 100;
    else if (token === 'thousand') {
      total += current * 1000;
      current = 0;
    }
  }

  const value = total + current;
  return value > 0 ? value : null;
}

function extractIncome(text) {
  const normalized = normalize(text);
  const numberPattern = /(?:rs\.?|inr)?\s*(\d{2,3}(?:,\d{3})+|\d{4,7})(?:\s*(?:per month|monthly|month|mahina))?/gi;
  const shorthandPattern = /(\d{1,3}(?:\.\d+)?)\s*(?:k|thousand)\b/gi;
  const lakhPattern = /(\d+(?:\.\d+)?)\s*lakh/gi;
  const wordThousandPattern = /((?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|hundred|and)[\s-]+)+thousand)\b/gi;
  const detections = [];

  for (const match of normalized.matchAll(numberPattern)) {
    if (hasNearbyKeyword(normalized, match.index || 0, incomeWords, 60)) {
      const value = match[1].replace(/,/g, '');
      detections.push({
        field: 'income',
        value,
        display_value: formatIncome(value)
      });
    }
  }

  for (const match of normalized.matchAll(shorthandPattern)) {
    if (hasNearbyKeyword(normalized, match.index || 0, incomeWords, 60)) {
      const value = Math.round(Number(match[1]) * 1000);
      detections.push({
        field: 'income',
        value: String(value),
        display_value: formatIncome(value)
      });
    }
  }

  for (const match of normalized.matchAll(lakhPattern)) {
    if (hasNearbyKeyword(normalized, match.index || 0, incomeWords, 60)) {
      const monthlyValue = Math.round((Number(match[1]) * 100000) / 12);
      detections.push({
        field: 'income',
        value: String(monthlyValue),
        display_value: formatIncome(monthlyValue)
      });
    }
  }

  for (const match of normalized.matchAll(wordThousandPattern)) {
    if (hasNearbyKeyword(normalized, match.index || 0, incomeWords, 80)) {
      const value = numberFromWords(match[1]);
      if (value) {
        detections.push({
          field: 'income',
          value: String(value),
          display_value: formatIncome(value)
        });
      }
    }
  }

  return detections.slice(0, 1);
}

function extractAge(text) {
  const normalized = normalize(text);
  const patterns = [
    /(?:my age is|age is|i am|i'm|im|aged)\s*(\d{2})(?:\s*(?:years?|yrs?|year old|years old|old))?/gi,
    /(\d{2})\s*(?:years?|yrs?)\s*old/gi
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const value = Number(match[1]);
      if (value < 18 || value > 90) continue;
      const workContext = hasNearbyKeyword(normalized, match.index || 0, ['work', 'working', 'employed', 'job', 'company', 'experience', 'kaam', 'naukri'], 45);
      const ageContext = pattern.source.includes('my age is') || hasNearbyKeyword(normalized, match.index || 0, ageWords, 45);
      if (!workContext || ageContext) {
        return [{
          field: 'age',
          value,
          display_value: `${value} years`
        }];
      }
    }
  }

  const wordAge = normalized.match(/(?:my age is|age is|i am|i'm|im|aged)\s+((?:twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|one|two|three|four|five|six|seven|eight|nine|and|[\s-])+)(?:years?|yrs?|old)?/i);
  if (wordAge) {
    const value = numberFromWords(wordAge[1]);
    if (value >= 18 && value <= 90) {
      return [{
        field: 'age',
        value,
        display_value: `${value} years`
      }];
    }
  }

  return [];
}

function extractEmployment(text) {
  const normalized = normalize(text);
  const match = employmentWords.find((word) => normalized.includes(word));
  if (!match) return [];

  return [{
    field: 'employment',
    value: match === 'naukri' || match === 'job' ? 'salaried' : match.replace(' ', '-'),
    display_value: match === 'naukri' || match === 'job' ? 'Salaried' : match
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
  const patterns = [
    /(?:for|since|last)\s*(\d{1,2})\s*(?:years?|yrs?|saal)/gi,
    /(\d{1,2})\s*(?:years?|yrs?|saal)\s*(?:experience|exp|work|working|employed|job)/gi
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const value = Number(match[1]);
      if (value < 1 || value > 50) continue;
      if (hasNearbyKeyword(normalized, match.index || 0, ['years old', 'year old', 'age'], 16)) continue;
      return [{
        field: 'years_employed',
        value,
        display_value: `${value} years`
      }];
    }
  }

  return [];
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
  const normalized = normalize(text);
  const consentKeywords = [
    'i consent to this loan application',
    'i consent',
    'i agree',
    'consent deta',
    'consent deti',
    'manzoor hai',
    'manzoori hai',
    'taiyaar hoon',
    'agree karta',
    'agree karti'
  ];
  const hasConsent = consentKeywords.some((phrase) => normalized.includes(phrase));
  return hasConsent
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
    ...extractAge(text),
    ...extractEmployment(text),
    ...extractEmployer(text),
    ...extractYearsEmployed(text),
    ...extractLoanPurpose(text),
    ...extractConsent(text),
    ...extractRisk(text)
  ];
}
