import { z } from "zod";

export const CompilerOptionsSchema = z.object({
	scaleFactor: z.number().positive().optional(),
});
