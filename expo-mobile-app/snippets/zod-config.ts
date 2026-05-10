// lib/schema.ts + lib/configs.ts pattern — schema-first JSON config validation
//
// Why: catch malformed game-data JSON at app startup with a clear error
// pointing at the bad field, instead of silently passing undefined down
// to UI and crashing later.
//
// Bonus: TS types are inferred from Zod schemas — single source of truth.

// ─── lib/schema.ts ────────────────────────────────────────────
import { z } from "zod";

const money = z.number().nonnegative();
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id must be kebab-case");

export const ProfessionSchema = z.object({
  id: slug,
  name: z.string().min(1),
  income: z.object({ salary: money }),
  expenses: z.object({
    taxes: money,
    mortgage: money,
    schoolLoan: money,
    carLoan: money,
    creditCards: money,
    otherLoans: money,
    other: money,
    perChild: money,
  }),
  assets: z.object({ savings: money }),
  liabilities: z.object({
    mortgage: money,
    schoolLoan: money,
    carLoan: money,
    creditCards: money,
    otherLoans: money,
  }),
});

export const ProfessionListSchema = z.array(ProfessionSchema).nonempty();

// Type inferred from schema — DO NOT redeclare manually
export type Profession = z.infer<typeof ProfessionSchema>;


// ─── lib/configs.ts ───────────────────────────────────────────
import professionsJson from "@/config/professions.json";

// `parse` throws ZodError synchronously at module load if JSON is invalid.
// The error message tells you exactly which field is wrong.
export const PROFESSIONS = ProfessionListSchema.parse(professionsJson);

// Lookup map for hot paths
export const PROFESSION_BY_ID = Object.fromEntries(
  PROFESSIONS.map((p) => [p.id, p]),
);


// ─── lib/calculations.ts ─────────────────────────────────────
// Pure functions that consume validated configs + runtime state.
// Keep them stateless — easy to test, easy to compose.

import { PROFESSION_BY_ID } from "./configs";
import type { PlayerState, Profession } from "./types";

export function getProfession(id: string): Profession {
  const p = PROFESSION_BY_ID[id];
  if (!p) throw new Error(`Unknown profession id: ${id}`);
  return p;
}

export function totalExpenses(p: PlayerState, prof: Profession): number {
  const e = prof.expenses;
  return e.taxes + e.mortgage + e.schoolLoan + e.carLoan
       + e.creditCards + e.otherLoans + e.other
       + p.childrenCount * e.perChild;
}
