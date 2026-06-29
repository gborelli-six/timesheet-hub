# Design Tokens — Timesheet Hub

> Documento di riferimento per `createTheme()` MUI v7. Finalizzato in STORY-024 (design brief), implementato in STORY-025 — valori confermati corrispondenti all'implementazione effettiva in `frontend/src/theme/index.ts`.
>
> Progetto design originale: claude.ai/design `e1aac35b-a506-46e1-83e0-dbf593de6b87`.
>
> Stack: React 19 + MUI v7 + Emotion. Desktop-only per v1.

---

## 1. Palette

### Primary — Blu brand (royal blue, identità ingranaggio 6feetup)

| Token | Hex | Uso |
|---|---|---|
| `palette.primary.main` | `#4068c8` | CTA primari, accenti, ingranaggio logo |
| `palette.primary.light` | `#4f72cd` | Hover state, elementi secondari attivi |
| `palette.primary.dark` | `#33509f` | Focus ring, pressed state, navbar active |
| `palette.primary.contrastText` | `#FFFFFF` | Testo su sfondo primary |

Scala intera di riferimento (CSS vars):

| Var | Hex |
|---|---|
| `--primary-50` | `#eef2fc` |
| `--primary-100` | `#dae4f7` |
| `--primary-200` | `#b6c8ee` |
| `--primary-300` | `#8aa5e2` |
| `--primary-400` | `#6182d4` |
| `--primary-500` | `#4f72cd` |
| `--primary-600` | `#4068c8` ← main |
| `--primary-700` | `#33509f` ← dark / hover |
| `--primary-800` | `#28407d` |
| `--primary-900` | `#1e306c` ← navy wordmark |

### Secondary — Mint/sage accent

| Token | Hex | Uso |
|---|---|---|
| `palette.secondary.main` | `#3fa07e` | Accenti secondari, badge positivi |
| `palette.secondary.light` | `#5fbf9c` | Hover, elementi de-enfatizzati |
| `palette.secondary.dark` | `#2f7d62` | Pressed state |
| `palette.secondary.contrastText` | `#FFFFFF` | Testo su sfondo secondary |

### Sidebar — Palette custom (estensione tema MUI)

La sidebar usa una superficie scura (navy-slate) distinta dalla palette principale.
Dichiarata tramite `declare module '@mui/material/styles'` in `theme/index.ts`.

| Token custom | Hex | Uso |
|---|---|---|
| `sidebar.background` | `#1e2a3a` | Sfondo sidebar |
| `sidebar.activeBackground` | `#4068c8` | Sfondo item nav attivo |
| `sidebar.text` | `#c3cedd` | Testo nav items |
| `sidebar.activeText` | `#ffffff` | Testo item attivo |
| `sidebar.muted` | `#6b7c93` | Label sezione, testo de-enfatizzato |
| `sidebar.border` | `rgba(255,255,255,0.08)` | Separatori interni |

### Neutrali — Cool slate

| Token | Hex |
|---|---|
| `--neutral-0` | `#ffffff` |
| `--neutral-50` | `#f8fafc` |
| `--neutral-100` | `#f1f5f9` |
| `--neutral-200` | `#e2e8f0` |
| `--neutral-300` | `#cbd5e1` |
| `--neutral-400` | `#94a3b8` |
| `--neutral-500` | `#64748b` |
| `--neutral-600` | `#475569` |
| `--neutral-700` | `#334155` |
| `--neutral-800` | `#1e293b` |
| `--neutral-900` | `#0f172a` |

### Sfondo e superficie

| Token | Hex | Uso |
|---|---|---|
| `palette.background.default` | `#f8fafc` | Body / sfondo pagina |
| `palette.background.paper` | `#ffffff` | Card, Dialog, Menu |

### Semantici

| Colore | `main` | `light` | Uso |
|---|---|---|---|
| `palette.success` | `#16a34a` | `#4ade80` | Importazione riuscita, stato OK |
| `palette.warning` | `#d97706` | `#fbbf24` | Warning parziale, righe anomale |
| `palette.error` | `#dc2626` | `#f87171` | Errore critico, campo non valido |
| `palette.info` | `#2563eb` | `#60a5fa` | Informazioni, tooltip, hint |

---

## 2. Tipografia

### Font family

```
"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif
"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace   ← solo per code/timestamp
```

IBM Plex Sans è il font principale; IBM Plex Mono per valori numerici e codice.
Caricato via Google Fonts: `family=IBM+Plex+Sans:wght@400;500;600;700`.

### Scale

| Variante MUI | Size (rem) | Weight | Line height | Uso tipico |
|---|---|---|---|---|
| `h1` | 2.5rem (40px) | 700 | 1.2 | Titoli pagina principali (raro) |
| `h2` | 2rem (32px) | 700 | 1.2 | Sezioni principali |
| `h3` | 1.75rem (28px) | 700 | 1.2 | Sottosezioni |
| `h4` | 1.5rem (24px) | 600 | 1.2 | Titoli card / PageHeader |
| `h5` | 1.25rem (20px) | 600 | 1.2 | Titoli pannelli / dialoghi |
| `h6` | 1rem (16px) | 600 | 1.2 | Etichette di gruppo |
| `body1` | 1rem (16px) | 400 | 1.5 | Testo principale |
| `body2` | 0.875rem (14px) | 400 | 1.5 | Testo secondario, descrizioni |
| `caption` | 0.75rem (12px) | 400 | — | Metadati, timestamp, label minori |
| `button` | 0.875rem (14px) | 600 | — | Label pulsanti |

### Note

- `button.textTransform`: `'none'` — testo pulsanti in maiuscolo/minuscolo naturale
- `lineHeight` base: 1.5 per body; 1.2 per heading

---

## 3. Spacing

Base unit: **8px** (default MUI — `theme.spacing(1) = 8px`).

### Scala derivata

| Multiplo | px | Uso tipico |
|---|---|---|
| `0.5` | 4px | Gap micro (icona-testo) |
| `1` | 8px | Padding interno compatto |
| `1.5` | 12px | Gap tra elementi correlati |
| `2` | 16px | Padding standard componenti |
| `3` | 24px | Gap sezioni |
| `4` | 32px | Padding pagina, separatori |
| `5` | 40px | Padding main content (top) |
| `6` | 48px | Padding main content (laterale) |

---

## 4. Shape

| Token | Valore | Uso |
|---|---|---|
| `shape.borderRadius` | `8` (px) | Tutti i componenti MUI (Button, Card, Input…) |

Componenti specifici possono sovrascrivere con `sx={{ borderRadius: '4px' }}` per elementi più compatti (es. Chip, Badge).

---

## 5. Elevation — Piano ombre

MUI usa 25 livelli di shadow (0–24). Per Timesheet Hub si usano 4 livelli semantici:

| Livello | MUI shadow index | Uso |
|---|---|---|
| **none** | `shadows[0]` | Superfici flat (sfondo, SideNav) |
| **low** | `shadows[2]` | Card semplici, input focused |
| **medium** | `shadows[4]` | Card con azione, Header sticky |
| **high** | `shadows[8]` | Dialog, Dropdown menu, Popover |

> Le shadow di MUI v7 sono già definite internamente — non è necessario sovrascrivere `theme.shadows` a meno di non cambiare il colore ombra. Per v1 si usano le shadow default.

---

## 6. Mappatura `createTheme()` — Snippet di riferimento

```typescript
// frontend/src/theme/index.ts
import { createTheme, ThemeProvider } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

declare module '@mui/material/styles' {
  interface Palette {
    sidebar: {
      background: string
      activeBackground: string
      text: string
      activeText: string
      muted: string
      border: string
    }
  }
  interface PaletteOptions {
    sidebar?: {
      background?: string
      activeBackground?: string
      text?: string
      activeText?: string
      muted?: string
      border?: string
    }
  }
}

export const theme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4068c8',
      light: '#4f72cd',
      dark: '#33509f',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#3fa07e',
      light: '#5fbf9c',
      dark: '#2f7d62',
      contrastText: '#FFFFFF',
    },
    success: { main: '#16a34a', light: '#4ade80' },
    warning: { main: '#d97706', light: '#fbbf24' },
    error:   { main: '#dc2626', light: '#f87171' },
    info:    { main: '#2563eb', light: '#60a5fa' },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    sidebar: {
      background: '#1e2a3a',
      activeBackground: '#4068c8',
      text: '#c3cedd',
      activeText: '#ffffff',
      muted: '#6b7c93',
      border: 'rgba(255,255,255,0.08)',
    },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontSize: '2.5rem',  fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '2rem',    fontWeight: 700, lineHeight: 1.2 },
    h3: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2 },
    h4: { fontSize: '1.5rem',  fontWeight: 600, lineHeight: 1.2 },
    h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.2 },
    h6: { fontSize: '1rem',    fontWeight: 600, lineHeight: 1.2 },
    body1:   { fontSize: '1rem',     fontWeight: 400, lineHeight: 1.5 },
    body2:   { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
    caption: { fontSize: '0.75rem',  fontWeight: 400 },
    button:  { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
  },
  spacing: 8,
  shape: { borderRadius: 8 },
  // shadows: usa i default MUI v7 (4 livelli semantici: 0/2/4/8)
})

export { ThemeProvider }
```

---

## 7. Come usare questo documento in claude.ai/design

Prefisso standard per ogni sessione di generazione componenti (storie STORY-026…028):

```
React 19 + MUI v7. Usa componenti @mui/material.
Palette: primary.main #4068c8, secondary.main #3fa07e.
Sfondo pagina #f8fafc, paper #ffffff.
Font: IBM Plex Sans. borderRadius 8px.
Sidebar scura: background #1e2a3a, testo #c3cedd, active #4068c8.
Usa token tema (es. sx={{ color: 'primary.main' }}), non hex hardcoded.
Desktop-only: no useMediaQuery, no breakpoint xs/sm, no drawer mobile.
```
