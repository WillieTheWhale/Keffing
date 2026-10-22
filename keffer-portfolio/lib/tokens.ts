// Design tokens shared by components (system design document §8).

export const breakpoints = {
  mobile: 0,
  tablet: 640,
  desktop: 1024,
  wide: 1440,
} as const;

export const springs = {
  gentle: { stiffness: 100, damping: 15 },
  snappy: { stiffness: 300, damping: 25 },
};
