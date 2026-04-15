# Testi pronti per form upload progetto casco

## Checkbox obbligatorie (non preselezionate)

1. `Dichiaro di aver letto la Privacy Policy e di aver compreso le finalita del trattamento dei miei dati personali.`
2. `Accetto i Termini di utilizzo del servizio.`
3. `Dichiaro di avere i diritti necessari sui contenuti caricati e autorizzo il trattamento dei file esclusivamente per l'analisi e la gestione della mia richiesta.`

## Testi brevi vicino all'upload

- `Non caricare dati sanitari o altre categorie particolari di dati personali, salvo stretta necessita.`
- `Formati ammessi: PDF, PNG, JPEG, GIF, WEBP. Dimensione massima per file: 15 MB.`
- `I file saranno usati solo per valutare e sviluppare la richiesta progetto.`
- `Se hai meno di 14 anni, invia la richiesta solo con il consenso di un genitore o tutore.`

## Log da registrare lato backend (compliance minima)

- versione Privacy Policy accettata
- versione Termini accettata
- timestamp ISO dell'accettazione
- identificativo utente/richiesta
- indirizzo IP e user-agent (nei limiti necessari alla sicurezza)

## Retention consigliata (da adattare)

- richieste senza seguito: 12 mesi
- richieste con trattativa attiva: durata trattativa + 24 mesi
- eventuali dati amministrativi/contrattuali: fino a 10 anni (se applicabile)

## Note operative

- Le checkbox obbligatorie devono bloccare l'invio se non selezionate.
- Non usare checkbox di consenso marketing se non svolgi marketing diretto.
- Prevedi endpoint/contatto per esercizio diritti privacy (accesso, rettifica, cancellazione).
