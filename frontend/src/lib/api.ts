import type { ZodType } from 'zod';
import { clearSession } from './auth';
import {
  CapTableEventResponseSchema,
  CapTableResponseSchema,
  CompanyResponseSchema,
  StakeholderDetailResponseSchema,
  StakeholderResponseSchema,
  TokenResponseSchema,
  UserResponseSchema,
} from './schemas';
import { z } from 'zod';

// All requests go through the Next.js proxy route (/api/backend/*), which
// attaches the Bearer token from the httpOnly session cookie server-side.
// Client code never handles the JWT. (When RSC reads land, a server-side
// variant of this client will call the backend directly with cookies().)
const API_BASE = '/api/backend';

/** Normalized API failure: HTTP status + human-readable detail. status 0 = network failure. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 401 from these endpoints means "bad credentials/code", not "session expired"
// — they must surface the error instead of redirecting to /login.
const NO_REDIRECT_ON_401 = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/mfa/verify',
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function request<T>(path: string, init?: RequestInit, schema?: ZodType<unknown>): Promise<T> {
  const { headers, ...restInit } = init || {};
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...restInit,
      headers: { 'Content-Type': 'application/json', ...headers },
    });

  // Retry network-level failures (not HTTP errors) for reads only. Mutations
  // are never retried: cap table events are a legal record and the API has no
  // idempotency keys yet — a blind resend could double-issue shares.
  const isRead = !init?.method || init.method === 'GET';
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await doFetch();
      break;
    } catch {
      if (!isRead || attempt === 3) {
        throw new ApiError(0, 'Network error — check your connection and try again.');
      }
      await sleep(250 * attempt);
    }
  }
  if (!res) throw new ApiError(0, 'Network error — check your connection and try again.');

  if (
    res.status === 401 &&
    typeof window !== 'undefined' &&
    !NO_REDIRECT_ON_401.some(p => path.startsWith(p))
  ) {
    // Session expired or revoked: clear the cookie and return to login.
    void clearSession();
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired — redirecting to login.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = (err as { detail?: string | Array<{ msg: string }> }).detail;
    let message = 'Request failed';
    if (typeof detail === 'string') message = detail;
    else if (Array.isArray(detail) && detail.length > 0)
      message = detail.map(d => d.msg).join(', ');
    throw new ApiError(res.status, message);
  }

  // 204 carries no body; the affected endpoints are typed Promise<void> by their callers.
  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json();
  if (schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      // Intentional error reporting: a contract break between backend and
      // frontend must be loud in development, not silently mis-rendered.
      console.error(`API response validation failed for ${path}`, parsed.error.issues);
      throw new ApiError(500, `Unexpected response shape from ${path} — see console for details.`);
    }
    // Runtime-validated by the schema; drift guards in schemas.ts keep the
    // schema aligned with T at compile time.
    return parsed.data as T;
  }
  // Trusted cast for endpoints whose zod schema hasn't landed yet (ADR-0008
  // coverage is incremental, legal-correctness surface first).
  return data as T;
}

/**
 * Fetch a binary document (PDF) through the authenticated proxy and trigger a
 * browser download. The proxy injects the JWT from the session cookie, so no
 * Authorization header is set here. Throws ApiError on non-2xx so callers can
 * surface the message (e.g. 503 when PDF rendering is unavailable).
 */
async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = (err as { detail?: string }).detail;
    throw new ApiError(res.status, typeof detail === 'string' ? detail : 'Download failed');
  }
  // Prefer the server-provided filename from Content-Disposition.
  const cd = res.headers.get('content-disposition') ?? '';
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TokenResponse = { access_token: string; token_type: string; mfa_required?: boolean | undefined };
export type RegisterResponse = { message: string; email: string };

export type UserResponse = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  mfa_enabled: boolean;
};

export type MFASetupResponse = { secret: string; otpauth_uri: string };

export type EntityType = 'LLC' | 'SJSC' | 'JSC';

// Wire enums — mirrored from backend/app/models/*.py, which is the source of truth.
// If the backend enum changes, these unions must change with it.
export type CompanyStatus = 'active' | 'suspended' | 'dissolved';
export type MemberRole = 'admin' | 'editor' | 'viewer';
export type CapTableEventType =
  | 'share_issuance'
  | 'share_transfer'
  | 'share_cancellation'
  | 'capital_increase'
  | 'capital_decrease';
export type EsopPlanStatus = 'active' | 'exhausted' | 'closed';
export type GrantStatus = 'active' | 'exercised' | 'partially_exercised' | 'forfeited' | 'expired' | 'terminated';
export type LeaverType = 'good_leaver' | 'bad_leaver';
export type VestingType = 'cliff_monthly' | 'performance';

export type PerformanceMilestone = {
  label: string;
  fraction: string;
  achieved: boolean;
  achieved_date: string | null;
};
export type FilingType =
  | 'moc_partner_register'
  | 'moc_aoa_amendment'
  | 'moc_capital_change'
  | 'zatca_zakat_year'
  | 'cma_esop_disclosure';
export type FilingStatus = 'pending' | 'in_progress' | 'submitted' | 'not_required';
export type InstrumentType = 'sukuk_convertible' | 'phantom' | 'warrant';
export type InstrumentStatus = 'active' | 'converted' | 'redeemed' | 'expired';
export type ProRataStatus = 'active' | 'exercised' | 'waived' | 'expired';

export type CompanyResponse = {
  id: string;
  name_en: string;
  name_ar: string | null;
  entity_type: EntityType;
  cr_number: string | null;
  status: CompanyStatus;
  authorized_capital: string | null;
  paid_up_capital: string | null;
  par_value_per_share: string | null;
  incorporation_date: string | null;
  fiscal_year_start: number | null;
  has_rofr: boolean;
  rofr_days: number | null;
  has_drag_tag: boolean;
  has_tag_along: boolean;
  profit_allocation_notes: string | null;
  created_at: string;
};

export type StakeholderType = 'natural_person' | 'legal_entity';

export type StakeholderResponse = {
  id: string;
  company_id: string;
  stakeholder_type: StakeholderType;
  name_en: string;
  name_ar: string | null;
  nationality: string | null;
  cr_number: string | null;
  email: string | null;
  created_at: string;
};

export type StakeholderDetailResponse = StakeholderResponse & {
  holdings: { share_class: string; quantity: string }[];
};

export type SyntheticKind = 'esop_pool' | 'esop_grants' | 'convertible';

export type HoldingResponse = {
  stakeholder_id: string | null;  // null for synthetic (diluted) rows
  stakeholder_name: string;
  share_class: string;
  quantity: string;
  percentage: string;
  synthetic?: SyntheticKind | null | undefined;
};

export type CapTableResponse = {
  company_id: string;
  total_shares: string;
  holdings: HoldingResponse[];
  total_shares_issued?: string | null | undefined;
  total_shares_diluted?: string | null | undefined;
};

export type ProjectedSyntheticKind = SyntheticKind | 'esop_topup' | 'new_investor';

export type ProjectedHolding = {
  stakeholder_name: string;
  share_class: string;
  pre_round_quantity: string;
  pre_round_percentage: string;
  post_round_quantity: string;
  post_round_percentage: string;
  dilution_delta_pp: string;
  is_new: boolean;
  synthetic?: ProjectedSyntheticKind | null;
};

export type RoundPreviewResponse = {
  pre_money_valuation_sar: string;
  post_money_valuation_sar: string;
  pre_round_total_shares: string;
  post_round_total_shares: string;
  new_investor_shares: string;
  esop_topup_shares: string;
  holdings: ProjectedHolding[];
};

export type ParticipationType = 'non_participating' | 'participating' | 'capped';

export type WaterfallPreference = {
  share_class: string;
  seniority: number;
  multiplier: number;
  participation: ParticipationType;
  cap_multiplier?: number | undefined;
  original_investment_sar: number;
};

export type StakeholderDistribution = {
  stakeholder_name: string;
  share_class: string;
  quantity: string;
  distribution_sar: string;
  pct_of_exit: string;
  synthetic?: SyntheticKind | null;
};

export type ClassDistribution = {
  share_class: string;
  total_distribution_sar: string;
  pct_of_exit: string;
  converted: boolean;
};

export type Breakpoint = {
  exit_value_sar: string;
  description: string;
  breakpoint_type: 'common_starts' | 'conversion' | 'cap_hit';
  share_class: string | null;
};

export type WaterfallResponse = {
  exit_value_sar: string;
  total_distributed_sar: string;
  stakeholder_distributions: StakeholderDistribution[];
  class_distributions: ClassDistribution[];
  breakpoints: Breakpoint[];
};

export type IFRS2ValuationInputs = {
  spot_price_sar: number;
  volatility: number;       // 0.40 = 40%
  risk_free_rate: number;   // 0.045 = 4.5%
  dividend_yield?: number | undefined;  // default 0
  expected_life_years?: number | undefined;
};

export type IFRS2PeriodExpense = {
  period_start: string;
  period_end: string;
  period_expense_sar: string;
  cumulative_expense_sar: string;
};

export type IFRS2ExpenseResponse = {
  grant_id: string;
  fair_value_per_option_sar: string;
  total_grant_expense_sar: string;
  vesting_start: string;
  vesting_end: string;
  total_vesting_months: number;
  method: string;
  inputs: {
    spot_price_sar: string;
    volatility: string;
    risk_free_rate: string;
    dividend_yield: string;
    expected_life_years: string | null;
  };
  schedule: IFRS2PeriodExpense[];
};

export type CapTableEventResponse = {
  id: string;
  company_id: string;
  event_type: CapTableEventType;
  event_date: string;
  payload: Record<string, unknown>;
  notes: string | null;
  is_draft: boolean;
  created_by: string;
};

export type EsopPlanResponse = {
  id: string;
  company_id: string;
  name: string;
  total_pool: string;
  allocated: string;
  share_class: string;
  authorized_date: string | null;
  plan_rules: string | null;
  status: EsopPlanStatus;
  created_at: string;
};

export type GrantResponse = {
  id: string;
  plan_id: string;
  company_id: string;
  stakeholder_id: string;
  quantity: string;
  exercised_quantity: string;
  grant_date: string;
  expiry_date: string | null;
  exercise_price: string | null;
  vesting_schedule: {
    type: string;
    cliff_months?: number;
    total_months?: number;
    milestones?: PerformanceMilestone[];
  };
  status: GrantStatus;
  termination_date?: string | null;
  leaver_type?: LeaverType | null;
  notes: string | null;
  created_at: string;
};

export type BulkGrantRowResult = {
  stakeholder_id: string;
  quantity: string;
  ok: boolean;
  error: string | null;
};

export type BulkGrantResponse = {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  total_quantity: string;
  pool_remaining_after: string;
  committed: number;
  results: BulkGrantRowResult[];
};

export type SigningStatus = 'sent' | 'signed' | 'declined' | 'voided';

export type SigningRecordResponse = {
  id: string;
  company_id: string;
  document_type: string;
  document_name: string;
  provider: string;
  envelope_id: string;
  status: SigningStatus;
  signers: { name: string; email: string }[];
  notes: string | null;
  created_at: string;
  completed_at: string | null;
};

export type FilingReference = {
  authority: string;
  title_en: string;
  title_ar: string;
  deadline_days: number;
  fee_note_en: string;
  portal_section: string;
  required_documents: string[];
  description_en: string;
};

export type FilingResponse = {
  id: string;
  company_id: string;
  filing_type: FilingType;
  trigger_event_id: string | null;
  status: FilingStatus;
  due_date: string | null;
  submitted_date: string | null;
  notes: string | null;
  created_at: string;
  is_overdue: boolean;
  reference: FilingReference | null;
};

export type InstrumentResponse = {
  id: string;
  company_id: string;
  stakeholder_id: string;
  instrument_type: InstrumentType;
  name: string;
  face_value: string | null;
  quantity: string;
  issue_date: string;
  maturity_date: string | null;
  terms: Record<string, unknown>;
  status: InstrumentStatus;
  notes: string | null;
  created_at: string;
};

export type ProRataRightResponse = {
  id: string;
  company_id: string;
  stakeholder_id: string;
  instrument_id: string | null;
  round_name: string;
  max_investment_sar: string;
  deadline: string | null;
  status: ProRataStatus;
  exercised_amount_sar: string | null;
  exercised_at: string | null;
  notes: string | null;
  created_at: string;
};

export type MemberResponse = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: MemberRole;
  created_at: string;
};

// Mock MoC lookup — mirrors backend/app/api/integrations.py response shape.
export type MoCCompanyLookupResponse = {
  cr_number: string;
  status: string;
  name_en: string;
  name_ar: string;
  entity_type: EntityType;
  capital: number;
  incorporation_date: string;
  mock: boolean;
};

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (email: string, password: string, fullName?: string) =>
      request<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName }),
      }),
    verifyEmail: (email: string, otp: string) =>
      request<TokenResponse>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      }, TokenResponseSchema),
    resendVerification: (email: string) =>
      request<RegisterResponse>('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    login: (email: string, password: string) =>
      request<TokenResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }, TokenResponseSchema),
    me: () =>
      request<UserResponse>('/api/auth/me', undefined, UserResponseSchema),
    mfaSetup: () =>
      request<MFASetupResponse>('/api/auth/mfa/setup', { method: 'POST' }),
    mfaQrUrl: () => `${API_BASE}/api/auth/mfa/qr`,
    mfaEnable: (code: string) =>
      request<{ mfa_enabled: boolean }>('/api/auth/mfa/enable', {
        method: 'POST', body: JSON.stringify({ code }),
      }),
    mfaVerify: (code: string) =>
      request<TokenResponse>('/api/auth/mfa/verify', {
        method: 'POST', body: JSON.stringify({ code }),
      }, TokenResponseSchema),
    mfaDisable: (code: string) =>
      request<{ mfa_enabled: boolean }>('/api/auth/mfa/disable', {
        method: 'POST', body: JSON.stringify({ code }),
      }),
    devLogin: (email: string, password: string) =>
      request<TokenResponse>('/api/auth/dev/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }, TokenResponseSchema),
    devVerifyEmail: (email: string) =>
      request<TokenResponse>('/api/auth/dev/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, otp: '000000' }),
      }, TokenResponseSchema),
  },

  companies: {
    list: () =>
      request<CompanyResponse[]>('/api/companies', undefined, z.array(CompanyResponseSchema)),
    get: (id: string) =>
      request<CompanyResponse>(`/api/companies/${id}`, undefined, CompanyResponseSchema),
    create: (body: {
      name_en: string; name_ar?: string | undefined; entity_type: EntityType;
      cr_number?: string | undefined; authorized_capital?: number | undefined;
      paid_up_capital?: number | undefined; par_value_per_share?: number | undefined;
      incorporation_date?: string | undefined; fiscal_year_start?: number | undefined;
      has_rofr?: boolean | undefined; rofr_days?: number | undefined;
      has_drag_tag?: boolean | undefined; has_tag_along?: boolean | undefined;
      profit_allocation_notes?: string | undefined;
    }) =>
      request<CompanyResponse>('/api/companies', {
        method: 'POST', body: JSON.stringify(body),
      }),
    // companies.update removed 2026-06: no UI called it, and its
    // Partial<CompanyResponse> body didn't match the backend's
    // UpdateCompanyRequest. Reintroduce typed against that schema
    // when company editing ships.
    delete: (id: string) =>
      request<void>(`/api/companies/${id}`, {
        method: 'DELETE',
      }),
  },

  stakeholders: {
    list: (companyId: string) =>
      request<StakeholderResponse[]>(`/api/companies/${companyId}/stakeholders`, undefined, z.array(StakeholderResponseSchema)),
    get: (companyId: string, stakeholderId: string) =>
      request<StakeholderDetailResponse>(`/api/companies/${companyId}/stakeholders/${stakeholderId}`, undefined, StakeholderDetailResponseSchema),
    create: (companyId: string, body: {
      stakeholder_type: StakeholderType; name_en: string; name_ar?: string | undefined;
      national_id?: string | undefined; nationality?: string | undefined;
      cr_number?: string | undefined; email?: string | undefined;
    }) =>
      request<StakeholderResponse>(`/api/companies/${companyId}/stakeholders`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    update: (companyId: string, stakeholderId: string, body: {
      name_en?: string | undefined; name_ar?: string | undefined;
      nationality?: string | undefined; cr_number?: string | undefined;
      email?: string | undefined; national_id?: string | undefined;
      iban?: string | undefined;
    }) =>
      request<StakeholderResponse>(`/api/companies/${companyId}/stakeholders/${stakeholderId}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }),
    delete: (companyId: string, stakeholderId: string) =>
      request<void>(`/api/companies/${companyId}/stakeholders/${stakeholderId}`, {
        method: 'DELETE',
      }),
  },

  capTable: {
    get: (companyId: string, opts?: { diluted?: boolean }) =>
      request<CapTableResponse>(`/api/companies/${companyId}/cap-table${opts?.diluted ? '?diluted=true' : ''}`, undefined, CapTableResponseSchema),
    previewRound: (companyId: string, body: {
      round_size_sar: number; price_per_share: number;
      new_share_class?: string | undefined; new_investor_name?: string | undefined;
      target_esop_post_money_pct?: number | undefined;
    }) =>
      request<RoundPreviewResponse>(`/api/companies/${companyId}/cap-table/preview-round`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    waterfall: (companyId: string, body: {
      exit_value_sar: number;
      preferences: WaterfallPreference[];
    }) =>
      request<WaterfallResponse>(`/api/companies/${companyId}/cap-table/waterfall`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    issue: (companyId: string, body: {
      stakeholder_id: string; share_class?: string | undefined; quantity: number;
      event_date: string; notes?: string | undefined;
    }) =>
      request<CapTableEventResponse>(`/api/companies/${companyId}/cap-table/issue`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    transfer: (companyId: string, body: {
      from_stakeholder_id: string; to_stakeholder_id: string; share_class?: string | undefined;
      quantity: number; price_per_share?: number | undefined;
      event_date: string; notes?: string | undefined; rofr_waived?: boolean | undefined;
    }) =>
      request<CapTableEventResponse>(`/api/companies/${companyId}/cap-table/transfer`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    split: (companyId: string, body: {
      share_class: string; split_ratio_numerator: number;
      split_ratio_denominator: number; event_date: string; notes?: string | undefined;
    }) =>
      request<CapTableEventResponse>(`/api/companies/${companyId}/cap-table/split`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    capitalIncrease: (companyId: string, body: {
      new_authorized_capital?: number | undefined; new_paid_up_capital?: number | undefined;
      share_class?: string | undefined; shares_issued?: number | undefined;
      stakeholder_id?: string | undefined;
      event_date: string; notes?: string | undefined;
    }) =>
      request<CapTableEventResponse>(`/api/companies/${companyId}/cap-table/capital-increase`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    capitalDecrease: (companyId: string, body: {
      stakeholder_id: string; share_class?: string | undefined; quantity: number;
      event_date: string; notes?: string | undefined;
    }) =>
      request<CapTableEventResponse>(`/api/companies/${companyId}/cap-table/capital-decrease`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    events: (companyId: string) =>
      request<CapTableEventResponse[]>(`/api/companies/${companyId}/cap-table/events`, undefined, z.array(CapTableEventResponseSchema)),
    zatcaExport: (companyId: string) =>
      request<Record<string, unknown>>(`/api/companies/${companyId}/exports/zatca`),
  },

  esop: {
    listPlans: (companyId: string) =>
      request<EsopPlanResponse[]>(`/api/companies/${companyId}/esop`),
    createPlan: (companyId: string, body: {
      name: string; total_pool: number; share_class?: string | undefined;
      authorized_date?: string | undefined; plan_rules?: string | undefined;
    }) =>
      request<EsopPlanResponse>(`/api/companies/${companyId}/esop`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    getPlan: (companyId: string, planId: string) =>
      request<EsopPlanResponse>(`/api/companies/${companyId}/esop/${planId}`),
    listGrants: (companyId: string, planId: string) =>
      request<GrantResponse[]>(`/api/companies/${companyId}/esop/${planId}/grants`),
    createGrant: (companyId: string, planId: string, body: {
      stakeholder_id: string; quantity: number; grant_date: string;
      expiry_date?: string | undefined; exercise_price?: number | undefined;
      vesting_type?: VestingType | undefined;
      cliff_months?: number | undefined; total_months?: number | undefined;
      milestones?: { label: string; fraction: number }[] | undefined;
      notes?: string | undefined;
    }) =>
      request<GrantResponse>(`/api/companies/${companyId}/esop/${planId}/grants`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    exerciseGrant: (companyId: string, planId: string, grantId: string, body: {
      quantity: number; exercise_type: 'cash' | 'net'; exercise_date: string;
      notes?: string | undefined;
    }) =>
      request<GrantResponse>(`/api/companies/${companyId}/esop/${planId}/grants/${grantId}/exercise`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    terminateGrant: (companyId: string, planId: string, grantId: string, body: {
      leaver_type: LeaverType; termination_date: string; notes?: string | undefined;
    }) =>
      request<GrantResponse>(`/api/companies/${companyId}/esop/${planId}/grants/${grantId}/terminate`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    achieveMilestone: (companyId: string, planId: string, grantId: string, body: {
      milestone_index: number; achieved_date: string;
    }) =>
      request<GrantResponse>(`/api/companies/${companyId}/esop/${planId}/grants/${grantId}/achieve-milestone`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    bulkGrants: (companyId: string, planId: string, body: {
      dry_run: boolean;
      grants: {
        stakeholder_id: string; quantity: number; grant_date: string;
        exercise_price?: number | undefined; cliff_months?: number | undefined;
        total_months?: number | undefined;
      }[];
    }) =>
      request<BulkGrantResponse>(`/api/companies/${companyId}/esop/${planId}/grants/bulk`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    ifrs2Expense: (
      companyId: string,
      planId: string,
      grantId: string,
      body: IFRS2ValuationInputs,
    ) =>
      request<IFRS2ExpenseResponse>(
        `/api/companies/${companyId}/esop/${planId}/grants/${grantId}/ifrs2-expense`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
  },

  documents: {
    capTablePdf: (companyId: string) =>
      downloadFile(`/api/companies/${companyId}/documents/cap-table.pdf`, 'cap-table.pdf'),
    certificatePdf: (companyId: string, stakeholderId: string, shareClass?: string) =>
      downloadFile(
        `/api/companies/${companyId}/documents/stakeholders/${stakeholderId}/certificate.pdf${shareClass ? `?share_class=${encodeURIComponent(shareClass)}` : ''}`,
        'certificate.pdf',
      ),
    vestingPdf: (companyId: string, planId: string, grantId: string) =>
      downloadFile(
        `/api/companies/${companyId}/esop/${planId}/grants/${grantId}/vesting.pdf`,
        'vesting.pdf',
      ),
    auditPackZip: (companyId: string) =>
      downloadFile(`/api/companies/${companyId}/documents/audit-pack.zip`, 'audit-pack.zip'),
    filingDraftPdf: (companyId: string, filingId: string) =>
      downloadFile(`/api/companies/${companyId}/filings/${filingId}/draft.pdf`, 'filing-draft.pdf'),
    cmaPlanPdf: (companyId: string, planId: string) =>
      downloadFile(`/api/companies/${companyId}/esop/${planId}/cma-plan.pdf`, 'cma-esop-plan.pdf'),
  },

  signing: {
    list: (companyId: string) =>
      request<SigningRecordResponse[]>(`/api/companies/${companyId}/signing`),
    send: (companyId: string, body: {
      document_type: string; document_name: string;
      signers: { name: string; email: string }[]; notes?: string | undefined;
    }) =>
      request<SigningRecordResponse>(`/api/companies/${companyId}/signing`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    markSigned: (companyId: string, recordId: string) =>
      request<SigningRecordResponse>(`/api/companies/${companyId}/signing/${recordId}/mark-signed`, {
        method: 'POST',
      }),
  },

  filings: {
    list: (companyId: string) =>
      request<FilingResponse[]>(`/api/companies/${companyId}/filings`),
    update: (companyId: string, filingId: string, body: {
      status?: FilingStatus | undefined; submitted_date?: string | undefined;
      notes?: string | undefined;
    }) =>
      request<FilingResponse>(`/api/companies/${companyId}/filings/${filingId}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }),
  },

  instruments: {
    list: (companyId: string) =>
      request<InstrumentResponse[]>(`/api/companies/${companyId}/instruments`),
    create: (companyId: string, body: {
      stakeholder_id: string; instrument_type: InstrumentType;
      name: string; quantity: number; face_value?: number | undefined; issue_date: string;
      maturity_date?: string | undefined; terms?: Record<string, unknown> | undefined;
      notes?: string | undefined;
    }) =>
      request<InstrumentResponse>(`/api/companies/${companyId}/instruments`, {
        method: 'POST', body: JSON.stringify(body),
      }),
  },

  proRata: {
    list: (companyId: string) =>
      request<ProRataRightResponse[]>(`/api/companies/${companyId}/pro-rata-rights`),
    create: (companyId: string, body: {
      stakeholder_id: string; round_name: string; max_investment_sar: number;
      deadline?: string | undefined; instrument_id?: string | undefined;
      notes?: string | undefined;
    }) =>
      request<ProRataRightResponse>(`/api/companies/${companyId}/pro-rata-rights`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    exercise: (companyId: string, rightId: string, exercisedAmountSar: number) =>
      request<ProRataRightResponse>(`/api/companies/${companyId}/pro-rata-rights/${rightId}/exercise`, {
        method: 'POST', body: JSON.stringify({ exercised_amount_sar: exercisedAmountSar }),
      }),
    waive: (companyId: string, rightId: string) =>
      request<ProRataRightResponse>(`/api/companies/${companyId}/pro-rata-rights/${rightId}/waive`, {
        method: 'POST',
      }),
  },

  members: {
    list: (companyId: string) =>
      request<MemberResponse[]>(`/api/companies/${companyId}/members`),
    updateRole: (companyId: string, memberId: string, role: MemberRole) =>
      request<{ id: string; role: string }>(`/api/companies/${companyId}/members/${memberId}`, {
        method: 'PATCH', body: JSON.stringify({ role }),
      }),
    remove: (companyId: string, memberId: string) =>
      request<void>(`/api/companies/${companyId}/members/${memberId}`, {
        method: 'DELETE',
      }),
  },

  integrations: {
    moc: {
      fetchCompany: (crNumber: string) =>
        request<MoCCompanyLookupResponse>(`/api/integrations/moc/cr/${crNumber}`),
    },
  },
};
