export function nextProjectNo(createdAt: string, existingProjectNos: readonly string[]): string {
  const prefix = `PJ-${projectDate(createdAt)}`;
  const maxSequence = existingProjectNos.reduce((maximum, projectNo) => {
    const match = new RegExp(`^${prefix}-(\\d{3,})$`).exec(String(projectNo || ''));
    return Math.max(maximum, match ? Number(match[1]) : 0);
  }, 0);
  return `${prefix}-${String(maxSequence + 1).padStart(3, '0')}`;
}

function projectDate(value: string): string {
  const date = new Date(value);
  const normalized = Number.isNaN(date.valueOf()) ? new Date() : date;
  return normalized.toISOString().slice(0, 10).replaceAll('-', '');
}
