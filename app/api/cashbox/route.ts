import { NextResponse } from 'next/server';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function rpc(name: string, args: Record<string, unknown>) {
  if (!url || !key) throw new Error('Supabase env missing');
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function read(path: string) {
  if (!url || !key) throw new Error('Supabase env missing');
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function GET() {
  try {
    const sessions = await read('cash_sessions?select=*&order=opened_at.desc&limit=50');
    const movements = await read('cash_movements?select=*&order=created_at.desc&limit=100');
    return reply({ ok: true, sessions, movements });
  } catch (e) {
    return reply({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === 'open') {
      const row = await rpc('open_cash_session', {
        p_cashier_id: body.cashier_id,
        p_operator_id: body.operator_id,
        p_opening_amount: Number(body.opening_amount || 0),
        p_notes: body.notes || null,
      });
      return reply({ ok: true, session: row });
    }
    if (body.action === 'movement') {
      const row = await rpc('add_cash_movement', {
        p_cash_session_id: body.cash_session_id,
        p_movement_type: body.movement_type,
        p_amount: Number(body.amount || 0),
        p_reason: body.reason || null,
        p_payment_method: body.payment_method || 'Dinheiro',
      });
      return reply({ ok: true, movement: row });
    }
    if (body.action === 'close') {
      const row = await rpc('close_cash_session', {
        p_cash_session_id: body.cash_session_id,
        p_closing_amount: Number(body.closing_amount || 0),
        p_notes: body.notes || null,
      });
      return reply({ ok: true, session: row });
    }
    return reply({ ok: false, error: 'Invalid action' }, 400);
  } catch (e) {
    return reply({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
