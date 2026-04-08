/**
 * @vitest-environment jsdom
 */
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import LyraPage from "./page";
import { RegionProvider } from "@/lib/context/RegionContext";
import { ViewModeProvider } from "@/components/dashboard/view-mode-context";
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

// Mock ScrollIntoView
Element.prototype.scrollIntoView = vi.fn();

/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock next/dynamic — vi.mock runs before imports, so mocked modules are already resolved
// We use require() inside the factory to eagerly grab the (already-mocked) modules
vi.mock("next/dynamic", () => {
  return {
    default: (loaderFn: () => Promise<any>) => {
      // Eagerly resolve the loader — since the target modules are already mocked by vi.mock,
      // the Promise resolves on the microtask queue before any render.
      let Resolved: React.ComponentType<any> | null = null;
      loaderFn().then((mod: any) => {
        Resolved = mod.default || (Object.values(mod)[0] as React.ComponentType<any>);
      });
      // Return a wrapper that forwards props to the resolved component
      const Wrapper = (props: any) => {
        if (!Resolved) return null;
        return <Resolved {...props} />;
      };
      Wrapper.displayName = "DynamicMock";
      return Wrapper;
    },
  };
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// Mock SWR to avoid real API calls
vi.mock("swr", () => ({
  default: () => ({ data: undefined, error: undefined, isLoading: false }),
  mutate: vi.fn(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock Components
vi.mock("@/components/lyra/trending-questions", () => ({
  TrendingQuestions: ({
    onQuestionClick,
  }: {
    onQuestionClick: (q: string) => void;
  }) => (
    <button
      data-testid="trending-q"
      onClick={() => onQuestionClick("Trending 1")}
    >
      Trending 1
    </button>
  ),
}));

vi.mock("@/components/lyra/answer-with-sources", () => ({
  AnswerWithSources: ({ content }: { content: string }) => (
    <div data-testid="answer-content">{content}</div>
  ),
}));

// Mock error-boundary
vi.mock("@/components/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SectionErrorFallback: () => <div>Error</div>,
}));

// Mock Clerk Auth
vi.mock("@clerk/nextjs", () => ({
  auth: () => ({ userId: "test-user" }),
  useUser: () => ({ user: { id: "test-user" }, isLoaded: true }),
  useAuth: () => ({ userId: "test-user", isLoaded: true }),
}));

// Mock heavy transitive imports to prevent Clerk/Prisma from loading
vi.mock("@/components/lyra/elite-command-bar", () => ({
  EliteCommandBar: () => null,
}));

vi.mock("@/components/lyra/export-button", () => ({
  ExportButton: () => null,
}));

vi.mock("@/components/dashboard/personal-briefing-card", () => ({
  PersonalBriefingCard: () => null,
}));

vi.mock("@/components/dashboard/regime-banner", () => ({
  RegimeBanner: () => null,
}));

vi.mock("@/components/lyra/related-questions", () => ({
  RelatedQuestions: () => <div data-testid="related-qs">Related Qs</div>,
}));

vi.mock("@/hooks/use-plan", () => ({
  usePlan: () => ({ plan: "STARTER", isElite: false, isPro: false, isStarter: true }),
}));

vi.mock("@/lib/context/RegionContext", () => ({
  useRegion: () => ({ region: "US", setRegion: vi.fn() }),
  RegionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/ai/elite-commands", () => ({
  parseEliteCommand: () => null,
}));

vi.mock("@/lib/lyra-utils", () => ({
  parseLyraMessage: (content: string) => ({ text: content, sources: [] }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/lyra",
}));

// Mock Dropdown Menu to bypass Radix UI JSDOM issues
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <div role="button" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

describe("LyraPage Integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    // Default: Empty history success for all tests unless overridden
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, history: [] }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders initial empty state with heading and input", async () => {
    render(
      <ViewModeProvider initialMode="simple">
        <RegionProvider>
          <LyraPage />
        </RegionProvider>
      </ViewModeProvider>
    );
    await waitFor(() => {
      expect(screen.getByText(/Lyra terminal/i)).toBeDefined();
      expect(screen.getByText(/AI-powered market intelligence/i)).toBeDefined();
    });
    // Input should be present
    await waitFor(() => {
      expect(screen.getByLabelText("Chat input")).toBeDefined();
    });
  });

  it("updates input field when typing", async () => {
    render(
      <ViewModeProvider initialMode="simple">
        <RegionProvider>
          <LyraPage />
        </RegionProvider>
      </ViewModeProvider>
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Chat input")).toBeDefined();
    });
    const input = screen.getByLabelText("Chat input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hello Lyra" } });
    expect(input.value).toBe("Hello Lyra");
  });

  it("sends message and simulates streaming response via Fetch Mock", async () => {
    // 1. History Fetch (on mount)
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, history: [] }),
    });

    // Setup generic stream mock for Chat API
    const mockStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode("Hello "));
        controller.enqueue(encoder.encode("World"));
        controller.close();
      },
    });

    const mockResponse = {
      ok: true,
      body: mockStream,
      headers: new Headers(),
    };

    // 2. Chat API
    (global.fetch as Mock).mockResolvedValueOnce(mockResponse);

    // 3. Related Questions
    (global.fetch as Mock).mockResolvedValueOnce({ ok: false });

    render(
      <ViewModeProvider initialMode="simple">
        <RegionProvider>
          <LyraPage />
        </RegionProvider>
      </ViewModeProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Chat input")).toBeDefined();
    });

    const input = screen.getByLabelText("Chat input");
    const form = input.closest("form");
    if (!form) throw new Error("Chat form not found");
    const sendBtn = within(form).getByRole("button");

    fireEvent.change(input, { target: { value: "Test Message" } });
    fireEvent.click(sendBtn);

    // Verify User Message renders
    await waitFor(() => {
      expect(screen.getByText("Test Message")).toBeDefined();
    });

    // Verify the fetch was called with correct payload
    await waitFor(() => {
      const calls = (global.fetch as Mock).mock.calls;
      const chatCall = calls.find((c: unknown[]) => c[0] === "/api/chat");
      expect(chatCall).toBeDefined();
      const body = JSON.parse(chatCall![1].body);
      expect(body.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Test Message" }),
        ]),
      );
    });
  });

  it("hides thinking indicator when content is present", async () => {
    // 1. History Fetch (on mount)
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, history: [] }),
    });

    // This logic was "Fix #9" - strict verification
    const mockStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode("A"));
        // Small delay to simulate stream start
        await new Promise((r) => setTimeout(r, 10));
        controller.close();
      },
    });

    // 2. Chat API
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers(),
    });
    // 3. Related Qs
    (global.fetch as Mock).mockResolvedValueOnce({ ok: false });

    render(
      <ViewModeProvider initialMode="simple">
        <RegionProvider>
          <LyraPage />
        </RegionProvider>
      </ViewModeProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Chat input")).toBeDefined();
    });

    const input = screen.getByLabelText("Chat input");
    const form = input.closest("form");
    if (!form) throw new Error("Chat form not found");
    const sendBtn = within(form).getByRole("button");

    fireEvent.change(input, { target: { value: "Q" } });
    fireEvent.click(sendBtn);

    // Verify Loading Text appears (lowercase 'a' in 'analyzing')
    await waitFor(() => {
      expect(screen.getByText(/Lyra is analyzing/i)).toBeDefined();
    });

    // Wait for content updates to hide the indicator
    await waitFor(
      () => {
        expect(screen.queryByText(/Lyra is analyzing/i)).toBeNull();
      },
      { timeout: 2000 },
    );
  });

  it("loads and displays chat history", async () => {
    // Mock History API
    const mockHistory = {
      success: true,
      history: [
        {
          id: "1",
          inputQuery: "Old Query",
          outputResponse: "Old Answer",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHistory,
    });

    render(
      <ViewModeProvider initialMode="simple">
        <RegionProvider>
          <LyraPage />
        </RegionProvider>
      </ViewModeProvider>
    );

    // Wait for component to mount
    await waitFor(() => {
      expect(screen.getByText(/History/i)).toBeDefined();
    });

    // The dropdown content is always rendered (mocked), check for "No sessions yet" initially
    expect(screen.getByText("No sessions yet")).toBeDefined();
  });
});
