/** The reader, over loopback. In the Tauri build this becomes an `invoke` and
 *  the HTTP layer disappears; the shape of the answer stays the same. */

export interface ReadResult {
  name: string;
  form: string | null;
  strength: string | null;
  quantity: number | null;
  unit: string | null;
  perDay: number | null;
  durationDays: number | null;
  prn: boolean;
  source: string;
  escalated: boolean;
  missing: string[];
}

const ENDPOINT = "http://127.0.0.1:8791";

export async function readLabel(dataUrl: string): Promise<ReadResult | null> {
  try {
    const response = await fetch(`${ENDPOINT}/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ReadResult;
    if (!data?.name && !data?.strength) return null;
    return data;
  } catch {
    // No reader running: the screen asks for the name by hand instead of
    // inventing one.
    return null;
  }
}
