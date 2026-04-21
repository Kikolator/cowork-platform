export interface SpaceContext {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
}
