import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb, degrees } from 'npm:pdf-lib@1.17.1'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'X-Page-Count',
  'Cache-Control': 'no-store, private',
}
const json = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json('Method not allowed', 405)
  try {
    const auth = req.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) return json('Authentication required', 401)
    const url = Deno.env.get('SUPABASE_URL')
    const anon = Deno.env.get('SUPABASE_ANON_KEY')
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anon || !service) return json('Service unavailable', 503)
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
    const { data: identity, error: identityError } = await userClient.auth.getUser(auth.slice(7))
    if (identityError || !identity.user) return json('Invalid session', 401)
    const { lectureId, page = 1 } = await req.json()
    if (typeof lectureId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(lectureId) || !Number.isInteger(page) || page < 1) {
      return json('Invalid request', 400)
    }
    // Permission enforcement happens on the server, not in the React UI.
    const { data: access, error: accessError } = await userClient.rpc('consume_lecture_asset', {
      p_lecture_id: lectureId, p_asset_type: 'datashow',
    })
    if (accessError) return json('Access denied', 403)
    const row = Array.isArray(access) ? access[0] : access
    if (!row?.asset_path) return json('Lecture not available', 404)

    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { data: original, error: storageError } = await admin.storage.from('kifaro-content').download(row.asset_path)
    if (storageError || !original) return json('Lecture not available', 404)

    const source = await PDFDocument.load(await original.arrayBuffer())
    const count = source.getPageCount()
    if (page > count) return json('Page out of range', 404)
    const output = await PDFDocument.create()
    const [selected] = await output.copyPages(source, [page - 1])
    output.addPage(selected)

    const font = await output.embedFont(StandardFonts.Helvetica)
    const { width, height } = selected.getSize()
    const identityLabel = (identity.user.email || identity.user.id).replace(/[^\x20-\x7E]/g, '').slice(0, 65)
    const trace = identity.user.id.slice(0, 12)
    const label = `Dr. Kirolus Fares | ${identityLabel} | ${trace}`
    const size = Math.max(9, Math.min(17, width / 45))
    for (let y = 60; y < height; y += 155) {
      selected.drawText(label, { x: 24, y, size, font, color: rgb(0.15, 0.27, 0.45), opacity: 0.17, rotate: degrees(12) })
    }
    const bytes = await output.save()
    return new Response(bytes, {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/pdf', 'X-Page-Count': String(count), 'Content-Disposition': 'inline; filename="slide.pdf"' },
    })
  } catch {
    return json('Unable to display slide', 500)
  }
})
