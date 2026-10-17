import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../docs/guardian/proposals/secure-lecture-variant-catalog.sql', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../src/hooks/useLectureDocumentVariants.ts', import.meta.url), 'utf8');
test('safe public view design', () => {
 assert.ok(sql.includes('WITH (security_invoker = true)'));
 assert.ok(sql.includes('published IS TRUE'));
 assert.ok(sql.includes('REVOKE ALL ON public.lecture_document_variant_catalog'));
});
test('private paths are not public catalog columns', () => {
 const columns = sql.split('CREATE TABLE IF NOT EXISTS public.lecture_document_variant_catalog (')[1]?.split(');')[0];
 assert.ok(columns);
 for (const privateKey of ['source_name','pdf_path','pptx_path','user_id']) assert.ok(!columns.includes(privateKey));
});
test('same fields as the React hook', () => {
 const view = sql.split('CREATE OR REPLACE VIEW public.lecture_document_variants_public')[1]?.split('REVOKE ALL ON public.lecture_document_variants_public')[0];
 assert.ok(view);
 for (const key of ['lecture_id','variant_key','label','description','sort_order','published','available_pdf','available_pptx']) {
   assert.ok(hook.includes(key) && view.includes(key), key);
 }
});
test('sync trigger handles create/update/delete', () => {
 assert.ok(sql.includes('AFTER INSERT OR UPDATE OR DELETE ON public.lecture_document_variants'));
});
