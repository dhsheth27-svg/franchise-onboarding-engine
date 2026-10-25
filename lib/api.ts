import { NextResponse } from 'next/server';

export function jsonError(message: string, status = 400, details: string[] = []) {
  return NextResponse.json({ error: message, details }, { status });
}

export function serverError(e: unknown) {
  console.error(e);
  return jsonError('Something went wrong on our side. Please try again.', 500, [e instanceof Error ? e.message : String(e)]);
}
