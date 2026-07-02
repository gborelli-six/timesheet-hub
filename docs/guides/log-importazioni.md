# Come consultare lo storico delle importazioni

Questa guida spiega come accedere al log delle importazioni, leggere l'esito di ciascuna voce e interpretare gli errori sulle singole righe.

**Ruoli:** Dipendente

---

## Prerequisiti

- Hai effettuato l'accesso con il tuo account Google aziendale (`@sixfeetup.it`)
- Hai completato almeno una importazione (il log è vuoto se non ne hai mai eseguite)

---

## 1. Come accedere allo storico

Nel menu laterale, clicca su **Log Importazioni**.

La pagina mostra l'elenco di tutte le importazioni che hai eseguito personalmente, ordinate dalla più recente alla più vecchia. Non è possibile vedere le importazioni di altri dipendenti: ciascun utente vede solo i propri log.

---

## 2. La lista delle importazioni

La tabella mostra una riga per ogni importazione completata.

| Colonna | Contenuto |
|---|---|
| **Data** | Data e ora in cui è stata confermata l'importazione |
| **Periodo** | Intervallo di date coperto dalle righe del timesheet (es. `01/06/2026 – 30/06/2026`) |
| **Backend** | Connettore o connettori su cui è stata eseguita l'importazione (es. `Odoo`, `Jira`) |
| **Righe ok / fail** | Numero di righe importate con successo e numero di righe fallite |
| **Esito** | Badge colorato che riassume l'esito complessivo |

### Significato dei badge esito

| Badge | Colore | Significato |
|---|---|---|
| **Successo** | Verde | Tutte le righe sono state importate correttamente su tutti i backend |
| **Parziale** | Arancione | L'importazione è stata completata ma almeno una riga o un backend ha restituito un errore |
| **Fallito** | Rosso | Nessuna riga è stata importata (errore di connessione, credenziali non valide o rifiuto del backend) |

---

## 3. Filtri

Sopra la tabella sono disponibili tre filtri per restringere la lista:

- **Periodo (da / a)**: mostra solo le importazioni il cui campo `created_at` ricade nell'intervallo selezionato. Lascia un campo vuoto per non impostare il limite inferiore o superiore.
- **Backend**: seleziona uno o più connettori per vedere solo le importazioni che li coinvolgono (es. solo `Odoo`, solo `Jira`, o entrambi).
- **Esito**: filtra per `Successo`, `Parziale` o `Fallito`.

Il pulsante **Reimposta filtri** annulla tutte le selezioni attive e mostra di nuovo l'intera lista.

---

## 4. Il dettaglio di un'importazione

Clicca su una riga della lista per aprire il pannello di dettaglio.

### Metadati dell'importazione

In cima al dettaglio trovi il riepilogo dell'operazione:

| Campo | Descrizione |
|---|---|
| **Periodo** | Intervallo di date del timesheet importato |
| **Esito** | Badge con il risultato complessivo (successo / parziale / fallito) |
| **Righe totali** | Numero di righe presenti nel file Excel |
| **Righe ok** | Righe importate con successo (su tutti i backend assegnati) |
| **Righe fallite** | Righe con almeno un backend che ha restituito errore |

### Tabella delle righe

Sotto il riepilogo trovi la tabella dettagliata, **raggruppata per riga Excel**. Per ogni riga del foglio viene mostrato un blocco con:

- **Numero riga** — indice 1-based come nel foglio Excel originale
- **Progetto / Task** — valori letti dal file Excel

Per ciascuna riga sono elencate le assegnazioni ai backend, una per riga. Ogni assegnazione mostra:

| Campo | Descrizione |
|---|---|
| **Connettore** | Label del connettore usato (es. "Odoo Aziendale") |
| **Progetto remoto** | Nome del progetto sul sistema di destinazione |
| **Task remoto** | Nome o codice del task sul sistema di destinazione |
| **Ore** | Ore inviate al backend |
| **Esito** | Badge successo o fallito per questa specifica assegnazione |

---

## 5. Leggere gli errori

Le assegnazioni fallite mostrano sotto l'esito un **messaggio di errore in rosso** che riporta la causa del problema restituita dal backend remoto.

Esempi di messaggi comuni:

| Messaggio | Causa probabile | Cosa fare |
|---|---|---|
| `Authentication failed` / `Token scaduto` | Le credenziali del connettore non sono più valide | Vai su **Profilo → Connettori** e aggiorna il token per il backend interessato |
| `Project not found` | Il progetto remoto selezionato non esiste o non è accessibile | Avvia una nuova importazione e scegli un progetto diverso |
| `Task not found` | Il task remoto è stato cancellato o rinominato | Avvia una nuova importazione e seleziona il task corretto |
| `Connection error` | Il backend esterno era irraggiungibile al momento dell'importazione | Riprova più tardi; se il problema persiste contatta il supporto IT |

Se l'errore non rientra nei casi sopra o non riesci a risolverlo autonomamente, contatta il supporto IT con il testo esatto del messaggio di errore e l'identificativo dell'importazione (visibile nell'URL della pagina di dettaglio).

---

## 6. Accesso rapido dal wizard

Al termine di ogni importazione, nella schermata del risultato (Step 4 del wizard), trovi il pulsante **"Log dettagliato"**. Cliccandolo si apre direttamente il dettaglio del log appena creato, senza dover navigare manualmente alla pagina dei log.

Questa scorciatoia è utile soprattutto quando l'esito è parziale o fallito e vuoi verificare immediatamente quali righe hanno avuto problemi.
