# Accesso e login — Timesheet Hub

> Questa guida spiega come accedere a Timesheet Hub, cosa succede alla scadenza della sessione e come fare logout. Non è richiesta nessuna password: si usa l'account Google aziendale.

---

## Come accedere

L'accesso è disponibile per i tre ruoli aziendali: **Employee**, **HR** e **Admin**. La procedura è identica per tutti.

1. Apri l'URL di Timesheet Hub nel browser (fornito dall'amministratore IT).
2. Clicca il bottone **"Accedi con Google"**.
3. Seleziona (o conferma) il tuo account `@sixfeetup.it` nella finestra Google.
4. Sei reindirizzato automaticamente alla dashboard.

> **Nota:** solo gli account `@sixfeetup.it` sono autorizzati. Un tentativo con un account Gmail o di altro dominio viene rifiutato con un messaggio di errore.

### Cosa vedo in base al mio ruolo

| Ruolo | Cosa può fare |
|---|---|
| `employee` | Importa il proprio timesheet; vede solo i propri log di importazione |
| `hr` | Importa per qualsiasi dipendente; vede tutti i log di importazione |
| `admin` | Gestisce utenti e ruoli; configura i backend adapter |

Il ruolo è assegnato dall'amministratore e non è modificabile autonomamente.

---

## Scadenza della sessione (8 ore)

La sessione rimane attiva per **8 ore** dall'ultimo login, coprendo l'intera giornata lavorativa.

Alla scadenza:
- La prossima azione che richiede autenticazione (navigazione, importazione, ecc.) reindirizza automaticamente alla pagina di login.
- **Nessun dato viene perso**: i timesheet già importati rimangono nel sistema; le importazioni completate sono nei log.
- È sufficiente effettuare nuovamente il login con Google per riprendere a lavorare.

> Se la sessione scade durante un'importazione in corso, l'operazione viene interrotta. Dopo il login, rilancia l'importazione normalmente.

---

## Come fare logout

Hai due opzioni:

1. **Dal menu dell'app** — usa la voce "Logout" o "Esci" presente nell'header o nel menu utente.
2. **Navigazione diretta** — apri nel browser l'URL `/api/auth/logout` (ad es. `https://6feetup-timesheet.up.railway.app/api/auth/logout`): il cookie di sessione viene cancellato e sei reindirizzato al login.

Dopo il logout il cookie di sessione è eliminato dal browser: non è possibile accedere alle risorse protette senza un nuovo login.
