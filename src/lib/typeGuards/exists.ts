/**
 * Determines if an item is not null or undefined
 */
export function exists<T>(item: T | null | undefined): item is T {
  return item !== null && item !== undefined;
}
