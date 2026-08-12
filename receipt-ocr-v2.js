const roEl=id=>document.getElementById(id);

function roHeic(file){return /\.(heic|heif)$/i.test(file?.name||'')||/^image\/hei[cf]$/i.test(file?.type||'');}
let roHeicPromise=null;
async function roHeicTo(){
  if(window.HeicTo)return window.HeicTo;
  if(!roHeicPromise)roHeicPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js';
    s.onload=()=>window.HeicTo?resolve(window.HeicTo):reject(new Error('HEIC converter niet geladen'));
    s.onerror=()=>reject(new Error('HEIC converter niet geladen'));
    document.head.appendChild(s);
  });
  return roHeicPromise;
}
async function roImageBlob(file){
  if(!roHeic(file))return file;
  const HeicTo=await roHeicTo();
  const out=await HeicTo({blob:file,type:'image/jpeg',quality:0.96});
  return Array.isArray(out)?out[0]:out;
}
async function roLoadImage(blob){
  const url=URL.createObjectURL(blob);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
    return img;
  }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
function roCanvas(img){
  const maxSide=2400,scale=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
  const w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,w,h);
  return c;
}
function roEnhance(src,threshold=false){
  const c=document.createElement('canvas');c.width=src.width;c.height=src.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
  const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
  for(let i=0;i<d.length;i+=4){
    let g=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    if(threshold)g=g>178?255:0;else g=Math.max(0,Math.min(255,(g-128)*1.55+128));
    d[i]=d[i+1]=d[i+2]=g;
  }
  ctx.putImageData(im,0,0);return c;
}
function roCropBottom(src,ratio=.62){
  const y=Math.round(src.height*(1-ratio)),h=src.height-y;
  const c=document.createElement('canvas');c.width=src.width;c.height=h;
  c.getContext('2d').drawImage(src,0,y,src.width,h,0,0,src.width,h);return c;
}
async function roOcrMany(canvases){
  const {createWorker}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
  const worker=await createWorker('nld+eng');
  try{
    await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});
    const texts=[];
    for(const c of canvases){const r=await worker.recognize(c);if(r?.data?.text)texts.push(r.data.text);}
    return texts.join('\n--- OCR PASS ---\n');
  }finally{await worker.terminate();}
}
function roFix(s){
  return String(s||'')
    .replace(/(\d)[oO](?=\d)/g,'$10')
    .replace(/(\d)[lI|](?=\d|\b)/g,'$11')
    .replace(/(\d{1,5})\s+(\d{2})(?!\d)/g,'$1,$2');
}
function roMoney(token){
  let s=roFix(token).replace(/[^0-9,.-]/g,'');
  if(!s)return NaN;
  const c=s.lastIndexOf(','),d=s.lastIndexOf('.');
  if(c>=0&&d>=0)s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(c>=0)s=s.replace(/\./g,'').replace(',','.');
  const n=Number(s);return Number.isFinite(n)?n:NaN;
}
function roAmounts(line){
  const s=roFix(line),re=/(?:€\s*)?(\d{1,5}(?:[.,]\d{2}|\s\d{2}))(?:\s*€)?/g,out=[];
  for(const m of s.matchAll(re)){const n=roMoney(m[1]);if(Number.isFinite(n)&&n>0&&n<100000)out.push(n);}
  return out;
}
function roFindTotal(text){
  const lines=String(text||'').split(/\n+/).map(roFix).map(x=>x.trim()).filter(Boolean);
  const keys=/\b(t[o0]taal|eindt[o0]taal|grand\s*total|te\s*betalen|amount\s*due|betaald|bedrag)\b/i;
  const scored=[];
  lines.forEach((line,i)=>{
    if(!keys.test(line))return;
    const vals=roAmounts(line+' '+(lines[i+1]||''));
    for(const v of vals)scored.push({v,score:/t[o0]taal|te\s*betalen|grand\s*total/i.test(line)?3:1});
  });
  if(scored.length){scored.sort((a,b)=>b.score-a.score||b.v-a.v);return scored[0].v;}
  const all=[];for(const line of lines){if(/\b(?:btw|vat|tax)\b|%/.test(line.toLowerCase()))continue;all.push(...roAmounts(line));}
  return all.length?Math.max(...all):NaN;
}
function roFindVat(text,total){
  const lines=String(text||'').split(/\n+/).map(roFix).map(x=>x.trim()).filter(Boolean),cands=[];
  for(let i=0;i<lines.length;i++){
    if(!/(btw|vat|omzetbelasting|tax)/i.test(lines[i]))continue;
    for(let j=i;j<=Math.min(i+3,lines.length-1);j++){
      const vals=roAmounts(lines[j]);
      for(const v of vals){if(!Number.isFinite(total)||v<total)cands.push(v);}
    }
  }
  if(cands.length){
    const plausible=cands.filter(v=>!Number.isFinite(total)||v<=Math.max(1,total*.35));
    const pool=plausible.length?plausible:cands;
    if(Number.isFinite(total)){const expected=total*21/121;pool.sort((a,b)=>Math.abs(a-expected)-Math.abs(b-expected));}
    return pool[0];
  }
  const has21=/(21\s*%|21\s*procent)/i.test(text),hasOther=/(9\s*%|6\s*%)/i.test(text);
  if(Number.isFinite(total)&&has21&&!hasOther)return total*21/121;
  return NaN;
}
async function roReadReceipt(file){
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''))return'';
  const blob=await roImageBlob(file),img=await roLoadImage(blob),base=roCanvas(img);
  const gray=roEnhance(base,false),bw=roEnhance(base,true),bottom=roCropBottom(gray,.68),bottomBw=roCropBottom(bw,.68);
  return roOcrMany([gray,bottom,bottomBw]);
}

document.addEventListener('change',event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='receiptFile'||!input.files?.[0])return;
  const file=input.files[0];
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''))return;
  setTimeout(async()=>{
    const status=roEl('receiptReadStatus');
    try{
      if(status)status.textContent='Bedragen extra controleren: totaal en btw opnieuw uitlezen…';
      const text=await roReadReceipt(file),total=roFindTotal(text),vat=roFindVat(text,total);
      const totalEl=roEl('rTotal'),vatEl=roEl('rVat');
      if(Number.isFinite(total)&&totalEl)totalEl.value=total.toFixed(2);
      if(Number.isFinite(vat)&&vatEl)vatEl.value=vat.toFixed(2);
      if(status){
        if(Number.isFinite(total)&&Number.isFinite(vat))status.textContent=`Bon opnieuw gecontroleerd. Totaal € ${total.toFixed(2)} en btw € ${vat.toFixed(2)} herkend. Controleer de groene velden.`;
        else if(Number.isFinite(total))status.textContent=`Totaal € ${total.toFixed(2)} herkend. BTW kon nog niet betrouwbaar worden gelezen; controleer het btw-veld.`;
        else status.textContent='De bedragen zijn na meerdere OCR-pogingen nog niet betrouwbaar leesbaar. Controleer totaal en btw handmatig.';
      }
    }catch(e){console.error('receipt OCR v2',e);if(status)status.textContent='Extra bedragcontrole lukte niet. Controleer totaal en btw handmatig.';}
  },900);
});
