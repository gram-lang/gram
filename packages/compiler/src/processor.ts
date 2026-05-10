import { quantityToMinutes } from './units';
import { slugify, minifyQuantity, createCleanUsage } from './utils';
import { normalizeMass } from './mass_normalization';
import { 
    Context, Registry, ProcessedSection, ProcessedStep, Usage 
} from 'gram-parser';
import { CompilerOptions } from './core';

export interface ProcessorContext extends Context {
    options?: CompilerOptions;
}

export function processBlockItem(item: any, ctx: ProcessorContext, registry: Registry, secIngredients: Usage[], secCookware: Usage[]): Usage | null | string {
    if (!item) return null;

    if (item.type === 'Ingredient') {
        const id = slugify(item.name);
        
        if (!registry.ingredients.has(id)) {
            let defaultUnit = null;
            if (item.quantity && item.quantity.unit) defaultUnit = item.quantity.unit;
            registry.ingredients.set(id, { id, name: item.name, default_unit: defaultUnit });
        }
        
        const entry = registry.ingredients.get(id);
        if (entry && item.quantity && item.quantity.unit && !entry.default_unit) {
            entry.default_unit = item.quantity.unit;
        }

        if (item.composite) {
            if (entry) entry.is_composite = true;
            const parentId = slugify(item.composite.parent);
            if (entry) entry.parent = parentId;
            if (!registry.ingredients.has(parentId)) {
                 registry.ingredients.set(parentId, { id: parentId, name: item.composite.parent, is_composite: true });
            } else {
                 const parent = registry.ingredients.get(parentId);
                 if (parent) parent.is_composite = true;
            }
        }

        // Handle RelativeQuantity
        if (item.quantity && item.quantity.type === 'RelativeQuantity') {
             const rel = item.quantity;
             const targetName = rel.target;
             const targetId = slugify(targetName);
             const percent = rel.percent;
             
             let totalQty = 0;
             let inheritedUnit: string | null = null;
             let isGhost = false;
             
             const markerChar = rel.referenceType === 'variable' ? '&' : '@';
             // Store formula for display.
             const formulaStr = `${percent}% of ${markerChar}${targetName}`;

             if (rel.referenceType === 'variable') {
                 if (ctx.variableWeights.has(targetId)) {
                     const varData = ctx.variableWeights.get(targetId);
                     if (varData) {
                        totalQty = varData.mass;
                        inheritedUnit = 'g'; 
                     }
                 } else {
                     // Ghost Variable
                     isGhost = true;
                     ctx.warnings.push({
                         code: 'VARIABLE_NOT_FOUND',
                         message: `Variable '&${targetName}' not found or has undefined mass.`,
                         item: item.name,
                         loc: item.loc
                     });
                 }
             } else {
                 // Ingredient Resolution (Linear Top-Down)
                 const found = secIngredients.some(i => i.id === targetId);
                 if (!found) {
                     isGhost = true;
                     ctx.warnings.push({
                         code: 'RELATIVE_QUANTITY_UNRESOLVED',
                         message: `Could not resolve relative quantity for '@${targetName}'. Source not found.`,
                         item: item.name,
                         loc: item.loc
                     });
                 } else {
                     // Calculate sum by original unit
                     let fallbackMassSum = 0;
                     let fallbackUnit = 'g';
                     let hasValidUnit = false;
                     
                     for (const prev of secIngredients) {
                         if (prev.id === targetId) {
                             if (!hasValidUnit && prev.unit) {
                                 inheritedUnit = prev.unit;
                                 hasValidUnit = true;
                             }
                             
                             if (hasValidUnit && prev.unit === inheritedUnit && prev.qty && typeof prev.qty === 'number') {
                                 totalQty += prev.qty;
                             } else {
                                 // Unit mismatch, fallback to mass if possible
                                 if (prev.normalizedMass) {
                                     fallbackMassSum += prev.normalizedMass;
                                 } else if (prev.qty && typeof prev.qty === 'number' && prev.unit) {
                                     const norm = normalizeMass(prev.qty, prev.unit, prev.name, ctx.densityOverrides, ctx.options);
                                     if (norm) {
                                         fallbackMassSum += norm.mass;
                                     }
                                 }
                             }
                         }
                     }
                     
                     if (!hasValidUnit) {
                         // Maybe it's unitless or mass-only, fallback to mass sum
                         if (fallbackMassSum > 0) {
                             totalQty = fallbackMassSum;
                             inheritedUnit = 'g';
                         } else {
                             isGhost = true;
                             ctx.warnings.push({
                                 code: 'RELATIVE_NO_MASS',
                                 message: `Source '@${targetName}' has no usable quantity. Calculation impossible.`,
                                 item: item.name,
                                 loc: item.loc
                             });
                         }
                     } else if (fallbackMassSum > 0) {
                         // Mixed units, and we have a mass fallback. If mass norm is enabled, use it.
                         if (ctx.options?.enableMassNormalization !== false) {
                             // Try to add the matching unit parts to the mass sum
                             const norm = normalizeMass(totalQty, inheritedUnit!, item.name, ctx.densityOverrides, ctx.options);
                             if (norm) fallbackMassSum += norm.mass;
                             totalQty = fallbackMassSum;
                             inheritedUnit = 'g';
                         } else {
                              ctx.warnings.push({
                                  code: 'RELATIVE_MIXED_UNITS',
                                  message: `Source '@${targetName}' has mixed units and mass normalization is disabled. Only identical units were summed.`,
                                  item: item.name,
                                  loc: item.loc
                              });
                         }
                     }
                 }
             }
             
             const newVal = totalQty * (percent / 100);
             const usage = createCleanUsage(item, id, ctx.densityOverrides, ctx.options);
              usage.qty = parseFloat(newVal.toFixed(2)); 
              usage.unit = inheritedUnit || 'g'; 
              
              if (usage.unit) {
                  const norm = normalizeMass(usage.qty, usage.unit, usage.name || item.name, ctx.densityOverrides, ctx.options);
                  if (norm) {
                      usage.normalizedMass = norm.mass;
                      usage.conversionMethod = norm.method;
                      (usage as any).isEstimate = norm.isEstimate;
                  }
              } 
             
             // Check Circular (Direct self-reference)
             if (targetId === id) {
                 usage.isCircular = true;
                 ctx.warnings.push({
                     code: 'CIRCULAR_REFERENCE',
                     message: `Circular reference detected: ${item.name} depends on itself.`,
                     item: item.name,
                     loc: item.loc
                 });
             }

             // Attach dependency info for graph cycle detection
             usage.dependencies = [targetId];

             usage.formula = {
                 raw: formulaStr,
                 target: targetName,
                 percent: percent,
                 isGhost: isGhost
             };
             
             secIngredients.push(usage);
             return usage;
        }

        const usage = createCleanUsage(item, id, ctx.densityOverrides, ctx.options);
        if (item.modifiers && item.modifiers.includes('&')) {
             if (!ctx.seenNames.has(item.name)) {
                 ctx.warnings.push({ code: 'UNDEFINED_REFERENCE', message: `Reference to undefined ingredient '@&${item.name}'.`, item: item.name, loc: item.loc });
             }
             if (ctx.definedIntermediates.has(item.name)) ctx.usedIntermediates.add(item.name);
        } else {
             ctx.seenNames.add(item.name);
        }
        
        if (!item.modifiers || !item.modifiers.includes('&') || item.quantity) {
             secIngredients.push(usage);
        }
        
        return usage;
    }

    if (item.type === 'Cookware') {
        const id = slugify(item.name);
        if (!registry.cookware.has(id)) {
            registry.cookware.set(id, { id, name: item.name });
        }
        const usage = createCleanUsage(item, id, ctx.densityOverrides, ctx.options);
        secCookware.push(usage);
        return usage;
    }

    if (item.type === 'Alternative') {
        const processedOptions: any[] = [];
        // Sequential processing to allow internal references (e.g. A | B{50% A})
        
        let tempIngredientsScope = [...secIngredients];
        let tempCookwareScope = [...secCookware];

        item.options.forEach((opt: any) => {
            const captureIngredients = [...tempIngredientsScope];
            const captureCookware = [...tempCookwareScope];
            
            const result = processBlockItem(opt, ctx, registry, captureIngredients, captureCookware);
            processedOptions.push(result);
            
            if (result && typeof result !== 'string') {
                const r = result as Usage;
                if (r.type === 'ingredient' || r.type === 'drink' || (r.id && !r.type)) { 
                     tempIngredientsScope.push(r);
                }
                if (r.type === 'cookware') {
                     tempCookwareScope.push(r);
                }
            }
        });

        const usage: Usage = { id: 'alternative', type: 'alternative', options: processedOptions };
        
        if (item.options.length > 0) {
             if (item.options[0].type === 'Ingredient') {
                 secIngredients.push(usage);
             } else if (item.options[0].type === 'Cookware') {
                 secCookware.push(usage);
             }
        }
        return usage;
    }

    if (item.type === 'Reference') {
        const id = slugify(item.name);
        if (!registry.ingredients.has(id)) {
             ctx.warnings.push({ code: 'UNDEFINED_REFERENCE', message: `Reference to undefined ingredient '&${item.name}'.`, item: item.name, loc: item.loc });
        }
        if (ctx.definedIntermediates.has(item.name)) ctx.usedIntermediates.add(item.name);
        
        const obj: Usage = { type: 'reference', id, name: item.name };
        
        
        // Only use explicit quantity if it has a value or unit (e.g. {100g} or {100})
        // Empty braces {} should fall through to inheritance
        if (item.quantity && (item.quantity.value !== null || item.quantity.unit || item.quantity.type === 'TextQuantity')) {
             const cleanQty = minifyQuantity(item.quantity);
             if (cleanQty !== undefined) obj.qty = cleanQty;
             if (item.quantity.unit) obj.unit = item.quantity.unit;
             if (item.quantity.type === 'TextQuantity') obj.qty = item.quantity.value;

             // Normalize explicit quantity
             if (obj.qty && typeof obj.qty === 'number') {
                 const norm = normalizeMass(obj.qty, obj.unit || '', item.name, ctx.densityOverrides, ctx.options);
                 if (norm) {
                     obj.normalizedMass = norm.mass;
                     obj.conversionMethod = norm.method;
                     obj.isEstimate = norm.isEstimate;
                 }
             }
        } else {
             // No quantity -> Inherit mass from intermediate
             if (ctx.variableWeights.has(id)) {
                 const w = ctx.variableWeights.get(id);
                 if (w) {
                     obj.normalizedMass = w.mass;
                     obj.isEstimate = w.isPartial;
                     obj.conversionMethod = 'physical'; // Inherited
                 }
             } else {
                 console.log(`[DEBUG] Variable ${id} not found. Available:`, Array.from(ctx.variableWeights.keys()));
             }
        }
        
        // Only add to section ingredients (for Mass Calc) if it's NOT a local intermediate
        // Local intermediates are already counted in the steps that created them.
        if (!ctx.currentSectionIntermediates.has(item.name)) {
            secIngredients.push(obj);
        }
        
        return obj;
    }

    if (item.type === 'IntermediateDecl') {
        const id = slugify(item.name);
        ctx.intermediateDecl = id;
        ctx.currentSectionIntermediates.add(item.name); // Track local declaration
        if (!registry.ingredients.has(id)) {
            registry.ingredients.set(id, { id, name: item.name, is_intermediate: true });
        } else {
            const entry = registry.ingredients.get(id);
            if (entry) entry.is_intermediate = true;
        }
        return { type: 'declaration', name: item.name, id };
    }

    if (item.type === 'Text') return item.value;
    
    // Timer/Temperature logic (keep same)
    if (item.type === 'Timer' || item.type === 'Temperature') {
         const obj: any = { type: item.type.toLowerCase() };
         if (item.name) obj.name = item.name;
         if (item.type === 'Timer' && (item as any).isAsync) obj.isAsync = true;
         if (item.quantity) {
              const q = item.quantity;
              if (q.value) obj.quantity = q.value;
              let unit = q.unit;
              if (item.type === 'Timer' && (unit === 'm' || unit === 'minutes')) unit = 'min';
              if (unit) obj.unit = unit;
              
              if (q.type === 'TextQuantity') {
                  ctx.warnings.push({ code: 'INVALID_UNIT', message: `Invalid text content in ${item.type}.`, item: (q as any).value, loc: item.loc });
                  obj.quantity = { type: 'text', value: (q as any).value }; 
              } else {
                  if (!unit) {
                      ctx.warnings.push({ code: 'MISSING_UNIT', message: `${item.type} must have an explicit unit.`, item: item.name || item.type, loc: item.loc });
                  }
              }
         return obj;
    }
    }

    if (item.type === 'Comment') {
        return { type: 'comment', value: item.value, kind: item.kind } as any;
    }

    return item;
}

export function processSections(astChildren: any[], registry: Registry, overrides?: Record<string, number>, options?: CompilerOptions): { sections: ProcessedSection[], metrics: { totalTime: number, activeTime: number } } {
    const ctx: ProcessorContext = {
        warnings: registry.warnings,
        intermediateDecl: null,
        seenNames: new Set(),
        definedIntermediates: new Set(),
        usedIntermediates: new Set(),
        currentSectionIntermediates: new Set(),
        variableWeights: new Map(),
        globalScopes: new Map(),
        densityOverrides: overrides || {},
        options
    };

    const sections: ProcessedSection[] = [];
    let blocksToProcess = astChildren;
    
    if (blocksToProcess.length > 0 && blocksToProcess[0].type !== 'Section') {
        blocksToProcess = [{ type: 'Section', title: null, children: astChildren }];
    }

    let cookCursor = 0;
    let globalActiveTime = 0;
    const activeBackgroundTasks: Array<{ end: number }> = [];

    blocksToProcess.forEach(section => {
        if (section.type !== 'Section') return; 
        ctx.currentSectionIntermediates.clear();

        if (section.intermediateDecl) {
            const varName = section.intermediateDecl.name;
            if (ctx.globalScopes.has(varName)) {
                registry.warnings.push({
                    code: 'SCOPE_CONFLICT',
                    message: `Global variable '&${varName}' is redefined.`,
                    section: section.title,
                    loc: section.intermediateDecl?.loc
                });
            } else {
                ctx.globalScopes.set(varName, section.title);
            }

            const id = slugify(varName);
            if (!registry.ingredients.has(id)) {
                registry.ingredients.set(id, { id, name: varName, is_intermediate: true });
            }
            ctx.definedIntermediates.add(varName);
        }

        const sectionIngredients: Usage[] = [];
        const sectionCookware: Usage[] = [];
        const steps: ProcessedStep[] = [];

        section.children.forEach((block: any) => {
             if (block.type === 'Step') {
                 let localActiveTime = 0;
                 const stepAsyncTasks: Array<{ name?: string, duration: number, startOffset: number }> = [];
                 const stepContentObjects: any[] = [];
                 
                 ctx.intermediateDecl = null;
                 
                 block.children.forEach((item: any) => {
                     const processed = processBlockItem(item, ctx, registry, sectionIngredients, sectionCookware);
                     
                     if (processed) {
                          stepContentObjects.push(processed);

                          if (typeof processed !== 'string') {
                              const p = processed as any; 
                              if (p.type === 'timer' && p.quantity) {
                                  const duration = quantityToMinutes({ value: p.quantity, unit: p.unit });
                                  
                                  if (p.isAsync) {
                                      stepAsyncTasks.push({
                                          name: p.name || 'Timer',
                                          duration: duration,
                                          startOffset: localActiveTime
                                      });
                                      activeBackgroundTasks.push({ end: cookCursor + localActiveTime + duration });
                                  } else {
                                      localActiveTime += duration;
                                  }
                              }
                          }
                     }
                 });

                 if (localActiveTime === 0 && stepAsyncTasks.length === 0) {
                     localActiveTime = 2; 
                 }

                 const startTime = cookCursor;
                 const endTime = cookCursor + localActiveTime;
                 
                 const stepObj: ProcessedStep = {
                     type: 'step',
                     content: stepContentObjects,
                     timings: {
                         start: startTime,
                         end: endTime,
                         activeDuration: localActiveTime
                     },
                     backgroundTasks: stepAsyncTasks
                 };

                  if (block.action) {
                      (stepObj as any).action = block.action;
                  }

                 cookCursor += localActiveTime;
                 globalActiveTime += localActiveTime;

                 let stepMass = 0;
                 let stepValid = true;
                 stepContentObjects.forEach(p => {
                      if (typeof p !== 'string') {
                          // Prioritize normalized mass
                          if (p.normalizedMass) {
                                stepMass += p.normalizedMass;
                          } else if (p.qty && typeof p.qty === 'number' && p.unit) {
                                // Last resort fallback
                                const norm = normalizeMass(p.qty, p.unit, p.name, ctx.densityOverrides, ctx.options);
                                if (norm) stepMass += norm.mass;
                          }
                          
                          // Check validity for partial status
                          if (p.type === 'ingredient' && !p.normalizedMass) stepValid = false;
                      }
                 });

                 if (ctx.intermediateDecl) { 
                      const varId = ctx.intermediateDecl;
                      ctx.variableWeights.set(varId, { mass: stepMass, isPartial: !stepValid });
                      (stepObj as any).intermediate_preparation = ctx.intermediateDecl;
                 }
                 
                 steps.push(stepObj);

             } else if (block.type === 'Comment') {
                 steps.push({ type: 'comment', value: block.value, kind: block.kind } as any);
             }
        });

        const res: ProcessedSection = { 
            title: section.title, 
            ingredients: sectionIngredients, 
            cookware: sectionCookware, 
            steps 
        };
        
        if (section.intermediateDecl) {
             res.intermediate_preparation = section.intermediateDecl.name;
             let secMass = 0;
             let partial = false;
             res.ingredients.forEach(ing => {
                 if (ing.normalizedMass) {
                     secMass += ing.normalizedMass;
                 } else {
                     partial = true; // Conservative
                 }
             });
             const varId = slugify(section.intermediateDecl.name);
             ctx.variableWeights.set(varId, { mass: secMass, isPartial: partial });
        }
        if (section.retroPlanning) {
            res.retro_planning = section.retroPlanning;
        }
        sections.push(res);
    });

    let maxBackgroundTaskEnd = 0;
    activeBackgroundTasks.forEach(t => {
        if (t.end > maxBackgroundTaskEnd) maxBackgroundTaskEnd = t.end;
    });
    const totalTime = Math.max(cookCursor, maxBackgroundTaskEnd);

    return { 
        sections, 
        metrics: {
            totalTime,
            activeTime: globalActiveTime
        }
    };
}
