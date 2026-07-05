import { NextResponse } from 'next/server';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function supabase(path: string, init?: RequestInit) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase backend environment variables are missing.');
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function rpc(name: string, body: Record<string, unknown>) {
  return supabase(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
}

function mapTicket(row: any) {
  return {
    id: row.id,
    code: row.public_code,
    token: row.secure_code,
    item: row.product_id,
    stall: row.allowed_stall_id || 'todas',
    v: Number(row.value || 0),
    st: row.status === 'consumed' ? 'consumido' : row.status === 'cancelled' ? 'cancelado' : 'vendido',
    pay: row.payment_method || 'Servidor',
    at: row.sold_at || row.created_at,
    used: row.consumed_stall_id || undefined,
  };
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    if (body.action === 'status') {
      return json({ ok: true, status: 'online' });
    }

    if (body.action === 'bootstrap') {
      const event = (await supabase('events?status=eq.open&select=*&order=created_at.desc&limit=1'))[0];
      if (!event) return json({ ok: false, error: 'Nenhum evento aberto.' }, 404);
      const [cashiers, stalls, products, tickets] = await Promise.all([
        supabase(`cashiers?event_id=eq.${event.id}&active=eq.true&select=*&order=created_at.asc`),
        supabase(`stalls?event_id=eq.${event.id}&active=eq.true&select=*&order=created_at.asc`),
        supabase(`products?event_id=eq.${event.id}&active=eq.true&select=*&order=created_at.asc`),
        supabase(`tickets?event_id=eq.${event.id}&select=*&order=created_at.desc&limit=100`),
      ]);
      return json({
        ok: true,
        status: 'online',
        event,
        cashiers,
        stalls,
        products,
        tickets: tickets.map(mapTicket),
      });
    }

    if (body.action === 'sell') {
      const row = await rpc('sell_pos_ticket', {
        p_product_id: body.product_id,
        p_cashier_id: body.cashier_id,
        p_payment_details: body.payment_details || [],
        p_paid_amount: Number(body.paid_amount || 0),
        p_change_amount: Number(body.change_amount || 0),
        p_customer_name: body.customer_name || null,
        p_customer_phone: body.customer_phone || null,
        p_customer_email: body.customer_email || null,
      });
      return json({ ok: true, status: 'online', ticket: mapTicket(row) });
    }

    if (body.action === 'consume') {
      const result = await rpc('consume_pos_ticket', {
        p_code: String(body.code || '').trim(),
        p_stall_id: body.stall_id,
      });
      if (result.ticket) result.ticket = mapTicket(result.ticket);
      return json({ status: 'online', ...result });
    }

    return json({ ok: false, error: 'Ação inválida.' }, 400);
  } catch (error) {
    return json({ ok: false, status: 'offline', error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
