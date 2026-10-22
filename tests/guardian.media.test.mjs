import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import ts from 'typescript';
import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// Exercise the real exporter after changing PDF.js and PptxGenJS's transitive
// image-size dependency, using synthetic content rather than student files.
const original = await readFile(new URL('../src/admin/lectureArtifacts.ts', import.meta.url), 'utf8');
const source = original.replace(/from '(pptxgenjs|jspdf)'/g, (_, name) => `from '${import.meta.resolve(name)}'`);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { buildLecturePptx, buildLecturePdf } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQ3PoaAAK8AcLKuPaIAAAAAElFTkSuQmCC';
const image = `data:image/png;base64,${png}`;
const content = {
  lecture_title: 'Guardian export fixture', academic_year: 1, module: 'TEST',
  learning_objectives: ['Check the exported document.'],
  slides: [{ slide_number: 3, title: 'Image fixture', body_points: ['Synthetic test content.'] }],
};
const visuals = new Map([[3, image]]);

test('lecture PPTX export retains slide text, image bytes, and the watermark', async () => {
  const blob = await buildLecturePptx(content, visuals);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slides.length, 3);
  const xml = await zip.file('ppt/slides/slide3.xml').async('string');
  assert.match(xml, /Image fixture/);
  assert.match(xml, /Dr\. Kirolus Fares/);
  assert.match(xml, /<p:pic>/);
  const images = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/') && !zip.files[name].dir);
  assert.ok(images.length > 0);
  assert.ok((await Promise.all(images.map(name => zip.file(name).async('nodebuffer'))))
    .some(bytes => bytes.equals(Buffer.from(png, 'base64'))));
});

test('exported lecture PDF loads and its image page renders through updated PDF.js', async () => {
  const blob = buildLecturePdf(content, visuals);
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true });
  const pdf = await task.promise;
  try {
    assert.equal(pdf.numPages, 3);
    const page = await pdf.getPage(3);
    const text = (await page.getTextContent()).items.map(item => item.str || '').join(' ');
    assert.match(text, /Image fixture/);
    assert.match(text, /Dr\. Kirolus Fares/);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = pdf.canvasFactory.create(viewport.width, viewport.height);
    try {
      await page.render({ canvasContext: canvas.context, viewport }).promise;
      assert.ok(canvas.canvas.toBuffer('image/png').length > 1000);
    } finally {
      pdf.canvasFactory.destroy(canvas);
    }
  } finally {
    await task.destroy();
  }
});

test('patched transitive image parser handles PNG and rejects zero-length ICNS without hanging', () => {
  const require = createRequire(import.meta.url);
  const fromPptx = createRequire(require.resolve('pptxgenjs'));
  const parser = fromPptx.resolve('image-size');
  const { imageSize } = fromPptx('image-size');
  assert.deepEqual(imageSize(Buffer.from(png, 'base64')), { height: 1, width: 1, type: 'png' });
  // Isolate the historical infinite loop in a child with a hard timeout, so
  // accidentally restoring the vulnerable version cannot hang the test runner.
  const script = `
    const mod = require(process.argv[1]);
    const parse = mod.imageSize || mod.default || mod;
    try { parse(Buffer.from('69636e73000000106963303700000000', 'hex')); }
    catch { process.stdout.write('rejected'); }
  `;
  const result = spawnSync(process.execPath, ['-e', script, parser], { encoding: 'utf8', timeout: 3000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'rejected');
});
