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
    success: { main: '#16a34a', light: '#4ade80', dark: '#15803d' },
    warning: { main: '#d97706', light: '#fbbf24', dark: '#b45309' },
    error: { main: '#dc2626', light: '#f87171', dark: '#b91c1c' },
    info: { main: '#2563eb', light: '#60a5fa', dark: '#1d4ed8' },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
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
  components: {
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.6875rem',
          height: 22,
          borderRadius: 9999,
          border: '1px solid transparent',
        },
        colorSuccess: {
          backgroundColor: '#f0fdf4',
          color: '#15803d',
          borderColor: '#bbf7d0',
        },
        colorWarning: {
          backgroundColor: '#fffbeb',
          color: '#b45309',
          borderColor: '#fde68a',
        },
        colorError: {
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          borderColor: '#fecaca',
        },
        colorInfo: {
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          borderColor: '#bfdbfe',
        },
        colorPrimary: {
          backgroundColor: '#eef2fc',
          color: '#33509f',
          borderColor: '#b6c8ee',
        },
        colorDefault: {
          backgroundColor: '#f1f5f9',
          color: '#475569',
          borderColor: '#e2e8f0',
        },
      },
    },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.2 },
    h3: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2 },
    h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.2 },
    h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.2 },
    h6: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.2 },
    body1: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.55 },
    body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.55 },
    caption: { fontSize: '0.6875rem', fontWeight: 400 },
    button: { fontSize: '0.8125rem', fontWeight: 600, textTransform: 'none' },
  },
  spacing: 8,
  shape: { borderRadius: 8 },
})

export { ThemeProvider }
