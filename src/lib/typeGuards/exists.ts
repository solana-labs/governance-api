export function exists<T>(item: T | null | undefined): item is T {
  return !!item;
}
