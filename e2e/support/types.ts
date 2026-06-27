/** Ruoli utente supportati — ADR-003-B. */
export type Role = 'employee' | 'hr' | 'admin';

/** Email per-ruolo seedate nel DB di test (ADR-003-C). */
export const ROLE_EMAILS: Record<Role, string> = {
  employee: 'employee@sixfeetup.it',
  hr: 'hr@sixfeetup.it',
  admin: 'admin@sixfeetup.it',
};

/** Path degli storageState per-ruolo, relativi alla root e2e/ (ADR-003-B). */
export const AUTH_STATE_FILES: Record<Role, string> = {
  employee: '.auth/employee.json',
  hr: '.auth/hr.json',
  admin: '.auth/admin.json',
};
