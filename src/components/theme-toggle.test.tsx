/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ThemeToggle } from "./theme-toggle";

const useThemeMock = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => useThemeMock(),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    useThemeMock.mockReturnValue({
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: vi.fn(),
    });
  });

  it("renders light and dark options in quick toggle mode and defaults to dark", async () => {
    render(<ThemeToggle includeSystem={false} />);

    const themeGroup = await screen.findByRole("group", { name: /Theme preference/i });
    const lightButton = screen.getByRole("button", { name: "Light" });
    const darkButton = screen.getByRole("button", { name: "Dark" });

    expect(themeGroup).toBeInTheDocument();
    expect(lightButton).toBeInTheDocument();
    expect(darkButton).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "System" })).not.toBeInTheDocument();
    expect(darkButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls setTheme when the user switches to light mode", async () => {
    const setTheme = vi.fn();
    useThemeMock.mockReturnValue({
      theme: "dark",
      resolvedTheme: "dark",
      setTheme,
    });

    render(<ThemeToggle includeSystem={false} />);

    const lightButton = await screen.findByRole("button", { name: "Light" });
    fireEvent.click(lightButton);

    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("shows the system status copy only when system mode is enabled and active", async () => {
    useThemeMock.mockReturnValue({
      theme: "system",
      resolvedTheme: "dark",
      setTheme: vi.fn(),
    });

    render(<ThemeToggle showLabels showStatus />);

    await waitFor(() => {
      expect(screen.getByText(/Following system\. Currently using Dark\./i)).toBeInTheDocument();
    });
  });
});
