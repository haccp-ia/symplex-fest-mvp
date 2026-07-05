'use client';

import { useEffect, useMemo, useState } from 'react';

const EVENT_ID = '00000000-0000-0000-0000-000000000101';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mcayepsmvtkpzenqdmba.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_iPMTwelOvvnAYOJoeyMUlg_zogChO2u';
const API_URL = `${SUPABASE_URL}/functions/v1/symplex-api`;

type Row = Record<string, any>;

async function callApi(action: string, payload: Row = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ action, eventId: EVENT_ID, ...payload }),
  });
  const data = await res.json();
  if (!res.ok || data?.ok === false) throw new Error(data?.error || data?.message || 'Erro na API');
  return data;
}

function money(v: any) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Home() {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState<Row>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cashierId, setCashierId] = useState('');
  const [stallId, setStallId] = useState('');
  const [productId, setProductId] = useState('');
  const [mode, setMode] = useState<'value' | 'product'>('value');
  const [value, setValue] = useState(10);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentFee, setPaymentFee] = useState(0);
  const [qrPayload, setQrPayload] = useState('');
  const [lastTicket, setLastTicket] = useState<Row | null>(null);
  const [consumeResult, setConsumeResult] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const boot = await callApi('bootstrap');
      setData(boot);
      setCashierId((x) => x || boot.cashiers?.[0]?.id || '');
      setStallId((x) => x || boot.stalls?.[0]?.id || '');
      setProductId((x) => x || boot.products?.[0]?.id || '');
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cashier = useMemo(() => data.cashiers?.find((c: Row) => c.id === cashierId), [data.cashiers, cashierId]);
  const product = useMemo(() => data.products?.find((p: Row) => p.id === productId), [data.products, productId]);
  const dashboard = data.dashboard || {};
  const settlements = data.settlements || [];
  const tickets = data.recentTickets || [];

  async function sell() {
    try {
      const sold = await callApi('sell', { cashierId, series: cashier?.series, value: mode === 'value' ? value : 0, productId: mode === 'product' ? productId : null, paymentMethod, paymentFee });
      setLastTicket(sold.ticket);
      setQrPayload(sold.ticket?.qr_payload || '');
      await load();
    } catch (e: any) { setError(e.message || String(e)); }
  }

  async function consume() {
    try {
      const result = await callApi('consume', { qrPayload, stallId });
      setConsumeResult(result);
      await load();
    } catch (e: any) { setError(e.message || String(e)); }
  }

  return <main className="layout">
    <aside className="sidebar">
      <div className="brand"><div className="logo">SF</div><div><b>Symplex Fest</b><span>MVP funcional</span></div></div>
      {['dashboard','caixa','barraca','financeiro','eventos','logs'].map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
      <div className="side-note">Tickets QR, caixa, barracas, comissão, taxa de cartão e repasse líquido.</div>
    </aside>

    <section className="content">
      <header className="topbar"><div><h1>{tab.toUpperCase()}</h1><p>Festa Julina 2026 · Supabase Symplex Fest</p></div><button className="btn secondary" onClick={load}>{loading ? 'Atualizando...' : 'Atualizar'}</button></header>
      {error && <div className="alert">{error}</div>}

      {tab === 'dashboard' && <>
        <div className="metrics-grid">
          <Metric title="Total vendido" value={money(dashboard.total_sold)} />
          <Metric title="Consumido" value={money(dashboard.total_consumed)} />
          <Metric title="Pendentes" value={dashboard.tickets_pending || 0} />
          <Metric title="Ticket médio" value={money(dashboard.average_ticket)} />
        </div>
        <div className="grid-2"><Card title="Repasse por barraca"><Settlement rows={settlements} /></Card><Card title="Tickets recentes"><TicketList rows={tickets} pick={(t) => { setQrPayload(t.qr_payload); setTab('barraca'); }} /></Card></div>
      </>}

      {tab === 'caixa' && <div className="grid-2"><Card title="Venda no caixa">
        <label>Caixa</label><select value={cashierId} onChange={(e) => setCashierId(e.target.value)}>{data.cashiers?.map((c: Row) => <option key={c.id} value={c.id}>{c.name} · Série {c.series}</option>)}</select>
        <div className="toggle"><button className={mode === 'value' ? 'active' : ''} onClick={() => setMode('value')}>Valor</button><button className={mode === 'product' ? 'active' : ''} onClick={() => setMode('product')}>Produto</button></div>
        {mode === 'value' ? <div className="value-grid">{[5,10,20,50].map((v) => <button key={v} className={value === v ? 'active' : ''} onClick={() => setValue(v)}>{money(v)}</button>)}</div> : <><label>Produto</label><select value={productId} onChange={(e) => setProductId(e.target.value)}>{data.products?.map((p: Row) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)} · {p.stalls?.name}</option>)}</select></>}
        <label>Pagamento</label><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="debit">Débito</option><option value="credit">Crédito</option><option value="other">Outro</option></select>
        <label>Taxa cartão/pagamento</label><input type="number" step="0.01" value={paymentFee} onChange={(e) => setPaymentFee(Number(e.target.value))} />
        <button className="btn" onClick={sell}>Vender e gerar ticket</button>
      </Card><Card title="Ticket gerado">{lastTicket ? <Ticket ticket={lastTicket} product={product} /> : <p className="muted">Venda um ticket para aparecer aqui.</p>}</Card></div>}

      {tab === 'barraca' && <div className="grid-2"><Card title="Validação na barraca">
        <label>Barraca</label><select value={stallId} onChange={(e) => setStallId(e.target.value)}>{data.stalls?.map((s: Row) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <label>QR payload / código</label><textarea value={qrPayload} onChange={(e) => setQrPayload(e.target.value)} />
        <button className="btn" onClick={consume}>Consumir ticket</button>
        {consumeResult && <div className={`result ${consumeResult.ok ? 'ok' : 'bad'}`}><b>{consumeResult.ok ? 'PODE ACEITAR' : 'NÃO ACEITAR'}</b><span>{consumeResult.message}</span><small>{consumeResult.public_code}</small></div>}
      </Card><Card title="Tickets recentes"><TicketList rows={tickets} pick={(t) => setQrPayload(t.qr_payload)} /></Card></div>}

      {tab === 'financeiro' && <div className="grid-2"><Card title="Regras das barracas"><Rules rows={data.stalls || []} /></Card><Card title="Repasse líquido"><Settlement rows={settlements} /></Card></div>}
      {tab === 'eventos' && <div className="grid-2"><Card title="Eventos"><pre>{JSON.stringify(data.events || [], null, 2)}</pre></Card><Card title="Produtos"><Rules rows={data.products || []} /></Card></div>}
      {tab === 'logs' && <Card title="Auditoria"><pre>{JSON.stringify(data.logs || [], null, 2)}</pre></Card>}
    </section>
  </main>;
}

function Metric({ title, value }: { title: string; value: any }) { return <div className="metric"><span>{title}</span><strong>{value}</strong></div>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="card"><h2>{title}</h2>{children}</section>; }
function Settlement({ rows }: { rows: Row[] }) { if (!rows?.length) return <p className="muted">Sem dados.</p>; return <table><thead><tr><th>Barraca</th><th>Bruto</th><th>Comissão</th><th>Taxas</th><th>Líquido</th></tr></thead><tbody>{rows.map((r) => <tr key={r.stall_id}><td>{r.stall_name}</td><td>{money(r.gross_consumed)}</td><td>{money(r.organization_commission)}</td><td>{money(r.card_fees_to_deduct)}</td><td><b>{money(r.net_payout)}</b></td></tr>)}</tbody></table>; }
function TicketList({ rows, pick }: { rows: Row[]; pick: (row: Row) => void }) { if (!rows?.length) return <p className="muted">Sem tickets vendidos.</p>; return <div className="ticket-list">{rows.map((t) => <button key={t.id} onClick={() => pick(t)}><b>{t.public_code}</b><span>{money(t.value)} · {t.status} · {t.payment_method || '-'}</span></button>)}</div>; }
function Ticket({ ticket, product }: { ticket: Row; product?: Row }) { return <div className="paper"><strong>SYMPLEX FEST</strong><span>{ticket.public_code}</span><div className="fake-qr">QR</div><b>{money(ticket.value)}</b><span>{product?.name || 'Ticket por valor'}</span><small>{ticket.qr_payload}</small></div>; }
function Rules({ rows }: { rows: Row[] }) { return <div className="rules">{rows.map((r) => <div key={r.id} className="rule"><b>{r.name}</b><span>{r.price ? money(r.price) : `Comissão ${Number(r.commission_percent || 0).toFixed(1)}% · Fixo ${money(r.fixed_fee)}`}</span></div>)}</div>; }
