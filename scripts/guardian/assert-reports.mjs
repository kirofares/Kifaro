import { readFileSync } from 'node:fs';

// PRs supply the dependency report only; main/scheduled runs also supply the
// live-site report. Missing, unreadable or unknown evidence must fail closed.
const files = process.argv.slice(2);
if (!files.length) {
  console.error('No Guardian reports supplied');
  process.exitCode = 1;
}
for (const file of files) {
  try {
    const report = JSON.parse(readFileSync(file, 'utf8'));
    if (!['PASS', 'WARN'].includes(report?.status)) {
      throw new Error(`unacceptable status: ${report?.status ?? 'missing'}`);
    }
    console.log(`${file}: ${report.status}`);
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exitCode = 1;
  }
}
