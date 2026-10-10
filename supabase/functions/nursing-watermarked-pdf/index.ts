import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb, degrees } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = Deno.env.get('SUPABASE_URL')
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    const publishableKey = publishableKeys.default || Deno.env.get('SUPABASE_ANON_KEY')
    const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !publishableKey || !secretKey) throw new Error('Supabase function environment is incomplete')

    const token = authHeader.slice('Bearer '.length)
    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const user = userData.user
    const { data: profile } = await adminClient.from('profiles').select('faculty,role,full_name').eq('id', user.id).maybeSingle()
    const isAdmin = profile?.role === 'admin'
    if (!isAdmin && profile?.faculty !== 'Nursing') {
      return new Response(JSON.stringify({ error: 'Nursing access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const lectureId = String(body?.lectureId || '')
    const fileKind = String(body?.fileKind || '')
    if (!lectureId.startsWith('nursing-y1-general-anatomy-') || !['visual_pdf','workbook_pdf'].includes(fileKind)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: record, error: recordError } = await adminClient
      .from('nursing_lecture_files')
      .select('storage_path,original_name')
      .eq('lecture_id', lectureId)
      .eq('file_kind', fileKind)
      .maybeSingle()
    if (recordError || !record?.storage_path) {
      return new Response(JSON.stringify({ error: 'PDF is not available yet' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: fileBlob, error: downloadError } = await adminClient.storage.from('kifaro-content').download(record.storage_path)
    if (downloadError || !fileBlob) throw downloadError || new Error('Could not load PDF')

    const pdfDoc = await PDFDocument.load(new Uint8Array(await fileBlob.arrayBuffer()))
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const studentName = String(profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student')
    const email = String(user.email || 'student-account')
    const traceId = String(user.id).slice(0,8).toUpperCase()
    const viewedAt = new Date().toISOString().replace('T',' ').replace('Z',' UTC')
    const owner = 'Dr. Kirolus Fares'
    const identity = `${studentName} · ${email}`
    const trace = `ID ${traceId} · ${viewedAt}`

    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize()
      const mainSize = Math.max(16, Math.min(28, width / 24))
      const subSize = Math.max(9, Math.min(13, width / 48))
      for (let y = 80; y < height; y += Math.max(170, height / 3)) {
        for (let x = 40; x < width; x += Math.max(260, width / 1.7)) {
          page.drawText(owner, { x, y, size: mainSize, font: bold, color: rgb(0.09,0.23,0.43), opacity: 0.12, rotate: degrees(-25) })
          page.drawText(identity.slice(0,90), { x, y: y - 24, size: subSize, font, color: rgb(0.09,0.23,0.43), opacity: 0.11, rotate: degrees(-25) })
        }
      }
      page.drawText(owner, { x: 28, y: 28, size: 10, font: bold, color: rgb(0.09,0.23,0.43), opacity: 0.55 })
      page.drawText(identity.slice(0,110), { x: 28, y: 15, size: 7.5, font, color: rgb(0.09,0.23,0.43), opacity: 0.5 })
      page.drawText(trace.slice(0,120), { x: Math.max(28,width-260), y: 15, size: 6.5, font, color: rgb(0.09,0.23,0.43), opacity: 0.45 })
    }

    const output = await pdfDoc.save({ useObjectStreams: true })
    return new Response(output, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="KIFARO-Nursing-protected.pdf"',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})