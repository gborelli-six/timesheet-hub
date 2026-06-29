# Navigazione e interfaccia — Timesheet Hub

Guida per l'utente finale sull'accesso e sull'utilizzo dell'interfaccia di Timesheet Hub.

---

## Come accedere

1. Apri l'URL dell'applicazione nel browser (fornito dall'amministratore di sistema).
2. Nella schermata di benvenuto, fai clic sul pulsante **Accedi con Google**.
3. Scegli il tuo account Google aziendale `@sixfeetup.it`. Account di altri domini non sono autorizzati.
4. Al completamento dell'autenticazione vieni reindirizzato automaticamente all'interfaccia principale.

> Se vedi il messaggio "Account non autorizzato", assicurati di usare l'account Google `@sixfeetup.it` e riprova.

---

## Struttura dell'interfaccia

L'interfaccia è composta da tre aree:

```
┌──────────────────────────────────────────────────┐
│  Header (logo · logout)                          │
├──────────────┬───────────────────────────────────┤
│              │                                   │
│   Sidebar    │   Area principale                 │
│   (menu)     │   (contenuto della pagina)        │
│              │                                   │
└──────────────┴───────────────────────────────────┘
```

### Header

Barra orizzontale in cima alla pagina. Contiene:
- **Logo Timesheet Hub** — identificativo dell'applicazione
- **Pulsante Logout** — in alto a destra, per terminare la sessione

### Sidebar (menu laterale)

Pannello verticale a sinistra. Mostra le voci di navigazione disponibili per il tuo ruolo (vedi sezione successiva). In fondo alla sidebar è visibile un chip con le tue iniziali, l'indirizzo email e il ruolo assegnato.

### Area principale

Occupa il resto della schermata. Cambia in base alla voce di menu selezionata.

---

## Voci di menu per ruolo

| Voce | Employee | HR | Admin |
|---|---|---|---|
| **Import** — carica e invia un timesheet | ✅ | ✅ | ✅ |
| **Log** — cronologia delle importazioni | ✅ | ✅ | ✅ |
| **Profilo** — gestione token connettori | ✅ | ✅ | ✅ |
| **Admin** — pannello di amministrazione | — | — | ✅ |

La voce **Admin** è visibile solo agli utenti con ruolo `admin`. Employee e HR non la vedono.

---

## Come fare logout

Fai clic sul pulsante **Logout** in alto a destra nell'header. Vieni reindirizzato alla schermata di login e la sessione viene terminata. La sessione scade automaticamente dopo 8 ore dall'accesso.
