export const AREAS = [
  "NO1",
  "NO2",
  "NO3",
  "NO4",
  "NO5",
  "SE1",
  "SE2",
  "SE3",
  "SE4",
  "FI",
  "DK1",
  "DK2",
] as const;

export type Area = (typeof AREAS)[number];
