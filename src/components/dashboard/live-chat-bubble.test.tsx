/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePlanMock = vi.fn();
const useUserMock = vi.fn();

vi.mock("@/hooks/use-plan", () => ({
  usePlan: () => usePlanMock(),
}));
vi.mock("@/lib/clerk-shim", () => ({
  useUser: () => useUserMock(),
}));
vi.mock("./live-chat-starter-nudge", () => ({
  LiveChatStarterNudge: () => <div data-testid="starter-nudge">starter</div>,
}));

import { LiveChatBubble } from "./live-chat-bubble";

describe("LiveChatBubble", () => {
  beforeEach(() => {
    usePlanMock.mockReturnValue({ plan: "PRO", isLoading: false });
    useUserMock.mockReturnValue({ user: { id: "user_1" }, isLoaded: true });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "localhost" },
    });
  });

  it("shows a loading affordance while plan data resolves", () => {
    usePlanMock.mockReturnValue({ plan: "STARTER", isLoading: true });
    render(<LiveChatBubble />);

    expect(screen.getByRole("button", { name: /loading support chat/i })).toBeInTheDocument();
  });

  it("shows the paid-user launcher once the plan is loaded", () => {
    render(<LiveChatBubble />);

    expect(screen.getByRole("button", { name: /open support chat/i })).toBeInTheDocument();
  });

  it("shows the starter nudge for non-paid users", () => {
    usePlanMock.mockReturnValue({ plan: "STARTER", isLoading: false });
    render(<LiveChatBubble />);

    expect(screen.getByTestId("starter-nudge")).toBeInTheDocument();
  });
});
