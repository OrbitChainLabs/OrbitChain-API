/**
 * Masks an email address for safe logging, e.g. "jo***@example.com".
 * Keeps enough of the local part to be useful for debugging without
 * exposing the full address in log aggregators.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}
