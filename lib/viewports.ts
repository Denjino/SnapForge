export interface ViewportPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  icon: string;
  category: 'desktop' | 'tablet' | 'mobile' | 'custom';
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  // Desktop
  {
    id: 'desktop-1920',
    label: 'Desktop HD',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    icon: '🖥',
    category: 'desktop',
  },
  {
    id: 'desktop-1440',
    label: 'Desktop',
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    icon: '🖥',
    category: 'desktop',
  },
  {
    id: 'desktop-1280',
    label: 'Laptop',
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    isMobile: false,
    icon: '💻',
    category: 'desktop',
  },
  // Tablet
  {
    id: 'ipad-pro',
    label: 'iPad Pro',
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2,
    isMobile: true,
    icon: '📱',
    category: 'tablet',
  },
  {
    id: 'ipad',
    label: 'iPad',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    icon: '📱',
    category: 'tablet',
  },
  // Mobile
  {
    id: 'iphone-15-pro',
    label: 'iPhone 15 Pro',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    icon: '📲',
    category: 'mobile',
  },
  {
    id: 'iphone-se',
    label: 'iPhone SE',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    icon: '📲',
    category: 'mobile',
  },
  {
    id: 'pixel-7',
    label: 'Pixel 7',
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    isMobile: true,
    icon: '📲',
    category: 'mobile',
  },
];

export const VIEWPORT_CATEGORIES = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'mobile', label: 'Mobile' },
] as const;

export function getPresetById(id: string): ViewportPreset | undefined {
  return VIEWPORT_PRESETS.find((p) => p.id === id);
}
