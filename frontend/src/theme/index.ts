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
    error: { main: '#dc2626', light: '#f87171' },
    info: { main: '#2563eb', light: '#60a5fa' },
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
    h1: { fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 },
    h3: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2 },
    h4: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.2 },
    h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.2 },
    h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.2 },
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', fontWeight: 400 },
    button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
  },
  spacing: 8,
  shape: { borderRadius: 8 },
})

export { ThemeProvider }
