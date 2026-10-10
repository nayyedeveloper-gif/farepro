import api from '../services/api';

export interface OrgInfo {
  id: string;
  name: string;
  subdomain: string;
  plan?: string;
}

export interface OrgContext {
  hasOrg: boolean;
  role?: string;
  organization?: OrgInfo;
}

export function saveOrgContext(organization: OrgInfo, role: string, token?: string) {
  localStorage.setItem('org', JSON.stringify(organization));
  localStorage.setItem('orgRole', role);
  if (token) {
    localStorage.setItem('token', token);
  }
}

export function clearOrgContext() {
  localStorage.removeItem('org');
  localStorage.removeItem('orgRole');
}

export function getOrgRole(): string {
  return localStorage.getItem('orgRole') || '';
}

export function getHomeRouteForRole(role: string): string {
  if (role === 'owner' || role === 'admin') return '/portal';
  if (role === 'dispatcher') return '/dispatch';
  return '/app';
}

export async function syncOrgContext(): Promise<OrgContext> {
  try {
    const res = await api.get('/org/context');
    const data = res.data;
    if (!data.hasOrg) {
      clearOrgContext();
      return { hasOrg: false };
    }
    saveOrgContext(data.organization, data.role, data.token);
    return {
      hasOrg: true,
      role: data.role,
      organization: data.organization,
    };
  } catch {
    const org = localStorage.getItem('org');
    const role = localStorage.getItem('orgRole');
    if (org && role) {
      return { hasOrg: true, role, organization: JSON.parse(org) };
    }
    return { hasOrg: false };
  }
}
