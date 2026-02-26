import {
    type ApproximateLocation,
    type DistanceBand,
    enforceMinimumPublicPrecision,
} from '@mutual-hub/shared';

export interface SearchCenter {
    lat: number;
    lng: number;
}

const earthRadiusMeters = 6_371_000;

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

export function normalizeIndexedLocation(
    location: ApproximateLocation,
    minimumPrecisionMeters: number,
): ApproximateLocation {
    return enforceMinimumPublicPrecision(location, minimumPrecisionMeters);
}

export function haversineDistanceMeters(
    from: SearchCenter,
    to: Pick<ApproximateLocation, 'lat' | 'lng'>,
): number {
    const latDelta = toRadians(to.lat - from.lat);
    const lngDelta = toRadians(to.lng - from.lng);
    const fromLat = toRadians(from.lat);
    const toLat = toRadians(to.lat);

    const a =
        Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
        Math.cos(fromLat) *
            Math.cos(toLat) *
            Math.sin(lngDelta / 2) *
            Math.sin(lngDelta / 2);

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function toDistanceBand(distanceMeters?: number): DistanceBand {
    if (distanceMeters === undefined) {
        return 'far';
    }

    if (distanceMeters <= 5_000) {
        return 'near';
    }

    if (distanceMeters <= 20_000) {
        return 'mid';
    }

    return 'far';
}

export function isWithinRadius(
    distanceMeters: number | undefined,
    radiusMeters?: number,
): boolean {
    if (radiusMeters === undefined) {
        return true;
    }

    if (distanceMeters === undefined) {
        return false;
    }

    return distanceMeters <= radiusMeters;
}
