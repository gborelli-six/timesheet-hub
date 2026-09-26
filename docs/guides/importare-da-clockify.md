# Come importare le ore da Clockify

Questa guida spiega come scaricare le proprie ore direttamente da Clockify, invece di compilare e caricare un file Excel, e come completare l'importazione verso i sistemi aziendali (Odoo, Jira, ...).

**Ruoli:** Dipendente

---

## Prerequisiti

- Hai effettuato l'accesso con il tuo account Google aziendale (`@sixfeetup.it`)
- Hai configurato un **connettore Clockify** nel tuo profilo, con la tua API key personale — vedi [Configurare i connettori](configurare-i-connettori.md#clockify)
- Hai anche configurato almeno un connettore di **destinazione** (Odoo, Jira, ...): Clockify da solo non basta a completare un'importazione, vedi sotto

---

## Il concetto chiave: sorgente vs. destinazione

Clockify e i backend aziendali (Odoo, Jira) svolgono due ruoli opposti nel flusso di importazione:

| | Ruolo | Cosa fa |
|---|---|---|
| **Clockify** | Sorgente | Da qui si **leggono** le ore già registrate durante il periodo |
| **Odoo / Jira** | Destinazione | Qui le ore vengono **scritte**, cioè effettivamente rendicontate |

Un'importazione da Clockify richiede quindi **entrambi**: prima scarichi le voci da Clockify, poi le assegni a uno o più connettori di destinazione (esattamente come faresti con le righe di un file Excel). Clockify non compare mai come destinazione: non è possibile "scrivere" ore su Clockify da Timesheet Hub.

---

## Quando compare lo step "Sorgente"

Il wizard di importazione mostra uno step iniziale **"Sorgente"** — con la scelta tra "File Excel" e i tuoi connettori Clockify — **solo se hai configurato almeno un connettore di tipo sorgente** (oggi solo Clockify).

- **Hai un connettore Clockify configurato** → il wizard si apre a 4 step: **Sorgente → Periodo → Verifica e assegna → Conferma**.
- **Non hai nessun connettore sorgente** → il wizard si apre direttamente sull'upload del file Excel, a 3 step (**Upload → Verifica e assegna → Conferma**), esattamente come descritto in [Come caricare il file timesheet](excel-upload.md). Non vedrai alcuno step "Sorgente": non è un errore, significa solo che non hai ancora configurato una sorgente API.

Questa scelta viene decisa una sola volta all'apertura della pagina **Importa timesheet**: se aggiungi un connettore Clockify mentre il wizard è già aperto, il passaggio in più non compare finché non esci e rientri nella pagina.

---

## Come importare da Clockify

### Passo 1 — Apri l'importazione

Nel menu laterale, clicca su **Importa timesheet**.

### Passo 2 — Scegli la sorgente

Nello step **Sorgente**, clicca sulla card con il nome del tuo connettore Clockify (es. "Clockify"). La card indica: *"Scarica le voci da Clockify per un periodo a scelta."*

### Passo 3 — Scegli il periodo e scarica

Nello step successivo:

1. I campi **Dal** e **Al** sono precompilati con il **mese corrente**; modificali se ti serve un periodo diverso.
2. Clicca **Scarica voci**.

Se il periodo non è valido (la data di fine precede quella di inizio) il campo **Al** si evidenzia in rosso con il messaggio *"La data di fine deve seguire quella di inizio."* e il pulsante resta disabilitato finché non correggi.

A download completato, un'etichetta verde conferma il risultato: **"N voci scaricate"** (o **"Nessuna voce trovata nel periodo selezionato"** se il periodo non contiene registrazioni). Clicca **Avanti** per proseguire.

### Passo 4 — Verifica e assegna

Le voci scaricate entrano nella stessa schermata di anteprima usata per l'upload Excel: per ciascuna riga assegni uno o più connettori di **destinazione** (Odoo, Jira, ...), scegliendo progetto e task remoto. Dalla seconda importazione in poi, le associazioni già usate in passato vengono suggerite automaticamente (badge tratteggiato "= suggerito"): restano sempre modificabili prima di confermare.

A differenza delle righe da Excel, le righe scaricate da Clockify **non generano warning**: arrivano già in un formato validato dal backend, non c'è un file da controllare.

### Passo 5 — Conferma

Rivedi il riepilogo (periodo, righe importabili, connettori coinvolti) e clicca **Conferma importazione**. Da questo momento le righe vengono scritte sui backend assegnati: l'operazione è irreversibile.

---

## Come vengono aggregate le voci

Clockify registra il tempo a livello di singola sessione di lavoro; Timesheet Hub le raggruppa prima di mostrarle in anteprima:

- Le voci che condividono **stesso giorno, stesso progetto, stesso task e stessa nota** vengono **sommate in un'unica riga**.
- Se due sessioni sullo stesso progetto/task nello stesso giorno hanno **note diverse**, restano **righe separate** — la nota fa parte della chiave di raggruppamento.
- Le ore risultanti sono **arrotondate a due decimali** (es. 1 minuto e 40 secondi diventano `0.03` ore).

## Voci senza progetto o task

Se in Clockify hai registrato del tempo senza assegnarlo a un progetto o a un task, la riga corrispondente compare in anteprima con i segnaposto **`— No project —`** e/o **`— No task —`**. Puoi comunque assegnarla a un connettore di destinazione come qualsiasi altra riga; ti conviene però tornare su Clockify e completare l'assegnazione, per non perdere il riferimento la prossima volta.

---

## Quando qualcosa va storto

Se lo scarico fallisce, sotto i campi data compare un riquadro rosso **"Scarico non riuscito"** con il messaggio restituito dal sistema.

| Situazione | Cosa vedi | Cosa fare |
|---|---|---|
| **Credenziali scadute o non valide** | Il messaggio è seguito dal link **"Aggiorna il token nel Profilo"** | Vai su **Profilo**, apri il connettore Clockify e incolla una nuova API key (vedi [Configurare i connettori](configurare-i-connettori.md)) |
| **Clockify non raggiungibile** | Il messaggio è seguito dal pulsante **"Riprova"** | Clicca **Riprova**; se il problema persiste, attendi qualche minuto o contatta il supporto IT |
| **Periodo troppo ampio** | Il messaggio riporta che il periodo non può superare 366 giorni | Restringi l'intervallo **Dal**/**Al** ed effettua un nuovo download |
| Nessuno dei casi sopra | Messaggio generico: *"Impossibile scaricare le voci dalla sorgente. Riprova più tardi."* | Riprova; se persiste, contatta il supporto IT |

---

## Limiti

- Il periodo di un singolo scarico non può superare **366 giorni**.
- Ogni scarico sostituisce le righe eventualmente già presenti in anteprima in questa sessione del wizard: se hai bisogno di più periodi, effettua importazioni separate.

---

## Domande frequenti

**Ho configurato Clockify ma non vedo lo step "Sorgente"**
→ Esci dalla pagina di importazione e rientraci: la scelta tra wizard a 3 o 4 step viene fatta solo all'apertura della pagina.

**Posso importare da Clockify e da Excel nella stessa importazione?**
→ No, ogni importazione ha un'unica sorgente. Se ti servono righe da entrambe, esegui due importazioni separate.

**Le mie voci Clockify vengono scritte automaticamente su Odoo/Jira?**
→ No: lo scarico da Clockify popola solo l'anteprima. Nulla viene scritto finché non assegni le righe a un connettore di destinazione e confermi l'importazione (Passo 5).
