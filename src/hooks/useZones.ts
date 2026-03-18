import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActiveZones, calculateDeliveryInfo } from '@/services/zoneService';

export function useActiveZones() {
  return useQuery({
    queryKey: ['active-zones'],
    queryFn: getActiveZones,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes — zones rarely change
  });
}

export function useZoneDeliveryInfo(zoneName: string | null) {
  const { data: zones } = useActiveZones();

  // Memoize with minute-level granularity — calculateDeliveryInfo uses current time
  // for same_day cutoff checks, so we re-evaluate once per minute
  const minuteKey = Math.floor(Date.now() / 60_000);

  return useMemo(() => {
    if (!zoneName || !zones) return null;

    const zone = zones.find((z) => z.name === zoneName);
    if (!zone) return null;

    return calculateDeliveryInfo(zone);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- minuteKey is intentional time-based invalidation
  }, [zoneName, zones, minuteKey]);
}
