const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ zeroSizedQr = false } = {}) {
  const loaded = new Set();
  const draws = [];
  let captures = 0;
  const images = ['logo', 'qr'].map((id) => ({
    src: id,
    decode: async () => { await new Promise((resolve) => setImmediate(resolve)); loaded.add(id); },
    getBoundingClientRect: () => id === 'logo'
      ? { left: 24, top: 80, width: 30, height: 30 }
      : { left: 60, top: 310, width: 240, height: loaded.has('qr') && !zeroSizedQr ? 270 : 0 },
  }));
  const element = {
    querySelectorAll: () => images,
    getBoundingClientRect: () => ({ left: 10, top: 50, width: 360, height: loaded.has('qr') ? 800 : 530 }),
  };
  const context = Object.fromEntries(['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'closePath', 'clip'].map((name) => [name, () => {}]));
  context.drawImage = (image, ...rect) => draws.push({ source: image.src, rect });
  const canvas = { width: 1080, height: 2400, getContext: () => context, toBlob: (callback) => callback(new Blob(['png'], { type: 'image/png' })) };
  const module = { exports: {} };
  const source = readFileSync(path.join(__dirname, '../lib/receipt-export.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  vm.runInNewContext(compiled, {
    exports: module.exports,
    require: (name) => {
      assert.equal(name, 'html-to-image');
      return { toCanvas: async () => { captures += 1; return canvas; } };
    },
    document: { fonts: { ready: Promise.resolve() } },
    window: { getComputedStyle: () => ({ borderTopLeftRadius: '0px', objectFit: 'contain' }) },
    fetch: async (url) => ({ ok: true, blob: async () => url }),
    FileReader: class {
      readAsDataURL(value) { this.result = value; queueMicrotask(() => this.onload()); }
    },
    Image: class {
      set src(value) {
        this.value = value;
        this.naturalWidth = value === 'qr' ? 640 : 1254;
        this.naturalHeight = value === 'qr' ? 720 : 1254;
        queueMicrotask(() => this.onload());
      }
      get src() { return this.value; }
    },
    Blob,
  });
  return { render: () => module.exports.createReceiptPng(element), draws, captures: () => captures };
}

test('cold images: PNG contains the QR and logo at the loaded receipt coordinates', async () => {
  const fixture = setup();
  const png = await fixture.render();
  assert.equal(png.type, 'image/png');
  assert.deepEqual(fixture.draws, [
    { source: 'logo', rect: [42, 90, 90, 90] },
    { source: 'qr', rect: [150, 780, 720, 810] },
  ]);
});

test('a zero-height QR rejects export instead of silently producing a missing QR', async () => {
  const fixture = setup({ zeroSizedQr: true });
  await assert.rejects(fixture.render(), /image has no visible layout/);
  assert.equal(fixture.captures(), 0);
});
