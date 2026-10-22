import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/db/env", () => ({
  isSupabaseConfigured: true,
  SUPABASE_URL: "http://localhost:8000",
  SUPABASE_ANON_KEY: "chave-anon-fake",
}));

const { GET } = await import("./route");
const env = await import("@/core/db/env");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(env).isSupabaseConfigured = true;
});

describe("GET /api/health", () => {
  it("responde 200 quando o Supabase está configurado e o PostgREST responde ok", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("responde 503 quando o Supabase não está configurado, sem tentar rede", async () => {
    vi.mocked(env).isSupabaseConfigured = false;
    const res = await GET();
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("responde 503 quando o PostgREST responde erro", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("responde 503 quando a rede falha (fetch rejeita)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
