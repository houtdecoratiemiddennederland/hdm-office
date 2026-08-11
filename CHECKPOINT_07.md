# HDM Office – Checkpoint 07

Status: mobiele Next-versie live op Vercel, gekoppeld aan GitHub en Supabase.

## Gereed
- Login werkt via officiële Supabase-authenticatie en sessie blijft bewaard.
- Inlogscherm wordt na succesvolle login volledig verborgen.
- Mobiel verticaal scrollen en horizontaal swipen van tabellen/navigatie verbeterd.
- Cloudadministratie blijft centraal in Supabase.
- Duidelijke dubbele Gamma-bon verwijderd.
- 123inkt-factuur €256,03 gecorrigeerd van foutieve €80,42 btw naar €44,43 btw.
- Gamma juli 6 gecorrigeerd naar €8,07 btw (21% + 9%).
- Gamma 1 juli gecorrigeerd naar werkelijk betaald €17,71 en €3,07 btw na puntenkorting.
- Drie bonnen zonder betrouwbaar zichtbaar btw-bedrag gemarkeerd als `vatReview=true` en tellen niet meer mee in Q3-btw totdat officiële btw-factuur is gecontroleerd.
- Dashboard toont nu gecontroleerde BTW bonnetjes Q3, aantal BTW-bonnen te controleren en mogelijke dubbele bonnen.
- Boekhouding gebruikt alleen gecontroleerde bon-btw voor het voorlopige Q3-overzicht.

## Stand na correcties
- 15 bonnen in cloud.
- Inkoopkosten: €2.131,81.
- Gecontroleerde BTW bonnetjes Q3: €292,22.
- 3 btw-bonnen staan nog op controleren en worden niet meegerekend.
- BTW klantfacturen Q3 blijft €1.235,72 volgens huidige factuurdata.

## Volgende stap
- De 3 gemarkeerde bonnen vervangen/controleren met officiële btw-facturen.
- Bij toekomstige bon-upload automatisch duplicaten signaleren vóór opslaan en btw alleen automatisch boeken wanneer het document een betrouwbaar btw-bedrag bevat.
- Daarna toevoegen/bewerken en OCR-uploadfunctionaliteit verder uitbouwen in HDM Office Next.
