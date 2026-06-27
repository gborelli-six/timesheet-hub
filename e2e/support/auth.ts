/**
 * Fixture loginAs — ADR-003-B.
 *
 * Stub in E1: non autentica (endpoint POST /_test/session risponde 501).
 * In E3: chiama l'endpoint, riceve il cookie JWT, salva storageState per-ruolo.
 *
 * Uso nei test:
 *   import { authFixtures } from '@support/auth';
 *   const test = base.extend<{ loginAs: AuthFixtures['loginAs'] }>(authFixtures);
 *   await loginAs('employee');
 */
import { test as base } from "@playwright/test";
import { Role, ROLE_EMAILS } from "./types";

type AuthFixtures = {
  loginAs: (role: Role, email?: string) => Promise<void>;
};

export const authFixtures = base.extend<AuthFixtures>({
  loginAs: async ({ context }, use) => {
    const loginAs = async (role: Role, email?: string): Promise<void> => {
      const targetEmail = email ?? ROLE_EMAILS[role];
      const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

      // --- E3: decommentare quando POST /_test/session è operativo ---
      // const response = await context.request.post(`${backendUrl}/_test/session`, {
      //   data: { email: targetEmail, role },
      // });
      // if (!response.ok()) {
      //   throw new Error(
      //     `loginAs(${role}) failed: ${response.status()} ${await response.text()}`
      //   );
      // }
      // Il cookie JWT è salvato automaticamente nel context.
      // Persistere con: await context.storageState({ path: AUTH_STATE_FILES[role] });
      // ---

      console.warn(
        `[loginAs] STUB E1: autenticazione non attiva per ${role} (${targetEmail}). ` +
          `Attivare in E3 quando /_test/session è operativo.`
      );

      void backendUrl;
    };

    await use(loginAs);
  },
});

export type { Role };
