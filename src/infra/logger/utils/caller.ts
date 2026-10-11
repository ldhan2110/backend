const SKIP = /caller\.(ts|js)|sql-mapper|SqlMapper\.|\.query\b|\.affected\b/;

export function callerFromStack(stack: string | undefined): string {
  const lines = stack?.split('\n') ?? [];
  // Prefer the repository frame, e.g. "at UserRepository.findById (...)".
  for (const line of lines) {
    const m = line.match(/at (\w+Repository\.\w+)/);
    if (m) return m[1];
  }
  for (const line of lines) {
    if (SKIP.test(line)) continue;
    const m = line.match(/at (\w+\.\w+)/);
    if (m) return m[1];
  }
  return 'SqlMapper';
}

export function callerService(): string {
  return callerFromStack(new Error().stack);
}
