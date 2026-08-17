(()=>{
  const byId=id=>document.getElementById(id);
  const round2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
  const vat21FromGross=total=>round2(Number(total)-Number(total)/1.21);

  function repairInvoiceVat(){
    const totalEl=byId('iTotal'),vatEl=byId('iVat');
    if(!totalEl||!vatEl)return false;
    const total=Number(totalEl.value||0),vat=Number(vatEl.value||0);
    if(!(total>0))return false;

    // Aftrekbare/verschuldigde BTW hoort nooit in de buurt van het bedrag excl. BTW te liggen.
    // De bekende fout las bijvoorbeeld 165,29 als BTW bij een totaal van 200,00.
    const clearlyWrong=!vat||vat>=total||vat>total*.35;
    if(!clearlyWrong)return false;

    const corrected=vat21FromGross(total);
    vatEl.value=corrected.toFixed(2);
    const status=byId('invoiceReadStatus');
    if(status)status.textContent=`Factuur gecontroleerd. BTW gecorrigeerd naar € ${corrected.toFixed(2).replace('.',',')} op basis van 21% over het totaal incl. btw. Controleer de groene velden.`;
    return true;
  }

  document.addEventListener('change',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='invoiceFile'||!input.files?.[0])return;

    // app.js en parser-v3 lezen hetzelfde document asynchroon. We controleren daarom
    // enkele seconden door, zodat ook een late foutieve parserwaarde wordt hersteld.
    let checks=0;
    const timer=setInterval(()=>{
      repairInvoiceVat();
      checks++;
      if(checks>=40)clearInterval(timer);
    },300);
  });
})();
