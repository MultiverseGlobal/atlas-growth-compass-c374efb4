import type { FC } from "react";

export type IconProps = { size?: number; color?: string; className?: string };

/**
 * Pseudonyms Sovereign Signature Mark
 * Geometric diamond core encased in a dashed sovereign orbit.
 */
export const PseudonymsSovereignMark: FC<IconProps> = ({ size = 20, color = "currentColor", className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3.5 2.5" opacity="0.75" />
    <path d="M12 5.5L18.5 12L12 18.5L5.5 12L12 5.5Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
);

/**
 * Pseudonyms ID — Sovereign Geometric Core
 */
export const PseudonymsIDIcon: FC<IconProps> = ({ size = 20, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
    <path d="M12 6L18 12L12 18L6 12L12 6Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
);

/**
 * Atlas — Hollow ink circle + center core + dotted telemetry stem
 * Sourced directly from Atlas io/public/favicon.svg
 */
export const AtlasIcon: FC<IconProps> = ({ size = 20, color = "currentColor", className = "" }) => (
  <svg width={size} height={size * 1.25} viewBox="0 0 24 32" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
    <circle cx="12" cy="12" r="3" fill={color} />
    <line
      x1="12"
      y1="22"
      x2="12"
      y2="30"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeDasharray="1.5 3"
    />
  </svg>
);

/**
 * Metaphor — Concentric Target / Neural Context Aperture
 */
export const MetaphorIcon: FC<IconProps> = ({ size = 20, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
    <circle cx="12" cy="12" r="5.5" stroke={color} strokeWidth="1.5" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
);

/**
 * Orion — Sovereign Kinetic Lightning Bolt
 */
export const OrionIcon: FC<IconProps> = ({ size = 20, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 48 46" fill="none" className={className} aria-hidden="true">
    <path
      fill={color}
      d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
    />
  </svg>
);

/**
 * Clario — Film Frame with Sprocket Holes + Aperture Play Core
 */
export const ClarioIcon: FC<IconProps> = ({ size = 20, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <rect x="4.5" y="6.5" width="2" height="2" rx="0.5" fill={color} opacity="0.8" />
    <rect x="4.5" y="11" width="2" height="2" rx="0.5" fill={color} opacity="0.8" />
    <rect x="4.5" y="15.5" width="2" height="2" rx="0.5" fill={color} opacity="0.8" />
    <rect x="17.5" y="6.5" width="2" height="2" rx="0.5" fill={color} opacity="0.8" />
    <rect x="17.5" y="11" width="2" height="2" rx="0.5" fill={color} opacity="0.8" />
    <rect x="17.5" y="15.5" width="2" height="2" rx="0.5" fill={color} opacity="0.8" />
    <path d="M10 9.5L15.5 12L10 14.5V9.5Z" fill={color} />
  </svg>
);

/**
 * Weave — Interlocking Context Mesh Nodes & Edges
 */
export const WeaveIcon: FC<IconProps> = ({ size = 20, color = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="5" cy="5" r="1.5" fill={color} />
    <circle cx="12" cy="5" r="1.5" fill={color} />
    <circle cx="19" cy="5" r="1.5" fill={color} />
    <circle cx="5" cy="12" r="1.5" fill={color} />
    <circle cx="12" cy="12" r="1.5" fill={color} />
    <circle cx="19" cy="12" r="1.5" fill={color} />
    <circle cx="5" cy="19" r="1.5" fill={color} />
    <circle cx="12" cy="19" r="1.5" fill={color} />
    <circle cx="19" cy="19" r="1.5" fill={color} />
    <line x1="5" y1="5" x2="12" y2="12" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
    <line x1="12" y1="5" x2="19" y2="12" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
    <line x1="5" y1="12" x2="12" y2="19" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
    <line x1="12" y1="12" x2="19" y2="19" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
    <line x1="5" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
    <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
  </svg>
);
