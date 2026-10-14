import { beforeEach, describe, expect, it, vi } from "vitest";

// `shareEntryRedirect` reaches Convex, so the query is stubbed: what's under test
// is which requests bounce and where to, not the round trip.
const fetchQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/nextjs", () => ({ fetchQuery }));

const { shareEntryRedirect } = await import("./shareEntry");

const course = (keys: string[]) => ({
  lessons: keys.map((key, i) => ({ key, seq: i + 1, title: key, locked: false })),
});

describe("shareEntryRedirect", () => {
  beforeEach(() => {
    fetchQuery.mockReset();
    fetchQuery.mockResolvedValue(course(["0001-a", "0002-b"]));
  });

  it("sends the course index straight to the first lesson", async () => {
    const to = await shareEntryRedirect(new URL("https://my-course.app/share/abc123"));
    expect(to?.href).toBe("https://my-course.app/share/abc123/lessons/0001-a");
    expect(fetchQuery).toHaveBeenCalledWith(expect.anything(), { token: "abc123" });
  });

  it("carries the query string through, so the landing pageview keeps its UTMs", async () => {
    const to = await shareEntryRedirect(new URL("https://my-course.app/share/abc123/?utm_source=whatsapp&x=1"));
    expect(to?.href).toBe("https://my-course.app/share/abc123/lessons/0001-a?utm_source=whatsapp&x=1");
  });

  it("leaves every path other than the index alone, without a Convex read", async () => {
    for (const path of ["/share", "/share/abc123/lessons/0001-a", "/share/abc123/references/g", "/courses/hindi"]) {
      expect(await shareEntryRedirect(new URL(`https://my-course.app${path}`))).toBeNull();
    }
    expect(fetchQuery).not.toHaveBeenCalled();
  });

  it("renders the index (no bounce) for a dead link, an empty course or a Convex error", async () => {
    const url = new URL("https://my-course.app/share/abc123");
    fetchQuery.mockResolvedValueOnce(null);
    expect(await shareEntryRedirect(url)).toBeNull();
    fetchQuery.mockResolvedValueOnce(course([]));
    expect(await shareEntryRedirect(url)).toBeNull();
    fetchQuery.mockRejectedValueOnce(new Error("offline"));
    expect(await shareEntryRedirect(url)).toBeNull();
  });

  it("does not throw on a malformed token", async () => {
    expect(await shareEntryRedirect(new URL("https://my-course.app/share/%E0"))).toBeNull();
  });
});
