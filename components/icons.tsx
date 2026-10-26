// Small stroke icon set (24px grid, currentColor) used on icon tiles and buttons.

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const IconCheck = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconShield = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M12 3 5 6v6c0 4.2 3 7.3 7 9 4-1.7 7-4.8 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
export const IconMap = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M12 21s-6-5.3-6-11a6 6 0 1 1 12 0c0 5.7-6 11-6 11Z" />
    <circle cx="12" cy="10" r="2.2" />
  </svg>
);
export const IconRoute = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
  </svg>
);
export const IconChat = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M5 18.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-3 2.5Z" />
    <path d="M9 9h6M9 12h4" />
  </svg>
);
export const IconList = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
  </svg>
);
export const IconUpload = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);
export const IconGrad = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="m3 9 9-4 9 4-9 4-9-4Z" />
    <path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4" />
  </svg>
);
export const IconDownload = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M12 4v12m0 0-4-4m4 4 4-4M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" />
  </svg>
);
export const IconArrow = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);
export const IconGrid = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </svg>
);
export const IconClock = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconInbox = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M4 13.5 6.5 5h11l2.5 8.5V19H4v-5.5Z" />
    <path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20" />
  </svg>
);
export const IconTable = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M4 9.5h16M4 14.5h16M9.5 9.5V20" />
  </svg>
);
export const IconChart = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M4 19h16" />
    <path d="M5 15c2.5 0 3-5 6-5s3.5 3 6 3 2-6 2-6" />
  </svg>
);
export const IconSliders = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M5 7h9M18 7h1M5 17h3M12 17h7" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
export const IconAlert = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M12 4 3.5 19h17L12 4Z" />
    <path d="M12 10v4M12 16.5v.01" />
  </svg>
);
export const IconHistory = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
    <path d="M4 4.5v4h4M12 8v4l2.5 1.5" />
  </svg>
);
