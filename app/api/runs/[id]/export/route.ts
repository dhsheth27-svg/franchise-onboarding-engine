import { jsonError, serverError } from '@/lib/api';
import { exportCsv, exportWorkbook } from '@/lib/export';
import { loadRun } from '@/lib/runs';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const run = await loadRun(params.id);
    if (!run) return jsonError('Run not found.', 404);
    const name = `franchise-decisions-v${run.version}-${run.result.asOf}`;
    if (new URL(req.url).searchParams.get('format') === 'csv')
      return new Response(exportCsv(run.result), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` } });
    return new Response(new Uint8Array(exportWorkbook(run.result)), {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}.xlsx"` },
    });
  } catch (e) {
    return serverError(e);
  }
}
