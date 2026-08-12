const hro=id=>document.getElementById(id);
let hroTesseractPromise=null,hroHeicPromise=null;

async function hroLoadScript(src,test){
  if(test())return;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Bibliotheek kon niet worden geladen'));document.head.appendChild(s);});
}
async function hroEnsureTesseract(){
  if(window.Tesseract&&typeof window.Tesseract.createWorker==='function')return window.Tesseract;
  if(!hroTesseractPromise)hroTesseractPromise=hroLoadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',()=>!!(window.Tesseract&&typeof window.Tesseract.createWorker==='function')).then(()=>window.Tesseract);
  return hroTesseractPromise;
}
async function hroEnsureHeic(){
  if(window.HeicTo)return window.HeicTo;
  if(!hroHeicPromise)hroHeicPromise=hroLoadScript('https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js',()=>!!window.HeicTo).then(()=>window.HeicTo);
  return hroHeicPromise;
}
function hroNorm(s){return String(s||'').replace(/\r/g,'').replace(/[\u00a0\u202f]/g,' ').replace(/[|]/g,'1').replace(/(\d)[oO](?=\d)/g,'$10').replace(/(\d)[lI](?=\d|\b)/g,'$11');}
function hroNum(s){s=String(s||'').replace(/[€EUR\s]/gi,'').replace(/[^0-9,.-]/g,'');if(!s)return NaN;const c=s.lastIndexOf(','),d=s.lastIndexOf('.');if(c>=0&&d>=0)s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(c>=0)s=s.replace(/\./g,'').replace(',','.');return Number(s);}
function hroAmounts(line){const s=hroNorm(line).replace(/(\d{1,5})\s+(\d{2})(?!\d)/g,'$1,$2');const out=[];for(const m of s.matchAll(/(?:€\s*)?(\d{1,5}(?:[.,]\d{2}))(?:\s*(?:€|EUR))?/gi)){const n=hroNum(m[1]);if(Number.isFinite(n)&&n>=0&&n<10000)out.push(n);}return out;}
function hroSupplier(t,file){if(/\bGAMMA\b/i.test(t))return'Gamma';if(/\bPRAXIS\b/i.test(t))return'Praxis';if(/\bKARWEI\b/i.test(t))return'Karwei';if(/\bHORNBACH\b/i.test(t))return'Hornbach';return String(file?.name||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\b(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\b.*$/i,'').replace(/\b\d{1,2}\b.*$/,'').trim();}
function hroDate(t){let m=hroNorm(t).match(/(?:datum\s*[:.-]?\s*)?(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})/i);if(!m)m=hroNorm(t).match(/\bdd\.?\s*(\d{1,2})-(\d{1,2})-(20\d{2})/i);if(!m)return'';const d=+m[1],mo=+m[2],y=+m[3];if(d<1||d>31||mo<1||mo>12)return'';return`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function hroMethod(t){if(/maestro|mastercard|visa|pin|kaart|debit|contactless/i.test(t))return'Pin';if(/contant|cash/i.test(t))return'Contant';if(/ideal|i-deal/i.test(t))return'iDEAL';return'Bank';}
function hroTotal(t){const lines=hroNorm(t).split(/\n+/).map(x=>x.trim()).filter(Boolean);const best=[];for(let i=0;i<lines.length;i++){if(/\b(?:9\s*)?t[o0]taal\b|tot\.?\s*omzet|te\s*betalen|eindt[o0]taal/i.test(lines[i])){const vals=hroAmounts(lines[i]+' '+(lines[i+1]||''));best.push(...vals.filter(v=>v>0));}}if(best.length){const freq={};best.forEach(v=>freq[v]=(freq[v]||0)+1);return Number(Object.keys(freq).sort((a,b)=>freq[b]-freq[a]||Number(b)-Number(a))[0]);}const all=[];for(const l of lines){if(/btw|vat|tax|%/i.test(l))continue;all.push(...hroAmounts(l).filter(v=>v>0));}return all.length?Math.max(...all):NaN;}
function hroVat(t,total){
  const lines=hroNorm(t).split(/\n+/).map(x=>x.trim()).filter(Boolean),maxVat=Number.isFinite(total)?total*.35:9999,rateMap=new Map();
  for(let i=0;i<lines.length;i++){
    const line=lines[i];if(!/btw|vat|tax/i.test(line))continue;
    const rm=line.match(/(?:btw|vat|tax)\s*([0-9]{1,2})(?:[,.]0+)?\s*%/i)||line.match(/([0-9]{1,2})(?:[,.]0+)?\s*%/i);if(!rm)continue;
    const rate=Number(rm[1]);if(![0,6,9,12,21].includes(rate))continue;
    const joined=line+' '+(lines[i+1]||'');let candidate=NaN;const eq=joined.match(/(?:=|:)[^0-9]{0,8}(\d{1,4}(?:[.,]\d{2}))/);if(eq)candidate=hroNum(eq[1]);
    if(!Number.isFinite(candidate)){const vals=hroAmounts(joined).filter(v=>v>0&&v<=maxVat);if(vals.length)candidate=vals[vals.length-1];}
    if(Number.isFinite(candidate)&&candidate>0&&candidate<=maxVat){const cur=rateMap.get(rate);if(!cur)rateMap.set(rate,{value:candidate,count:1});else if(Math.abs(cur.value-candidate)<.02)cur.count++;else if(candidate<cur.value)rateMap.set(rate,{value:candidate,count:1});}
  }
  const comp=[...rateMap.values()].map(x=>x.value).filter(v=>v>0),sum=comp.length?Number(comp.reduce((a,b)=>a+b,0).toFixed(2)):NaN,explicit=[];
  for(let i=0;i<lines.length;i++){if(!/(?:tot\.?\s*btw|t[o0]t\.?\s*btw|btw\s*totaal|total\s*vat)/i.test(lines[i]))continue;const win=[lines[i],lines[i+1]||'',lines[i+2]||''].join(' ');explicit.push(...hroAmounts(win).filter(v=>v>0&&v<=maxVat));}
  if(explicit.length){if(Number.isFinite(sum)){explicit.sort((a,b)=>Math.abs(a-sum)-Math.abs(b-sum));if(Math.abs(explicit[0]-sum)<=.20)return Number(explicit[0].toFixed(2));}explicit.sort((a,b)=>b-a);return Number(explicit[0].toFixed(2));}
  return Number.isFinite(sum)?sum:NaN;
}
async function hroImage(file){let blob=file;if(/\.hei[cf]$/i.test(file?.name||'')||/^image\/hei[cf]$/i.test(file?.type||'')){const HeicTo=await hroEnsureHeic();let out=await HeicTo({blob:file,type:'image/jpeg',quality:.98});blob=Array.isArray(out)?out[0]:out;}const url=URL.createObjectURL(blob);try{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});return img;}finally{setTimeout(()=>URL.revokeObjectURL(url),2000);}}
function hroBase(img){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,sx=Math.round(iw*.16),sy=Math.round(ih*.015),sw=Math.round(iw*.68),sh=Math.round(ih*.97),scale=Math.min(2.3,2000/sw),c=document.createElement('canvas');c.width=Math.round(sw*scale);c.height=Math.round(sh*scale);const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);return c;}
function hroEnhance(src,bw=false){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0);const im=x.getImageData(0,0,c.width,c.height),d=im.data;for(let i=0;i<d.length;i+=4){let g=.299*d[i]+.587*d[i+1]+.114*d[i+2];g=bw?(g>176?255:0):Math.max(0,Math.min(255,(g-128)*1.7+128));d[i]=d[i+1]=d[i+2]=g;}x.putImageData(im,0,0);return c;}
function hroCrop(src,a,b){const c=document.createElement('canvas'),y=Math.round(src.height*a),h=Math.max(1,Math.round(src.height*(b-a)));c.width=src.width;c.height=h;c.getContext('2d').drawImage(src,0,y,src.width,h,0,0,src.width,h);return c;}
async function hroOcr(canvases,status){const T=await hroEnsureTesseract();if(!T||typeof T.createWorker!=='function')throw new Error('Tesseract is niet geladen');const worker=await T.createWorker('nld+eng');try{await worker.setParameters({preserve_interword_spaces:'1'});const texts=[];for(let i=0;i<canvases.length;i++){if(status)status.textContent=`Bon uitlezen… stap ${i+1} van ${canvases.length}`;const r=await worker.recognize(canvases[i]);texts.push(r?.data?.text||'');}return texts.join('\n--- VOLGENDE OCR PASS ---\n');}finally{await worker.terminate();}}
async function hroRead(file,status){const img=await hroImage(file),base=hroBase(img),gray=hroEnhance(base,false),bw=hroEnhance(base,true);return hroOcr([gray,hroCrop(gray,.22,.72),hroCrop(bw,.22,.72),hroCrop(gray,.40,.80)],status);}

document.addEventListener('change',event=>{
  const input=event.target;if(!(input instanceof HTMLInputElement)||input.id!=='receiptFile'||!input.files?.[0])return;
  const file=input.files[0];if(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''))return;
  setTimeout(async()=>{
    const status=hro('receiptReadStatus');
    try{
      if(status)status.textContent='Bon voorbereiden en nauwkeurig uitlezen…';
      const text=await hroRead(file,status),supplier=hroSupplier(text,file),date=hroDate(text),total=hroTotal(text),vat=hroVat(text,total),method=hroMethod(text);
      if(supplier&&hro('rSupplier'))hro('rSupplier').value=supplier;
      if(date&&hro('rDate'))hro('rDate').value=date;
      if(Number.isFinite(total)&&hro('rTotal'))hro('rTotal').value=total.toFixed(2);
      if(Number.isFinite(vat)&&hro('rVat'))hro('rVat').value=vat.toFixed(2);
      if(method&&hro('rMethod'))hro('rMethod').value=method;
      if(status){const parts=[];if(supplier)parts.push(supplier);if(date)parts.push(date.split('-').reverse().join('-'));if(Number.isFinite(total))parts.push(`totaal € ${total.toFixed(2)}`);if(Number.isFinite(vat))parts.push(`btw € ${vat.toFixed(2)}`);status.textContent=parts.length?`Bon uitgelezen: ${parts.join(' · ')}. Controleer de groene velden en sla daarna op.`:'Bon kon niet volledig automatisch worden uitgelezen. Controleer de groene velden.';}
    }catch(e){console.error('HDM receipt OCR',e);if(status)status.textContent='Bon uitlezen lukte niet volledig. Controleer de groene velden handmatig.';}
  },1200);
});
