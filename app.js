import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL=window.location.origin+'/supabase';
const SUPABASE_KEY='sb_publishable_mH67_UIYRx069mQ0PJzpvQ_HIm3eFLZ';
const EMAIL_KEY='hdm-login-email';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
let db={customers:[],invoices:[],receipts:[],payments:[],orders:[],mileageTrips:[]},currentUser=null,lastInvoiceText='',lastReceiptText='',lastInvoiceFile='',lastReceiptFile='',pendingInvoiceFile=null,pendingReceiptFile=null;
const el=id=>document.getElementById(id);const num=n=>Number(n||0)||0;const euro=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(num(n));const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtDate=s=>{if(!s)return'—';const d=new Date(String(s).slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())?esc(s):d.toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'})};
function cloud(t,s=''){el('cloud').textContent=t;el('cloud').className='pill '+s}function showLogin(m=''){el('login').hidden=false;el('app').hidden=true;el('loginMsg').textContent=m}function showApp(){el('login').hidden=true;el('app').hidden=false}
async function login(){const email=el('email').value.trim(),password=el('password').value;if(!email||!password){el('loginMsg').textContent='Vul e-mailadres en wachtwoord in.';return}el('loginMsg').textContent='Inloggen…';el('loginBtn').disabled=true;try{const{data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;localStorage.setItem(EMAIL_KEY,email);el('password').value='';await loadCloud()}catch(e){el('loginMsg').textContent=/invalid login credentials/i.test(String(e.message))?'E-mailadres of wachtwoord klopt niet.':'Inloggen mislukt: '+e.message}finally{el('loginBtn').disabled=false}}
async function resume(){el('email').value=localStorage.getItem(EMAIL_KEY)||'';try{const{data}=await supabase.auth.getSession();if(data?.session){await loadCloud();return}}catch{}showLogin()}
async function loadCloud(){cloud('Cloud: laden…');try{const{data:{user},error:uerr}=await supabase.auth.getUser();if(uerr||!user)throw uerr||new Error('Geen gebruiker');currentUser=user;const{data:rows,error}=await supabase.from('hdm_app_state').select('data').eq('user_id',user.id).limit(1);if(error)throw error;db=rows?.[0]?.data||{};for(const k of['customers','invoices','receipts','payments','orders','mileageTrips'])if(!Array.isArray(db[k]))db[k]=[];renderAll();showApp();cloud('Cloud: opgeslagen','ok')}catch(e){cloud('Cloud: fout','error');showLogin('Cloud laden mislukt: '+e.message)}}
async function saveCloud(){if(!currentUser)return;cloud('Cloud: opslaan…');const{error}=await supabase.from('hdm_app_state').update({data:db,updated_at:new Date().toISOString()}).eq('user_id',currentUser.id);if(error){cloud('Cloud: fout','error');throw error}cloud('Cloud: opgeslagen','ok')}
function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function safeUploadName(name){return String(name||'bestand').normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(-140)||'bestand'}
async function uploadAttachment(file,kind,recordId){
  if(!file)return null;
  if(!currentUser)throw new Error('Je bent niet ingelogd.');
  const fileName=safeUploadName(file.name);
  const filePath=`${currentUser.id}/${kind}/${recordId}/${Date.now()}-${fileName}`;
  const options={cacheControl:'3600',upsert:false};
  if(file.type)options.contentType=file.type;
  const {error}=await supabase.storage.from('hdm-documents').upload(filePath,file,options);
  if(error)throw error;
  return{filePath,fileName:file.name||fileName,fileType:file.type||'',fileSize:Number(file.size||0)};
}
async function openStoredDocument(path){
  if(!path)return;
  const popup=window.open('about:blank','_blank');
  try{
    const {data,error}=await supabase.storage.from('hdm-documents').createSignedUrl(path,3600);
    if(error)throw error;
    if(popup)popup.location.href=data.signedUrl;else window.location.href=data.signedUrl;
  }catch(e){
    if(popup)popup.close();
    alert('Bestand openen lukt niet: '+String(e?.message||e));
  }
}function invoicePaid(i){let p=num(i.paid);for(const x of db.payments||[])if(x.invoiceId===i.id)p+=num(x.amount);return Math.min(num(i.total),p)}function q3(x){const d=String(x.month||x.date||'');return d.slice(0,4)==='2026'&&['07','08','09'].includes(d.slice(5,7))}function vatIncl(t){return num(t)-num(t)/1.21}function verifiedReceiptVat(r){return r.vatReview===true?0:(num(r.vat)||num(r.vatAmount)||vatIncl(r.total))}function reviewReceipts(){return(db.receipts||[]).filter(r=>q3(r)&&r.vatReview===true)}function receiptSignature(r){return[String(r.date||'').slice(0,10),num(r.total).toFixed(2),String(r.supplier||'').trim().toLowerCase()].join('|')}function duplicateReceiptCount(){const s=new Set();let d=0;for(const r of db.receipts||[]){const x=receiptSignature(r);if(s.has(x))d++;else s.add(x)}return d}function trueDeposits(){const inv=db.invoices||[],pay=db.payments||[];let t=inv.reduce((a,i)=>a+(i.depositRecognized?num(i.paid):0),0);t+=pay.filter(p=>p.type==='Aanbetaling'&&!inv.some(i=>i.id===p.invoiceId&&i.depositRecognized)).reduce((a,p)=>a+num(p.amount),0);return t}
function monthOptions(items){const vals=[...new Set(items.map(x=>String(x.month||x.date||'').slice(0,7)).filter(v=>/^\d{4}-\d{2}$/.test(v)))].sort().reverse();return'<option value="">Alle maanden</option>'+vals.map(v=>'<option value="'+v+'">'+new Date(v+'-01T12:00:00').toLocaleDateString('nl-NL',{month:'long',year:'numeric'})+'</option>').join('')}
function renderDashboard(){const inv=db.invoices||[],rec=db.receipts||[],revenue=inv.reduce((a,i)=>a+num(i.total),0),open=inv.reduce((a,i)=>a+Math.max(0,num(i.total)-invoicePaid(i)),0),costs=rec.reduce((a,r)=>a+num(r.total),0),vatR=rec.filter(q3).reduce((a,r)=>a+verifiedReceiptVat(r),0),vatI=inv.filter(q3).reduce((a,i)=>a+(num(i.vatAmount)||vatIncl(i.total)),0),q3Sales=inv.filter(q3).reduce((a,i)=>a+num(i.total),0);const cards=[['Omzet Q3 2026',euro(q3Sales)],['Omzet facturen',euro(revenue)],['Openstaande facturen',euro(open)],['Inkoopkosten',euro(costs)],['BTW bonnetjes · Q3',euro(vatR)],['BTW klantfacturen · Q3',euro(vatI)],['BTW-bonnen te controleren',reviewReceipts().length+' bonnen'],['Mogelijke dubbele bonnen',duplicateReceiptCount()+' bonnen'],['Aanbetalingen ontvangen',euro(trueDeposits())],['Loon beschikbaar · 60%',euro(open*.60)],['Inkomstenbelasting · 30%',euro(open*.30)],['Materiaalkosten · 10%',euro(open*.10)]];el('dashboard').innerHTML=cards.map(c=>'<div class="card metric"><small>'+c[0]+'</small><strong>'+c[1]+'</strong></div>').join('')}
function customerOrder(c){const rows=(db.orders||[]).filter(o=>o.customerId===c.id);return rows.sort((a,b)=>String(b.due||'').localeCompare(String(a.due||'')))[0]||null}
function renderCustomers(){const m=el('customerMonth').value;const rows=(db.customers||[]).filter(c=>!m||String(c.month||c.date||'').startsWith(m));el('customersBody').innerHTML=rows.map(c=>{const o=customerOrder(c);return'<tr><td>'+esc(c.name||'')+'</td><td class="wrapcell">'+esc(o?.product||c.product||c.description||'—')+'</td><td>'+fmtDate(o?.due||c.due||c.deliveryDate||'')+'</td></tr>'}).join('')||'<tr><td colspan="3">Geen klanten gevonden.</td></tr>'}
function renderInvoices(){const m=el('invoiceMonth').value;const rows=(db.invoices||[]).filter(i=>!m||String(i.date||'').startsWith(m));el('invoicesBody').innerHTML=rows.map(i=>{const p=invoicePaid(i),o=Math.max(0,num(i.total)-p),v=num(i.vatAmount)||vatIncl(i.total),file=i.filePath?'<button type="button" class="doc-open" data-doc-path="'+esc(i.filePath)+'">📎 Bestand</button>':'—';return'<tr data-invoice-id="'+esc(i.id||'')+'"><td>'+esc(i.number||'')+'</td><td>'+esc(i.customerName||'')+'</td><td>'+fmtDate(i.date)+'</td><td>'+euro(i.total)+'</td><td>'+euro(p)+'</td><td>'+euro(o)+'</td><td>'+euro(v)+'</td><td>'+file+'</td></tr>'}).join('')||'<tr><td colspan="8">Geen facturen gevonden.</td></tr>'}
function renderReceipts(){const m=el('receiptMonth').value;const rows=(db.receipts||[]).filter(r=>!m||String(r.date||'').startsWith(m));el('receiptsBody').innerHTML=rows.map(r=>{const file=r.filePath?'<button type="button" class="doc-open" data-doc-path="'+esc(r.filePath)+'">📎 Bestand</button>':'—';return'<tr data-receipt-id="'+esc(r.id||'')+'"><td>'+fmtDate(r.date)+'</td><td>'+esc(r.supplier||'')+'</td><td>'+esc(r.category||'')+'</td><td>'+euro(r.total)+'</td><td>'+(r.vatReview?'CONTROLEREN':euro(verifiedReceiptVat(r)))+'</td><td>'+file+'</td></tr>'}).join('')||'<tr><td colspan="6">Geen bonnen gevonden.</td></tr>'}
function renderMileage(){
  const trips=(db.mileageTrips||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const year=String(new Date().getFullYear());
  const total=trips.reduce((a,t)=>a+num(t.km),0);
  const yearTotal=trips.filter(t=>String(t.date||'').startsWith(year+'-')).reduce((a,t)=>a+num(t.km),0);
  el('mileageCards').innerHTML=[
    ['Totaal zakelijke km',total.toLocaleString('nl-NL',{maximumFractionDigits:1})+' km'],
    ['Zakelijke km '+year,yearTotal.toLocaleString('nl-NL',{maximumFractionDigits:1})+' km'],
    ['Aantal ritten',trips.length]
  ].map(x=>'<div class="card metric"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('');
  const month=el('mileageMonth')?.value||'';
  const filtered=month?trips.filter(t=>String(t.date||'').startsWith(month)):trips;
  el('mileageBody').innerHTML=filtered.map(t=>'<tr><td>'+fmtDate(t.date)+'</td><td><strong>'+num(t.km).toLocaleString('nl-NL',{maximumFractionDigits:1})+' km</strong></td><td class="wrapcell">'+esc(t.description||'—')+'</td><td><button type="button" class="mileage-delete" data-mileage-id="'+esc(t.id||'')+'">Verwijder</button></td></tr>').join('')||'<tr><td colspan="4">Nog geen zakelijke kilometers ingevoerd.</td></tr>';
  if(el('mileageMonth')){
    const current=el('mileageMonth').value;
    el('mileageMonth').innerHTML=monthOptions(trips.map(t=>({date:t.date})));
    el('mileageMonth').value=current;
  }
}
async function saveMileage(){
  const date=el('mDate').value,km=num(el('mKm').value),description=el('mDescription').value.trim();
  if(!date){alert('Vul de datum van de rit in.');return}
  if(km<=0){alert('Vul het aantal zakelijke kilometers in.');return}
  db.mileageTrips.push({id:id(),date,month:date.slice(0,7),km:Number(km.toFixed(1)),description});
  await saveCloud();
  el('mDate').value=new Date().toISOString().slice(0,10);
  el('mKm').value='';
  el('mDescription').value='';
  renderMileage();
}
async function deleteMileage(idValue){
  const trip=(db.mileageTrips||[]).find(t=>String(t.id)===String(idValue));
  if(!trip)return;
  if(!confirm('Deze rit van '+fmtDate(trip.date)+' ('+num(trip.km).toLocaleString('nl-NL',{maximumFractionDigits:1})+' km) verwijderen?'))return;
  db.mileageTrips=db.mileageTrips.filter(t=>String(t.id)!==String(idValue));
  await saveCloud();
  renderMileage();
}
function renderBook(){const inv=(db.invoices||[]).filter(q3),rec=(db.receipts||[]).filter(q3),sales=inv.reduce((a,i)=>a+num(i.total),0),vatOut=inv.reduce((a,i)=>a+(num(i.vatAmount)||vatIncl(i.total)),0),vatIn=rec.reduce((a,r)=>a+verifiedReceiptVat(r),0);const quarterEl=el('quarterCards');if(quarterEl)quarterEl.innerHTML=[['Q3 2026 · juli–september',euro(sales)]].map(c=>'<div class="card metric"><small>'+c[0]+'</small><strong>'+c[1]+'</strong></div>').join('');el('bookCards').innerHTML=[['BTW klantfacturen Q3',euro(vatOut)],['BTW bonnetjes Q3',euro(vatIn)],['BTW-bonnen te controleren',reviewReceipts().length+' bonnen']].map(c=>'<div class="card metric"><small>'+c[0]+'</small><strong>'+c[1]+'</strong></div>').join('');el('bookText').innerHTML='Omzet Q3 2026: <strong>'+euro(sales)+'</strong><br><br>BTW klantfacturen Q3: <strong>'+euro(vatOut)+'</strong><br><br>BTW bonnetjes Q3: <strong>'+euro(vatIn)+'</strong><br><br>Verschil: <strong>'+euro(vatOut-vatIn)+'</strong>'}
function renderAll(){el('customerMonth').innerHTML=monthOptions(db.customers||[]);el('invoiceMonth').innerHTML=monthOptions(db.invoices||[]);el('receiptMonth').innerHTML=monthOptions(db.receipts||[]);renderDashboard();renderCustomers();renderInvoices();renderReceipts();renderMileage();renderBook()}
function parseEuro(s){if(!s)return'';return s.replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'')}function findMoney(text,labels){for(const l of labels){const re=new RegExp(l+'[^€\\d]{0,30}€?\\s*([0-9.]+,[0-9]{2})','i'),m=text.match(re);if(m)return parseEuro(m[1])}return''}function findDate(text){let m=text.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;m=text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);if(m)return`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;return''}function parseDocument(text,type){const clean=text.replace(/\r/g,'');const lines=clean.split('\n').map(x=>x.trim()).filter(Boolean);const date=findDate(clean),vat=findMoney(clean,['BTW(?: bedrag)?','21% BTW','NL btw \\(21[^)]*\\)']),total=findMoney(clean,['TOTAAL INCL\\.? BTW','Totaal factuur','Totaal te betalen','Totaal']);if(type==='invoice'){const nr=(clean.match(/Factuurnummer\s*[:#]?\s*([A-Z0-9-]+)/i)||[])[1]||'';let customer='';const p=lines.findIndex(x=>/Factuuradres/i.test(x));if(p>=0)customer=lines[p+1]||'';return{number:nr,date,total,vat,customer}}else{let supplier=lines[0]||'';supplier=supplier.replace(/Factuur|Kwitantie/i,'').trim()||lines[1]||'';return{supplier,date,total,vat}}}
async function readFile(file,type){const status=el(type==='invoice'?'invoiceReadStatus':'receiptReadStatus');status.textContent='Bestand uitlezen…';let text='';try{if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),c=await page.getTextContent();text+=c.items.map(i=>i.str).join(' ')+'\n'}}else{const{createWorker}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');const worker=await createWorker('nld');const r=await worker.recognize(file);text=r.data.text||'';await worker.terminate()}const parsed=parseDocument(text,type);if(type==='invoice'){lastInvoiceText=text;lastInvoiceFile=file.name;el('iNumber').value=parsed.number;el('iDate').value=parsed.date;el('iTotal').value=parsed.total;el('iVat').value=parsed.vat;el('iCustomer').value=parsed.customer}else{lastReceiptText=text;lastReceiptFile=file.name;el('rSupplier').value=parsed.supplier;el('rDate').value=parsed.date;el('rTotal').value=parsed.total;el('rVat').value=parsed.vat}status.textContent='Uitgelezen. Controleer de groene velden hieronder.'}catch(e){console.error(e);status.textContent='Automatisch uitlezen lukte niet volledig. Vul de groene velden handmatig in.'}}
async function saveCustomer(){const name=el('cName').value.trim(),product=el('cOrder').value.trim(),due=el('cDue').value;if(!name){alert('Vul de naam in.');return}const cid=id();db.customers.push({id:cid,name,product,due,deliveryDate:due,month:due?due.slice(0,7):''});db.orders.push({id:id(),customerId:cid,product,due,month:due?due.slice(0,7):''});await saveCloud();el('cName').value='';el('cOrder').value='';el('cDue').value='';el('customerForm').hidden=true;renderAll()}
async function saveInvoice(){
  const total=num(el('iTotal').value),paid=num(el('iPaid').value),date=el('iDate').value;
  if(!total||!date){alert('Controleer datum en totaalbedrag.');return}
  const recordId=id();
  let attachment=null;
  if(pendingInvoiceFile){
    try{
      cloud('Bestand opslaan…');
      attachment=await uploadAttachment(pendingInvoiceFile,'facturen',recordId);
    }catch(e){
      cloud('Cloud: fout','error');
      alert('Factuurbestand opslaan mislukt. De factuur is nog niet opgeslagen.\n\n'+String(e?.message||e));
      return;
    }
  }
  const item={id:recordId,number:el('iNumber').value.trim(),customerName:el('iCustomer').value.trim(),date,month:date.slice(0,7),description:el('iDescription').value.trim(),total,paid,vatAmount:num(el('iVat').value)||vatIncl(total),depositRecognized:paid>0,fileName:attachment?.fileName||lastInvoiceFile,ocrText:lastInvoiceText};
  if(attachment)Object.assign(item,attachment);
  db.invoices.push(item);
  await saveCloud();
  for(const x of['iNumber','iCustomer','iDate','iDescription','iTotal','iPaid','iVat'])el(x).value='';
  el('iPaid').value='0';
  lastInvoiceText='';lastInvoiceFile='';pendingInvoiceFile=null;el('invoiceFile').value='';
  el('invoiceEditor').hidden=true;renderAll();
}
async function saveReceipt(){
  const total=num(el('rTotal').value),date=el('rDate').value,supplier=el('rSupplier').value.trim();
  if(!total||!date||!supplier){alert('Controleer leverancier, datum en totaalbedrag.');return}
  const vat=num(el('rVat').value)||vatIncl(total),recordId=id();
  let attachment=null;
  if(pendingReceiptFile){
    try{
      cloud('Bestand opslaan…');
      attachment=await uploadAttachment(pendingReceiptFile,'bonnen',recordId);
    }catch(e){
      cloud('Cloud: fout','error');
      alert('Bonbestand opslaan mislukt. De bon is nog niet opgeslagen.\n\n'+String(e?.message||e));
      return;
    }
  }
  const item={id:recordId,supplier,date,month:date.slice(0,7),category:el('rCategory').value,total,vat,method:el('rMethod').value,fileName:attachment?.fileName||lastReceiptFile,ocrText:lastReceiptText,ocrConfidence:lastReceiptText?90:0};
  if(attachment)Object.assign(item,attachment);
  const sig=receiptSignature(item);
  if((db.receipts||[]).some(r=>receiptSignature(r)===sig)&&!confirm('Deze bon lijkt al te bestaan. Toch opslaan?'))return;
  db.receipts.push(item);
  await saveCloud();
  for(const x of['rSupplier','rDate','rTotal','rVat'])el(x).value='';
  lastReceiptText='';lastReceiptFile='';pendingReceiptFile=null;el('receiptFile').value='';
  el('receiptEditor').hidden=true;renderAll();
}
el('loginBtn').onclick=login;el('password').addEventListener('keydown',e=>{if(e.key==='Enter')login()});el('customerMonth').onchange=renderCustomers;el('invoiceMonth').onchange=renderInvoices;el('receiptMonth').onchange=renderReceipts;el('newCustomerBtn').onclick=()=>el('customerForm').hidden=!el('customerForm').hidden;el('newInvoiceBtn').onclick=()=>el('invoiceEditor').hidden=!el('invoiceEditor').hidden;el('newReceiptBtn').onclick=()=>el('receiptEditor').hidden=!el('receiptEditor').hidden;el('saveCustomerBtn').onclick=saveCustomer;el('saveInvoiceBtn').onclick=saveInvoice;el('saveReceiptBtn').onclick=saveReceipt;el('saveMileageBtn').onclick=saveMileage;el('mileageMonth').onchange=renderMileage;el('mDate').value=new Date().toISOString().slice(0,10);el('invoiceFile').onchange=e=>{pendingInvoiceFile=e.target.files?.[0]||null;if(pendingInvoiceFile)readFile(pendingInvoiceFile,'invoice')};el('receiptFile').onchange=e=>{pendingReceiptFile=e.target.files?.[0]||null;if(pendingReceiptFile)readFile(pendingReceiptFile,'receipt')};document.addEventListener('click',e=>{const b=e.target.closest?.('.doc-open');if(b){e.preventDefault();e.stopPropagation();openStoredDocument(b.dataset.docPath);return}const m=e.target.closest?.('.mileage-delete');if(m){e.preventDefault();deleteMileage(m.dataset.mileageId)}});document.querySelectorAll('.bottomnav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.bottomnav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));el(b.dataset.page).classList.add('active');window.scrollTo(0,0)});supabase.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT')showLogin();else if(event==='TOKEN_REFRESHED'&&s)cloud('Cloud: opgeslagen','ok')});resume();