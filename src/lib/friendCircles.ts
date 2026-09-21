export const FRIEND_CIRCLES = ['friends', 'family', 'close'] as const;

export type FriendCircle = (typeof FRIEND_CIRCLES)[number];

export const ALL_CIRCLES: FriendCircle[] = [...FRIEND_CIRCLES];

export function isFriendCircle(value: string): value is FriendCircle {
  return (FRIEND_CIRCLES as readonly string[]).includes(value);
}

export function normalizeCircles(value?: string[] | null): FriendCircle[] {
  if (!value?.length) return [];
  return FRIEND_CIRCLES.filter((circle) => value.includes(circle));
}

export function circlesFromVisible(visible: boolean, circles?: string[] | null): FriendCircle[] {
  if (!visible) return [];
  const next = normalizeCircles(circles);
  return next.length ? next : ALL_CIRCLES;
}

export function sameCircles(a?: string[] | null, b?: string[] | null): boolean {
  const left = normalizeCircles(a);
  const right = normalizeCircles(b);
  return left.length === right.length && left.every((circle, i) => circle === right[i]);
}

export function circleLabelKey(circle: FriendCircle): 'circleFriends' | 'circleFamily' | 'circleClose' {
  if (circle === 'family') return 'circleFamily';
  if (circle === 'close') return 'circleClose';
  return 'circleFriends';
}
