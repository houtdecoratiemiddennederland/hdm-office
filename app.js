import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://clojzlftxumfreyrsugx.supabase.co';
const SUPABASE_KEY='sb_publishable_mH67_UIYRx069mQ0PJzpvQ_HIm3eFLZ';
const EMAIL_KEY='hdm-login-email';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});

let db={customers:[],invoices:[],receipts:[],payments:[],orders:[]};
const el=id=>document.getElementById(id);
const euro=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(n||0));
const num=n=>Number(n||0)||0;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtDate=s=>{if(!s)return '—';const d=new Date(String(s).slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())?esc(s):d.toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'})};
function cloud(text,state=''){el('cloud').textContent=text;el('cloud').className='pill '+state}
function showLogin(msg=''){el('login').hidden=false;el('app').hidden=true;el('loginMsg').textContent=msg}
function showApp(){el('login').hidden=true;el('app').hidden=false}

async function login(){
  const email=el('email').value.trim(),password=el('password').value;
  if(!email||!password){el('loginMsg').textContent='Vul e-mailadres en wachtwoord in.';return}
  el('loginMsg').textContent='Inloggen…';el('loginBtn').disabled=true;
  try{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;if(!data?.session)throw new Error('Geen geldige sessie ontvangen.');localStorage.setItem(EMAIL_KEY,email);el('password').value='';await loadCloud()}
  catch(e){console.error(e);const msg=String(e?.message||e||'Inloggen mislukt');el('loginMsg').textContent=/invalid login credentials/i.test(msg)?'E-mailadres of wachtwoord klopt niet.':'Inloggen mislukt: '+msg}
  finally{el('loginBtn').disabled=false}
}
async function resume(){el('email').value=localStorage.getItem(EMAIL_KEY)||'';try{const {data,error}=await supabase.auth.getSession();if(error)throw error;if(data?.session){await loadCloud();return}}catch(e){console.error(e)}showLogin()}
async function loadCloud(){
  cloud('Cloud: laden…');
  try{const {data:{user},error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!user)throw new Error('Geen ingelogde gebruiker gevonden.');const {data:rows,error}=await supabase.from('hdm_app_state').select('data,updated_at').eq('user_id',user.id).limit(1);if(error)throw error;db=rows?.[0]?.data||{};for(const k of ['customers','invoices','receipts','payments','orders'])if(!Array.isArray(db[k]))db[k]=[];renderAll();showApp();cloud('Cloud: opgeslagen','ok')}
  catch(e){console.error(e);cloud('Cloud: fout','error');showLogin('Cloud laden mislukt: '+String(e?.message||e));throw e}
}

function invoicePaid(i){let p=num(i.paid);for(const x of db.payments||[])if(x.invoiceId===i.id)p+=num(x.amount);return Math.min(num(i.total),p)}
function q3(x){const d=String(x.month||x.date||'');return d.slice(0,4)==='2026'&&['07','08','09'].includes(d.slice(5,7))}
function vatIncl(t){return num(t)-num(t)/1.21}
function verifiedReceiptVat(r){if(r.vatReview===true)return 0;return num(r.vat)||num(r.vatAmount)||vatIncl(r.total)}
function reviewReceipts(){return (db.receipts||[]).filter(r=>q3(r)&&r.vatReview===true)}
function receiptSignature(r){return [String(r.date||r.month||'').slice(0,10),num(r.total).toFixed(2),String(r.supplier||'').trim().toLowerCase()].join('|')}
function duplicateReceiptCount(){const seen=new Set();let dup=0;for(const r of db.receipts||[]){const s=receiptSignature(r);if(seen.has(s))dup++;else seen.add(s)}return dup}
function trueDeposits(){const inv=db.invoices||[],pay=db.payments||[];let total=inv.reduce((a,i)=>a+(i.depositRecognized?num(i.paid):0),0);total+=pay.filter(p=>p.type==='Aanbetaling'&&!inv.some(i=>i.id===p.invoiceId&&i.depositRecognized)).reduce((a,p)=>a+num(p.amount),0);return total}

function renderDashboard(){
  const inv=db.invoices||[],rec=db.receipts||[];
  const revenue=inv.reduce((a,i)=>a+num(i.total),0),open=inv.reduce((a,i)=>a+Math.max(0,num(i.total)-invoicePaid(i)),0),costs=rec.reduce((a,r)=>a+num(r.total),0),vatReceipts=rec.filter(q3).reduce((a,r)=>a+verifiedReceiptVat(r),0),vatInvoices=inv.filter(q3).reduce((a,i)=>a+(num(i.vatAmount)||vatIncl(i.total)),0);
  const cards=[['Omzet facturen',euro(revenue)],['Openstaande facturen',euro(open)],['Inkoopkosten',euro(costs)],['BTW bonnetjes · Q3',euro(vatReceipts)],['BTW klantfacturen · Q3',euro(vatInvoices)],['BTW-bonnen te controleren',reviewReceipts().length+' bonnen'],['Mogelijke dubbele bonnen',duplicateReceiptCount()+' bonnen'],['Aanbetalingen ontvangen',euro(trueDeposits())],['Loon beschikbaar · 60%',euro(open*.60)],['Inkomstenbelasting · 30%',euro(open*.30)],['Materiaalkosten · 10%',euro(open*.10)]];
  el('dashboard').innerHTML=cards.map(c=>'<div class="card metric"><small>'+c[0]+'</small><strong>'+c[1]+'</strong></div>').join('')
}
function monthOptions(items){const vals=[...new Set(items.map(x=>String(x.month||x.date||'').slice(0,7)).filter(v=>/^\d{4}-\d{2}$/.test(v)))].sort().reverse();return '<option value="">Alle maanden</option>'+vals.map(v=>'<option value="'+v+'">'+new Date(v+'-01T12:00:00').toLocaleDateString('nl-NL',{month:'long',year:'numeric'})+'</option>').join('')}
function customerOrder(c){const rows=(db.orders||[]).filter(o=>o.customerId===c.id);if(!rows.length)return null;return rows.sort((a,b)=>String(b.due||b.month||'').localeCompare(String(a.due||a.month||'')))[0]}
function renderCustomers(){
  const m=el('customerMonth').value;
  const rows=(db.customers||[]).filter(c=>!m||String(c.month||c.date||'').startsWith(m));
  el('customersBody').innerHTML=rows.map(c=>{const o=customerOrder(c);return '<tr><td>'+esc(c.name||'')+'</td><td class="wrapcell">'+esc(o?.product||c.product||c.description||'—')+'</td><td>'+fmtDate(o?.due||c.due||c.deliveryDate||'')+'</td></tr>'}).join('')||'<tr><td colspan="3">Geen klanten gevonden.</td></tr>'
}
function renderInvoices(){const m=el('invoiceMonth').value;const rows=(db.invoices||[]).filter(i=>!m||String(i.date||i.month||'').startsWith(m));el('invoicesBody').innerHTML=rows.map(i=>{const p=invoicePaid(i),o=Math.max(0,num(i.total)-p),v=num(i.vatAmount)||vatIncl(i.total);return '<tr><td>'+esc(i.number||'')+'</td><td>'+esc(i.customerName||'')+'</td><td>'+esc(i.date||'')+'</td><td>'+euro(i.total)+'</td><td>'+euro(p)+'</td><td>'+euro(o)+'</td><td>'+euro(v)+'</td></tr>'}).join('')||'<tr><td colspan="7">Geen facturen gevonden.</td></tr>'}
function renderReceipts(){const m=el('receiptMonth').value;const rows=(db.receipts||[]).filter(r=>!m||String(r.date||r.month||'').startsWith(m));el('receiptsBody').innerHTML=rows.map(r=>{const vat=r.vatReview===true?'CONTROLEREN':euro(verifiedReceiptVat(r));return '<tr><td>'+esc(r.date||'')+'</td><td>'+esc(r.supplier||'')+'</td><td>'+esc(r.category||'')+'</td><td>'+euro(r.total)+'</td><td>'+vat+'</td></tr>'}).join('')||'<tr><td colspan="5">Geen bonnen gevonden.</td></tr>'}
function renderBook(){const inv=(db.invoices||[]).filter(q3),rec=(db.receipts||[]).filter(q3),sales=inv.reduce((a,i)=>a+num(i.total),0),vatOut=inv.reduce((a,i)=>a+(num(i.vatAmount)||vatIncl(i.total)),0),vatIn=rec.reduce((a,r)=>a+verifiedReceiptVat(r),0),review=reviewReceipts().length;el('bookCards').innerHTML=[['Omzet Q3',euro(sales)],['BTW klantfacturen Q3',euro(vatOut)],['BTW bonnetjes Q3 · gecontroleerd',euro(vatIn)],['BTW-bonnen te controleren',review+' bonnen']].map(c=>'<div class="card metric"><small>'+c[0]+'</small><strong>'+c[1]+'</strong></div>').join('');el('bookText').innerHTML='BTW klantfacturen Q3: <strong>'+euro(vatOut)+'</strong><br><br>Gecontroleerde BTW bonnetjes Q3: <strong>'+euro(vatIn)+'</strong><br><br>Voorlopig verschil: <strong>'+euro(vatOut-vatIn)+'</strong>'}
function renderAll(){el('customerMonth').innerHTML=monthOptions(db.customers||[]);el('invoiceMonth').innerHTML=monthOptions(db.invoices||[]);el('receiptMonth').innerHTML=monthOptions(db.receipts||[]);renderDashboard();renderCustomers();renderInvoices();renderReceipts();renderBook()}

el('loginBtn').addEventListener('click',login);el('password').addEventListener('keydown',e=>{if(e.key==='Enter')login()});el('customerMonth').addEventListener('change',renderCustomers);el('invoiceMonth').addEventListener('change',renderInvoices);el('receiptMonth').addEventListener('change',renderReceipts);
document.querySelectorAll('.bottomnav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.bottomnav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));el(b.dataset.page).classList.add('active');window.scrollTo(0,0)}));
supabase.auth.onAuthStateChange((event,activeSession)=>{if(event==='SIGNED_OUT')showLogin();else if(event==='TOKEN_REFRESHED'&&activeSession)cloud('Cloud: opgeslagen','ok')});
resume();