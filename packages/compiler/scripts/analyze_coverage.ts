
import * as fs from 'fs';
import * as path from 'path';
import { getAST } from 'gram-parser';
import { compile } from '../src/index';

const EXAMPLES_DIR = path.resolve(__dirname, '../../../examples');

function scanExamples() {
    console.log(`🔍 Scanning recipes in: ${EXAMPLES_DIR}`);

    if (!fs.existsSync(EXAMPLES_DIR)) {
        console.error("❌ Examples directory not found!");
        return;
    }

    const files = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.gram'));
    
    const allMissing = new Set<string>();
    let totalIngredients = 0;
    let missingCount = 0;

    files.forEach(file => {
        const fullPath = path.join(EXAMPLES_DIR, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        console.log(`\n📄 Processing: ${file}`);

        try {
            const ast = getAST(content);
            const result = compile(ast);
            
            if (result.metrics && result.metrics.missingMassIngredients) {
                const missing = result.metrics.missingMassIngredients;
                if (missing.length > 0) {
                    console.log(`   ⚠️  Missing weights for: ${missing.join(', ')}`);
                    missing.forEach(m => allMissing.add(m));
                    missingCount += missing.length;
                } else {
                    console.log(`   ✅ 100% Covered!`);
                }
            }
            
            // Heuristic to count total unique ingredients
            totalIngredients += Object.keys(result.registry.ingredients).length;

        } catch (e: any) {
            console.error(`   ❌ Error compiling ${file}:`, e.message);
            console.error(e.stack);
        }
    });

    console.log('\n──────────────────────────────────────────');
    console.log('📊 GLOBAL INGREDIENT DB REPORT');
    console.log('──────────────────────────────────────────');
    console.log(`Total Files:   ${files.length}`);
    console.log(`Unique Missing: ${allMissing.size}`);
    
    if (allMissing.size > 0) {
        console.log('\n🔴 MISSING INGREDIENTS (Add these to ingredient_db.ts):');
        console.log(Array.from(allMissing).map(s => `- ${s}`).join('\n'));
    } else {
        console.log('\n🎉 Fantastic! No missing ingredients found in examples.');
    }
    console.log('──────────────────────────────────────────');
}

scanExamples();
