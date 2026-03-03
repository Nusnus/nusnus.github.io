import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  profileSchema,
  reposSchema,
  activitySchema,
  contributionGraphSchema,
  metaSchema,
} from '../src/lib/github/schemas.js';

const DATA_DIR = join(process.cwd(), 'public', 'data');

interface ValidationTarget {
  filename: string;
  schema: { parse: (data: unknown) => unknown };
}

const targets: ValidationTarget[] = [
  { filename: 'profile.json', schema: profileSchema },
  { filename: 'repos.json', schema: reposSchema },
  { filename: 'activity.json', schema: activitySchema },
  { filename: 'contribution-graph.json', schema: contributionGraphSchema },
  { filename: 'meta.json', schema: metaSchema },
];

let hasErrors = false;

for (const { filename, schema } of targets) {
  try {
    const raw = readFileSync(join(DATA_DIR, filename), 'utf-8');
    const data: unknown = JSON.parse(raw);
    schema.parse(data);
    console.log(`  ✓ ${filename}`);
  } catch (error) {
    hasErrors = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ ${filename}: ${message}`);
  }
}

if (hasErrors) {
  console.error('\n❌ Data validation failed');
  process.exit(1);
} else {
  console.log('\n✅ All data files are valid');
}
