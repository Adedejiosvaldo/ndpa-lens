import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";

export interface SignupOrganisation {
  legalName: string;
  tradingName: string;
  address: string;
  phone: string;
}

interface SignupStore {
  /** Set by Better Auth's user-create hook: only for a genuinely new account. */
  createdUserId?: string;
}

/**
 * Lets the sign-up controller learn whether Better Auth really created a user:
 * its user-create hook only fires for new emails. The controller then creates
 * the organisation for new accounts only, while answering every sign-up the
 * same way (no enumeration).
 */
type NewUserHandler = (userId: string, organisation: SignupOrganisation) => Promise<void>;

@Injectable()
export class SignupContext {
  private readonly als = new AsyncLocalStorage<SignupStore>();
  private readonly handlers: NewUserHandler[] = [];

  /** Registered by OrgsModule (no import cycle with AuthModule). */
  onNewUser(fn: NewUserHandler): void {
    this.handlers.push(fn);
  }

  async afterNewUser(userId: string, organisation: SignupOrganisation): Promise<void> {
    for (const h of this.handlers) await h(userId, organisation);
  }

  run<T>(fn: () => Promise<T>): Promise<{ result: T; createdUserId?: string }> {
    const store: SignupStore = {};
    return this.als.run(store, async () => ({ result: await fn(), createdUserId: store.createdUserId }));
  }

  markCreated(userId: string): void {
    const store = this.als.getStore();
    if (store) store.createdUserId = userId;
  }
}
