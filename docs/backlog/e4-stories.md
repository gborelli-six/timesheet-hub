# E4 — Style guide & shell applicativa: dettaglio storie

> Definisce i token visivi MUI v7, configura la shell Mantis come layout delle pagine autenticate (header, sidebar con navigazione per-ruolo, main content area) e implementa la LoginPage integrata con `AuthGuard` (E3). Sblocca tutte le epiche UI successive (E5–E10).
>
> Stack: React 19 + MUI v7 + Mantis + Emotion. Desktop-only per v1 (mobile fuori scope). Implementazione assistita da **claude.ai/design** — per accorgimenti specifici MUI v7 + Mantis vedi la sezione in fondo.
>
> ADR rilevanti: ADR-001-B (stack frontend), ADR-003 (E2E Playwright), UX brief: `003-timesheet-hub-ux-brief.md`.
>
> **Nota sugli ID**: STORY-024…030 riprendono subito dopo E3 (termina a STORY-023). E5 mantiene ID `STORY-E5-N` provvisori.

---

## STORY-024 — Design brief & token MUI (palette, tipografia, spaziatura)

- **Stato**: ✅ Done
- **Tipo**: UX/UI
- **Dipende da**: —
- **Riferimento design**: [Design System.html](https://claude.ai/design/p/e1aac35b-a506-46e1-83e0-dbf593de6b87?file=Design+System.html)

**Obiettivo**: produrre un documento di riferimento visivo che guida il tema MUI (`createTheme`) e i prompt delle sessioni claude.ai/design per tutte le storie successive di E4.

**Criteri di accettazione**:
- Nuovo file `docs/specs/004-design-tokens.md` con:
  - **Palette**: colori hex per `primary` (main, light, dark, contrastText), `secondary`, neutrali (`grey` scale MUI), semantici (`success`, `warning`, `error`, `info` — `main` + `light`)
  - **Tipografia**: font-family (es. Inter o Roboto), size per h1–h6 e body1/body2, font-weight principali
  - **Spacing**: base unit (4px o 8px), esempi di scala derivata
  - **Shape**: `borderRadius` base (es. 8px)
  - **Elevation**: shadow plan (4 livelli MUI usati)
- Il documento esplicita come ogni token si mappa a `createTheme()` (es. `palette.primary.main = "#XXXXXX"`)
- Il file è usato come input letterale per i prompt claude.ai/design nelle storie STORY-025…STORY-028

---

## STORY-025 — Configurazione tema MUI (`createTheme`, `ThemeProvider`)

- **Stato**: ✅ Done
- **Tipo**: Frontend
- **Dipende da**: STORY-024
- **Riferimento design**: [Design System.html](https://claude.ai/design/p/e1aac35b-a506-46e1-83e0-dbf593de6b87?file=Design+System.html)

**Obiettivo**: il tema MUI centralizzato è disponibile a tutta l'app; le storie successive non hardcodano colori o font.

**Criteri di accettazione**:
- Nuovo file `frontend/src/theme/index.ts`:
  - `createTheme()` con valori da `docs/specs/004-design-tokens.md`: `palette`, `typography`, `spacing`, `shape`, `shadows`
  - Esporta `theme` (typed `Theme`) e `ThemeProvider` re-export per import comodo
  - Se si aggiungono token custom (es. colori sidebar Mantis), estendere il tipo con `declare module '@mui/material/styles'`
- `frontend/src/main.tsx` wrappa `<App />` con `<ThemeProvider theme={theme}><CssBaseline />{...}</ThemeProvider>`
- `<CssBaseline />` presente per il reset CSS MUI
- Nessun valore hex o font-family hardcoded fuori da `frontend/src/theme/index.ts`
- Dark/light mode **non richiesta** per v1 — non aggiungere `PaletteMode` o toggle

---

## STORY-026 — Shell Mantis — Header, SideNav, menu e routing

- **Stato**: ✅ Done
- **Tipo**: Frontend
- **Dipende da**: STORY-025
- **Riferimento design**: [App Shell.html](https://claude.ai/design/p/e1aac35b-a506-46e1-83e0-dbf593de6b87?file=App+Shell.html)

**Obiettivo**: la shell Mantis è il layout di tutte le pagine autenticate; la navigazione per-ruolo è funzionante.

**Criteri di accettazione**:
- Componente `frontend/src/components/shell/AppShell.tsx` che wrappa il layout Mantis:
  - `<Header />`: logo Timesheet Hub a sinistra, nome utente (`useAuth().data.email`) a destra, pulsante logout (`GET /api/auth/logout`)
  - `<SideNav />`: voci di menu con React Router v7 `<NavLink>`:
    - **Import** (visibile a tutti i ruoli)
    - **Log** (visibile a tutti i ruoli)
    - **Profilo** (visibile a tutti i ruoli)
    - **Admin** (visibile solo se `role === 'admin'`)
  - `<Outlet />` di React Router v7 nella main content area
- Voce Admin nascosta per `role = 'employee'` e `role = 'hr'` (condizione su `useAuth().data.role`)
- Layout desktop-only: nessun breakpoint responsive, nessun drawer mobile, nessun `useMediaQuery`
- Integrazione con React Router v7: `<AppShell />` montato come layout route che wrappa le rotte autenticate

---

## STORY-027 — LoginPage con MUI + integrazione AuthGuard

- **Stato**: ✅ Done
- **Tipo**: Frontend
- **Dipende da**: STORY-025, STORY-022 (E3)
- **Riferimento design**: [Login.html — versione B (desktop)](https://claude.ai/design/p/e1aac35b-a506-46e1-83e0-dbf593de6b87?file=Login.html)

**Obiettivo**: la schermata di login è coerente con il tema MUI e si attiva automaticamente tramite `AuthGuard` (STORY-022) quando la sessione è assente o scaduta.

**Criteri di accettazione**:
- `frontend/src/pages/LoginPage.tsx` — layout centrato con MUI:
  - `<Card>` centrata verticalmente e orizzontalmente (Flexbox `100vh`)
  - Logo o titolo "Timesheet Hub" (`<Typography variant="h5">`)
  - `<Button variant="contained" startIcon={<GoogleIcon />}>Accedi con Google</Button>` → `window.location.href = '/api/auth/login'`
  - Nessun form, nessun campo email/password (OAuth puro)
- `frontend/src/pages/AuthErrorPage.tsx` — per `/auth/error`:
  - Messaggio descrittivo ("Account non autorizzato — usa un account @sixfeetup.it")
  - Link/pulsante "Torna al login"
- `AuthGuard` (E3 STORY-022): già implementato — verificare che `/login` e `/auth/error` siano fuori dalla guardia, tutte le altre rotte dentro
- Nessun cookie o token gestito client-side (cookie httpOnly, invisibile a JS)

---

## STORY-028 — Wrapper componenti base

- **Stato**: ✅ Done
- **Tipo**: Frontend
- **Dipende da**: STORY-025
- **Riferimento design**: [Design System.html](https://claude.ai/design/p/e1aac35b-a506-46e1-83e0-dbf593de6b87?file=Design+System.html)

**Obiettivo**: set minimo di componenti wrapper/composizione che le epiche E5–E10 importeranno; non duplica ciò che MUI v7 fornisce già.

**Criteri di accettazione**:
- Componenti in `frontend/src/components/ui/`:
  - `PageHeader.tsx`: titolo pagina (`<Typography variant="h4">`) + slot opzionale per breadcrumb o azioni — pattern Mantis
  - `StatusBadge.tsx`: `<Chip>` MUI con colori semantici del tema (`success`, `warning`, `error`, `info`, `default`) via prop `status: 'success' | 'warning' | 'error' | 'info' | 'default'`
  - `LoadingOverlay.tsx`: `<Backdrop>` + `<CircularProgress>` per loading a pagina intera
  - `ConfirmDialog.tsx`: `<Dialog>` MUI riutilizzabile per azioni distruttive — props: `open`, `title`, `message`, `onConfirm`, `onCancel`, `confirmLabel?`, `confirmColor?`
- Ogni componente: props TypeScript complete, `data-testid` per E2E
- Export da `frontend/src/components/ui/index.ts`
- **Non** creare wrapper per Button, TextField, Alert, Snackbar — usare MUI direttamente nelle feature

---

## STORY-029 — Test E2E shell — navigazione e flusso login/logout

- **Stato**: ✅ Done
- **Tipo**: E2E
- **Dipende da**: STORY-026, STORY-027

**Obiettivo**: CI verifica che la shell si comporti correttamente per i ruoli previsti e che il flusso login/logout funzioni end-to-end.

**Criteri di accettazione**:
- Nuovo file `e2e/tests/shell.spec.ts`:
  - **Scenario 1** (utente non autenticato): naviga a `/` senza storageState → verifica redirect a `/login` → pagina login contiene pulsante "Accedi con Google"
  - **Scenario 2** (login → shell): usa `loginAs('employee')` (storageState da STORY-020) → naviga a `/` → shell visibile (Header con email utente, SideNav con voci Import/Log/Profilo) → voce "Admin" assente nel SideNav
  - **Scenario 3** (ruolo admin): usa `loginAs('admin')` → SideNav contiene voce "Admin"
  - **Scenario 4** (logout): autenticato come employee → click logout → redirect a `/login`
- Selettori resilienti: `data-testid` per voce nav e pulsante logout, no selettori CSS fragili
- Usa `storageState` per-ruolo prodotto da STORY-020 (nessun OAuth reale in E2E)
- Verde in CI (`.github/workflows/e2e.yml`)

---

## STORY-030 — Documentazione E4

- **Stato**: ✅ Done
- **Tipo**: Docs
- **Dipende da**: STORY-025, STORY-026, STORY-027, STORY-028, STORY-029

**Obiettivo**: le decisioni di design e implementazione di E4 sono tracciate; l'utente finale sa come navigare l'applicazione.

**Criteri di accettazione**:
- `docs/specs/004-design-tokens.md` finalizzata (aggiornata se necessario con valori effettivamente implementati in STORY-025)
- `docs/guides/navigazione-e-interfaccia.md` (nuovo):
  - Come accedere (link app → "Accedi con Google" con account `@sixfeetup.it`)
  - Struttura dell'interfaccia: header, menu laterale, area principale
  - Menu disponibili per ruolo (Employee/HR: Import, Log, Profilo — Admin: + Admin)
  - Come fare logout
- Se in STORY-025–026 sono state prese decisioni architetturali non ovvie (es. scelta di sovrascrivere componenti Mantis specifici, rinuncia alla dark mode, gestione del token di sessione), aggiungere un ADR o nota in ADR-001-B

---

## Accorgimenti claude.ai/design per MUI v7 + Mantis

1. **Specificare il framework nel prompt**: ogni sessione deve iniziare con "React + MUI v7, usa componenti `@mui/material`" — così l'output contiene `<Button>`, `<Box>`, `<Typography>` invece di HTML/CSS puro.
2. **Palette dal design brief**: includere i valori hex di `docs/specs/004-design-tokens.md` nel prompt perché l'output usi colori coerenti con `sx={{ color: '#XXXXXX' }}` o richiami il tema con `sx={{ color: 'primary.main' }}`.
3. **Preferire `sx={{ color: 'primary.main' }}`**: è più robusto di valori hardcoded; specificarlo nel prompt ("usa i token del tema MUI, non colori hex").
4. **Import paths**: normalizzare l'output da import profondi (es. `@mui/material/Button`) a import barrel (`import { Button } from '@mui/material'`).
5. **`sx` vs `styled()`**: l'output di claude.ai/design usa spesso `sx={{...}}` — accettabile per override puntuali, ma per componenti riutilizzabili (STORY-028) preferire `styled()` di Emotion.
6. **Mantis non è noto a claude.ai/design**: usare claude.ai/design per il contenuto/look di un'area specifica (es. la card login, l'header MUI), poi integrare manualmente nella struttura Mantis (layout Drawer, AppBar Mantis).
7. **No responsive**: v1 è desktop-only — omettere `useMediaQuery`, `Hidden`, e breakpoint `xs`/`sm` dall'output generato.
