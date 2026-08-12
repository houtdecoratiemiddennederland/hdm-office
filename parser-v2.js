const pEl=id=>document.getElementById(id);

function pClean(text){return String(text||'').replace(/\r/g,'').replace(/[\u00a0\u202f]/g,' ').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').trim()}
function pMoney(raw){
  if(raw==null)return'';
  let s=String(raw).replace(/\s/g,'').replace(/[€EUR]/gi,'').replace(/[^0-9,.-]/g,'');
  if(!s)return'';
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  if(comma>=0&&dot>=0){if(comma>dot)s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'')}
  else if(comma>=0)s=s.replace(/\./g,'').replace(',','.');
  else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
  const n=Number(s);return Number.isFinite(n)?n.toFixed(2):'';
}
function pMoneyPattern(){return'(?:€\\s*)?(\\d{1,3}(?:[.\\s]\\d{3})*(?:,\\d{2})|\\d+[,.]\\d{2}|\\d+)(?:\\s*€)?'}
function pFindMoney(text,labels){
  const flat=pClean(text).replace(/\n/g,' ');
  for(const label of labels){const re=new RegExp('(?:'+label+')[^0-9€]{0,45}'+pMoneyPattern(),'i');const m=flat.match(re);if(m){const n=pMoney(m[1]);if(n!=='')return n}}
  return'';
}
function pFindAllMoney(text){const re=/(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+[,.]\d{2})(?:\s*€)?/g;const out=[];for(const m of pClean(text).matchAll(re)){const n=Number(pMoney(m[1]));if(Number.isFinite(n)&&n>0)out.push(n)}return out}
const P_MONTHS={januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12,jan:1,feb:2,mrt:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,okt:10,nov:11,dec:12};
function pDateParts(y,m,d){const yy=Number(y),mm=Number(m),dd=Number(d);if(yy<2000||yy>2100||mm<1||mm>12||dd<1||dd>31)return'';return`${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`}
function pDateFrom(text){
  const s=pClean(text);let m=s.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return pDateParts(m[1],m[2],m[3]);
  m=s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);if(m)return pDateParts(m[3],m[2],m[1]);
  m=s.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)\.?\s+(20\d{2})/i);if(m)return pDateParts(m[3],P_MONTHS[m[2].toLowerCase()],m[1]);
  return'';
}
function pFindDate(text,labels){const flat=pClean(text).replace(/\n/g,' ');for(const label of labels){const re=new RegExp('(?:'+label+')[^0-9]{0,35}((?:20\\d{2}[-/.]\\d{1,2}[-/.]\\d{1,2})|(?:\\d{1,2}[-/.]\\d{1,2}[-/.]20\\d{2})|(?:\\d{1,2}\\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\\s+20\\d{2}))','i');const m=flat.match(re);if(m){const d=pDateFrom(m[1]);if(d)return d}}return pDateFrom(flat)}
function pAfter(lines,labels){for(let i=0;i<lines.length;i++){for(const label of labels){const re=new RegExp('^\\s*(?:'+label+')\\s*[:#-]?\\s*(.*)$','i'),m=lines[i].match(re);if(m){const inline=(m[1]||'').trim();if(inline)return inline;for(let j=i+1;j<Math.min(lines.length,i+4);j++){const c=lines[j].trim();if(c&&!/^(factuur|datum|adres|kvk|btw|iban|totaal|omschrijving|beschrijving|product|prijs)/i.test(c))return c}}}}return''}
function pNumber(text,lines){const flat=pClean(text).replace(/\n/g,' '),patterns=[/factuurnummer\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,/factuur\s*(?:nr\.?|nummer|no\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,/invoice\s*(?:no\.?|number)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i];for(const re of patterns){const m=flat.match(re);if(m)return m[1].replace(/[.,;:]$/,'')}return pAfter(lines,['Factuurnummer','Factuur\\s*nr\\.?','Factuurnr\\.?'])}
function pCustomer(lines,text){let v=pAfter(lines,['Factuuradres','Klant(?:naam)?','Debiteur','Gefactureerd aan','Factuur aan','Bill to']);if(v)return v.replace(/^[:#-]\s*/,'').trim();const flat=pClean(text).replace(/\n/g,' '),m=flat.match(/(?:factuuradres|klant(?:naam)?|debiteur|gefactureerd aan|factuur aan|bill to)\s*[:#-]?\s*([A-ZÀ-ÿ0-9][A-ZÀ-ÿ0-9 &'().-]{2,60}?)(?=\s+(?:[A-Z]{0,2}\d{4}\s?[A-Z]{2}|\d{1,5}\s+[A-Za-zÀ-ÿ]|kvk|btw|datum|factuur|omschrijving|totaal)|$)/i);return m?m[1].trim():''}
function pDescription(lines,text){let v=pAfter(lines,['Omschrijving','Beschrijving','Product(?:\\s*\\/\\s*bestelling)?','Bestelling','Dienst','Artikel']);if(v){v=v.replace(/\s+(?:€?\s*\d+[.,]\d{2}).*$/,'').trim();if(v.length>2)return v}const flat=pClean(text).replace(/\n/g,' '),m=flat.match(/(?:omschrijving|beschrijving|product|bestelling|dienst|artikel)\s*[:#-]?\s*([A-ZÀ-ÿ0-9][A-ZÀ-ÿ0-9 ,&+()./'-]{3,90}?)(?=\s+(?:aantal|prijs|bedrag|subtotaal|totaal|btw|€\s*\d)|$)/i);return m?m[1].trim():''}
function pParse(text){
  const clean=pClean(text),lines=clean.split('\n').map(x=>x.trim()).filter(Boolean);
  const date=pFindDate(clean,['Factuurdatum','Datum factuur','Datum']);
  let vat=pFindMoney(clean,['BTW(?:\\s*bedrag)?','BTW\\s*21\\s*%','21\\s*%\\s*BTW','Omzetbelasting','VAT(?:\\s*amount)?']);
  let total=pFindMoney(clean,['Totaal\\s*incl\\.?\\s*btw','Totaalbedrag','Factuurtotaal','Totaal\\s*factuur','Te\\s*betalen','Totaal']);
  if(!total){const amounts=pFindAllMoney(clean).filter(n=>n<100000);if(amounts.length)total=Math.max(...amounts).toFixed(2)}
  let paid=pFindMoney(clean,['Aanbetaling(?:\\s*voldaan)?','Reeds\\s*betaald','Betaald\\s*bedrag','Ontvangen\\s*aanbetaling','Voorschot','Deposit']);
  const remaining=pFindMoney(clean,['Resterend(?:\\s*bedrag)?','Restant(?:\\s*bedrag)?','Nog\\s*te\\s*betalen','Openstaand(?:\\s*bedrag)?']);
  if(!paid&&total&&remaining){const n=Number(total)-Number(remaining);if(n>=0)paid=n.toFixed(2)}
  if(!vat&&total&&/21\s*%/.test(clean))vat=(Number(total)*21/121).toFixed(2);
  return{number:pNumber(clean,lines),customer:pCustomer(lines,clean),date,description:pDescription(lines,clean),total,paid:paid||'0',vat};
}
function pPdfLines(items){const rows=[];for(const item of items||[]){const str=String(item.str||'').trim();if(!str)continue;const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);let row=rows.find(r=>Math.abs(r.y-y)<=2.5);if(!row){row={y,items:[]};rows.push(row)}row.items.push({x,str})}return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n')}
async function pRead(file){
  let text='';
  if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),c=await page.getTextContent();text+=pPdfLines(c.items)+'\n'}}
  else{const{createWorker}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');const worker=await createWorker('nld');const r=await worker.recognize(file);text=r.data.text||'';await worker.terminate()}
  return text;
}
function pApply(parsed){pEl('iNumber').value=parsed.number||'';pEl('iCustomer').value=parsed.customer||'';pEl('iDate').value=parsed.date||'';pEl('iDescription').value=parsed.description||'';pEl('iTotal').value=parsed.total||'';pEl('iPaid').value=parsed.paid||'0';pEl('iVat').value=parsed.vat||''}
function pStatus(parsed){const fields={number:'factuurnummer',customer:'klant',date:'datum',description:'omschrijving',total:'totaal',paid:'aanbetaling',vat:'btw'},found=[],missing=[];for(const[k,label]of Object.entries(fields)){const v=parsed[k];if(v!==''&&v!=null&&(k!=='paid'||Number(v)>0))found.push(label);else missing.push(label)}return missing.length?`Extra controle klaar. Herkend: ${found.join(', ')||'beperkte gegevens'}. Controleer/vul nog in: ${missing.join(', ')}.`:'Alles herkend. Controleer de groene velden en sla daarna op.'}

document.addEventListener('change',event=>{
  const input=event.target;if(!(input instanceof HTMLInputElement)||input.id!=='invoiceFile'||!input.files?.[0])return;
  const file=input.files[0],status=pEl('invoiceReadStatus');
  setTimeout(async()=>{try{if(status)status.textContent='Factuur extra nauwkeurig uitlezen…';const text=await pRead(file),parsed=pParse(text);pApply(parsed);if(status)status.textContent=pStatus(parsed)}catch(e){console.error('Invoice parser v2',e);if(status)status.textContent='Bestand is gelezen, maar niet alle velden konden automatisch worden herkend. Controleer de groene velden.'}},300);
});
