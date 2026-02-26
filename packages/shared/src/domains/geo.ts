export interface ApproximateLocation {
  lat: number;
  lng: number;
  precisionMeters: number;
  areaLabel?: string;
}

export function enforceMinimumPublicPrecision(
  location: ApproximateLocation,
  minimumMeters = 300,
): ApproximateLocation {
  return {
    ...location,
    precisionMeters: Math.max(location.precisionMeters, minimumMeters),
  };
}
