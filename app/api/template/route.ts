import { templateWorkbook } from '@/lib/excel';

export const runtime = 'nodejs';

export async function GET() {
  return new Response(new Uint8Array(templateWorkbook()), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Franchise_Applications_Template.xlsx"',
    },
  });
}
