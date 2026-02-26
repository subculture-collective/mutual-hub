export interface ApproximateLocation {
    lat: number;
    lng: number;
    precisionMeters: number;
    areaLabel?: string;
}

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

function snapCoordinate(value: number, step: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
        return value;
    }

    return Number((Math.round(value / step) * step).toFixed(6));
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

export function toPublicApproximateLocation(
    location: ApproximateLocation,
    minimumMeters = 300,
): ApproximateLocation {
    const normalized = enforceMinimumPublicPrecision(location, minimumMeters);
    const metersPerLatDegree = 111_320;
    const latStep = normalized.precisionMeters / metersPerLatDegree;
    const cosLat = Math.max(0.2, Math.abs(Math.cos(toRadians(normalized.lat))));
    const lngStep = normalized.precisionMeters / (metersPerLatDegree * cosLat);

    return {
        ...normalized,
        lat: snapCoordinate(normalized.lat, latStep),
        lng: snapCoordinate(normalized.lng, lngStep),
    };
}
