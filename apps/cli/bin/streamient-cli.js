#!/usr/bin/env node

import { readFileSync } from 'node:fs';

import { CliApplication } from '../lib/application.js';

for (const stream of [process.stdout, process.stderr]) stream.on('error', (error) => { if (error.code === 'EPIPE') process.exit(0); throw error; });

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const application = new CliApplication({ version: packageJson.version });
process.exitCode = await application.run(process.argv.slice(2));

