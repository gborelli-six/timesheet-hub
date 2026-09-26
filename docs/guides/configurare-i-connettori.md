# Configurare i connettori

I connettori collegano il tuo profilo Timesheet Hub ai backend esterni (Jira, Odoo, Clockify, ...) usati per importare o rendicontare i timesheet. Prima di poter avviare un'importazione devi configurare almeno un connettore per il servizio che utilizzi.

---

## Sorgenti e destinazioni

Ogni servizio ha un ruolo preciso: puoi **leggere** le ore da una sorgente, oppure **scrivere** le ore su una destinazione. Nessun servizio oggi fa entrambe le cose.

| Servizio | Ruolo | Disponibile |
|---|---|---|
| **Clockify** | Sorgente — da qui si leggono le ore già registrate | Sì |
| **Odoo** | Destinazione — qui le ore vengono scritte | Sì |
| **Jira** | Destinazione — qui le ore vengono scritte | Sì |
| **Linear** | Destinazione (prevista) | No — non ancora implementato |
| **Asana** | Destinazione (prevista) | No — non ancora implementato |

Linear e Asana compaiono nella schermata di creazione ma sono disabilitati (l'icona è sbiadita e non è possibile selezionarli): sono già previsti dal sistema ma non hanno ancora un'integrazione funzionante.

Nella schermata **Profilo**, i connettori già configurati sono elencati in due sezioni separate, **Sorgenti** e **Destinazioni**, per non confondere i due ruoli — l'aggiunta di un nuovo connettore resta un'unica azione (**Aggiungi connettore**), con la scelta del servizio nel drawer.

Se configuri **almeno un connettore Clockify**, il wizard di importazione mostra uno step aggiuntivo in cui puoi scegliere se importare da un file Excel o scaricare le ore direttamente da Clockify — vedi [Come importare da Clockify](importare-da-clockify.md). Senza connettori sorgente, il wizard funziona esattamente come prima: si parte sempre dall'upload del file Excel.

---

## Cos'è un connettore

Un connettore è composto da campi comuni a tutti i servizi e da campi specifici del tipo di servizio scelto.

**Campi comuni:**

| Campo | Descrizione |
|---|---|
| **Tipo di servizio** | Il backend esterno: Odoo, Jira, Clockify, Linear o Asana |
| **Nome connettore** | Un nome leggibile che assegni tu (es. "Jira Azienda", "Clockify personale") — deve essere unico tra i tuoi connettori |
| **Identificativo account** | Il tuo username, email o ID sull'altro sistema (l'etichetta del campo cambia a seconda del servizio, es. "Utente" per Odoo, "Email" per Jira) — compare solo per i servizi che lo richiedono, non per Clockify |
| **Segreto** | Il tuo API token o password — write-only, mai visualizzato dopo il salvataggio |

**Campi che dipendono dal servizio scelto** (mostrati automaticamente nel form quando selezioni il tipo):

| Servizio | Campo aggiuntivo | Obbligatorio |
|---|---|---|
| **Odoo** | URL istanza | Sì |
| | Nome database | Sì |
| **Jira** | URL istanza | Sì |
| **Clockify** | — | — (bastano nome connettore e API key) |
| **Linear / Asana** | — | — (creazione non disponibile) |

Puoi avere più connettori per lo stesso servizio con nomi diversi — utile se lavori su due istanze Jira distinte.

---

## Accedere alla schermata profilo

Clicca sull'icona **Profilo** nel menu laterale. La schermata mostra i tuoi dati utente e la lista dei connettori già configurati.

---

## Aggiungere un connettore

1. Clicca sul bottone **Aggiungi connettore** in fondo alla lista.
2. Nel drawer che si apre, seleziona il **tipo di servizio** tra i riquadri proposti (Odoo, Jira, Clockify, ...). I riquadri disabilitati (Linear, Asana) non sono selezionabili.
3. Inserisci il **nome connettore** (obbligatorio, deve essere unico tra i tuoi connettori).
4. Inserisci l'**identificativo account**, se pertinente per il servizio scelto.
5. Se richiesto dal servizio, inserisci l'**URL istanza** (Odoo, Jira) e i campi aggiuntivi (es. **Nome database** per Odoo). Clockify non ne ha.
6. Inserisci il **segreto** (API token o password) — obbligatorio.
7. Clicca **Aggiungi connettore**.

Il connettore appare in lista con il badge **Configurato**.

### Clockify

Per configurare un connettore Clockify ti serve una API key personale:

1. Accedi a [Clockify](https://clockify.me) con il tuo account.
2. Vai su **Profile settings → API** e copia la tua API key.
3. In Timesheet Hub, aggiungi un connettore scegliendo il tipo **Clockify**.
4. Incolla l'API key nel campo **API key**.

Clockify non richiede né URL istanza né identificativo account né altri campi di configurazione: è un servizio SaaS, bastano nome connettore e API key. L'importazione usa sempre il workspace di default del tuo account Clockify.

---

## Modificare un connettore

1. Clicca sulla riga del connettore per espanderla.
2. Aggiorna i campi che vuoi modificare (identificativo account, URL istanza se presente, campi specifici del servizio).
3. Il campo **Segreto** mostra `•••• già configurato` se un segreto è già presente: lascialo vuoto per non modificarlo, oppure digita il nuovo valore per sostituirlo.
4. Clicca **Aggiorna**.

Un messaggio verde **"Salvato"** conferma il salvataggio.

Il nome del connettore e il tipo di servizio sono assegnati alla creazione e non sono modificabili in seguito (servono come chiave identificativa).

> I campi di configurazione specifici del servizio (es. Nome database per Odoo) vengono **sostituiti per intero** a ogni salvataggio, non uniti al valore precedente: se svuoti un campo e salvi, quel campo resta vuoto.

---

## Eliminare un connettore

1. Espandi la riga del connettore.
2. Clicca l'icona del cestino.
3. Conferma l'operazione nella finestra di dialogo ("Elimina connettore").

L'eliminazione è permanente.

---

## Stato del connettore

| Stato | Significato |
|---|---|
| **Configurato** | Credenziali presenti e valide |
| **Da aggiornare** | Il servizio esterno ha rifiutato le credenziali; è necessario reinserire il segreto |

Se compare il banner **"Il token per questo connettore non è più valido. Inserisci un nuovo segreto per ripristinarlo."**, espandi il connettore, inserisci il nuovo segreto e clicca **Aggiorna**.

---

## Sicurezza

- Il segreto non viene mai restituito né visualizzato dopo il salvataggio — è cifrato nel database con AES-256-GCM.
- L'identificativo account è visibile in chiaro nella UI; non inserirvi dati sensibili.
- I campi di configurazione specifici del servizio (es. Nome database per Odoo) sono anch'essi in chiaro: contengono solo dati non sensibili, mai segreti.
- Il segreto viene decifrato in memoria solo al momento dell'importazione e immediatamente scartato.

Per i dettagli tecnici vedi [`ADR-005`](../adr/ADR-005-connector-credentials-security.md) e [`ADR-008`](../adr/ADR-008-import-sources.md).
