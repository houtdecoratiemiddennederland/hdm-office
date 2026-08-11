# HDM Office — checkpoint 06

Datum: 11 augustus 2026

Stabiele basis: checkpoint 05 + HDM Office Next migratie.

## Afgerond
- Nieuwe één-projectsversie `hdm-office-next` gekoppeld aan GitHub en Vercel.
- Supabase-login vervangen door officiële clientmethode.
- Inloggen werkt op iPhone.
- Supabase-sessie wordt lokaal bewaard voor automatische herlogin.
- Mobiele layout bevat Dashboard, Klanten, Facturen, Bonnen en Boekhouding.
- Maandfilters aanwezig bij Klanten, Facturen en Bonnen.
- BTW klantfacturen en BTW bonnetjes afzonderlijk weergegeven.
- Openstaande facturen houden rekening met betaalde bedragen.
- Aanbetalingen en 60/30/10-verdeling aanwezig.
- Inlogscherm wordt na succesvolle login geforceerd verborgen via `[hidden]{display:none!important}`.
- Verticaal scrollen op iPhone verbeterd; tabellen ondersteunen tegelijk horizontaal en verticaal touch-scrollen.
- Onderste navigatie blijft horizontaal swipebaar.

## Niet wijzigen zonder expliciete opdracht
- Bestaande live `hdm-office.vercel.app` / checkpoint 05.
- Supabase clouddata en bestaande administratie.
- Bestaande berekeningslogica tenzij gebruiker specifiek een berekening wil aanpassen.

## Volgende sessie
Eerst controleren op iPhone:
1. Login blijft weg na inloggen/herladen.
2. Scrollen boven/onder werkt op alle pagina's.
3. Clouddata en dashboardbedragen kloppen.
Daarna verder met toevoegen/bewerken en upload + automatische uitlezing van bonnen en facturen.
