const $p=id=>document.getElementById(id);

const clean=s=>String(s||'').replace(/\r/g,'').replace(/[\u00a0\u202f]/g,' ').replace(/[ \t]+/g,' ').replace(/\n +/g,'\n').trim();

function toMoney(raw){
  let s=String(raw||'').replace(/\s/g,'').replace(/[€EUR]/gi,'').replace(/[^0-9,.-]/g,'');
  if(!s)return'';
  const c=s.lastIndexOf(','),d=s.lastIndexOf('.');
  if(c>=0&&d>=0)s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(c>=0)s=s.replace(/\./g,'').replace(',','.');
  else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
  const n=Number(s);return Number.isFinite(n)?n.toFixed(2):'';
}

const MONEY='(?:€\\s*)?(\\d{1,3}(?:[.\\s]\\d{3})*(?:,\\d{2})|\\d+[,.]\\d{2}|\\d+)(?:\\s*€)?';
function moneyAfter(text,labels){
  const flat=clean(text).replace(/\n/g,' ');
  for(const label of labels){
    const m=flat.match(new RegExp('(?:'+label+')[^0-9€]{0,45}'+MONEY,'i'));
    if(m){const v=toMoney(m[1]);if(v)return v;}
  }
  return'';
}
function moneyValues(text){
  const out=[];const re=/(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+[,.]\d{2})(?:\s*€)?/g;
  for(const m of clean(text).matchAll(re)){const n=Number(toMoney(m[1]));if(Number.isFinite(n)&&n>0)out.push(n);}
  return out;
}

const months={januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12,jan:1,feb:2,mrt:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,okt:10,nov:11,dec:12};
function dateParts(y,m,d){const yy=+y,mm=+m,dd=+d;return yy>=2000&&yy<=2100&&mm>=1&&mm<=12&&dd>=1&&dd<=31?`${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`:'';}
function dateIn(s){
  s=clean(s);let m=s.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return dateParts(m[1],m[2],m[3]);
  m=s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);if(m)return dateParts(m[3],m[2],m[1]);
  m=s.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)\.?\s+(20\d{2})/i);
  return m?dateParts(m[3],months[m[2].toLowerCase()],m[1]):'';
}
function dateAfter(text,labels){
  const flat=clean(text).replace(/\n/g,' ');
  for(const label of labels){
    const m=flat.match(new RegExp('(?:'+label+')[^0-9]{0,35}((?:20\\d{2}[-/.]\\d{1,2}[-/.]\\d{1,2})|(?:\\d{1,2}[-/.]\\d{1,2}[-/.]20\\d{2})|(?:\\d{1,2}\\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\\s+20\\d{2}))','i'));
    if(m){const d=dateIn(m[1]);if(d)return d;}
  }
  return dateIn(flat);
}
function after(lines,labels){
  for(let i=0;i<lines.length;i++)for(const label of labels){
    const m=lines[i].match(new RegExp('^\\s*(?:'+label+')\\s*[:#-]?\\s*(.*)$','i'));
    if(!m)continue;
    if((m[1]||'').trim())return m[1].trim();
    for(let j=i+1;j<Math.min(i+4,lines.length);j++)if(lines[j].trim())return lines[j].trim();
  }
  return'';
}

function parseInvoice(text){
  const t=clean(text),lines=t.split('\n').map(x=>x.trim()).filter(Boolean),flat=t.replace(/\n/g,' ');
  let number='';
  for(const re of [/factuurnummer\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,/factuur\s*(?:nr\.?|nummer|no\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,/invoice\s*(?:no\.?|number)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i]){const m=flat.match(re);if(m){number=m[1].replace(/[.,;:]$/,'');break;}}
  let customer=after(lines,['Factuuradres','Klant(?:naam)?','Debiteur','Gefactureerd aan','Factuur aan','Bill to']);
  let description=after(lines,['Omschrijving','Beschrijving','Product','Bestelling','Dienst','Artikel']);
  if(description)description=description.replace(/\s+€?\s*\d+[.,]\d{2}.*$/,'').trim();
  const date=dateAfter(t,['Factuurdatum','Datum factuur','Invoice date','Datum']);
  let total=moneyAfter(t,['Totaal\\s*incl\\.?\\s*btw','Totaalbedrag','Factuurtotaal','Totaal\\s*factuur','Grand\\s*total','Amount\\s*due','Te\\s*betalen','Totaal']);
  if(!total){const vals=moneyValues(t).filter(n=>n<100000);if(vals.length)total=Math.max(...vals).toFixed(2);}
  let vat=moneyAfter(t,['Totaal\\s*BTW','BTW(?:\\s*bedrag)?','Omzetbelasting','VAT(?:\\s*amount|\\s*total)?']);
  if(!vat&&total&&/(?:21\s*%\s*(?:btw|vat)|(?:btw|vat)\s*21\s*%)/i.test(t))vat=(Number(total)*21/121).toFixed(2);
  let paid=moneyAfter(t,['Aanbetaling(?:\\s*voldaan)?','Reeds\\s*betaald','Betaald\\s*bedrag','Ontvangen\\s*aanbetaling','Voorschot','Deposit','Paid']);
  const rest=moneyAfter(t,['Resterend(?:\\s*bedrag)?','Restant(?:\\s*bedrag)?','Nog\\s*te\\s*betalen','Openstaand(?:\\s*bedrag)?','Balance\\s*due']);
  if(!paid&&total&&rest){const n=Number(total)-Number(rest);if(n>=0)paid=n.toFixed(2);}
  return{number,customer,date,description,total,paid:paid||'0',vat};
}

function supplierFrom(lines){
  const labeled=after(lines,['Leverancier','Verkoper','Winkel','Supplier','Seller','Merchant']);if(labeled)return labeled;
  const skip=/^(factuur|invoice|bon|receipt|kwitantie|order|bestelling|datum|date|klant|customer|adres|address|telefoon|phone|www\.|https?:|kvk|btw|vat|iban|transactie|transaction|totaal|subtotal|subtotaal|bedankt|thank)/i;
  for(const line of lines.slice(0,14)){
    const s=line.replace(/^[^A-Za-zÀ-ÿ0-9]+/,'').trim();
    if(!s||s.length<3||s.length>90||skip.test(s)||/^[€\d.,\s-]+$/.test(s))continue;
    if(/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(s)||/^20\d{2}[-/.]/.test(s))continue;
    return s;
  }
  return'';
}
function receiptCategory(t){
  const s=t.toLowerCase();
  if(/gereedschap|machine|boor|zaag|schuurmachine|laser|compressor|frees|tool|drill|saw/.test(s))return'Gereedschap en machines';
  if(/papier|printer|inkt|toner|bureau|kantoor|office|envelop|etiket|label/.test(s))return'Kantoor';
  if(/hout|mdf|multiplex|acryl|plexiglas|verf|lak|primer|schroef|lijm|kit|plaatmateriaal|bouwmarkt|gamma|praxis|karwei|hornbach|materiaal/.test(s))return'Materialen';
  return'Overig';
}
function paymentMethod(t){
  const s=t.toLowerCase();
  if(/\bideal\b|i-deal/.test(s))return'iDEAL';
  if(/\bcontant\b|\bcash\b/.test(s))return'Contant';
  if(/\bpin\b|maestro|mastercard|visa|debit|credit card|kaartbetaling|card payment/.test(s))return'Pin';
  return'Bank';
}
function vatFromReceipt(t,total){
  let vat=moneyAfter(t,['Totaal\\s*BTW','BTW\\s*totaal','BTW(?:\\s*bedrag)','Omzetbelasting','VAT\\s*total','VAT\\s*amount','Tax\\s*total','Tax\\s*amount']);
  if(vat)return vat;
  let sum=0,count=0;
  for(const line of t.split('\n')){
    if(!/(btw|vat|tax)/i.test(line)||!/(21|9|6)\s*%/.test(line))continue;
    const vals=moneyValues(line);if(vals.length){sum+=vals[vals.length-1];count++;}
  }
  if(count&&sum>0)return sum.toFixed(2);
  if(total&&/(?:21\s*%\s*(?:btw|vat)|(?:btw|vat)\s*21\s*%)/i.test(t))return(Number(total)*21/121).toFixed(2);
  return'';
}
function parseReceipt(text){
  const t=clean(text),lines=t.split('\n').map(x=>x.trim()).filter(Boolean);
  const supplier=supplierFrom(lines);
  const date=dateAfter(t,['Factuurdatum','Aankoopdatum','Transactiedatum','Orderdatum','Besteldatum','Invoice date','Order date','Transaction date','Datum','Date']);
  let total=moneyAfter(t,['Totaal\\s*incl\\.?\\s*btw','Totaalbedrag','Factuurtotaal','Ordertotaal','Eindtotaal','Grand\\s*total','Amount\\s*paid','Betaald(?:\\s*bedrag)?','Te\\s*betalen','Total']);
  if(!total){const vals=moneyValues(t).filter(n=>n<100000);if(vals.length)total=Math.max(...vals).toFixed(2);}
  return{supplier,date,total,vat:vatFromReceipt(t,total),category:receiptCategory(t),method:paymentMethod(t)};
}

function pdfRows(items){
  const rows=[];
  for(const item of items||[]){
    const str=String(item.str||'').trim();if(!str)continue;
    const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);
    let row=rows.find(r=>Math.abs(r.y-y)<=2.5);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,str});
  }
  return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}
async function ocr(source){
  const {createWorker}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
  const worker=await createWorker('nld+eng');
  try{const r=await worker.recognize(source);return r.data.text||'';}finally{await worker.terminate();}
}

function isHeicFile(file){return /\.(heic|heif)$/i.test(file.name||'')||/^image\/hei[cf]$/i.test(file.type||'');}
let heicLoader=null;
async function getHeicTo(){
  if(window.HeicTo)return window.HeicTo;
  if(!heicLoader)heicLoader=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js';
    s.onload=()=>window.HeicTo?resolve(window.HeicTo):reject(new Error('HEIC-converter niet geladen'));
    s.onerror=()=>reject(new Error('HEIC-converter kon niet worden geladen'));
    document.head.appendChild(s);
  });
  return heicLoader;
}
async function imageForOcr(file){
  if(!isHeicFile(file))return file;
  const HeicTo=await getHeicTo();
  const converted=await HeicTo({blob:file,type:'image/jpeg',quality:0.92});
  return Array.isArray(converted)?converted[0]:converted;
}
async function readDoc(file){
  if(!(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf'))){
    const source=await imageForOcr(file);
    return ocr(source);
  }
  const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;let text='';
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p),c=await page.getTextContent();let pageText=pdfRows(c.items);
    if(pageText.replace(/\s/g,'').length<20){const vp=page.getViewport({scale:1.8}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;pageText=await ocr(canvas);}
    text+=pageText+'\n';
  }
  return text;
}

function filenameSupplier(file){
  const base=String(file?.name||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
  if(!base)return'';
  const monthWords='januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec';
  return base.replace(new RegExp('\\b(?:'+monthWords+')\\b.*$','i'),'').replace(/\b20\d{2}\b.*$/,'').replace(/\b\d{1,2}\b.*$/,'').trim();
}
function filenameDate(file){
  const name=String(file?.name||'').replace(/\.[^.]+$/,'');
  const m=name.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)(?:\s+(20\d{2}))?/i)||name.match(/(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)\s+(\d{1,2})(?:\s+(20\d{2}))?/i);
  if(!m)return'';
  let day,monthName,year;
  if(/^\d/.test(m[1])){day=m[1];monthName=m[2];year=m[3];}else{monthName=m[1];day=m[2];year=m[3];}
  const fallbackYear=new Date(file?.lastModified||Date.now()).getFullYear();
  return dateParts(year||fallbackYear,months[monthName.toLowerCase()],day);
}

function applyInvoice(p){$p('iNumber').value=p.number||'';$p('iCustomer').value=p.customer||'';$p('iDate').value=p.date||'';$p('iDescription').value=p.description||'';$p('iTotal').value=p.total||'';$p('iPaid').value=p.paid||'0';$p('iVat').value=p.vat||'';}
function applyReceipt(p){$p('rSupplier').value=p.supplier||'';$p('rDate').value=p.date||'';$p('rTotal').value=p.total||'';$p('rVat').value=p.vat||'';if(p.category)$p('rCategory').value=p.category;if(p.method)$p('rMethod').value=p.method;}
function statusFor(p,receipt=false){
  const fields=receipt?{supplier:'leverancier',date:'datum',total:'totaal',vat:'btw',category:'categorie',method:'betaalwijze'}:{number:'factuurnummer',customer:'klant',date:'datum',description:'omschrijving',total:'totaal',paid:'aanbetaling',vat:'btw'};
  const found=[],missing=[];for(const[k,label]of Object.entries(fields)){const v=p[k];if(v!==''&&v!=null&&(k!=='paid'||Number(v)>0))found.push(label);else missing.push(label);}
  return missing.length?`${receipt?'Bon':'Factuur'} gecontroleerd. Herkend: ${found.join(', ')||'beperkte gegevens'}. Controleer/vul nog in: ${missing.join(', ')}.`:`Alle ${receipt?'bon':'factuur'}gegevens herkend. Controleer de groene velden en sla daarna op.`;
}

document.addEventListener('change',event=>{
  const input=event.target;if(!(input instanceof HTMLInputElement)||!input.files?.[0])return;
  const file=input.files[0];
  if(input.id==='invoiceFile')setTimeout(async()=>{const s=$p('invoiceReadStatus');try{if(s)s.textContent=isHeicFile(file)?'HEIC-foto omzetten en factuur uitlezen…':'Factuur extra nauwkeurig uitlezen…';const p=parseInvoice(await readDoc(file));applyInvoice(p);if(s)s.textContent=statusFor(p,false);}catch(e){console.error(e);if(s)s.textContent='Niet alle factuurgegevens konden automatisch worden herkend. Controleer de groene velden.';}},250);
  if(input.id==='receiptFile')setTimeout(async()=>{const s=$p('receiptReadStatus');try{if(s)s.textContent=isHeicFile(file)?'HEIC-foto omzetten en bon uitlezen…':'Bon extra nauwkeurig uitlezen…';const text=await readDoc(file);const p=parseReceipt(text);if(!p.supplier)p.supplier=filenameSupplier(file);if(!p.date)p.date=filenameDate(file);if(p.supplier&&!p.category)p.category=receiptCategory(p.supplier);applyReceipt(p);if(s)s.textContent=statusFor(p,true);}catch(e){console.error(e);const fallback={supplier:filenameSupplier(file),date:filenameDate(file),total:'',vat:'',category:receiptCategory(file.name||''),method:'Bank'};applyReceipt(fallback);if(s)s.textContent='De foto kon niet volledig worden uitgelezen. Leverancier/datum uit de bestandsnaam zijn waar mogelijk alvast ingevuld.';}},250);
});
