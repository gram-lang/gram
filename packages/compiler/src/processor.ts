import { slugify, minifyQuantity, createCleanUsage, quantityToMinutes } from './utils';
import { 
    Context, Registry, ProcessedSection, ProcessedStep, Usage 
} from '@gram/parser';
import { CompilerOptions } from './core';

export interface ProcessorContext extends Context {
    options?: CompilerOptions;
}

/**
 * Processes a single AST item inside a recipe step.
 * Identifies the node type (Ingredient, Cookware, Reference, Timer, etc.), normalizes its properties,
 * pushes it to the local section list, and checks for validation errors (ghosts, circularity).
 */
export function processBlockItem(item: any, ctx: ProcessorContext, registry: Registry, secIngredients: Usage[], secCookware: Usage[]): Usage | null | string {
    if (!item) return null;

    // 1. Process standard Ingredient declarations
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

        // Tag composite ingredients linked to a parent sub-recipe
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

        // Process RelativeQuantity nodes (e.g. 50% of another ingredient/variable)
        if (item.quantity && item.quantity.type === 'RelativeQuantity') {
             const rel = item.quantity;
             const targetName = rel.target;
             const targetId = slugify(targetName);
             const percent = rel.percent;
             
             let isGhost = false;
             const markerChar = rel.referenceType === 'variable' ? '&' : '@';
             const formulaStr = `${percent}% of ${markerChar}${targetName}`;

             if (rel.referenceType === 'variable') {
                  if (!ctx.definedIntermediates.has(targetName)) {
                      isGhost = true;
                      ctx.warnings.push({
                          code: 'VARIABLE_NOT_FOUND',
                          message: `Variable '&${targetName}' not found.`,
                          item: item.name,
                          loc: item.loc
                      });
                  }
             } else {
                  const found = secIngredients.some(i => i.id === targetId);
                  if (!found) {
                      isGhost = true;
                      ctx.warnings.push({
                          code: 'RELATIVE_QUANTITY_UNRESOLVED',
                          message: `Could not resolve relative quantity for '@${targetName}'. Source not found in current section.`,
                          item: item.name,
                          loc: item.loc
                      });
                  }
             }
             
             const usage = createCleanUsage(item, id, ctx.options);
             usage.qty = item.quantity; // Defer evaluation to analyzer
             usage.unit = null;
             
             if (targetId === id) {
                  usage.isCircular = true;
                  ctx.warnings.push({
                      code: 'CIRCULAR_REFERENCE',
                      message: `Circular reference detected: ${item.name} depends on itself.`,
                      item: item.name,
                      loc: item.loc
                  });
             }

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

        const usage = createCleanUsage(item, id, ctx.options);
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

    // 2. Process Cookware items
    if (item.type === 'Cookware') {
        const id = slugify(item.name);
        if (!registry.cookware.has(id)) {
            registry.cookware.set(id, { id, name: item.name });
        }
        const usage = createCleanUsage(item, id, ctx.options);
        secCookware.push(usage);
        return usage;
    }

    // 3. Process Alternative listings (A | B)
    if (item.type === 'Alternative') {
        const processedOptions: any[] = [];
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

    // 4. Process Variable References (&reference)
    if (item.type === 'Reference') {
        const id = slugify(item.name);
        if (!registry.ingredients.has(id)) {
             ctx.warnings.push({ code: 'UNDEFINED_REFERENCE', message: `Reference to undefined ingredient '&${item.name}'.`, item: item.name, loc: item.loc });
        }
        if (ctx.definedIntermediates.has(item.name)) ctx.usedIntermediates.add(item.name);
        
        const obj: Usage = { type: 'reference', id, name: item.name };
        
        if (item.quantity && (item.quantity.value !== null || item.quantity.unit || item.quantity.type === 'TextQuantity')) {
             const cleanQty = minifyQuantity(item.quantity);
             if (cleanQty !== undefined) obj.qty = cleanQty;
             if (item.quantity.unit) obj.unit = item.quantity.unit;
             if (item.quantity.type === 'TextQuantity') obj.qty = item.quantity.value;
        }
        
        if (!ctx.currentSectionIntermediates.has(item.name)) {
            secIngredients.push(obj);
        }
        
        return obj;
    }

    // 5. Process Intermediate Declarations (creating a sub-product like a dough)
    if (item.type === 'IntermediateDecl') {
        const id = slugify(item.name);
        ctx.intermediateDecl = id;
        ctx.currentSectionIntermediates.add(item.name);
        if (!registry.ingredients.has(id)) {
            registry.ingredients.set(id, { id, name: item.name, is_intermediate: true });
        } else {
            const entry = registry.ingredients.get(id);
            if (entry) entry.is_intermediate = true;
        }
        return { type: 'declaration', name: item.name, id };
    }

    if (item.type === 'Text') return item.value;
    
    // 6. Process Timers and Temperatures
    if (item.type === 'Timer') {
         const obj: any = { type: 'timer' };
         if (item.name) obj.name = item.name;
         if (item.isAsync) obj.isAsync = true;
         if (item.quantity) {
              const q = item.quantity;
              if (q.value) obj.quantity = q.value;
              let unit = q.unit;
              if (unit === 'm' || unit === 'minutes') unit = 'min';
              if (unit) obj.unit = unit;
              
              if (q.type === 'TextQuantity') {
                   ctx.warnings.push({ code: 'INVALID_UNIT', message: `Invalid text content in Timer.`, item: (q as any).value, loc: item.loc });
                   obj.quantity = { type: 'text', value: (q as any).value }; 
              } else {
                   if (!unit) {
                       ctx.warnings.push({ code: 'MISSING_UNIT', message: `Timer must have an explicit unit.`, item: item.name || 'Timer', loc: item.loc });
                   }
               }
          }
          return obj;
    }

    if (item.type === 'Temperature') {
         const obj: any = { type: 'temperature' };
         if (item.name) obj.name = item.name;
         if (item.text) {
              obj.text = item.text;
         } else {
              if (item.value) obj.quantity = item.value;
              if (item.unit) {
                  obj.unit = item.unit;
              } else {
                  ctx.warnings.push({
                      code: 'MISSING_UNIT',
                      message: `Temperature must have an explicit unit.`,
                      item: item.name || 'Temperature',
                      loc: item.loc
                  });
              }
         }
         return obj;
    }

    // 7. Process Step Comments
    if (item.type === 'Comment') {
        return { type: 'comment', value: item.value, kind: item.kind } as any;
    }

    return item;
}

/**
 * Main structural step/section processor.
 * Builds global scopes, registers intermediate recipe variables, schedules steps,
 * handles async background tasks, and calculates active and total duration metrics.
 */
export function processSections(astChildren: any[], registry: Registry, options?: CompilerOptions): { sections: ProcessedSection[], metrics: { totalTime: number, activeTime: number } } {
    const ctx: ProcessorContext = {
        warnings: registry.warnings,
        intermediateDecl: null,
        seenNames: new Set(),
        definedIntermediates: new Set(),
        usedIntermediates: new Set(),
        currentSectionIntermediates: new Set(),
        globalScopes: new Map(),
        options
    };

    const sections: ProcessedSection[] = [];
    let blocksToProcess = astChildren;
    
    // Wrap raw top-level steps into an implicit default section if none exist
    if (blocksToProcess.length > 0 && blocksToProcess[0].type !== 'Section') {
        blocksToProcess = [{ type: 'Section', title: null, children: astChildren }];
    }

    let cookCursor = 0;
    let globalActiveTime = 0;
    const activeBackgroundTasks: Array<{ end: number }> = [];

    blocksToProcess.forEach(section => {
        if (section.type !== 'Section') return; 
        ctx.currentSectionIntermediates.clear();

        // Register variables outputted by previous sections
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
                  
                  // Process all items in the step sequentially
                  block.children.forEach((item: any) => {
                      const processed = processBlockItem(item, ctx, registry, sectionIngredients, sectionCookware);
                      
                      if (processed) {
                           stepContentObjects.push(processed);

                           if (typeof processed !== 'string') {
                               const p = processed as any; 
                               if (p.type === 'timer' && p.quantity) {
                                   const duration = quantityToMinutes({ value: p.quantity, unit: p.unit });
                                   
                                   // Asynchronous background task (Gantt track split)
                                   if (p.isAsync) {
                                       stepAsyncTasks.push({
                                           name: p.name || 'Timer',
                                           duration: duration,
                                           startOffset: localActiveTime
                                       });
                                       activeBackgroundTasks.push({ end: cookCursor + localActiveTime + duration });
                                   } else {
                                       // Synchronous task (blocks the main workflow)
                                       localActiveTime += duration;
                                   }
                               }
                           }
                      }
                  });

                  // Apply standard fallback active duration for empty step actions (2 min)
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

                  if (ctx.intermediateDecl) { 
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
        }
        if (section.retroPlanning) {
            res.retro_planning = section.retroPlanning;
        }
        sections.push(res);
    });

    // Compute maximum workflow end time including background async tasks
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
