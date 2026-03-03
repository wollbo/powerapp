export function requireAddress<T extends `0x${string}`>(
  value: T | undefined,
  name: string
): T {
  if (!value) throw new Error(`Missing address: ${name}`);
  return value;
}