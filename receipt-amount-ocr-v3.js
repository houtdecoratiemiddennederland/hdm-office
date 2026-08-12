const ra3=id=>document.getElementById(id);

function ra3IsHeic(file){return /\.(heic|heif)$/i.test(file?.name||'')||/^image\/hei[cf]$/i.test(file?.type||'');}
let ra3HeicPromise=null;
async function ra3HeicTo(){
  if(window.HeicTo)return window.HeicTo;
  if(!ra3HeicPromise)ra3HeicPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js';
    s.onload=()=>window.HeicTo?resolve(window.HeicTo):reject(new Error('HEIC converter niet geladen'));
    s.onerror=()=>reject(new Error('HEIC converter niet geladen'));
    document.head.appendChild(s);
  });
  return ra3HeicPromise;
}
async function ra3Blob(file){
  if(!ra3IsHeic(file))return file;
  const HeicTo=await ra3HeicTo();
  const out=await HeicTo({blob:file,type:'image/jpeg',quality:0.98});
  return Array.isArray(out)?out[0]:out;
}
async function ra3Image(blob){
  const url=URL.createObjectURL(blob);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
    return img;
  }finally{setTimeout(()=>URL.revokeObjectURL(url),1500);}
}
function ra3Crop(img,xr,yr,wr,hr,maxWidth=1900){
  const sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height;
  const sx=Math.max(0,Math.round(sw*xr)),sy=Math.max(0,Math.round(sh*yr));
  const cw=Math.max(1,Math.min(sw-sx,Math.round(sw*wr))),ch=Math.max(1,Math.min(sh-sy,Math.round(sh*hr)));
  const scale=Math.min(2.2,maxWidth/cw),w=Math.max(1,Math.round(cw*scale)),h=Math.max(1,Math.round(ch*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,cw,ch,0,0,w,h);
  return c;
}
function ra3Enhance(src,threshold=false){
  const c=document.createElement('canvas');c.width=src.width;c.height=src.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
  const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
  for(let i=0;i<d.length;i+=4){
    let g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    if(threshold)g=g>172?255:0;else g=Math.max(0,Math.min(255,(g-128)*1.8+142));
    d[i]=d[i+1]=d[i+2]=g;
  }
  ctx.putImageData(im,0,0);return c;
}
async function ra3Ocr(canvases){
  const {createWorker}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
  const worker=await createWorker('nld+eng');
  const texts=[];
  try{
    await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});
    for(const c of canvases){const r=await worker.recognize(c);if(r?.data?.text)texts.push(r.data.text);}
    await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'11'});
    const r=await worker.recognize(canvases[0]);if(r?.data?.text)texts.push(r.data.text);
    return texts.join('\n--- RECEIPT PASS ---\n');
  }finally{await worker.terminate();}
}
function ra3Norm(s){
  return String(s||'')
    .replace(/\r/g,'')
    .replace(/[\u00a0\u202f]/g,' ')
    .replace(/(\d)[oO](?=\d)/g,'$10')
    .replace(/(\d)[lI|](?=\d|\b)/g,'$11')
    .replace(/(\d)\s*[.,]\s*(\d{2})(?!\d)/g,'$1,$2')
    .replace(/(\d{1,5})\s+(\d{2})(?!\d)/g,'$1,$2');
}
function ra3Money(raw){
  let s=ra3Norm(raw).replace(/[^0-9,.-]/g,'');if(!s)return NaN;
  const c=s.lastIndexOf(','),d=s.lastIndexOf('.');
  if(c>=0&&d>=0)s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(c>=0)s=s.replace(/\./g,'').replace(',','.');
  const n=Number(s);return Number.isFinite(n)?n:NaN;
}
function ra3Amounts(line){
  const s=ra3Norm(line),out=[];
  const re=/(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))(?:\s*(?:€|eur))?/ig;
  for(const m of s.matchAll(re)){const n=ra3Money(m[1]);if(Number.isFinite(n)&&n>=0&&n<100000)out.push(n);}
  return out;
}
function ra3Lines(text){return ra3Norm(text).split(/\n+/).map(x=>x.trim()).filter(Boolean);}
function ra3FindTotal(text){
  const lines=ra3Lines(text),priority=[/tot\s*[.\-]?\s*omzet/i,/\b(?:9\s*)?t[o0]taal\b/i,/te\s*betalen/i,/amount\s*due/i,/betaling/i];
  for(const re of priority){
    const hits=[];
    lines.forEach((line,i)=>{if(!re.test(line)||/(tot\s*[.\-]?\s*btw|btw|vat|tax)/i.test(line))return;const vals=ra3Amounts(line+' '+(lines[i+1]||''));hits.push(...vals.filter(v=>v>0));});
    if(hits.length)return Math.max(...hits);
  }
  return NaN;
}
function ra3FindVat(text,total){
  const lines=ra3Lines(text);
  for(let i=0;i<lines.length;i++){
    if(!/(tot\s*[.\-]?\s*btw|totaal\s*btw|tot\s*vat|total\s*vat)/i.test(lines[i]))continue;
    const vals=ra3Amounts(lines[i]+' '+(lines[i+1]||''));
    const plausible=vals.filter(v=>v>0&&(!Number.isFinite(total)||v<total));
    if(plausible.length)return plausible[plausible.length-1];
  }
  let sum=0,count=0;
  for(const line of lines){
    if(!/(btw|vat|tax)/i.test(line)||!/(21|9|6)[,.]?0*\s*%/.test(line))continue;
    const vals=ra3Amounts(line);if(!vals.length)continue;
    let v=vals[vals.length-1];
    if(Number.isFinite(total)&&v>=total)continue;
    if(v>=0&&v<10000){sum+=v;count++;}
  }
  if(count>=1&&sum>0&&(!Number.isFinite(total)||sum<total))return sum;
  const cands=[];
  lines.forEach((line,i)=>{if(!/(btw|vat|tax)/i.test(line))return;for(let j=i;j<=Math.min(i+2,lines.length-1);j++){for(const v of ra3Amounts(lines[j]))if(v>0&&(!Number.isFinite(total)||v<total*.4))cands.push(v);}});
  if(cands.length){if(Number.isFinite(total)){const expected=total*21/121;cands.sort((a,b)=>Math.abs(a-expected)-Math.abs(b-expected));}return cands[0];}
  return NaN;
}
function ra3Date(text){
  const t=ra3Norm(text);let m=t.match(/(?:datum\s*[:\-]?\s*)?(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})/i);
  if(!m)m=t.match(/(?:datum\s*[:\-]?\s*)?(\d{1,2})[.](\d{1,2})[.](20\d{2})/i);
  if(!m)return'';
  const d=+m[1],mo=+m[2],y=+m[3];if(d<1||d>31||mo<1||mo>12)return'';
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
async function ra3Read(file){
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''))return'';
  const blob=await ra3Blob(file),img=await ra3Image(blob);
  // Bonnen worden op mobiel meestal ongeveer gecentreerd gefotografeerd. Deze uitsneden verwijderen tafel/achtergrond.
  const fullReceipt=ra3Crop(img,.16,.03,.68,.94,1900);
  const middleReceipt=ra3Crop(img,.22,.28,.58,.48,1900);
  const totalsArea=ra3Crop(img,.20,.40,.62,.36,2100);
  const fullGray=ra3Enhance(fullReceipt,false),middleGray=ra3Enhance(middleReceipt,false),totalsBw=ra3Enhance(totalsArea,true);
  return ra3Ocr([fullGray,middleGray,totalsBw]);
}

document.addEventListener('change',event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='receiptFile'||!input.files?.[0])return;
  const file=input.files[0];if(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''))return;
  setTimeout(async()=>{
    const status=ra3('receiptReadStatus');
    try{
      if(status)status.textContent='Bon gericht uitlezen: kassabon uitsnijden en totaal/btw controleren…';
      const text=await ra3Read(file),total=ra3FindTotal(text),vat=ra3FindVat(text,total),date=ra3Date(text);
      const totalEl=ra3('rTotal'),vatEl=ra3('rVat'),dateEl=ra3('rDate');
      if(Number.isFinite(total)&&totalEl)totalEl.value=total.toFixed(2);
      if(Number.isFinite(vat)&&vatEl)vatEl.value=vat.toFixed(2);
      if(date&&dateEl)dateEl.value=date;
      if(status){
        const parts=[];if(Number.isFinite(total))parts.push(`totaal € ${total.toFixed(2)}`);if(Number.isFinite(vat))parts.push(`btw € ${vat.toFixed(2)}`);if(date)parts.push(`datum ${date.split('-').reverse().join('-')}`);
        status.textContent=parts.length?`Bon gericht gecontroleerd: ${parts.join(', ')}. Controleer de groene velden.`:'De gerichte boncontrole kon de bedragen nog niet betrouwbaar lezen. Controleer totaal en btw handmatig.';
      }
    }catch(e){console.error('receipt amount OCR v3',e);if(status)status.textContent='Gerichte boncontrole lukte niet. Controleer totaal en btw handmatig.';}
  },1800);
});
