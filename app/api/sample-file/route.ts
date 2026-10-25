import { workbookFromInput } from '@/lib/excel';
import { SAMPLE_APPLICATIONS, SAMPLE_TERRITORIES } from '@/lib/sample';

export const runtime = 'nodejs';

export async function GET() {
  return new Response(new Uint8Array(workbookFromInput(SAMPLE_APPLICATIONS, SAMPLE_TERRITORIES)), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Franchise_Sample_Messy_Data.xlsx"',
    },
  });
}
