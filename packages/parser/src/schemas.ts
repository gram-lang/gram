import { z } from "zod";

export const MetaSchema = z.record(
	z.string(),
	z.union([
		z.string(),
		z.array(z.string()),
		z.number(),
		z.boolean(),
		z.record(z.string(), z.any()),
	]),
);
