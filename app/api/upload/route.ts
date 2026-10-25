import { NextResponse } from 'next/server';
import { jsonError, serverError } from '@/lib/api';
import { parseWorkbook, WorkbookError } from '@/lib/excel';
import { createRun } from '@/lib/runs';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') return jsonError('Please choose an Excel (.xlsx) file to upload.');
    if (file.size > 4 * 1024 * 1024) return jsonError('That file is larger than 4 MB. Please upload the case template with Applications and Territories only.');
    if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) return jsonError(`"${file.name}" is not an Excel file. Please upload the .xlsx file in the case template format.`);
    const parsed = parseWorkbook(await file.arrayBuffer());
    const run = await createRun(
      { applications: parsed.applications, territories: parsed.territories, existingStores: parsed.existingStores, events: [], source: file.name, importNotes: parsed.notes },
      `Uploaded ${file.name}`,
    );
    return NextResponse.json({ runId: run.id });
  } catch (e) {
    if (e instanceof WorkbookError) return jsonError(e.message, 400, e.details);
    return serverError(e);
  }
}
