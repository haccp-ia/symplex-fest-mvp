import { NextResponse } from 'next/server';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const envStatus = {
  hasSupabaseUrl: Boolean(supabaseUrl),
  hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
  hasPublishableFallback: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function supabase(path: string, init?: RequestInit) {
  if (!supabaseUrl || !supabaseKey) throw new Error(`Supabase env missing: ${JSON.stringify(envStatus)}`);
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

async function rpc(name: string, body: Record<string, unknown>) {
  return supabase(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
}

async function currentEvent() {
  const event = (await supabase('events?status=eq.open&select=*&order=created_at.desc&limit=1'))[0];
  if (!event) throw new Error('Nenhum evento aberto.');
  return event;
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

async function bootstrap() {
  const event = await currentEvent();
  const [cashiers, stalls, products, tickets] = await Promise.all([
    supabase(`cashiers?event_id=eq.${event.id}&active=eq.true&select=*&order=created_at.asc`),
    supabase(`stalls?event_id=eq.${event.id}&active=eq.true&select=*&order=created_at.asc`),
    supabase(`products?event_id=eq.${event.id}&active=eq.true&select=*&order=created_at.asc`),
    supabase(`tickets?event_id=eq.${event.id}&select=*&order=created_at.desc&limit=100`),
  ]);
  return { ok: true, status: 'online', event, cashiers, stalls, products, tickets: tickets.map(mapTicket) };
}

async function saveEvent(data: any) {
  const base = await currentEvent();
  const payload = {
    organizer_id: base.organizer_id,
    name: data.name || data.nome || base.name,
    location: data.location || data.local || null,
    starts_at: data.starts_at || data.inicio || null,
    ends_at: data.ends_at || data.fim || null,
    status: data.status || 'open',
    sales_mode: data.sales_mode || data.mode || 'products',
  };
  if (data.id) return (await supabase(`events?id=eq.${data.id}`, { method: 'PATCH', body: JSON.stringify(payload) }))[0];
  return (await supabase('events', { method: 'POST', body: JSON.stringify(payload) }))[0];
}

async function saveStall(data: any) {
  const event = await currentEvent();
  const payload = {
    event_id: event.id,
    name: data.name || data.nome,
    owner_name: data.owner_name || data.owner || null,
    commission_percent: Number(data.commission_percent ?? data.com ?? data.comissao ?? 0),
    fixed_fee: Number(data.fixed_fee ?? data.fix ?? data.fixo ?? 0),
    subsidy: Number(data.subsidy ?? 0),
    card_fee_percent: Number(data.card_fee_percent ?? 0),
    deduct_card_fees: Boolean(data.deduct_card_fees ?? true),
    active: true,
  };
  if (data.id) return (await supabase(`stalls?id=eq.${data.id}`, { method: 'PATCH', body: JSON.stringify(payload) }))[0];
  return (await supabase('stalls', { method: 'POST', body: JSON.stringify(payload) }))[0];
}

async function saveProduct(data: any) {
  const event = await currentEvent();
  const stall = data.stall_id || data.stall || data.barraca;
  const payload = {
    event_id: event.id,
    stall_id: stall && stall !== 'todas' ? stall : null,
    name: data.name || data.nome,
    price: Number(data.price ?? data.valor ?? 0),
    scope: data.scope || (stall && stall !== 'todas' ? 'stall' : 'global'),
    active: true,
  };
  if (data.id) return (await supabase(`products?id=eq.${data.id}`, { method: 'PATCH', body: JSON.stringify(payload) }))[0];
  return (await supabase('products', { method: 'POST', body: JSON.stringify(payload) }))[0];
}

async function saveCashier(data: any) {
  const event = await currentEvent();
  const payload = {
    event_id: event.id,
    name: data.name || data.nome || 'Caixa',
    series: data.series || 'A1',
    operator_name: data.operator_name || data.operator || null,
    active: true,
  };
  if (data.id) return (await supabase(`cashiers?id=eq.${data.id}`, { method: 'PATCH', body: JSON.stringify(payload) }))[0];
  return (await supabase('cashiers', { method: 'POST', body: JSON.stringify(payload) }))[0];
}

async function deactivate(table: string, id: string) {
  if (!id) throw new Error('ID obrigatório.');
  if (table === 'events') return (await supabase(`events?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) }))[0];
  if (table === 'stalls') return (await supabase(`stalls?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }))[0];
  if (table === 'products') return (await supabase(`products?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }))[0];
  if (table === 'cashiers') return (await supabase(`cashiers?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }))[0];
  throw new Error('Tabela não permitida.');
}

export async function GET() {
  return json({ ok: true, status: supabaseUrl && supabaseKey ? 'online-ready' : 'offline-env-missing', env: envStatus });
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  try {
    if (body.action === 'status') return json({ ok: true, status: supabaseUrl && supabaseKey ? 'online-ready' : 'offline-env-missing', env: envStatus });
    if (body.action === 'bootstrap' || body.action === 'admin_list') return json(await bootstrap());

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
      const result = await rpc('consume_pos_ticket', { p_code: String(body.code || '').trim(), p_stall_id: body.stall_id });
      if (result.ticket) result.ticket = mapTicket(result.ticket);
      return json({ status: 'online', ...result });
    }

    if (body.action === 'save_event') return json({ ok: true, event: await saveEvent(body.data || body) });
    if (body.action === 'save_stall') return json({ ok: true, stall: await saveStall(body.data || body) });
    if (body.action === 'save_product') return json({ ok: true, product: await saveProduct(body.data || body) });
    if (body.action === 'save_cashier') return json({ ok: true, cashier: await saveCashier(body.data || body) });
    if (body.action === 'delete_admin') return json({ ok: true, result: await deactivate(String(body.table), String(body.id)) });

    return json({ ok: false, error: 'Ação inválida.' }, 400);
  } catch (error) {
    return json({ ok: false, status: 'offline', env: envStatus, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
