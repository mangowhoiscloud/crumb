/**
 * Bread mascot brand mark — ports the SVG from PR #148 (vanilla studio.html
 * line 41–87) verbatim. Multi-color baked-in (cream toast + golden crust +
 * orange crumbs) so the mark reads on both light and dark themes without
 * theme-driven recolor.
 *
 * The mark exposes a `size` prop because §6 row spec mentions size variants
 * (sm = 16, md = 22, default header = 26). Same SVG scales linearly.
 */

interface Props {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 26, className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={{ flex: '0 0 auto' }}
    >
      <path
        d="M5.5 7.5
           Q5.5 3 12 3
           Q14.6 3 15.6 3.7
           Q15 5 16.4 5.5
           Q18.3 6 18.5 7.5
           L18.5 16
           Q18.5 18 16.5 18
           L7.5 18
           Q5.5 18 5.5 16
           Z"
        fill="#fde6c0"
        stroke="#cc7a3a"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7.5
           Q7.5 5 10 5
           L14 5
           Q16 5 16 7.5
           L16 14
           Q16 16 14 16
           L10 16
           Q7.5 16 7.5 14
           Z"
        fill="#fff1d4"
        opacity="0.7"
      />
      <ellipse cx="10" cy="10.6" rx="0.75" ry="1.1" fill="#2a1a08" />
      <ellipse cx="13" cy="10.6" rx="0.75" ry="1.1" fill="#2a1a08" />
      <path
        d="M10.6 12.7 Q11.5 13.5 12.4 12.7"
        stroke="#2a1a08"
        strokeWidth="0.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="8" cy="20.4" r="0.95" fill="#e8a155" />
      <circle cx="6.4" cy="21.9" r="0.6" fill="#e8a155" />
      <circle cx="9.5" cy="22.2" r="0.5" fill="#e8a155" />
      <circle cx="7.7" cy="23.1" r="0.4" fill="#e8a155" />
    </svg>
  );
}
