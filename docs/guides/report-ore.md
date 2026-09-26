# Come consultare il report delle ore

Questa guida spiega come accedere alla pagina Report, leggere la tabella aggregata delle ore per progetto e connettore, applicare i filtri disponibili ed espandere la vista gerarchica fino al dettaglio per giorno e task.

**Ruoli:** Dipendente

---

## Prerequisiti

- Hai effettuato l'accesso con il tuo account Google aziendale (`@sixfeetup.it`)
- Hai completato almeno un'importazione il cui esito è stato almeno parzialmente positivo (il report è vuoto se non hai righe con esito `success`)

---

## 1. Come accedere al report

Nel menu laterale, clicca su **Report**.

La pagina mostra le ore che hai importato con successo, aggregate per progetto e connettore nel periodo selezionato. A differenza del Log — che è un elenco transazionale riga per riga — il Report è una vista aggregata pensata per verificare il totale delle ore registrate.

---

## 2. La tabella pivot: lettura e interpretazione

### Struttura della tabella

La tabella ha una colonna per ogni connettore che ha prodotto righe importate con successo, più una colonna **Totale** a destra.

| Colonna | Contenuto |
|---|---|
| **Progetto** | Nome del progetto come presente nel file Excel |
| **Connettore (es. Odoo)** | Ore inviate a quel backend per quel progetto |
| **Totale** | Somma delle ore su tutti i connettori per quel progetto |

La riga **Totale ore** in fondo alla tabella riporta il totale complessivo per connettore e il grand total.

### Come si leggono le celle

- Le celle mostrano i valori numerici in formato `8.0` (in ore, con una cifra decimale).
- Il simbolo `—` indica che non ci sono ore per quella combinazione progetto × connettore.
- La colonna Totale è evidenziata in azzurro per distinguerla dalle colonne connettore.

---

## 3. Filtri disponibili

### Filtro periodo

Sopra la tabella si trova la barra del periodo con cinque preset:

| Preset | Intervallo |
|---|---|
| **Mese corrente** | Dal 1° al giorno corrente del mese in corso |
| **Mese precedente** | Intero mese precedente a quello corrente |
| **Trimestre corrente** | Trimestre in corso (gen–mar, apr–giu, lug–set, ott–dic) |
| **Anno corrente** | Dal 1° gennaio al giorno corrente |
| **Personalizzato** | Due campi data liberi (Da… → A…) |

Selezionando **Personalizzato** appaiono i selettori di data. Le righe senza data (`—`) sono escluse quando è attivo un filtro periodo.

### Filtri per connettore, progetto e task

Nella seconda riga della barra filtri ci sono tre pulsanti a pillola:

- **Connettore** — filtra le righe per un singolo connettore (es. solo Odoo)
- **Progetto** — mostra solo le righe di un progetto specifico
- **Task** — mostra solo le righe di un task specifico

Cliccando su un pulsante pillola si apre un menu a tendina con le opzioni disponibili. Quando un filtro è attivo, la pillola cambia colore (bordo azzurro, sfondo chiaro). Il riepilogo a destra mostra il numero di progetti e le ore totali corrispondenti ai filtri applicati.

Il pulsante **Azzera** (visibile solo quando almeno un filtro è attivo) riporta tutto alla vista completa.

---

## 4. Espansione gerarchica delle righe

Ogni riga della tabella corrisponde a un progetto. Cliccando sul nome del progetto si apre un piccolo menu contestuale che chiede:

> **Dettaglio per:** Giorno · Task

### Dettaglio per Giorno

Le righe del progetto si espandono per data di lavorazione. Ogni data è a sua volta cliccabile per vedere il dettaglio per task in quella giornata.

Struttura:
```
▶ Nome Progetto          [ore per connettore]
  ▶ 01/06/2026           [ore di quel giorno]
      Task Dev           [ore di quel task in quel giorno]
      Task Review        [...]
  ▶ 02/06/2026           [...]
```

### Dettaglio per Task

Le righe del progetto si espandono per task (attività). Ogni task è a sua volta cliccabile per vedere il dettaglio per giorno in cui è stato lavorato.

Struttura:
```
▶ Nome Progetto          [ore per connettore]
  ▶ Dev                  [ore totali su quel task]
      01/06/2026         [ore di quel task in quel giorno]
      02/06/2026         [...]
  ▶ Review               [...]
```

### Comprimi

Per tornare alla vista aggregata per progetto, clicca nuovamente sul nome del progetto e scegli **Comprimi** nel menu contestuale.

---

## 5. Stati della pagina

| Stato | Visualizzazione | Causa |
|---|---|---|
| **Caricamento** | Scheletro animato con righe placeholder | Dati in arrivo dal server |
| **Vuoto** | Messaggio "Nessuna ora aggregata" | Nessuna importazione con esito positivo nel periodo selezionato |
| **Vuoto con filtro** | Messaggio "Nessuna riga importata... prova ad ampliare il periodo" + bottone "Azzera filtri" | Il filtro esclude tutti i dati disponibili |
| **Errore** | Messaggio di errore + bottone "Riprova" | Problema di comunicazione con il server |

---

## 6. Differenza tra Report e Log

| | **Report** | **Log** |
|---|---|---|
| **Vista** | Aggregata per progetto × connettore | Transazionale riga per riga |
| **Scopo** | Verificare le ore totali registrate | Controllare l'esito di ogni singola importazione |
| **Granularità** | Progetto / Task / Giorno (espandibile) | Singola riga Excel × backend |
| **Filtri** | Periodo, connettore, progetto, task | Periodo, backend, esito |
| **Include dati falliti** | No (solo righe con esito `success`) | Sì (mostra anche le righe fallite con il messaggio d'errore) |

Usa il **Report** per sapere quante ore hai registrato su un progetto in un mese. Usa il **Log** per investigare perché una riga specifica è fallita.
