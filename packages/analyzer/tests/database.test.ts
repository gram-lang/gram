import { describe, it, expect } from "bun:test";
import { validateIngredientDatabase } from "../src/index";
import { parse } from "yaml";
import { readFileSync } from "fs";
import { join } from "path";

describe("YAML Database Validation", () => {
    it("should correctly validate the examples/ingredients.yaml file", () => {
        // Read the example file
        const filePath = join(import.meta.dir, "fixtures/ingredients.yaml");
        const fileContent = readFileSync(filePath, "utf-8");
        
        // Parse YAML
        const parsedYaml = parse(fileContent);
        
        // The file wraps ingredients in an "ingredients:" root key
        const rawDb = parsedYaml.ingredients;
        
        // This should not throw if the schema matches
        const validatedDb = validateIngredientDatabase(rawDb);
        
        expect(validatedDb).toBeDefined();
        expect(validatedDb.mustard).toBeDefined();
        expect(validatedDb.mustard.name).toBe("Moutarde de Dijon");
        expect(validatedDb.mustard.nutrition?.calories).toBe(151);
        
        expect(validatedDb.sugar).toBeDefined();
        expect(validatedDb.sugar.nutrition?.sugar).toBe(100);
    });
});
