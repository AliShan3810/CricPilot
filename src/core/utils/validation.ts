export class ValidationError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function requireName(field: string, value: string, { min = 2, max = 40 } = {}): string {
  const v = cleanName(value ?? '');
  if (v.length < min) {
    throw new ValidationError(field, `${label(field)} must be at least ${min} characters.`);
  }
  if (v.length > max) {
    throw new ValidationError(field, `${label(field)} must be ${max} characters or fewer.`);
  }
  return v;
}

export function shortNameFrom(name: string): string {
  const words = cleanName(name).split(' ').filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }
  return cleanName(name).slice(0, 3).toUpperCase();
}

export function requireShortName(value: string): string {
  const v = cleanName(value).toUpperCase();
  if (!/^[A-Z0-9]{2,4}$/.test(v)) {
    throw new ValidationError('shortName', 'Short name must be 2–4 letters or digits.');
  }
  return v;
}

export function requireColor(value: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    throw new ValidationError('color', 'Choose a team colour.');
  }
  return value.toUpperCase();
}

export function optionalJersey(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0 || value > 999) {
    throw new ValidationError('jerseyNumber', 'Jersey number must be between 0 and 999.');
  }
  return value;
}

function label(field: string): string {
  const map: Record<string, string> = {
    name: 'Name',
    teamName: 'Team name',
    playerName: 'Player name',
    tournamentName: 'Tournament name',
    title: 'Title',
    venue: 'Venue',
  };
  return map[field] ?? field;
}
