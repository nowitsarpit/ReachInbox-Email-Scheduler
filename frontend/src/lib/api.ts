const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include', // send HttpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? `HTTP ${res.status}`
    );
  }

  return res.json() as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function getMe() {
  return apiFetch<{
    user: { id: string; email: string; name: string | null; avatarUrl: string | null };
    organization: { id: string; name: string; slug: string } | null;
    role: string;
    permissions: string[];
  }>('/api/v1/auth/me');
}

export async function logout() {
  return apiFetch<{ success: boolean }>('/api/v1/auth/logout', { method: 'POST' });
}

export async function getAuthStatus() {
  return apiFetch<{ oauthConfigured: boolean; provider: string; configurationUrl: string | null }>(
    '/api/v1/auth/status'
  );
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  deliveryMode: string;
  delayMs?: number;
  subject?: string;
  htmlBody?: string;
  senderId?: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  processingCount: number;
  deferredCount: number;
  cancelledCount: number;
  scheduledCount: number;
  createdAt: string;
  updatedAt: string;
  sender?: Sender;
}

export async function getCampaigns(params?: Record<string, string | number>) {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return apiFetch<{ data: Campaign[]; pagination: Pagination }>(`/api/v1/campaigns${qs}`);
}

export async function getCampaign(id: string) {
  return apiFetch<{ data: Campaign }>(`/api/v1/campaigns/${id}`);
}

export async function createCampaign(data: { name: string; description?: string }) {
  return apiFetch<{ data: Campaign }>('/api/v1/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCampaign(id: string, data: Partial<Campaign>) {
  return apiFetch<{ data: Campaign }>(`/api/v1/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function launchCampaign(id: string) {
  return apiFetch<{ data: Campaign }>(`/api/v1/campaigns/${id}/launch`, { method: 'POST' });
}

export async function pauseCampaign(id: string) {
  return apiFetch<{ data: Campaign }>(`/api/v1/campaigns/${id}/pause`, { method: 'POST' });
}

export async function resumeCampaign(id: string) {
  return apiFetch<{ data: Campaign }>(`/api/v1/campaigns/${id}/resume`, { method: 'POST' });
}

export async function cancelCampaign(id: string) {
  return apiFetch<{ data: Campaign }>(`/api/v1/campaigns/${id}/cancel`, { method: 'POST' });
}

export async function deleteCampaign(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/campaigns/${id}`, { method: 'DELETE' });
}

export async function importRecipients(campaignId: string, file: File | null, emails?: string) {
  const form = new FormData();
  if (file) form.append('file', file);
  if (emails) form.append('emails', emails);

  const res = await fetch(
    `${API_URL}/api/v1/campaigns/${campaignId}/recipients/import`,
    { method: 'POST', body: form, credentials: 'include' }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getCampaignRecipients(campaignId: string, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<{ data: unknown[]; pagination: Pagination }>(`/api/v1/campaigns/${campaignId}/recipients${qs}`);
}

// ─── Senders ─────────────────────────────────────────────────────────────────

export interface Sender {
  id: string;
  name: string;
  email: string;
  replyTo?: string;
  status: string;
  hourlyLimit?: number;
}

export async function getSenders() {
  return apiFetch<{ data: Sender[] }>('/api/v1/senders');
}

export async function createSender(data: { name: string; email: string; replyTo?: string; hourlyLimit?: number }) {
  return apiFetch<{ data: Sender }>('/api/v1/senders', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteSender(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/senders/${id}`, { method: 'DELETE' });
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function getTemplates() {
  return apiFetch<{ data: unknown[] }>('/api/v1/templates');
}

export async function createTemplate(data: unknown) {
  return apiFetch<{ data: unknown }>('/api/v1/templates', { method: 'POST', body: JSON.stringify(data) });
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContacts(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<{ data: unknown[]; pagination: Pagination }>(`/api/v1/contacts${qs}`);
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getAnalytics() {
  return apiFetch<{ data: unknown }>('/api/v1/analytics');
}

export async function getCampaignAnalytics(campaignId: string) {
  return apiFetch<{ data: unknown }>(`/api/v1/analytics/campaigns/${campaignId}`);
}

// ─── Activity ────────────────────────────────────────────────────────────────

export async function getActivity(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<{ data: unknown[]; pagination: Pagination }>(`/api/v1/activity${qs}`);
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function getOperationsStatus() {
  return apiFetch<{ data: unknown }>('/api/v1/operations');
}

// ─── Team ────────────────────────────────────────────────────────────────────

export async function getTeam() {
  return apiFetch<{ data: unknown[] }>('/api/v1/team');
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export async function getApiKeys() {
  return apiFetch<{ data: unknown[] }>('/api/v1/api-keys');
}

export async function createApiKey(data: { name: string; scopes: string[] }) {
  return apiFetch<{ data: unknown }>('/api/v1/api-keys', { method: 'POST', body: JSON.stringify(data) });
}

export async function revokeApiKey(id: string) {
  return apiFetch<{ success: boolean }>(`/api/v1/api-keys/${id}`, { method: 'DELETE' });
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export async function getWebhooks() {
  return apiFetch<{ data: unknown[] }>('/api/v1/webhooks');
}

// ─── Shared ──────────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export { ApiError };
