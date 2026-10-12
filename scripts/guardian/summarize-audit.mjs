import { readFileSync, writeFileSync } from 'node:fs';

let report;
try {
  const audit = JSON.parse(readFileSync('guardian-audit-raw.json', 'utf8'));
  if (!audit.metadata?.vulnerabilities) throw new Error('npm audit returned no vulnerability metadata');
  const { critical = 0, high = 0, moderate = 0, low = 0 } = audit.metadata.vulnerabilities;
  report = {
    status: critical + high ? 'FAIL' : 'PASS',
    critical, high, moderate, low,
    packages: Object.keys(audit.vulnerabilities || {}).filter(k =>
      ['high', 'critical'].includes(audit.vulnerabilities[k]?.severity)).slice(0, 50),
  };
} catch (error) {
  report = { status: 'UNKNOWN', reason: String(error?.message || error) };
}
writeFileSync('guardian-audit-result.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
