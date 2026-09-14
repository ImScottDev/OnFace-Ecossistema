// Simple template engine for email templates
// Supports {{variable}} syntax with lead data interpolation

export interface TemplateData {
  nome?: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  status?: string;
  link_implantacao?: string;
  [key: string]: string | undefined;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function interpolateTemplate(template: string, data: TemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined && value !== null ? escapeHtml(String(value)) : match;
  });
}

export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}
