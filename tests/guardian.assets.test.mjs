import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { discoverSiteAssets, validAssetContentType, verifyPublicAsset } from '../scripts/guardian/site-assets.mjs';

const html = '<!doctype html><html><head>'
  + '<link rel="manifest" href="./manifest.webmanifest">'
  + '<link rel="icon" href="./icons/anatomate-icon.svg">'
  + '<link rel="stylesheet" crossorigin href="./assets/main-98.css">'
  + '<link rel="canonical" href="https://external.example/">'
  + '<script type="module" crossorigin src="./assets/main-98.js"></script>'
  + '<script type="module" src="https://external.example/payload.js"></script>'
  + '</head><body><img src="./assets/logo.webp"><script>window.inline=true</script></body></html>';

test('resolves relative ./assets and public images/icons from delivered HTML', () => {
  const result = discoverSiteAssets(html, 'https://kifaroedu.com/').assets;
  assert.equal(result.length, 5);
  assert.deepEqual(result.map(x => x.kind), ['css','javascript','manifest','image','image']);
  assert.ok(result.some(x => x.url === 'https://kifaroedu.com/assets/main-98.js'));
  assert.ok(result.some(x => x.url === 'https://kifaroedu.com/icons/anatomate-icon.svg'));
  assert.ok(result.every(x => new URL(x.url).origin === 'https://kifaroedu.com'));
});

test('same-origin only, no data URLs or private links', () => {
  const h = '<script src="data:text/javascript,evil()"></script>'
    + '<img src="https://external.example/evil.png"><img src="./visible.png">'
    + '<link rel="canonical" href="https://kifaroedu.com/private/lecture.pdf">';
  const result = discoverSiteAssets(h, 'https://kifaroedu.com/').assets;
  assert.deepEqual(result, [{url:'https://kifaroedu.com/visible.png', kind:'image'}]);
});

test('caps number of requests and deduplicates assets', () => {
  const h = Array.from({length:50}, (_,i) => '<script src="./assets/' + i + '.js"></script>').join('');
  assert.equal(discoverSiteAssets(h, 'https://kifaroedu.com/').assets.length, 8);
  assert.equal(discoverSiteAssets('<img src="./a.webp"><img src="./a.webp">',
    'https://kifaroedu.com/').assets.length, 1);
});

test('rejects HTML fallback masquerading as scripts', () => {
  assert.equal(validAssetContentType('javascript', 'text/html; charset=utf-8'), false);
  assert.equal(validAssetContentType('javascript', 'text/javascript'), true);
  assert.equal(validAssetContentType('css', 'text/css'), true);
  assert.equal(validAssetContentType('image', 'image/svg+xml'), true);
});

const item = {url:'https://kifaroedu.com/assets/example.js', kind:'javascript'};
function mockResponse(status, body, contentType='text/javascript', url=item.url) {
  return () => Promise.resolve(new Response(body, {status,
    headers: {'Content-Type':contentType} })).then(x => {
    Object.defineProperty(x, 'url', {value:url});
    return x;
  });
}

test('200 script with correct MIME and content passes', async () => {
  const r = await verifyPublicAsset(item, mockResponse(200, 'console.log(1)'));
  assert.equal(r.status, 'PASS');
});

test('404 resource fails', async () => {
  const r = await verifyPublicAsset(item, mockResponse(404, 'not found', 'text/html'));
  assert.equal(r.status, 'FAIL');
  assert.equal(r.http, 404);
});

test('200 HTML fallback fails script MIME check', async () => {
  const r = await verifyPublicAsset(item, mockResponse(200, '<html>Not found</html>', 'text/html'));
  assert.equal(r.status, 'FAIL');
});

test('empty asset and foreign redirect fail closed', async () => {
  const empty = await verifyPublicAsset(item, mockResponse(200, ''));
  assert.equal(empty.status, 'FAIL');
  const cross = await verifyPublicAsset(item, mockResponse(200, 'ok','text/javascript','https://external.example/a.js'));
  assert.equal(cross.status, 'FAIL');
});

test('discovers extensionless icons, manifest and font/image preloads by semantics', () => {
  const html = '<link rel="icon" href="/icon">'
    + '<link rel="manifest" href="/manifest">'
    + '<link rel="preload" as="font" href="/font" crossorigin>'
    + '<link rel="preload" as="image" href="/hero">'
    + '<link rel="preload" as="fetch" href="/private/lecture.pdf">'
    + '<link rel="preload" as="constructor" href="/unknown">';
  assert.deepEqual(discoverSiteAssets(html, 'https://kifaroedu.com/').assets.map(x => x.kind),
    ['image', 'manifest', 'font', 'image']);
});

test('ignores comments, inline JS markup, credentials, HTTP and non-resource links', () => {
  const html = '<!-- <img src="/comment.png"> -->'
    + '<script>const template = `<img src="/template.png">`;</script>'
    + '<img src="https://user:pass@kifaroedu.com/x.png">'
    + '<img src="http://kifaroedu.com/x.png">'
    + '<a href="/assets/paid.pdf">PDF</a><link rel="canonical" href="/home">';
  assert.equal(discoverSiteAssets(html, 'https://kifaroedu.com/').discovered, 0);
});

test('quoted angle brackets do not hide actual script, stylesheet or image references', () => {
  const html = '<script data-label="A > B" src="./assets/app.js"></script>'
    + "<link title='A > B' rel='stylesheet' href='./assets/app.css'>"
    + '<img alt="A > B" src="./hero.png">';
  assert.deepEqual(discoverSiteAssets(html, 'https://kifaroedu.com/').assets, [
    {url:'https://kifaroedu.com/assets/app.js', kind:'javascript'},
    {url:'https://kifaroedu.com/assets/app.css', kind:'css'},
    {url:'https://kifaroedu.com/hero.png', kind:'image'},
  ]);
});

test('markup inside attribute values and raw text does not create phantom probes', () => {
  const html = `<div data-example="<img src='/ghost.png'>"></div>`
    + `<img alt="<!-- illustration -->" src="/real.png">`
    + `<script data-label="A > B">const sample = '<img src="/js.png">';</script>`
    + `<style>.example::after {content: '<img src="/css.png">'}</style>`
    + `<textarea><img src="/text.png"></textarea><title><img src="/title.png"></title>`;
  assert.deepEqual(discoverSiteAssets(html, 'https://kifaroedu.com/').assets,
    [{url:'https://kifaroedu.com/real.png', kind:'image'}]);
});

test('extra assets cannot crowd out the eight-bundle budget; coverage exposes cap', () => {
  const html = Array.from({length:30}, (_,i) => `<img src="/img-${i}.webp">`).join('')
    + Array.from({length:12}, (_,i) => `<script src="./assets/${i}.js"></script>`).join('');
  const result = discoverSiteAssets(html, 'https://kifaroedu.com/');
  assert.equal(result.discovered, 42);
  assert.equal(result.assets.length, 16);
  assert.equal(result.assets.filter(x => x.kind === 'javascript').length, 8);
  assert.equal(result.skipped, 26);
});

test('normalizes fragments and encoded query separators when deduplicating', () => {
  const html = '<img src="/a.svg?v=1&amp;x=2#one"><img src="/a.svg?v=1&x=2#two">';
  assert.deepEqual(discoverSiteAssets(html, 'https://kifaroedu.com/').assets,
    [{url:'https://kifaroedu.com/a.svg?v=1&x=2', kind:'image'}]);
});

for (const [kind, type] of [
  ['javascript','application/javascript; charset=utf-8'], ['css','text/css'],
  ['image','image/svg+xml'], ['manifest','application/manifest+json'], ['font','font/woff2'],
]) {
  test(`${kind}: accepts nonempty correct MIME, rejects HTML, missing/wrong MIME and empty body`, async () => {
    const asset = {...item, kind};
    assert.equal((await verifyPublicAsset(asset, mockResponse(200,'bytes',type))).status, 'PASS');
    for (const badType of ['text/html', 'application/xhtml+xml', '', 'text/plain', 'application/not-javascript']) {
      assert.equal((await verifyPublicAsset(asset, mockResponse(200,'bytes',badType))).status, 'FAIL');
    }
    assert.equal((await verifyPublicAsset(asset, mockResponse(200,'',type))).status, 'FAIL');
  });
}

for (const target of ['https://external.example/a.js', 'http://kifaroedu.com/a.js', 'https://user:pass@kifaroedu.com/a.js']) {
  test(`blocks redirect BEFORE requesting disallowed target ${target}`, async () => {
    const calls = [];
    const result = await verifyPublicAsset(item, async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, 'manual');
      return new Response(null, {status:302, headers:{location:target}});
    });
    assert.equal(result.status, 'FAIL');
    assert.deepEqual(calls, [item.url]);
    assert.match(result.reason, /allowed HTTPS origins/);
  });
}

test('follows same-origin relative redirects and rejects loops or missing Location', async () => {
  const calls = [];
  const pass = await verifyPublicAsset(item, async url => {
    calls.push(url);
    if (url === item.url) return new Response(null, {status:307, headers:{location:'./new.js'}});
    return new Response('bytes', {headers:{'content-type':'text/javascript'}});
  });
  assert.equal(pass.status, 'PASS');
  assert.equal(pass.final_url, 'https://kifaroedu.com/assets/new.js');
  assert.equal(calls.length, 2);
  let count = 0;
  const loop = await verifyPublicAsset(item, async () => {
    count++;
    return new Response(null, {status:301, headers:{location:item.url}});
  });
  assert.equal(loop.status, 'FAIL');
  assert.equal(count, 6);
  const missing = await verifyPublicAsset(item, async () => new Response(null, {status:302}));
  assert.match(missing.reason, /missing Location/);
});

test('cancels the stream after the first nonempty chunk', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1,2,3])); },
    cancel() { cancelled = true; },
  });
  const result = await verifyPublicAsset(item, async () => new Response(stream, {headers:{'content-type':'text/javascript'}}));
  assert.equal(result.status, 'PASS');
  assert.equal(cancelled, true);
});

test('fails on empty Content-Length, absent body, network errors and stream errors', async () => {
  const requests = [
    async () => new Response('bytes', {headers:{'content-type':'text/javascript','content-length':'0'}}),
    async () => new Response(null, {headers:{'content-type':'text/javascript'}}),
    async () => { throw new Error('Network timeout'); },
    async () => new Response(new ReadableStream({start(c) {c.error(new Error('Stream failed'));}}),
      {headers:{'content-type':'text/javascript'}}),
  ];
  for (const request of requests) assert.equal((await verifyPublicAsset(item, request)).status, 'FAIL');
});

// Captured from public https://kifaroedu.com/ on 2026-10-22; no login or paid media.
test('recorded production HTML discovers the actual Vite bundles, manifest and deduplicated icon', () => {
  const html = readFileSync(new URL('./fixtures/guardian-homepage.html', import.meta.url), 'utf8');
  const { assets, discovered, skipped } = discoverSiteAssets(html, 'https://kifaroedu.com/');
  assert.equal(discovered, 4);
  assert.equal(skipped, 0);
  assert.deepEqual(assets.map(x => x.kind), ['javascript', 'css', 'manifest', 'image']);
  assert.ok(assets.every(x => x.url.startsWith('https://kifaroedu.com/')));
  assert.ok(assets.some(x => x.url.endsWith('/manifest.webmanifest')));
  assert.ok(assets.some(x => x.url.endsWith('/icons/anatomate-icon.svg')));
});
