import { z } from "zod";

// `parseFrontmatterValue` (index.ts) only ever returns `string | string[]`
// — the wider union below (number,
// boolean, nested record) documented variants no producer ever emits,
// leaving every consumer believing it had to handle impossible shapes.
export const MetaSchema = z.record(
	z.string(),
	z.union([z.string(), z.array(z.string())]),
);
