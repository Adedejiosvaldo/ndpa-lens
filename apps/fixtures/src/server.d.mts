export interface Variant {
  id: string;
  flags: Record<string, boolean>;
  note: string;
  /** Expected outcome per check id. */
  expect: Record<string, "pass" | "fail" | "needs_review">;
}
export declare const VARIANTS: Variant[];
export declare const TRACKER_HOSTS: string[];
export declare const FIXTURE_DOMAIN: string;
export interface Fixtures {
  httpsPort: number;
  httpPort: number;
  caCert: string;
  url(variant: string, path?: string): string;
  hostResolverRules: string;
  close(): Promise<void>;
}
export declare function startFixtures(opts?: { host?: string }): Promise<Fixtures>;
