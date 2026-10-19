import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverPublicAssets, validAssetContentType, verifyPublicAsset } from '../scripts/guardian/public-assets.mjs';

const html = '<!doctype html><html><head>'
  + '<link rel="manifest" href="./manifest.webmanifest">'
  + '<link rel="icon" href="./icons/anatomate-icon.svg">'
  + '<link rel="stylesheet" crossorigin href="./assets/main-98.css">'
  + '<link rel="canonical" href="https://external.example/">'
  + '<script type="module" crossorigin src="./assets/main-98.js"></script>'
  + '<script type="module" src="https://external.example/payload.js"></script>'
  + '</head><body><img src="./assets/logo.webp"><script>window.inline=true</script></body></html>';

test('resolves relative ./assets and public images/icons from delivered HTML', () => {
  const result = discoverPublicAssets(html, 'https://kifaroedu.com/');
  assert.equal(result.length, 5);
  assert.deepEqual(result.map(x => x.kind), ['manifest','image','css','javascript','image']);
  assert.ok(result.some(x => x.url === 'https://kifaroedu.com/assets/main-98.js'));
  assert.ok(result.some(x => x.url === 'https://kifaroedu.com/icons/anatomate-icon.svg'));
  assert.ok(result.every(x => new URL(x.url).origin === 'https://kifaroedu.com'));
});

test('same-origin only, no data URLs or private links', () => {
  const h = '<script src="data:text/javascript,evil()"></script>'
    + '<img src="https://external.example/evil.png"><img src="./visible.png">'
    + '<link rel="canonical" href="https://kifaroedu.com/private/lecture.pdf">';
  const result = discoverPublicAssets(h, 'https://kifaroedu.com/');
  assert.deepEqual(result, [{url:'https://kifaroedu.com/visible.png', kind:'image'}]);
});

test('caps number of requests and deduplicates assets', () => {
  const h = Array.from({length:50}, (_,i) => '<script src="./assets/' + i + '.js"></script>').join('');
  assert.equal(discoverPublicAssets(h, 'https://kifaroedu.com/', 8).length, 8);
  assert.equal(discoverPublicAssets('<img src="./a.webp"><img src="./a.webp">',
    'https://kifaroedu.com/').length, 1);
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
