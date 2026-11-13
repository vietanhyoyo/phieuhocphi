const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const source = readFileSync(path.join(__dirname, '../lib/google-sheets-api.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {};
vm.runInNewContext(compiled, { exports: api, require: (name) => (name === 'node:crypto' ? crypto : {}), Buffer, process });

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const oneLine = pem.replace(/\n/g, '\\n');

test('the service account key is readable however it was pasted into the host', () => {
  const variants = {
    'real line breaks': pem,
    'literal \\n (.env style)': oneLine,
    'wrapped in double quotes': `"${oneLine}"`,
    'wrapped in single quotes with real breaks': `'${pem}'`,
    'Windows line breaks': pem.replace(/\n/g, '\r\n'),
    'escaped Windows line breaks': pem.replace(/\n/g, '\\r\\n'),
    'line breaks turned into spaces': pem.replace(/\n/g, ' '),
    'whole JSON key file': JSON.stringify({ type: 'service_account', private_key: pem, client_email: 'x@y.iam.gserviceaccount.com' }),
    'base64 of the PEM': Buffer.from(pem).toString('base64'),
    'surrounding whitespace': `\n  ${pem}  \n`,
  };
  for (const [name, raw] of Object.entries(variants)) {
    const key = api.normalizePrivateKey(raw);
    assert.doesNotThrow(() => crypto.createSign('RSA-SHA256').update('x').sign(key), name);
  }
});
