const KEYS: Record<string, string> = { EDP: 'EDP', EDT: 'EDT', Parfum: 'Parfum', 'Body Mist': 'BodyMist', Other: 'Other' };

/** "EDP" → "Eau de Parfum" in the page language; `t` is an un-namespaced translator */
export function concentrationLabel(c: string | null | undefined, t: (key: string) => string) {
  if (!c) return '';
  return KEYS[c] ? t(`concentration.${KEYS[c]}`) : c;
}
