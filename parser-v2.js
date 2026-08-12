const pEl=id=>document.getElementById(id);

function cleanText(text){
  return String(text||'')
    .replace(/\r/g,'')
    .replace(/[\u00a0\u202f]/g,' ')
    .replace(/[ \t]+/g,' ')
    .replace(/\n[ \t]+/g,'\n')
    .trim();
}

function money(raw){
  if(raw==null)return'';
  let s=String(raw).replace(/\s/g,'').replace(/[€EUR]/gi,'').replace(/[^0-9,.-]/g,'');
  if(!s)return'';
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  if(comma>=0&&dot>=0){
    if(comma>dot)s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/,/g,'');
  }else if(comma>=0){
    s=s.replace(/\./g,'').replace(',','.');
  }else if((s.match(/\./g)||[]).length>1){
    s=s.replace(/\./g,'');
  }
  const n=Number(s);
  return Number.isFinite(n)?n.toFixed(2):'';
}

const MONEY='(?:€\\s*)?(\\d{1,3}(?:[.\\s]\\d{3})*(?:,\\d{2})|\\d+[,.]\\d{2}|\\d+)(?:\\s*€)?';

function findMoney(text,labels,maxGap=45){
  const flat=cleanText(text).replace(/\n/g,' ');
  for(const label of labels){
    const re=new RegExp('(?:'+label+')[^0-9€]{0,'+maxGap+'}'+MONEY,'i');
    const m=flat.match(re);
    if(m){const n=money(m[1]);if(n!=='')return n;}
  }
  return'';
}

function allMoney(text){
  const re=/(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+[,.]\d{2})(?:\s*€)?/g;
  const out=[];
  for(const m of cleanText(text).matchAll(re)){
    const n=Number(money(m[1]));
    if(Number.isFinite(n)&&n>0)out.push(n);
  }
  return out;
}

const MONTHS={januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12,jan:1,feb:2,mrt:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,okt:10,nov:11,dec:12};

function dateParts(y,m,d){
  const yy=Number(y),mm=Number(m),dd=Number(d);
  if(yy<2000||yy>2100||mm<1||mm>12||dd<1||dd>31)return'';
  return `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}

function dateFrom(text){
  const s=cleanText(text);
  let m=s.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if(m)return dateParts(m[1],m[2],m[3]);
  m=s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
  if(m)return dateParts(m[3],m[2],m[1]);
  m=s.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|sept|okt|nov|dec)\.?\s+(20\d{2})/i);
  if(m)return dateParts(m[3],MONTHS[m[2].toLowerCase()],m[1]);
  return'';
}

function findDate(text,labels){
  const flat=cleanText(text).replace(/\n/g,' ');
  for(const label of labels){
    const re=new RegExp('(?:'+label+')[^0-9]{0,35}((?:20\\d{2}[-/.]\\d{1,2}[-/.]\\d{1,2})|(?:\\d{1,2}[-/.]\\d{1,2}[-/.]20\\d{2})|(?:\\d{1,2}\\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\\s+20\\d{2}))','i');
    const m=flat.match(re);
    if(m){const d=dateFrom(m[1]);if(d)return d;}
  }
  return dateFrom(flat);
}

function afterLabel(lines,labels){
  for(let i=0;i<lines.length;i++){
    for(const label of labels){
      const re=new RegExp('^\\s*(?:'+label+')\\s*[:#-]?\\s*(.*)$','i');
      const m=lines[i].match(re);
      if(!m)continue;
      const inline=(m[1]||'').trim();
      if(inline)return inline;
      for(let j=i+1;j<Math.min(lines.length,i+4);j++){
        const c=lines[j].trim();
        if(c&&!/^(factuur|datum|adres|kvk|btw|iban|totaal|omschrijving|beschrijving|product|prijs)/i.test(c))return c;
      }
    }
  }
  return'';
}

function invoiceNumber(text,lines){
  const flat=cleanText(text).replace(/\n/g,' ');
  const patterns=[
    /factuurnummer\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,
    /factuur\s*(?:nr\.?|nummer|no\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,
    /invoice\s*(?:no\.?|number)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i
  ];
  for(const re of patterns){const m=flat.match(re);if(m)return m[1].replace(/[.,;:]$/,'');}
  return afterLabel(lines,['Factuurnummer','Factuur\\s*nr\\.?','Factuurnr\\.?']);
}

function invoiceCustomer(lines,text){
  let v=afterLabel(lines,['Factuuradres','Klant(?:naam)?','Debiteur','Gefactureerd aan','Factuur aan','Bill to']);
  if(v)return v.replace(/^[:#-]\s*/,'').trim();
  const flat=cleanText(text).replace(/\n/g,' ');
  const m=flat.match(/(?:factuuradres|klant(?:naam)?|debiteur|gefactureerd aan|factuur aan|bill to)\s*[:#-]?\s*([A-ZÀ-ÿ0-9][A-ZÀ-ÿ0-9 &'().-]{2,60}?)(?=\s+(?:[A-Z]{0,2}\d{4}\s?[A-Z]{2}|\d{1,5}\s+[A-Za-zÀ-ÿ]|kvk|btw|datum|factuur|omschrijving|totaal)|$)/i);
  return m?m[1].trim():'';
}

function invoiceDescription(lines,text){
  let v=afterLabel(lines,['Omschrijving','Beschrijving','Product(?:\\s*\\/\\s*bestelling)?','Bestelling','Dienst','Artikel']);
  if(v){v=v.replace(/\s+(?:€?\s*\d+[.,]\d{2}).*$/,'').trim();if(v.length>2)return v;}
  const flat=cleanText(text).replace(/\n/g,' ');
  const m=flat.match(/(?:omschrijving|beschrijving|product|bestelling|dienst|artikel)\s*[:#-]?\s*([A-ZÀ-ÿ0-9][A-ZÀ-ÿ0-9 ,&+()./'-]{3,90}?)(?=\s+(?:aantal|prijs|bedrag|subtotaal|totaal|btw|€\s*\d)|$)/i);
  return m?m[1].trim():'';
}

function parseInvoice(text){
  const clean=cleanText(text),lines=clean.split('\n').map(x=>x.trim()).filter(Boolean);
  const date=findDate(clean,['Factuurdatum','Datum factuur','Invoice date','Datum']);
  let vat=findMoney(clean,['BTW(?:\\s*bedrag)?','Totaal\\s*BTW','BTW\\s*21\\s*%','21\\s*%\\s*BTW','Omzetbelasting','VAT(?:\\s*amount|\\s*total)?']);
  let total=findMoney(clean,['Totaal\\s*incl\\.?\\s*btw','Totaalbedrag','Factuurtotaal','Totaal\\s*factuur','Grand\\s*total','Amount\\s*due','Te\\s*betalen','Totaal']);
  if(!total){const amounts=allMoney(clean).filter(n=>n<100000);if(amounts.length)total=Math.max(...amounts).toFixed(2);}
  let paid=findMoney(clean,['Aanbetaling(?:\\s*voldaan)?','Reeds\\s*betaald','Betaald\\s*bedrag','Ontvangen\\s*aanbetaling','Voorschot','Deposit','Paid']);
  const remaining=findMoney(clean,['Resterend(?:\\s*bedrag)?','Restant(?:\\s*bedrag)?','Nog\\s*te\\s*betalen','Openstaand(?:\\s*bedrag)?','Balance\\s*due']);
  if(!paid&&total&&remaining){const n=Number(total)-Number(remaining);if(n>=0)paid=n.toFixed(2);}
  if(!vat&&total&&/(?:21\s*%\s*(?:btw|vat)|(?:btw|vat)\s*21\s*%)/i.test(clean))vat=(Number(total)*21/121).toFixed(2);
  return {number:invoiceNumber(clean,lines),customer:invoiceCustomer(lines,clean),date,description:invoiceDescription(lines,clean),total,paid:paid||'0',vat};
}

function receiptSupplier(lines){
  const labeled=afterLabel(lines,['Leverancier','Verkoper','Winkel','Supplier','Seller','Merchant']);
  if(labeled)return labeled.trim();
  const skip=/^(factuur|invoice|bon|receipt|kwitantie|order|bestelling|datum|date|klant|customer|adres|address|telefoon|phone|www\.|https?:|kvk|btw|vat|iban|transactie|transaction|totaal|subtotal|subtotaal|bedankt|thank you)/i;
  for(const line of lines.slice(0,14)){
    const s=line.replace(/^[^A-Za-zÀ-ÿ0-9]+/,'').trim();
    if(!s||s.length<3||s.length>90||skip.test(s))continue;
    if(/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(s)||/^20\d{2}[-/.]/.test(s))continue;
    if(/^[€\d.,\s-]+$/.test(s))continue;
    return s;
  }
  return'';
}

function receiptCategory(text){
  const s=cleanText(text).toLowerCase();
  if(/gereedschap|machine|boor|zaag|schuurmachine|laser|compressor|frees|tool|drill|saw/.test(s))return'Gereedschap en machines';
  if(/papier|printer|inkt|toner|bureau|kantoor|office|envelop|etiket|label/.test(s))return'Kantoor';
  if(/hout|mdf|multiplex|acryl|plexiglas|verf|lak|primer|schroef|lijm|kit|plaatmateriaal|bouwmarkt|gamma|praxis|karwei|hornbach|materiaal/.test(s))return'Materialen';
  return'Overig';
}

function receiptMethod(text){
  const s=cleanText(text).toLowerCase();
  if(/\bideal\b|i-deal/.test(s))return'iDEAL';
  if(/\bcontant\b|\bcash\b/.test(s))return'Contant';
  if(/\bpin\b|maestro|mastercard|visa|debit|credit card|kaartbetaling|card payment/.test(s))return'Pin';
  if(/bankoverschrijving|overschrijving|bank transfer|sepa|iban/.test(s))return'Bank';
  return'Bank';
}

function receiptVat(clean,total){
  let vat=findMoney(clean,['Totaal\\s*BTW','BTW\\s*totaal','BTW(?:\\s*bedrag)','Omzetbelasting','VAT\\s*total','VAT\\s*amount','Tax\\s*total','Tax\\s*amount']);
  if(vat)return vat;
  const lines=clean.split('\n').map(x=>x.trim()).filter(Boolean);
  let sum=0,count=0;
  for(const line of lines){
    if(!/(?:btw|vat|tax)/i.test(line)||!/(?:21|9|6)\s*%/.test(line))continue;
    const vals=allMoney(line);
    if(vals.length){sum+=vals[vals.length-1];count++;}
  }
  if(count&&sum>0)return sum.toFixed(2);
  vat=findMoney(clean,['21\\s*%\\s*BTW','BTW\\s*21\\s*%','9\\s*%\\s*BTW','BTW\\s*9\\s*%','VAT\\s*21\\s*%','VAT\\s*9\\s*%']);
  if(vat)return vat;
  if(total&&/(?:21\s*%\s*(?:btw|vat)|(?:btw|vat)\s*21\s*%)/i.test(clean))return(Number(total)*21/121).toFixed(2);
  return'';
}

function parseReceipt(text){
  const clean=cleanText(text),lines=clean.split('\n').map(x=>x.trim()).filter(Boolean);
  const supplier=receiptSupplier(lines);
  const date=findDate(clean,['Factuurdatum','Aankoopdatum','Transactiedatum','Orderdatum','Besteldatum','Invoice date','Order date','Transaction date','Datum','Date']);
  let total=findMoney(clean,['Totaal\\s*incl\\.?\\s*btw','Totaalbedrag','Factuurtotaal','Ordertotaal','Eindtotaal','Grand\\s*total','Amount\\s*paid','Betaald(?:\\s*bedrag)?','Te\\s*betalen','Total']);
  if(!total){const amounts=allMoney(clean).filter(n=>n>0&&n<100000);if(amounts.length)total=Math.max(...amounts).toFixed(2);}
  const vat=receiptVat(clean,total);
  return {supplier,date,total,vat,category:receiptCategory(clean),method:receiptMethod(clean)};
}

function pdfLines(items){
  const rows=[];
  for(const item of items||[]){
    const str=String(item.str||'').trim();
    if(!str)continue;
    const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);
    let row=rows.find(r=>Math.abs(r.y-y)<=2.5);
    if(!row){row={y,items:[]};rows.push(row);}
    row.items.push({x,str});
  }
  return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}

async function ocrImage(source){
  const {createWorker}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
  const worker=await createWorker('nld+eng');
  try{const r=await worker.recognize(source);return r.data.text||'';}finally{await worker.terminate();}
}

async function readDocument(file){
  if(!(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')))return ocrImage(file);
  const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  let text='';
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p),content=await page.getTextContent();
    let pageText=pdfLines(content.items);
    if(pageText.replace(/\s/g,'').length<20){
      const viewport=page.getViewport({scale:1.8});
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const ctx=canvas.getContext('2d');
      await page.render({canvasContext:ctx,viewport}).promise;
      pageText=await ocrImage(canvas);
    }
    text+=pageText+'\n';
  }
  return text;
}

function applyInvoice(parsed){
  pEl('iNumber').value=parsed.number||'';
  pEl('iCustomer').value=parsed.customer||'';
  pEl('iDate').value=parsed.date||'';
  pEl('iDescription').value=parsed.description||'';
  pEl('iTotal').value=parsed.total||'';
  pEl('iPaid').value=parsed.paid||'0';
  pEl('iVat').value=parsed.vat||'';
}

function applyReceipt(parsed){
  pEl('rSupplier').value=parsed.supplier||'';
  pEl('rDate').value=parsed.date||'';
  pEl('rTotal').value=parsed.total||'';
  pEl('rVat').value=parsed.vat||'';
  if(parsed.category)pEl('rCategory').value=parsed.category;
  if(parsed.method)pEl('rMethod').value=parsed.method;
}

function invoiceStatus(parsed){
  const fields={number:'factuurnummer',customer:'klant',date:'datum',description:'omschrijving',total:'totaal',paid:'aanbetaling',vat:'btw'},found=[],missing=[];
  for(const[k,label]of Object.entries(fields)){
    const v=parsed[k];
    if(v!==''&&v!=null&&(k!=='paid'||Number(v)>0))found.push(label);else missing.push(label);
  }
  return missing.length?`Extra controle klaar. Herkend: ${found.join(', ')||'beperkte gegevens'}. Controleer/vul nog in: ${missing.join(', ')}.`:'Alles herkend. Controleer de groene velden en sla daarna op.';
}

function receiptStatus(parsed){
  const fields={supplier:'leverancier',date:'datum',total:'totaal',vat:'btw',category:'categorie',method:'betaalwijze'},found=[],missing=[];
  for(const[k,label]of Object.entries(fields)){
    const v=parsed[k];
    if(v!==''&&v!=null)found.push(label);else missing.push(label);
  }
  return missing.length?`Bon extra gecontroleerd. Herkend: ${found.join(', ')||'beperkte gegevens'}. Controleer/vul nog in: ${missing.join(', ')}.`:'Alle bongegevens herkend. Controleer de groene velden en sla daarna op.';
}

document.addEventListener('change',event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||!input.files?.[0])return;
  const file=input.files[0];

  if(input.id==='invoiceFile'){
    const status=pEl('invoiceReadStatus');
    setTimeout(async()=>{
      try{
        if(status)status.textContent='Factuur extra nauwkeurig uitlezen…';
        const text=await readDocument(file),parsed=parseInvoice(text);
        applyInvoice(parsed);
        if(status)status.textContent=invoiceStatus(parsed);
      }catch(e){
        console.error('Invoice parser',e);
        if(status)status.textContent='Bestand is gelezen, maar niet alle velden konden automatisch worden herkend. Controleer de groene velden.';
      }
    },300);
  }

  if(input.id==='receiptFile'){
    const status=pEl('receiptReadStatus');
    setTimeout(async()=>{
      try{
        if(status)status.textContent='Bon extra nauwkeurig uitlezen…';
        const text=await readDocument(file),parsed=parseReceipt(text);
        applyReceipt(parsed);
        if(status)status.textContent=receiptStatus(parsed);
      }catch(e){
        console.error('Receipt parser',e);
        if(status)status.textContent='Bon is gelezen, maar niet alle velden konden automatisch worden herkend. Controleer de groene velden.';
      }
    },300);
  }
});
