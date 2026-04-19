export const applications = [
  { id: 'KYC-2024-0847', name: 'Rahul Sharma', phone: '+91 98765 43210', campaign: 'WhatsApp_Campaign_May', status: 'live', riskBand: 'A', score: 841, geo: 'match', city: 'Mumbai', time: '2m ago' },
  { id: 'KYC-2024-0848', name: 'Priya Mehta', phone: '+91 87654 32109', campaign: 'SMS_Campaign_Apr', status: 'completed', riskBand: 'B', score: 723, geo: 'match', city: 'Pune', time: '14m ago' },
  { id: 'KYC-2024-0849', name: 'Arjun Patel', phone: '+91 76543 21098', campaign: 'Email_Campaign_May', status: 'completed', riskBand: 'C', score: 598, geo: 'mismatch', city: 'Ahmedabad', time: '28m ago' },
  { id: 'KYC-2024-0850', name: 'Divya Krishnan', phone: '+91 65432 10987', campaign: 'WhatsApp_Campaign_May', status: 'pending', riskBand: null, score: null, geo: null, city: 'Chennai', time: '1h ago' },
  { id: 'KYC-2024-0851', name: 'Rohit Gupta', phone: '+91 54321 09876', campaign: 'SMS_Campaign_Apr', status: 'completed', riskBand: 'A', score: 879, geo: 'match', city: 'Delhi', time: '2h ago' },
  { id: 'KYC-2024-0852', name: 'Sneha Joshi', phone: '+91 43210 98765', campaign: 'Email_Campaign_May', status: 'completed', riskBand: 'D', score: 481, geo: 'mismatch', city: 'Nagpur', time: '3h ago' },
  { id: 'KYC-2024-0853', name: 'Amit Verma', phone: '+91 32109 87654', campaign: 'SMS_Campaign_Apr', status: 'expired', riskBand: null, score: null, geo: null, city: 'Lucknow', time: '5h ago' },
  { id: 'KYC-2024-0854', name: 'Kavya Reddy', phone: '+91 21098 76543', campaign: 'WhatsApp_Campaign_May', status: 'completed', riskBand: 'B', score: 751, geo: 'match', city: 'Hyderabad', time: '6h ago' }
];

export const kpis = { applicationsToday: 247, liveSessions: 12, autoApproved: 89, flagged: 23 };

export const campaigns = [
  { name: 'WhatsApp_Campaign_May', channel: 'WhatsApp', sent: 450, opened: 338, completed: 214, status: 'Active', date: '19 Apr 2026' },
  { name: 'SMS_Campaign_Apr', channel: 'SMS', sent: 820, opened: 514, completed: 301, status: 'Active', date: '17 Apr 2026' },
  { name: 'Email_Campaign_May', channel: 'Email', sent: 620, opened: 279, completed: 142, status: 'Completed', date: '15 Apr 2026' }
];

export const activityFeed = [
  { icon: 'Video', message: 'Rahul Sharma joined secure video KYC', time: 'Just now', type: 'live' },
  { icon: 'Shield', message: 'Consent captured for KYC-2024-0847', time: '1m ago', type: 'success' },
  { icon: 'MapPin', message: 'Geo mismatch flagged for Sneha Joshi', time: '7m ago', type: 'warning' },
  { icon: 'CheckCircle', message: 'Rohit Gupta auto-approved for Band A', time: '12m ago', type: 'success' },
  { icon: 'Target', message: '450 WhatsApp links generated successfully', time: '22m ago', type: 'info' },
  { icon: 'FileText', message: 'Application KYC-2024-0849 moved to review', time: '31m ago', type: 'warning' },
  { icon: 'Bell', message: 'Reminder sent to Divya Krishnan', time: '45m ago', type: 'info' },
  { icon: 'BarChart2', message: 'Daily approval rate updated to 36.2%', time: '1h ago', type: 'success' }
];

export const transcript = [
  { time: '04:02', speaker: 'Agent', text: 'Rahul, please confirm your full name and current city.' },
  { time: '04:06', speaker: 'Customer', text: 'My name is Rahul Sharma and I live in Andheri East, Mumbai.' },
  { time: '04:12', speaker: 'Agent', text: 'Please state your monthly income and employer name.' },
  { time: '04:17', speaker: 'Customer', text: 'I earn ₹68,000 per month and I work at TCS as a salaried software engineer.' },
  { time: '04:21', speaker: 'Customer', text: 'I consent to this loan application and verification process with Kredox AI.' },
  { time: '04:25', speaker: 'Agent', text: 'Thank you. We have captured your consent and income statement.' },
  { time: '04:29', speaker: 'System', text: 'Identity, liveness, geo, income, and consent checks completed successfully.' }
];

export const riskReport = {
  id: 'KYC-2024-0847',
  name: 'Rahul Sharma',
  phone: '+91 98765 43210',
  city: 'Mumbai, Maharashtra',
  completedAt: '10:29 AM',
  riskBand: 'A',
  persona: 'Stable Salaried Professional',
  confidenceScore: 84,
  summary:
    'Rahul Sharma presents a strong low-risk profile with stable salaried employment at TCS, consistent income declaration, and a high-quality video KYC session. Geo verification matched the declared Mumbai residence, liveness signals remained strong throughout the interview, and consent was captured clearly. The only review note is to confirm FOIR after final bureau liabilities are refreshed.',
  redFlags: ['FOIR ratio estimated at 42%; monitor if new bureau liabilities appear before disbursal.'],
  positiveSignals: [
    'CIBIL score above policy threshold',
    'Stable salaried employment at TCS',
    'Location matched declared city',
    'Consent phrase captured with audit timestamp',
    'Liveness and identity checks passed'
  ],
  cibilScore: 741,
  income: 68000,
  age: 32,
  liveness: 94,
  geoScore: 96,
  offerAmount: 850000,
  interestRate: 10.75,
  tenure: 36,
  emi: 27680,
  processingFee: 8500,
  totalPayable: 1006480,
  auditTimeline: [
    { time: '10:21:02', icon: 'Link', event: 'Secure campaign link opened from Mumbai IP' },
    { time: '10:21:18', icon: 'Video', event: 'Video session started with encrypted media channel' },
    { time: '10:22:04', icon: 'Shield', event: 'Face liveness passed with 94% score' },
    { time: '10:22:31', icon: 'MapPin', event: 'GPS and IP location matched declared Mumbai address' },
    { time: '10:23:11', icon: 'Mic', event: 'Income detected as ₹68,000 per month' },
    { time: '10:24:21', icon: 'CheckCircle', event: 'Consent phrase captured and timestamped' },
    { time: '10:25:02', icon: 'BarChart2', event: 'Policy engine evaluated 8 rules' },
    { time: '10:26:14', icon: 'Brain', event: 'Kredox AI generated Band A risk report' },
    { time: '10:28:08', icon: 'Wallet', event: 'Personalized offer generated for ₹8,50,000' },
    { time: '10:29:00', icon: 'FileCheck', event: 'Application marked ready for auto approval' }
  ]
};

export const volumeData = [
  { day: 'Mon', Submitted: 180, Approved: 63, Rejected: 29, Flagged: 18 },
  { day: 'Tue', Submitted: 212, Approved: 74, Rejected: 36, Flagged: 21 },
  { day: 'Wed', Submitted: 198, Approved: 72, Rejected: 31, Flagged: 19 },
  { day: 'Thu', Submitted: 236, Approved: 83, Rejected: 39, Flagged: 24 },
  { day: 'Fri', Submitted: 247, Approved: 89, Rejected: 44, Flagged: 23 },
  { day: 'Sat', Submitted: 169, Approved: 54, Rejected: 26, Flagged: 14 },
  { day: 'Sun', Submitted: 141, Approved: 48, Rejected: 22, Flagged: 11 }
];

export const riskDistribution = [
  { band: 'A', count: 89 },
  { band: 'B', count: 74 },
  { band: 'C', count: 50 },
  { band: 'D', count: 34 }
];

export const sparklineData = [184, 203, 198, 226, 247, 169, 141].map((value, index) => ({ index, value }));

export const customerPreview = [
  { name: 'Rahul Sharma', phone: '+91 98765 43210', status: 'Opened', session: 'Live', band: 'A' },
  { name: 'Nisha Kapoor', phone: '+91 99887 77665', status: 'Sent', session: 'Pending', band: '-' },
  { name: 'Sameer Khan', phone: '+91 88776 66554', status: 'Opened', session: 'Completed', band: 'B' },
  { name: 'Meera Iyer', phone: '+91 77665 55443', status: 'Expired', session: 'Not started', band: '-' },
  { name: 'Aditya Rao', phone: '+91 66554 44332', status: 'Opened', session: 'Completed', band: 'A' }
];
