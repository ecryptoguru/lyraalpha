import { vi } from "vitest";
const RedisMock = vi.fn().mockImplementation(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  quit: vi.fn().mockResolvedValue("OK"),
  ping: vi.fn().mockResolvedValue("PONG"),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
}));
export default RedisMock;
