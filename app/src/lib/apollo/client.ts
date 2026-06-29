const APOLLO_BASE_URL = "https://api.apollo.io";

function resolveApiKey(apiKey?: string): string {
  const key = apiKey || process.env.APOLLO_API_KEY;
  if (!key) throw new Error("Apollo API key não configurada para esta organização");
  return key;
}

async function apolloFetch<T>(endpoint: string, body: Record<string, unknown>, method = "POST", apiKey?: string): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": resolveApiKey(apiKey),
    },
  };
  if (method === "POST") opts.body = JSON.stringify(body);
  if (method === "GET") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    endpoint = `${endpoint}?${qs.toString()}`;
  }

  const res = await fetch(`${APOLLO_BASE_URL}${endpoint}`, opts);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string | null;
  headline: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  email: string | null;
  email_status: string | null;
  phone_numbers?: Array<{ raw_number: string; type: string }>;
  seniority: string | null;
  departments: string[];
  subdepartments: string[];
  functions: string[];
  employment_history: Array<{
    organization_name: string;
    title: string | null;
    current: boolean;
    start_date: string | null;
    end_date: string | null;
  }>;
  organization?: ApolloOrganization;
  twitter_url: string | null;
  github_url: string | null;
  facebook_url: string | null;
  is_likely_to_engage?: boolean;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url: string | null;
  industry: string | null;
  industries: string[];
  estimated_num_employees: number | null;
  annual_revenue: number | null;
  annual_revenue_printed: string | null;
  organization_revenue_printed: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  founded_year: number | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
  keywords: string[];
  short_description: string | null;
  raw_address: string | null;
  street_address: string | null;
  postal_code: string | null;
  logo_url: string | null;
  primary_domain: string | null;
  technology_names: string[];
  current_technologies: Array<{ uid: string; name: string; category: string }>;
  total_funding: number | null;
  total_funding_printed: string | null;
  latest_funding_stage: string | null;
  organization_headcount_six_month_growth: number | null;
  organization_headcount_twelve_month_growth: number | null;
  sic_codes: string[];
  naics_codes: string[];
}

// Search result person (partial data — last names obfuscated)
export interface ApolloSearchPerson {
  id: string;
  first_name: string;
  last_name_obfuscated: string;
  title: string | null;
  headline: string | null;
  has_email: boolean;
  has_city: boolean;
  has_state: boolean;
  has_country: boolean;
  has_direct_phone: string;
  last_refreshed_at: string;
  organization: {
    name: string;
    has_industry: boolean;
    has_phone: boolean;
    has_employee_count: boolean;
  };
}

// ─── People Enrichment (Match) ──────────────────────────────

interface PeopleMatchResponse {
  person: ApolloPerson | null;
}

export interface EnrichPersonParams {
  email?: string;
  name?: string;
  organization?: string;
  domain?: string;
  linkedinUrl?: string;
  revealPersonalEmails?: boolean;
  revealPhoneNumber?: boolean;
  webhookUrl?: string;
}

export async function enrichPerson(params: EnrichPersonParams, apiKey?: string): Promise<ApolloPerson | null> {
  const body: Record<string, unknown> = {};
  if (params.email) body.email = params.email;
  if (params.name) {
    const parts = params.name.trim().split(/\s+/);
    body.first_name = parts[0];
    body.last_name = parts.slice(1).join(" ") || undefined;
  }
  if (params.organization) body.organization_name = params.organization;
  if (params.domain) body.domain = params.domain;
  if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl;
  if (params.revealPersonalEmails) body.reveal_personal_emails = true;
  if (params.revealPhoneNumber) body.reveal_phone_number = true;
  if (params.webhookUrl) body.webhook_url = params.webhookUrl;

  const data = await apolloFetch<PeopleMatchResponse>("/api/v1/people/match", body, "POST", apiKey);
  return data.person || null;
}

// ─── Organization Enrichment ────────────────────────────────

interface OrgEnrichResponse {
  organization: ApolloOrganization | null;
}

export async function enrichOrganization(params: {
  domain?: string;
  name?: string;
}, apiKey?: string): Promise<ApolloOrganization | null> {
  const body: Record<string, unknown> = {};
  if (params.domain) body.domain = params.domain;
  if (params.name) body.organization_name = params.name;

  const data = await apolloFetch<OrgEnrichResponse>("/api/v1/organizations/enrich", body, "POST", apiKey);
  return data.organization || null;
}

// ─── People Search (Prospecting) ────────────────────────────

interface PeopleSearchResponse {
  people: ApolloSearchPerson[];
  total_entries: number;
}

export interface PeopleSearchParams {
  q_keywords?: string;
  q_person_name?: string;
  person_titles?: string[];
  person_not_titles?: string[];
  person_seniorities?: string[];
  person_locations?: string[];
  person_departments?: string[];
  q_organization_domains?: string;
  q_organization_name?: string;
  organization_num_employees_ranges?: string[];
  organization_revenue_ranges?: string[];
  currently_using_any_of_technology_uids?: string[];
  page?: number;
  per_page?: number;
}

export async function searchPeople(params: PeopleSearchParams, apiKey?: string): Promise<{ people: ApolloSearchPerson[]; total: number }> {
  const body: Record<string, unknown> = {
    page: params.page || 1,
    per_page: params.per_page || 25,
  };
  if (params.q_keywords) body.q_keywords = params.q_keywords;
  if (params.q_person_name) body.q_person_name = params.q_person_name;
  if (params.person_titles?.length) body.person_titles = params.person_titles;
  if (params.person_not_titles?.length) body.person_not_titles = params.person_not_titles;
  if (params.person_seniorities?.length) body.person_seniorities = params.person_seniorities;
  if (params.person_locations?.length) body.person_locations = params.person_locations;
  if (params.person_departments?.length) body.person_departments = params.person_departments;
  if (params.q_organization_domains) body.q_organization_domains = params.q_organization_domains;
  if (params.q_organization_name) body.q_organization_name = params.q_organization_name;
  if (params.organization_num_employees_ranges?.length) body.organization_num_employees_ranges = params.organization_num_employees_ranges;
  if (params.organization_revenue_ranges?.length) body.organization_revenue_ranges = params.organization_revenue_ranges;
  if (params.currently_using_any_of_technology_uids?.length) body.currently_using_any_of_technology_uids = params.currently_using_any_of_technology_uids;

  const data = await apolloFetch<PeopleSearchResponse>("/api/v1/mixed_people/api_search", body, "POST", apiKey);
  return { people: data.people || [], total: data.total_entries || 0 };
}

// ─── Bulk People Enrichment (up to 10) ─────────────────────

interface BulkPeopleResponse {
  matches: Array<ApolloPerson | null>;
  total_requested_enrichments?: number;
  unique_enriched_records?: number;
  credits_consumed?: number;
}

export interface BulkPersonDetail {
  email?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  domain?: string;
  linkedin_url?: string;
}

export async function bulkEnrichPeople(
  details: BulkPersonDetail[],
  options?: { revealPersonalEmails?: boolean; revealPhoneNumber?: boolean },
  apiKey?: string
): Promise<{ matches: Array<ApolloPerson | null>; credits: number }> {
  const body: Record<string, unknown> = { details };
  if (options?.revealPersonalEmails) body.reveal_personal_emails = true;
  if (options?.revealPhoneNumber) body.reveal_phone_number = true;

  const data = await apolloFetch<BulkPeopleResponse>("/api/v1/people/bulk_match", body, "POST", apiKey);
  return { matches: data.matches || [], credits: data.credits_consumed || 0 };
}

// ─── Bulk Organization Enrichment (up to 10) ───────────────

interface BulkOrgResponse {
  organizations: Array<ApolloOrganization | null>;
}

export async function bulkEnrichOrganizations(
  domains: string[],
  apiKey?: string
): Promise<Array<ApolloOrganization | null>> {
  const data = await apolloFetch<BulkOrgResponse>("/api/v1/organizations/bulk_enrich", {
    domains,
  }, "POST", apiKey);
  return data.organizations || [];
}

// ─── Credits ────────────────────────────────────────────────

/** Apollo credit costs per action */
export const APOLLO_COSTS = {
  enrichPerson: 1,
  enrichPersonEmail: 1,   // +1 se reveal email
  enrichPersonPhone: 1,   // +1 se reveal phone
  enrichOrganization: 1,
  search: 1,              // por página de busca
} as const;

/** Fetch Apollo account credit balance */
export async function getCreditsInfo(apiKey?: string): Promise<{
  credits_used: number;
  credits_limit: number;
  credits_remaining: number;
  plan: string;
}> {
  try {
    const key = resolveApiKey(apiKey);
    const res = await fetch(`${APOLLO_BASE_URL}/api/v1/auth/health`, {
      method: "GET",
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Apollo health check failed: ${res.status}`);
    const data = await res.json();
    // Apollo returns: { is_logged_in, credits: { ... } } or similar
    // Try common response shapes
    const credits = data.credits || data.account?.credits || {};
    return {
      credits_used: credits.used ?? credits.credits_used ?? 0,
      credits_limit: credits.limit ?? credits.credits_limit ?? credits.total ?? 0,
      credits_remaining: credits.remaining ?? credits.credits_remaining ?? (credits.limit ? credits.limit - (credits.used || 0) : 0),
      plan: data.plan?.name || data.account?.plan_name || credits.plan || "unknown",
    };
  } catch {
    // Fallback: try the usage endpoint
    try {
      const key = resolveApiKey(apiKey);
      const res = await fetch(`${APOLLO_BASE_URL}/api/v1/usage`, {
        method: "GET",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error("usage failed");
      const data = await res.json();
      return {
        credits_used: data.credits_used || 0,
        credits_limit: data.credits_limit || 0,
        credits_remaining: data.credits_remaining || 0,
        plan: data.plan || "unknown",
      };
    } catch {
      return { credits_used: 0, credits_limit: 0, credits_remaining: 0, plan: "unknown" };
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────

export function extractDomainFromEmail(email: string): string | null {
  const match = email.match(/@([^@]+)$/);
  if (!match) return null;
  const domain = match[1].toLowerCase();
  const freeProviders = [
    "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
    "live.com", "aol.com", "uol.com.br", "bol.com.br", "terra.com.br",
    "protonmail.com", "zoho.com", "mail.com",
  ];
  if (freeProviders.includes(domain)) return null;
  return domain;
}

export function extractDomainFromUrl(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Available seniorities for search filters
export const APOLLO_SENIORITIES = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-Suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
  { value: "intern", label: "Intern" },
];

// Available departments for search filters
export const APOLLO_DEPARTMENTS = [
  { value: "c_suite", label: "C-Suite" },
  { value: "consulting", label: "Consulting" },
  { value: "data_science", label: "Data Science" },
  { value: "design", label: "Design" },
  { value: "education", label: "Education" },
  { value: "engineering", label: "Engineering" },
  { value: "finance", label: "Finance" },
  { value: "human_resources", label: "Human Resources" },
  { value: "information_technology", label: "IT" },
  { value: "legal", label: "Legal" },
  { value: "marketing", label: "Marketing" },
  { value: "media_and_commmunication", label: "Media" },
  { value: "operations", label: "Operations" },
  { value: "product_management", label: "Product" },
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
];

// Employee ranges for search filters
export const APOLLO_EMPLOYEE_RANGES = [
  { value: "1,10", label: "1-10" },
  { value: "11,20", label: "11-20" },
  { value: "21,50", label: "21-50" },
  { value: "51,100", label: "51-100" },
  { value: "101,200", label: "101-200" },
  { value: "201,500", label: "201-500" },
  { value: "501,1000", label: "501-1K" },
  { value: "1001,5000", label: "1K-5K" },
  { value: "5001,10000", label: "5K-10K" },
  { value: "10001,", label: "10K+" },
];

// Revenue ranges for search filters
export const APOLLO_REVENUE_RANGES = [
  { value: "0,1000000", label: "< $1M" },
  { value: "1000000,10000000", label: "$1M-$10M" },
  { value: "10000000,50000000", label: "$10M-$50M" },
  { value: "50000000,100000000", label: "$50M-$100M" },
  { value: "100000000,500000000", label: "$100M-$500M" },
  { value: "500000000,1000000000", label: "$500M-$1B" },
  { value: "1000000000,", label: "$1B+" },
];

// Common technologies for search filters (uid → label)
export const APOLLO_TECHNOLOGIES = [
  { value: "salesforce", label: "Salesforce" },
  { value: "hubspot", label: "HubSpot" },
  { value: "wordpress_org", label: "WordPress" },
  { value: "shopify", label: "Shopify" },
  { value: "google_analytics", label: "Google Analytics" },
  { value: "google_tag_manager", label: "Google Tag Manager" },
  { value: "mailchimp", label: "Mailchimp" },
  { value: "zendesk", label: "Zendesk" },
  { value: "intercom", label: "Intercom" },
  { value: "slack", label: "Slack" },
  { value: "jira", label: "Jira" },
  { value: "confluence", label: "Confluence" },
  { value: "aws", label: "AWS" },
  { value: "azure", label: "Azure" },
  { value: "google_cloud", label: "Google Cloud" },
  { value: "cloudflare", label: "Cloudflare" },
  { value: "stripe", label: "Stripe" },
  { value: "segment", label: "Segment" },
  { value: "mixpanel", label: "Mixpanel" },
  { value: "amplitude", label: "Amplitude" },
  { value: "sendgrid", label: "SendGrid" },
  { value: "twilio", label: "Twilio" },
  { value: "woo_commerce", label: "WooCommerce" },
  { value: "magento", label: "Magento" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "monday_com", label: "Monday.com" },
  { value: "notion", label: "Notion" },
  { value: "linkedin_ads", label: "LinkedIn Ads" },
  { value: "facebook_pixel", label: "Facebook Pixel" },
  { value: "google_ads", label: "Google Ads" },
];
