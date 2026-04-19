export const kpis = {
  applicationsToday: 247,
  liveSessions: 12,
  autoApproved: 89,
  flagged: 23,
};

export const applications = [
  { id:'KYC-0847', name:'Rahul Sharma',    phone:'+91 98765 43210', campaign:'WA_May', status:'live',      band:'A', score:841, geo:'match',    city:'Mumbai',    time:'2m' },
  { id:'KYC-0848', name:'Priya Mehta',     phone:'+91 87654 32109', campaign:'SMS_Apr', status:'completed', band:'B', score:723, geo:'match',    city:'Pune',      time:'14m' },
  { id:'KYC-0849', name:'Arjun Patel',     phone:'+91 76543 21098', campaign:'Em_May',  status:'completed', band:'C', score:598, geo:'mismatch', city:'Ahmedabad', time:'28m' },
  { id:'KYC-0850', name:'Divya Krishnan',  phone:'+91 65432 10987', campaign:'WA_May',  status:'pending',   band:null,score:null,geo:null,       city:'Chennai',   time:'1h' },
  { id:'KYC-0851', name:'Rohit Gupta',     phone:'+91 54321 09876', campaign:'SMS_Apr', status:'completed', band:'A', score:879, geo:'match',    city:'Delhi',     time:'2h' },
  { id:'KYC-0852', name:'Sneha Joshi',     phone:'+91 43210 98765', campaign:'Em_May',  status:'completed', band:'D', score:481, geo:'mismatch', city:'Nagpur',    time:'3h' },
  { id:'KYC-0853', name:'Amit Verma',      phone:'+91 32109 87654', campaign:'SMS_Apr', status:'expired',   band:null,score:null,geo:null,       city:'Lucknow',   time:'5h' },
  { id:'KYC-0854', name:'Kavya Reddy',     phone:'+91 21098 76543', campaign:'WA_May',  status:'completed', band:'B', score:751, geo:'match',    city:'Hyderabad', time:'6h' },
];

export const activity = [
  { type:'live',     msg:'Rahul Sharma — session started',        time:'2m ago' },
  { type:'approved', msg:'Priya Mehta — auto approved ₹4.5L B',  time:'5m ago' },
  { type:'flag',     msg:'Arjun Patel — age mismatch flagged',    time:'8m ago' },
  { type:'offer',    msg:'Rohit Gupta — offer ₹8.2L generated',  time:'12m ago' },
  { type:'expired',  msg:'Divya K — link expired, resent',        time:'18m ago' },
  { type:'consent',  msg:'Kavya Reddy — consent confirmed',       time:'24m ago' },
  { type:'ai',       msg:'AI analysis complete — Sneha Joshi',    time:'31m ago' },
  { type:'campaign', msg:'New campaign launched — 450 links sent',time:'1h ago' },
];

export const weekData = [
  { day:'Mon', submitted:42, approved:28, rejected:8,  flagged:6 },
  { day:'Tue', submitted:55, approved:34, rejected:11, flagged:10 },
  { day:'Wed', submitted:48, approved:30, rejected:9,  flagged:9 },
  { day:'Thu', submitted:61, approved:40, rejected:12, flagged:9 },
  { day:'Fri', submitted:70, approved:45, rejected:14, flagged:11 },
  { day:'Sat', submitted:39, approved:24, rejected:7,  flagged:8 },
  { day:'Sun', submitted:33, approved:20, rejected:6,  flagged:7 },
];

export const bandDist = [
  { name:'A', value:89,  color:'#22C97A' },
  { name:'B', value:72,  color:'#4D90E8' },
  { name:'C', value:54,  color:'#F5A623' },
  { name:'D', value:32,  color:'#F04E55' },
];

export const riskReport = {
  id: 'KYC-2024-0847',
  name: 'Rahul Sharma',
  phone: '+91 98765 43210',
  city: 'Mumbai, Maharashtra',
  completedAt: '10:29 AM, Today',
  band: 'A',
  persona: 'Stable Salaried Professional',
  confidenceScore: 84,
  cibil: 741,
  income: 68000,
  age: 32,
  liveness: 94,
  geoScore: 96,
  offerAmount: 850000,
  interestRate: 10.75,
  tenure: 36,
  emi: 27680,
  processingFee: 8500,
  redFlags: ['Income declaration 12% above bureau estimate'],
  positiveSignals: [
    'Consent phrase clearly articulated at 04:21',
    'Liveness 94/100 — real person verified',
    'Geo location matches declared city Mumbai',
    'Age estimate CV 28–36 consistent with declared 32',
    'No existing loan defaults on record',
    'TCS employment verified — 6 years tenure',
  ],
  summary: 'Rahul Sharma presents a low-risk profile with consistent income declarations across speech and documentation. CIBIL score of 741 reflects responsible credit behaviour. Geo-verification confirms the applicant called from declared city Mumbai. Verbal consent clearly captured and timestamped. No material fraud signals detected.',
  transcript: [
    { time:'00:12', speaker:'Agent',    text:'Please state your full name.' },
    { time:'00:18', speaker:'Customer', text:'Mera naam Rahul Sharma hai.' },
    { time:'00:45', speaker:'Agent',    text:'How long have you been employed?' },
    { time:'00:52', speaker:'Customer', text:'TCS mein 6 saal se kaam kar raha hoon, senior developer position pe.', highlight:'employment' },
    { time:'01:34', speaker:'Agent',    text:'Please state your monthly income.' },
    { time:'01:41', speaker:'Customer', text:'Meri in-hand salary ₹68,000 per month hai.', highlight:'income' },
    { time:'02:18', speaker:'Customer', text:'Home renovation ke liye loan chahiye, approximately ₹8–9 lakhs.' },
    { time:'04:21', speaker:'Customer', text:'I consent to this loan application and verification process with Kredox AI.', highlight:'consent' },
  ],
  auditTimeline: [
    { time:'10:14 AM', icon:'link',    event:'Campaign link sent via WhatsApp' },
    { time:'10:22 AM', icon:'eye',     event:'Link opened by customer' },
    { time:'10:23 AM', icon:'video',   event:'Video session initiated' },
    { time:'10:23 AM', icon:'map-pin', event:'Geo-location captured — Mumbai' },
    { time:'10:24 AM', icon:'bar-chart',event:'CIBIL bureau data fetched — 741' },
    { time:'10:25 AM', icon:'mic',     event:'STT engine started' },
    { time:'10:26 AM', icon:'eye',     event:'CV age estimation: 28–36 yrs' },
    { time:'10:27 AM', icon:'check',   event:'Consent phrase confirmed' },
    { time:'10:29 AM', icon:'cpu',     event:'Kredox AI analysis complete' },
    { time:'10:29 AM', icon:'dollar',  event:'Offer generated: ₹8.5L @ 10.75%' },
  ],
};
