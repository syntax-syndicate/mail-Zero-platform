export const I18N_LOCALE_COOKIE_NAME = 'i18n:locale';
export const SIDEBAR_COOKIE_NAME = 'sidebar:state';
export const AI_SIDEBAR_COOKIE_NAME = 'ai-sidebar:state';
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const SIDEBAR_WIDTH = '14rem';
export const SIDEBAR_WIDTH_MOBILE = '14rem';
export const SIDEBAR_WIDTH_ICON = '3rem';
export const SIDEBAR_KEYBOARD_SHORTCUT = 'b';
export const BASE_URL = import.meta.env.VITE_PUBLIC_APP_URL;
export const MAX_URL_LENGTH = 2000;
export const CACHE_BURST_KEY = 'cache-burst:v0.0.2';

export const emailProviders = [
  {
    name: 'Google',
    icon: 'M11.99 13.9v-3.72h9.36c.14.63.25 1.22.25 2.05c0 5.71-3.83 9.77-9.6 9.77c-5.52 0-10-4.48-10-10S6.48 2 12 2c2.7 0 4.96.99 6.69 2.61l-2.84 2.76c-.72-.68-1.98-1.48-3.85-1.48c-3.31 0-6.01 2.75-6.01 6.12s2.7 6.12 6.01 6.12c3.83 0 5.24-2.65 5.5-4.22h-5.51z',
    providerId: 'google',
  },
  // {
  //   name: 'Microsoft',
  //   icon: 'M11.99 13.9v-3.72h9.36c.14.63.25 1.22.25 2.05c0 5.71-3.83 9.77-9.6 9.77c-5.52 0-10-4.48-10-10S6.48 2 12 2c2.7 0 4.96.99 6.69 2.61l-2.84 2.76c-.72-.68-1.98-1.48-3.85-1.48c-3.31 0-6.01 2.75-6.01 6.12s2.7 6.12 6.01 6.12c3.83 0 5.24-2.65 5.5-4.22h-5.51z',
  //   providerId: 'microsoft',
  // },
] as const;

interface GmailColor {
  textColor: string;
  backgroundColor: string;
}

export const GMAIL_COLORS: GmailColor[] = [
  { textColor: '#000000', backgroundColor: '#E2E2E2' },
  { textColor: '#D50000', backgroundColor: '#F28B82' },
  { textColor: '#EF6C00', backgroundColor: '#FBBC04' },
  { textColor: '#F9A825', backgroundColor: '#FFF475' },
  { textColor: '#188038', backgroundColor: '#CCFF90' },
  { textColor: '#1967D2', backgroundColor: '#AECBFA' },
  { textColor: '#9334E6', backgroundColor: '#D7AEFB' },
  { textColor: '#D93025', backgroundColor: '#FDCFE8' },
  { textColor: '#3C1E1E', backgroundColor: '#E6C9A8' },
  { textColor: '#3C4043', backgroundColor: '#E8EAED' },
  { textColor: '#0B4B3F', backgroundColor: '#A7FFEB' },
  { textColor: '#174EA6', backgroundColor: '#C5CAE9' },
  { textColor: '#33691E', backgroundColor: '#F0F4C3' },
  { textColor: '#007B83', backgroundColor: '#B2EBF2' },
  { textColor: '#5B2C6F', backgroundColor: '#E1BEE7' },
  { textColor: '#BF360C', backgroundColor: '#FFAB91' },
];
