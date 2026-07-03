# Come caricare il file timesheet

Questa guida spiega come caricare il proprio file timesheet Excel in Timesheet Hub per importare le ore sui sistemi di rendicontazione aziendali.

**Ruoli:** Dipendente · HR Manager

---

## Prerequisiti

- Hai effettuato l'accesso con il tuo account Google aziendale (`@sixfeetup.it`)
- Hai configurato almeno un connettore nel tuo profilo (menu in alto a destra → Profilo)
- Hai il file Excel del timesheet pronto

---

## Il file Excel

Il file deve seguire il **template aziendale standard**. Colonne richieste (intestazioni esatte):

| Colonna | Intestazione | Obbligatoria |
|---|---|---|
| Data | `Data` | No — se assente le righe vengono importate senza data |
| Progetto | `Progetto` | Si |
| Task | `Task` | Si |
| Ore | `Ore` | Si |
| Note | `Note` | No |

> Le intestazioni sono **case-sensitive** e devono corrispondere esattamente al template standard. Se usi un template modificato, contatta l'Admin per aggiornare il mapping colonne.

**Formati data accettati:**
- Celle formattate come data in Excel (consigliato)
- Testo ISO: `2026-01-15`
- Testo italiano: `15/01/2026`

---

## Come caricare il file

### Passo 1 — Accedi alla pagina di importazione

Nel menu laterale, clicca su **Importa timesheet**.

### Passo 2 — Carica il file

Hai due opzioni:
- **Trascina** il file Excel direttamente nell'area tratteggiata
- Clicca **Sfoglia** e seleziona il file dal tuo computer

**Formato accettato:** `.xlsx`  
**Dimensione massima:** 5 MB

Appena il file viene caricato, l'applicazione lo analizza automaticamente (pochi secondi). Se il file è valido, vedi il nome del file e una conferma verde.

### Passo 3 — Revisiona l'anteprima

L'applicazione mostra una tabella con tutte le righe del tuo timesheet. In cima alla tabella trovi un riepilogo:
- **"X righe valide · Y righe con warning"** — se ci sono anomalie
- Nessun riepilogo — se tutte le righe sono corrette

---

## Interpretare i warning

Le righe con anomalie vengono evidenziate con sfondo arancione e un'icona nella colonna **Stato**. Passa il mouse sull'icona per vedere il dettaglio.

| Warning | Significato | Cosa fare |
|---|---|---|
| `MISSING_PROJECT` | La colonna **Progetto** è vuota in questa riga | Controlla e ricompila il file |
| `MISSING_TASK` | La colonna **Task** è vuota in questa riga | Controlla e ricompila il file |
| `MISSING_HOURS` | La colonna **Ore** è assente o contiene un valore non numerico | Controlla e ricompila il file |
| `INVALID_DATE` | La data non è nel formato riconosciuto (`YYYY-MM-DD` o `DD/MM/YYYY`) | Correggi il formato data nel file |
| `MISSING_PERIOD` | La colonna **Ore** è assente dall'intero file | Il file usa un template diverso — ricarica il file corretto |

---

## Quando procedere nonostante i warning

I warning **non bloccano** l'importazione: il pulsante **"Avanti"** è sempre attivo.

Puoi procedere se:
- I warning riguardano poche righe con dati non essenziali (es. data mancante, note vuote)
- Sei consapevole che le righe con `MISSING_PROJECT` o `MISSING_TASK` potrebbero non essere importate correttamente su tutti i backend

---

## Assegnare i connettori alle righe

Nello step **"Verifica e assegna"** ogni riga va associata a uno o più connettori (Odoo, Jira, …) con il relativo progetto e task remoto. Clicca **"+ Assegna"** su una riga per aprire il pannello di assegnazione. Solo le righe con almeno un connettore verranno importate.

Dalla **seconda importazione** in poi le associazioni vengono **pre-compilate automaticamente** in base allo storico delle tue importazioni precedenti (icona ✨ *Suggerito*). Sono sempre modificabili.

### Precompila righe simili

Alla **prima importazione**, o quando compaiono **nuovi progetti/attività** non ancora presenti nello storico, puoi risparmiare tempo con il pulsante **"Precompila righe simili"** (in cima alla tabella):

1. Assegna manualmente **almeno una** riga.
2. Il testo accanto al pulsante indica quante righe ancora vuote condividono lo **stesso progetto e task** di righe già assegnate.
3. Clicca **"Precompila righe simili"**: quelle righe ricevono automaticamente gli **stessi connettori** (marcati come *Suggerito*).

Il match è **esatto** su progetto + task (ignorando maiuscole/minuscole e spazi in eccesso): righe con progetto o task diverso non vengono toccate. Puoi sempre rivedere o modificare le assegnazioni precompilate prima di confermare.

---

## Quando ricaricare il file

Ricarica il file se:
- Vedi il warning **`MISSING_PERIOD`** (manca l'intera colonna Ore) — significa che stai usando il template sbagliato
- Molte righe hanno `MISSING_PROJECT` o `MISSING_TASK` — indica un problema strutturale al file
- I dati nell'anteprima non corrispondono a ciò che ti aspetti

Per ricaricare: clicca **"Indietro"** → lo step di upload si azzera → trascina o seleziona il nuovo file.

---

## HR Manager: importare per conto di un dipendente

Se sei HR Manager, prima di caricare il file seleziona il dipendente per cui stai operando (Step 0 del wizard). Il resto del flusso è identico. Il log dell'importazione registra sia il dipendente di riferimento sia il tuo account.

---

## Problemi comuni

**Il file viene rifiutato con "Formato non supportato"**  
→ Salva il file come `.xlsx` da Excel o LibreOffice Calc.

**Il file viene rifiutato con "File troppo grande (max 5 MB)"**  
→ Verifica che il file non contenga immagini o fogli nascosti superflui.

**Il file viene rifiutato con "Il file non contiene dati"**  
→ Il file è vuoto o ha solo l'intestazione senza righe dati.

**Vedo `MISSING_PERIOD` ma la colonna Ore c'è**  
→ L'intestazione della colonna potrebbe avere spazi o maiuscole diverse. Il mapping default si aspetta esattamente `Ore`. Contatta l'Admin per aggiornare il mapping.
