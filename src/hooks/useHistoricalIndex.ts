import { useQuery } from "@tanstack/react-query";

export type IndexPoint = {
  dateNum: number;     // e.g. 20260125
  value1e6: string;    // stored as string to avoid JSON int issues
};

export type NormalizedPoint = {
  dateNum: number;
  dateISO: string;     // "2026-01-25"
  value: number;       // EUR/MWh (float)
};

function dateNumToISO(dateNum: number): string {
  const s = String(dateNum);
  const yyyy = s.slice(0, 4);
  const mm = s.slice(4, 6);
  const dd = s.slice(6, 8);
  return `${yyyy}-${mm}-${dd}`;
}

export function useHistoricalIndex(area: string) {
  return useQuery({
    queryKey: ["historical-index", area],
    queryFn: async (): Promise<NormalizedPoint[]> => {
      const res = await fetch(`/data/indexes/${area}.json`);
      if (!res.ok) throw new Error(`Failed to load /data/indexes/${area}.json`);
      const raw = (await res.json()) as IndexPoint[];

      return raw
        .map((p) => {
          const v1e6 = Number(p.value1e6);
          return {
            dateNum: Number(p.dateNum),
            dateISO: dateNumToISO(Number(p.dateNum)),
            value: v1e6 / 1_000_000,
          };
        })
        .sort((a, b) => a.dateNum - b.dateNum);
    },
    staleTime: Infinity, // static dataset
  });
}
