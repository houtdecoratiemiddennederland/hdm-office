import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://clojzlftxumfreyrsugx.supabase.co';
const SUPABASE_KEY='sb_publishable_mH67_UIYRx069mQ0PJzpvQ_HIm3eFLZ';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});

const num=n=>Number(n||0)||0;
const euro=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(num(n));
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>new Date().toISOString().slice(0,10);

function invoicePaid(invoice,payments){
  let paid=num(invoice.paid);
  for(const p of payments||[]) if(p.invoiceId===invoice.id) paid+=num(p.amount);
  return Math.min(num(invoice.total),paid);
}

async function loadState(){
  const {data:{user},error:uerr}=await supabase.auth.getUser();
  if(uerr||!user) throw uerr||new Error('Geen ingelogde gebruiker');
  const {data:rows,error}=await supabase.from('hdm_app_state').select('data').eq('user_id',user.id).limit(1);
  if(error) throw error;
  const state=rows?.[0]?.data||{};
  if(!Array.isArray(state.invoices)) state.invoices=[];
  if(!Array.isArray(state.payments)) state.payments=[];
  return {user,state};
}

async function saveState(user,state){
  const {error}=await supabase.from('hdm_app_state').update({data:state,updated_at:new Date().toISOString()}).eq('user_id',user.id);
  if(error) throw error;
}

function normalizeText(s){return String(s||'').trim().replace(/\s+/g,' ').toLowerCase()}

function findInvoiceForRow(row,state){
  const cells=[...row.querySelectorAll('td')];
  if(cells.length<2) return null;
  const number=normalizeText(cells[0].textContent);
  const customer=normalizeText(cells[1].textContent);
  let matches=state.invoices.filter(i=>normalizeText(i.number)===number);
  if(matches.length===1) return matches[0];
  if(matches.length>1){
    const byCustomer=matches.find(i=>normalizeText(i.customerName)===customer);
    if(byCustomer) return byCustomer;
  }
  matches=state.invoices.filter(i=>normalizeText(i.customerName)===customer);
  return matches.length===1?matches[0]:null;
}

async function markPaid(row,button){
  try{
    button.disabled=true;
    button.textContent='Verwerken…';
    const {user,state}=await loadState();
    const invoice=findInvoiceForRow(row,state);
    if(!invoice) throw new Error('Factuur kon niet worden gevonden.');
    const paid=invoicePaid(invoice,state.payments);
    const remaining=Math.max(0,num(invoice.total)-paid);
    if(remaining<=0){button.textContent='Betaald ✓';button.classList.add('paid-done');return}
    if(!confirm(`Factuur ${invoice.number||''} van ${invoice.customerName||'deze klant'} als volledig betaald markeren?\n\nTe verwerken betaling: ${euro(remaining)}`)){
      button.disabled=false;button.textContent='Betaald';return;
    }
    state.payments.push({id:id(),invoiceId:invoice.id,amount:remaining,type:'Betaling',date:today(),source:'Facturen · Betaald-knop'});
    await saveState(user,state);
    button.textContent='Betaald ✓';button.classList.add('paid-done');button.disabled=true;
    window.dispatchEvent(new CustomEvent('hdm:payment-saved',{detail:{invoiceId:invoice.id}}));
  }catch(e){
    console.error(e);alert('Betaling verwerken lukt niet: '+String(e?.message||e));button.disabled=false;button.textContent='Betaald';
  }
}

async function decorateInvoiceRows(){
  const body=document.getElementById('invoicesBody');
  if(!body) return;
  let state;
  try{({state}=await loadState())}catch{return}
  const headRow=body.closest('table')?.querySelector('thead tr');
  if(headRow&&!headRow.querySelector('.payment-head')){
    const th=document.createElement('th');th.className='payment-head';th.textContent='Betaling';headRow.appendChild(th);
  }
  [...body.querySelectorAll('tr')].forEach(row=>{
    if(row.querySelector('.payment-cell')) return;
    const invoice=findInvoiceForRow(row,state);
    if(!invoice) return;
    const td=document.createElement('td');td.className='payment-cell';
    const button=document.createElement('button');button.type='button';button.className='pay-btn';
    const remaining=Math.max(0,num(invoice.total)-invoicePaid(invoice,state.payments));
    if(remaining<=0){button.textContent='Betaald ✓';button.disabled=true;button.classList.add('paid-done')}
    else{button.textContent='Betaald';button.title=`Nog openstaand: ${euro(remaining)}`;button.onclick=()=>markPaid(row,button)}
    td.appendChild(button);row.appendChild(td);
  });
}

const body=document.getElementById('invoicesBody');
if(body){
  new MutationObserver(()=>decorateInvoiceRows()).observe(body,{childList:true,subtree:true});
  decorateInvoiceRows();
}
document.getElementById('invoiceMonth')?.addEventListener('change',()=>setTimeout(decorateInvoiceRows,0));
