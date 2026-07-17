import type { HandPose } from '@/lib/qareen/types';

type HandPath = readonly string[];

// Exact Tabler hand silhouettes named by QAREEN_MOTION_SPEC.md. Keeping
// the paths inline makes the pose swap synchronous and avoids loading an
// icon font or adding a runtime dependency to the motion-critical overlay.
const OPEN_PATHS: HandPath = [
  'M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5',
  'M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5',
  'M14 5.5a1.5 1.5 0 0 1 3 0v6.5',
  'M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47',
];

const POINT_PATHS: HandPath = [
  'M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5',
  'M11 11.5v-2a1.5 1.5 0 1 1 3 0v2.5',
  'M14 10.5a1.5 1.5 0 0 1 3 0v1.5',
  'M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47',
];

const TWO_PATHS: HandPath = [
  'M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5',
  'M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47',
  'M14 10.5a1.5 1.5 0 0 1 3 0v1.5',
  'M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5',
];

const THREE_PATHS: HandPath = [
  'M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5',
  'M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47',
  'M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5',
  'M14 5.5a1.5 1.5 0 0 1 3 0v6.5',
];

const GRAB_PATHS: HandPath = [
  'M8 11v-3.5a1.5 1.5 0 0 1 3 0v2.5',
  'M11 9.5v-3a1.5 1.5 0 0 1 3 0v3.5',
  'M14 7.5a1.5 1.5 0 0 1 3 0v2.5',
  'M17 9.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47',
];

const CLICK_ACCENTS: HandPath = ['M5 3l-1 -1', 'M4 7h-1', 'M14 3l1 -1', 'M15 6h1'];

const POSE_PATHS: Record<HandPose, HandPath> = {
  open: OPEN_PATHS,
  point: POINT_PATHS,
  two: TWO_PATHS,
  three: THREE_PATHS,
  pinch: [...POINT_PATHS, ...CLICK_ACCENTS],
  fist: GRAB_PATHS,
  grab: GRAB_PATHS,
  tap: [...POINT_PATHS, ...CLICK_ACCENTS],
  relax: OPEN_PATHS,
  grip_wrist: GRAB_PATHS,
};

export interface HandGlyphProps {
  pose: HandPose;
  size?: number;
  mirrored?: boolean;
  color?: string;
  className?: string;
}

export function HandGlyph({ pose, size = 96, mirrored = false, color = '#ddd8ce', className }: HandGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: 'block',
        overflow: 'visible',
        transform: mirrored ? 'scaleX(-1)' : undefined,
        filter: 'drop-shadow(0 3px 2px rgba(0,0,0,.45)) drop-shadow(0 0 6px rgba(221,216,206,.16))',
      }}
      className={className}
      aria-hidden="true"
    >
      {POSE_PATHS[pose].map((path, index) => <path key={`${pose}-${index}`} d={path} />)}
    </svg>
  );
}
