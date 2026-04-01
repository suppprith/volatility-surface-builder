export interface SurfaceDataPoint {
  strike: number;
  dte: number;
  iv: number;
  expiration: string;
}

export interface SurfaceResponse {
  ticker: string;
  spot_price: number;
  risk_free_rate: number;
  option_type: string;
  data_points: number;
  expirations: string[];
  surface_data: SurfaceDataPoint[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchSurface(
  ticker: string,
  optionType: "call" | "put"
): Promise<SurfaceResponse> {
  const params = new URLSearchParams({
    ticker: ticker.toUpperCase(),
    option_type: optionType,
  });

  const res = await fetch(`${API_BASE}/api/surface?${params}`);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.detail || `Failed to fetch surface data (${res.status})`
    );
  }

  return res.json();
}
