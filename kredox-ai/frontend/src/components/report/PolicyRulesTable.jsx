import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '../ui/Card.jsx';

const rules = [
  ['PASS', 'Min Age (21+)', '21+', '32', 'PASS'],
  ['PASS', 'Bureau Score (650+)', '650+', '741', 'PASS'],
  ['PASS', 'Min Income (₹15K+)', '₹15K', '₹68K', 'PASS'],
  ['PASS', 'Liveness (60+)', '60+', '94', 'PASS'],
  ['PASS', 'Consent', 'Yes', 'Yes (04:21)', 'PASS'],
  ['PASS', 'Geo Verified', 'Mumbai', 'Mumbai Match', 'PASS'],
  ['PASS', 'Max Existing Loans (3)', '<=3', '1', 'PASS'],
  ['WARN', 'FOIR Ratio (<50%)', '<50%', '42%', 'WARN']
];

export function PolicyRulesTable() {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <span className="font-display font-bold text-success">8/8 Rules Passed - Click to expand</span>
        <ChevronDown className={`h-5 w-5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="dark-scrollbar mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-text-muted">
              <tr><th className="p-2">Result</th><th className="p-2">Rule</th><th className="p-2">Required</th><th className="p-2">Actual</th><th className="p-2">Status</th></tr>
            </thead>
            <tbody>
              {rules.map((row) => (
                <tr key={row[1]} className="border-t border-border">
                  {row.map((cell, index) => (
                    <td key={`${row[1]}-${index}`} className={`p-2 ${cell === 'WARN' ? 'text-warning' : cell === 'PASS' ? 'text-success' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
