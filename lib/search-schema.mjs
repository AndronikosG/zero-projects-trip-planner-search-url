import { z } from "zod";

export const DEFAULT_CHECKIN = "2025-01-01";
export const DEFAULT_GUESTS = 2;
export const DEFAULT_ROOMS = 1;

function isRealIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const isoDate = z.string().refine(isRealIsoDate, "Expected a real YYYY-MM-DD date");

export const SearchStateSchema = z
  .object({
    dest: z.string().trim().min(1).max(100),
    checkin: isoDate,
    checkout: isoDate,
    guests: z.number().int().min(1).max(10),
    rooms: z.number().int().min(1).max(5),
    maxprice: z.number().int().min(1).max(1000).optional(),
  })
  .superRefine((state, ctx) => {
    if (state.checkout <= state.checkin) {
      ctx.addIssue({
        code: "custom",
        path: ["checkout"],
        message: "Checkout must be after check-in",
      });
    }
  });
