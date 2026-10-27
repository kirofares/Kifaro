// Local HTTP decode/render checks of the actual main-branch image component.
// No database connection, paid fixtures, production writes, or screenshots in git.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const manifest = JSON.parse(await readFile('scripts/spotters/svg-xml-repairs.json', 'utf8'))
const hash = b => createHash('sha256').update(b).digest('hex')
const fixtures = await Promise.all(manifest.map(async row => {
  const fixed = await readFile(row.path, 'utf8')
  const original = fixed.replaceAll('&amp;', '&')
  assert.equal(hash(original), row.original_sha256)
  assert.equal(hash(fixed), row.fixed_sha256)
  return { ...row, fixed, original }
}))
const source = await readFile('src/assessment/AssessmentCenter.tsx', 'utf8')
const component = source.slice(source.indexOf('function ProtectedAssessmentImage('), source.indexOf('\nfunction useAssessmentItems('))
assert.ok(component.startsWith('function ProtectedAssessmentImage('))
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React,{useState,useEffect} from 'react'; import {createRoot} from 'react-dom/client';
const publicAssetUrl=p=>p;
const supabase=null; // These tests only use existing public-asset URLs.
${component}
const root=createRoot(document.getElementById('root'));
window.renderFixture=(path)=>root.render(<article className="stationstem"><figure><ProtectedAssessmentImage key={path} itemId="fixture" mediaPath={path} alt="SVG review fixture"/></figure></article>);
` }, bundle: true, write: false, format: 'iife', jsx: 'automatic' })
const css = await readFile('src/styles.css', 'utf8')
const server = createServer((req, res) => {
  const match = /^\/(original|fixed)\/(\d+)\.svg$/.exec(req.url)
  if (match && fixtures[Number(match[2])]) {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' })
    res.end(fixtures[Number(match[2])][match[1]])
  } else if (req.url === '/bundle.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(bundle.outputFiles[0].text)
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main style="max-width:960px;margin:auto;padding:12px"><div id="root"></div></main><script src="/bundle.js"></script>`)
  } else { res.writeHead(404); res.end() }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] })
const results = []
const output = process.env.SVG_REVIEW_OUTPUT
if (output) await mkdir(output, { recursive: true })
try {
  for (const viewport of [{width:1440,height:900},{width:360,height:800},{width:390,height:844},{width:844,height:390}]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 1000, hasTouch: viewport.width < 1000, deviceScaleFactor: viewport.width < 1000 ? 3 : 1 })
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    for (const [i, fixture] of fixtures.entries()) {
      for (const version of ['original','fixed']) {
        const url = `/${version}/${i}.svg`
        await page.evaluate(p => window.renderFixture(p), url)
        await page.waitForFunction(p => { const e=document.querySelector('img'); return e?.getAttribute('src')===p && e.complete }, url)
        const actual = await page.locator('img').evaluate(async e => {
          let decodes = true; try { await e.decode() } catch { decodes = false }
          const b=e.getBoundingClientRect()
          return { decodes, naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,width:b.width,height:b.height,objectFit:getComputedStyle(e).objectFit,overflow:document.documentElement.scrollWidth>innerWidth }
        })
        assert.equal(actual.decodes, version==='fixed', fixture.path)
        if (version==='fixed') {
          assert.ok(actual.naturalWidth>0 && actual.naturalHeight>0)
          assert.equal(actual.objectFit,'contain'); assert.equal(actual.overflow,false)
          if (output) await page.locator('article').screenshot({path:resolve(output,`${viewport.width}-${i}.png`)})
        } else assert.equal(actual.naturalWidth,0)
        results.push({path:fixture.path,version,viewport,...actual})
      }
    }
    console.log(`PASS ${viewport.width}x${viewport.height}: 15 original failures, 15 repaired render/decode passes`)
    await context.close()
  }
  if (output) await writeFile(resolve(output,'browser-results.json'),JSON.stringify({browser:browser.version(),scope:'Local HTTP, actual main component and CSS; emulation only, no physical device or real paid session',results},null,2))
  console.log(`PASS ${results.length} image/browser cases`)
} finally { await browser.close(); await new Promise(done=>server.close(done)) }
