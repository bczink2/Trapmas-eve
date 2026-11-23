export type EmailVars = Record<string, string>;

export function renderTemplate(template: string, vars: EmailVars): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : value;
  });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function textToEmailHtml(text: string): string {
  const escaped = escapeHtml(text).replaceAll("\n", "<br>");
  return `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1a0d0f">${escaped}</div>`;
}
