import { NavLink, Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/apiClient'

const ICONS = {
  import:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  log: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16l4-4 3 3 5-6"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/>',
  admin:
    '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
}

function SvgIcon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  )
}

const GEAR_PATH =
  '<path fill="currentColor" fill-rule="evenodd" d="M39.07 14.65L41.82 3.72L58.18 3.72L60.93 14.65L67.26 17.27L76.94 11.49L88.51 23.06L82.73 32.74L85.35 39.07L96.28 41.82L96.28 58.18L85.35 60.93L82.73 67.26L88.51 76.94L76.94 88.51L67.26 82.73L60.93 85.35L58.18 96.28L41.82 96.28L39.07 85.35L32.74 82.73L23.06 88.51L11.49 76.94L17.27 67.26L14.65 60.93L3.72 58.18L3.72 41.82L14.65 39.07L17.27 32.74L11.49 23.06L23.06 11.49L32.74 17.27ZM50 24a26 26 0 1 0 0.01 0Z"/><path stroke="currentColor" stroke-width="5.6" stroke-linecap="round" d="M50 50V31"/><path stroke="currentColor" stroke-width="5.6" stroke-linecap="round" d="M50 50L64.5 59"/>'

function GearIcon() {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      width={18}
      height={18}
      style={{ color: '#fff' }}
      dangerouslySetInnerHTML={{ __html: GEAR_PATH }}
    />
  )
}

function NavItem({
  to,
  iconPath,
  label,
  testId,
}: {
  to: string
  iconPath: string
  label: string
  testId: string
}) {
  return (
    <NavLink to={to} style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <ListItemButton
          data-testid={testId}
          sx={{
            height: 40,
            borderRadius: '6px',
            px: '12px',
            gap: '11px',
            mb: '4px',
            bgcolor: isActive ? '#4068c8' : 'transparent',
            color: isActive ? '#fff' : '#c3cedd',
            '& .nav-icon': { color: isActive ? '#fff' : '#6b7c93' },
            '&:hover': {
              bgcolor: isActive ? '#4068c8' : 'rgba(255,255,255,0.06)',
              color: isActive ? '#fff' : '#fff',
              '& .nav-icon': { color: '#c3cedd' },
            },
          }}
        >
          <ListItemIcon className="nav-icon" sx={{ color: 'inherit', minWidth: 'auto' }}>
            <SvgIcon path={iconPath} size={18} />
          </ListItemIcon>
          <ListItemText
            primary={label}
            primaryTypographyProps={{
              fontSize: '0.8125rem',
              fontWeight: isActive ? 600 : 500,
              color: 'inherit',
            }}
          />
        </ListItemButton>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const { data } = useAuth()

  const handleLogout = async () => {
    try {
      await apiClient.get('/api/auth/logout')
    } finally {
      window.location.href = '/login'
    }
  }

  const role = data?.role ?? 'employee'
  const email = data?.email ?? ''
  const initials = email.split('@')[0].slice(0, 2).toUpperCase()
  const roleLabel = role === 'admin' ? 'Amministratore' : role === 'hr' ? 'HR' : 'Utente'

  return (
    <Box
      data-testid="app-shell"
      sx={{
        display: 'grid',
        gridTemplateRows: '60px 1fr',
        gridTemplateColumns: '244px 1fr',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <Box
        component="header"
        sx={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 60,
          pr: '28px',
          bgcolor: '#fff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Brand area */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            width: 244,
            px: '20px',
            height: '100%',
            borderRight: '1px solid #e2e8f0',
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: '#4068c8',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              mr: '12px',
            }}
          >
            <GearIcon />
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 0.92,
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            <Typography
              component="span"
              sx={{ fontSize: '13px', fontWeight: 700, color: '#1e306c', lineHeight: 0.92 }}
            >
              TIMESHEET
            </Typography>
            <Typography
              component="span"
              sx={{ fontSize: '13px', fontWeight: 700, color: '#4068c8', lineHeight: 0.92 }}
            >
              HUB
            </Typography>
          </Box>
        </Box>

        {/* Right: logout only */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            data-testid="btn-logout"
            onClick={handleLogout}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              height: 34,
              px: '14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              bgcolor: '#fff',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#64748b',
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#f1f5f9',
                color: '#0f172a',
                borderColor: '#94a3b8',
              },
            }}
          >
            <SvgIcon path={ICONS.logout} size={15} />
            Logout
          </Button>
        </Box>
      </Box>

      {/* Sidebar */}
      <Box
        component="aside"
        sx={{
          bgcolor: '#1e2a3a',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          px: '12px',
          pt: '20px',
          pb: '16px',
          position: 'sticky',
          top: '60px',
          height: 'calc(100vh - 60px)',
          overflowY: 'auto',
        }}
      >
        {/* Section label */}
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: '#6b7c93',
            px: '12px',
            mb: '4px',
          }}
        >
          Menu
        </Typography>

        <List disablePadding>
          <NavItem to="/import" iconPath={ICONS.import} label="Import" testId="nav-import" />
          <NavItem to="/log" iconPath={ICONS.log} label="Log" testId="nav-log" />
          <NavItem to="/profile" iconPath={ICONS.profile} label="Profilo" testId="nav-profilo" />
          {role === 'admin' && (
            <NavItem to="/admin" iconPath={ICONS.admin} label="Admin" testId="nav-admin" />
          )}
        </List>

        {/* Spacer + divider + user chip */}
        <Box sx={{ flexGrow: 1 }} />
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />

        {/* User chip */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            p: '8px',
            borderRadius: '6px',
          }}
        >
          <Box
            data-testid="user-email"
            sx={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: '#fff',
              background: 'linear-gradient(135deg, #4f72cd, #33509f)',
            }}
          >
            {initials}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#c3cedd',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {email}
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: '#6b7c93' }}>{roleLabel}</Typography>
          </Box>
        </Box>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          bgcolor: '#f8fafc',
          p: '40px 48px 80px',
          minHeight: 'calc(100vh - 60px)',
          overflowY: 'auto',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
