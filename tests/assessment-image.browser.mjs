// Local browser harness for the real React component and production stylesheet.
// Set PLAYWRIGHT_MODULE to an installed playwright entrypoint if needed.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#def"/><text x="100" y="180" font-size="80">TEST FIXTURE 1</text><text x="900" y="700" font-size="80">2</text></svg>'
const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
const bundled = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import {ProtectedAssessmentImage} from './src/assessment/ProtectedAssessmentImage';
  const root=createRoot(document.getElementById('root'));
  window.calls=[];
  window.renderFixture=(config)=>{window.config=config; root.render(<article className="stationstem"><figure><ProtectedAssessmentImage itemId={config.item} mediaPath={config.path} alt="Test image"/></figure></article>)};
` }, bundle: true, write: false, format: 'iife', jsx: 'automatic', plugins: [{ name: 'test-boundaries', setup(b) {
  b.onResolve({ filter: /(?:lib\/supabase|auth\/AuthContext|\/i18n|lib\/publicAssetUrl)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents:
    args.path.includes('AuthContext') ? 'export const useAuth=()=>({session:window.config.session});' :
    args.path.includes('i18n') ? 'export const useTr=()=>((en,ar)=>window.config.ar?ar:en);' :
    args.path.includes('publicAssetUrl') ? 'export const publicAssetUrl=p=>p;' :
    'export const supabase={functions:{invoke:(name,options)=>new Promise((resolve,reject)=>window.calls.push({name,options,resolve,reject}))}};' }))
} }] })
const css = await readFile('src/styles.css', 'utf8')
const server = createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundled.outputFiles[0].text) }
  else if (req.url === '/fixture.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end(svg) }
  else { res.setHeader('Content-Type','text/html'); res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main style="max-width:960px;margin:auto;padding:12px"><div id="root"></div></main><script src="/bundle.js"></script>`) }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
let scenarios = 0
try {
  for (const width of [360, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const render = (item, path = 'private:test', session = { access_token: 'test-token' }) => page.evaluate(
      config => window.renderFixture(config), { item, path, session, ar: width === 390 })
    const settle = async (index, result) => { await page.waitForFunction(i => window.calls.length > i, index); await page.evaluate(([i,r]) => window.calls[i].resolve(r), [index,result]) }
    await render('one'); await settle(0, { data: { url: dataUrl }, error: null })
    await page.waitForFunction(() => document.querySelector('img')?.naturalWidth === 1200)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await page.locator('img').evaluate(el => getComputedStyle(el).objectFit), 'contain')
    await render('two'); await page.waitForFunction(() => window.calls.length === 2)
    assert.equal(await page.locator('img').count(), 0, 'old station must disappear while next image loads')
    await settle(1, { data: null, error: { message: 'Access denied' } })
    await page.locator('[role=alert]').waitFor(); assert.equal(await page.locator('img').count(), 0)
    await page.locator('button').click(); await settle(2, { data: { url: dataUrl } })
    await page.locator('img').waitFor()
    await render('three'); await page.waitForFunction(() => window.calls.length === 4)
    await render('four'); await page.waitForFunction(() => window.calls.length === 5)
    await settle(3, { data: { url: dataUrl } })
    assert.equal(await page.locator('img').count(), 0, 'late response must not fill the next station')
    await page.evaluate(() => window.calls[4].reject(new Error('offline')))
    await page.locator('[role=alert]').waitFor()
    await page.locator('button').click(); await settle(5, { data: { url: 'https://public.invalid/image.jpg' } })
    await page.locator('[role=alert]').waitFor(); assert.equal(await page.locator('img').count(), 0)
    await render('five'); await settle(6, { data: { url: dataUrl } }); await page.locator('img').waitFor()
    await render('five','private:test',null); await page.locator('[role=alert]').waitFor()
    assert.equal(await page.locator('img').count(),0, 'sign out must clear protected pixels')
    assert.equal(await page.evaluate(() => window.calls.length),7)
    await render('public','/fixture.svg',null)
    await page.waitForFunction(() => document.querySelector('img')?.naturalWidth === 1200)
    await render('decode'); await settle(7, { data: { url: 'data:image/jpeg;base64,AAAA' } })
    await page.locator('[role=alert]').waitFor()
    assert.deepEqual(errors,[])
    scenarios += 10
    console.log(`PASS ${width}px: paid image, contain/no overflow, next station, denied, retry, stale response, rejection, no public fallback, logout, decode failure`)
    await page.close()
  }
  console.log(`PASS ${scenarios} browser checks (mocked service, real component)`)
} finally { await browser.close(); await new Promise(done => server.close(done)) }
