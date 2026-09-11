/** Shared colours - keep in sync with web/src/styles.css */
export const colors = {
  bg: '#0d0718',
  surface: '#170f28',
  surface2: '#1f1533',
  line: 'rgba(255,255,255,0.09)',
  text: '#f6f4ff',
  muted: '#a99fc0',
  brand: '#7c3aed',
  brand2: '#ec4899',
  accent: '#f59e0b',
  ok: '#22c55e',
  danger: '#ef4444',
};

export const NETWORKS = [
  { id: 'mtn', label: 'MTN MoMo' },
  { id: 'vodafone', label: 'Vodafone Cash' },
  { id: 'airteltigo', label: 'AirtelTigo' },
] as const;

export type NetworkId = (typeof NETWORKS)[number]['id'];
