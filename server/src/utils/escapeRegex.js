export function escapeRegex(value) {
  return String(value).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
