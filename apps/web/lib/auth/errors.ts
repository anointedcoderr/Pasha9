// Built by Anointed Coder.
// Shared API error response helpers.

import { NextResponse } from 'next/server';

export function jsonError(status: number, code: string, message?: string, meta?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message: message ?? code, ...meta }, { status });
}

export function jsonOk<T extends object>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}
