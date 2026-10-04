export function callerFromStack(stack: string | undefined): string {
  const lines = stack?.split('\n') ?? [];
  for (const line of lines) {
    const m = line.match(/(\w+Service)\b/);
    if (m && m[1] !== 'SqlMapper') return m[1];
  }
  return 'SqlMapper';
}

export function callerService(): string {
  return callerFromStack(new Error().stack);
}
