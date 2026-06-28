/**
 * Fixture loginAs — ADR-003-B.
 *
 * E3 (STORY-020): chiama POST /api/_test/session, riceve cookie JWT,
 * salva storageState per-ruolo in e2e/.auth/{role}.json.
 *
 * Uso nei test:
 *   import { authFixtures } from '@support/auth';
 *   const test = base.extend(authFixtures);
 *   await loginAs('employee');
 */
import path from "path";
import { test as base } from "@playwright/test";
import { Role, ROLE_EMAILS, AUTH_STATE_FILES } from "./types";

type AuthFixtures = {
  loginAs: (role: Role, email?: string) => Promise<void>;
};

export const authFixtures = base.extend<AuthFixtures>({
  loginAs: async ({ context }, use) => {
    const loginAs = async (role: Role, email?: string): Promise<void> => {
      const targetEmail = email ?? ROLE_EMAILS[role];
      const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

      const response = await context.request.post(
        `${backendUrl}/api/_test/session`,
        { data: { email: targetEmail, role } }
      );
      if (!response.ok()) {
        throw new Error(
          `loginAs(${role}) failed: ${response.status()} ${await response.text()}`
        );
      }
      // Il cookie JWT è salvato automaticamente nel context da Playwright.
      await context.storageState({
        path: path.join(__dirname, "..", AUTH_STATE_FILES[role]),
      });
    };

    await use(loginAs);
  },
});

export type { Role };
