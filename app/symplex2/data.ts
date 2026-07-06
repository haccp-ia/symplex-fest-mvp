export type Role='admin'|'financeiro'|'caixa'|'barraca';
export type User={id?:string;name:string;email:string;role:Role;stall?:string;active?:boolean};
export type Stall={id:string;name:string;owner?:string;com?:number;fix?:number};
export type Item={id:string;name:string;price:number;stall:string;kind?:'produto'|'ticket'};
export type Cashier={id:string;name:string;series?:string;operator?:string};
export type Ticket={id:string;code:string;token:string;item:string;stall:string;v:number;st:'vendido'|'consumido'|'cancelado';qr?:string;used?:string;pay?:string};
export type Data={online:boolean;brand:{name:string;sub:string;sig:string};mode:'produtos'|'tickets';users:User[];stalls:Stall[];items:Item[];cashiers:Cashier[];tickets:Ticket[];logs:any[];channels:{whatsapp:boolean;sms:boolean;email:boolean}};
export const K='symplex-fest-v12',KU='symplex-user-v12';
export const money=(v:number)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const id=()=>Math.random().toString(36).slice(2,9).toUpperCase();
export const seed:Data={online:false,brand:{name:'Symplex Fest',sub:'Bilheteira e controlo para festivais',sig:'SF'},mode:'produtos',users:[{name:'Paulo',email:'admin@example.test',role:'admin',active:true},{name:'Caixa',email:'caixa@example.test',role:'caixa',active:true},{name:'Bebidas',email:'bebidas@example.test',role:'barraca',stall:'bebidas',active:true},{name:'Financeiro',email:'financeiro@example.test',role:'financeiro',active:true}],stalls:[{id:'bebidas',name:'Bebidas',com:12,fix:0},{id:'pastel',name:'Pastel',com:0,fix:300}],items:[{id:'cerveja',name:'Cerveja 600 ml',price:15,stall:'bebidas',kind:'produto'},{id:'pastel',name:'Pastel de carne',price:12,stall:'pastel',kind:'produto'},{id:'ticket10',name:'Ticket R$ 10',price:10,stall:'todas',kind:'ticket'}],cashiers:[{id:'caixa01',name:'Caixa 01',series:'A1',operator:'Caixa'}],tickets:[],logs:[],channels:{whatsapp:false,sms:false,email:false}};
export function load():Data{try{let x=JSON.parse(localStorage.getItem(K)||'{}');return {...seed,...x,brand:{...seed.brand,...(x.brand||{})},channels:{...seed.channels,...(x.channels||{})}}}catch{return seed}}
export function store(d:Data){localStorage.setItem(K,JSON.stringify(d))}
export async function api(action:string, body:any={}){let r=await fetch('/api/symplex',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})});let j=await r.json();if(!r.ok||j.ok===false)throw Error(j.error||j.message||'Erro no backend');return j}
export async function makeQr(s:string){let Q=await import('qrcode');return Q.toDataURL(s,{width:280,margin:2,errorCorrectionLevel:'M'})}
export function normTicket(x:any, item?:Item):Ticket{return {id:x.id||id(),code:x.public_code||x.code||x.codigo||x.secure_code||id(),token:x.qr_payload||x.secure_code||x.token||id(),item:item?.name||x.product_name||x.item||'Ticket',stall:item?.stall||x.allowed_stall_id||x.stall||'todas',v:Number(x.value||x.price||item?.price||0),st:x.status==='consumed'?'consumido':x.status==='cancelled'?'cancelado':'vendido',pay:x.payment_method||x.pay}}
export function lbl(x:string){return({painel:'Painel',caixa:'Caixa',barraca:'Barraca',financeiro:'Financeiro',gestao:'Gestão',perfil:'Perfil',admin:'Admin'} as any)[x]||x}
export function ico(x:string){return({painel:'▣',caixa:'◈',barraca:'◎',financeiro:'$',gestao:'⚙',perfil:'👤'} as any)[x]||'•'}
export function gl(x:string){return({config:'Configuração',events:'Eventos',stalls:'Barracas',items:'Tickets/Produtos',users:'Utilizadores',cashiers:'Caixas',integrations:'Integrações'} as any)[x]||x}
export function fl(x:string){return({resumo:'Resumo',caixas:'Caixas',movimentos:'Sangrias/Reforços',repasses:'Repasses',relatorios:'Relatórios',auditoria:'Auditoria',exportacoes:'Exportações',name:'Nome',place:'Local',sales_mode:'Modo de venda',owner:'Responsável',com:'Comissão (%)',fix:'Valor fixo',price:'Preço',stall:'Barraca',series:'Série',operator:'Operador'} as any)[x]||x}
