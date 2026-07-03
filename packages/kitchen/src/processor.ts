import { minifyQuantity, createCleanUsage, quantityToMinutes } from './utils';
import { 
    ASTNode, SectionAST, StepAST, CommentAST, IngredientAST, CookwareAST,
    AlternativeAST, ReferenceAST, IntermediateDecl, TimerAST, TemperatureAST, TextAST,
    QuantityValueAST, ASTNodeType, Location
} from '@gram/parser';
import { Context, ProcessedSection, ProcessedStep, Usage, ProcessedStepItem, ProcessedComment } from './types';
import { CompilerOptions } from './core';
import { RecipeRegistry } from './registry';
import { WarningCode, pushWarning } from './warnings';

export interface ProcessorContext extends Context {
    options?: CompilerOptions;
}

function checkModifiers(ctx: ProcessorContext, modifiers: string[], itemName: string, loc?: Location) {
    if (!modifiers) return;
    
    const seen = new Set<string>();
    for (const m of modifiers) {
        if (seen.has(m)) {
            pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, { item: itemName, combination: `Duplicated modifier '${m}'`, loc });
        }
        seen.add(m);
    }
    
    const hasOpt = modifiers.includes('?');
    const hasImp = modifiers.includes('*');
    const hasHid = modifiers.includes('-');
    const hasRef = modifiers.includes('&');
    
    if (hasOpt && hasImp) {
        pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, { item: itemName, combination: 'Optional (?) and Important (*)', loc });
    }
    if (hasHid && hasImp) {
        pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, { item: itemName, combination: 'Hidden (-) and Important (*)', loc });
    }
    if (hasHid && hasRef) {
        pushWarning(ctx, WarningCode.INVALID_MODIFIER_COMBINATION, { item: itemName, combination: 'Hidden (-) and Referenceable (&)', loc });
    }
}

/**
 * Processes a single AST item inside a recipe step.
 * Identifies the node type (Ingredient, Cookware, Reference, Timer, etc.), normalizes its properties,
 * pushes it to the local section list, and checks for validation errors (ghosts, circularity).
 */
export type ProcessedBlockResult = 
    | Usage 
    | string 
    | { type: 'declaration'; name: string; id: string } 
    | { type: 'timer'; name?: string; isPassive?: boolean; quantity?: number | string | QuantityValueAST; unit?: string } 
    | { type: 'temperature'; name?: string; text?: string; quantity?: QuantityValueAST; unit?: string } 
    | { type: 'comment'; value: string; kind: 'line' | 'block' };

/**
 * Processes a single AST item inside a recipe step.
 * Identifies the node type (Ingredient, Cookware, Reference, Timer, etc.), normalizes its properties,
 * pushes it to the local section list, and checks for validation errors (ghosts, circularity).
 */
function processIngredient(
    item: IngredientAST,
    ctx: ProcessorContext,
    registry: RecipeRegistry,
    secIngredients: Usage[]
): Usage {
    checkModifiers(ctx, item.modifiers, item.name, item.loc);
    
    const defaultUnit = (item.quantity && 'unit' in item.quantity && item.quantity.unit) || undefined;
    const id = registry.registerIngredient(item.name, defaultUnit ? { default_unit: defaultUnit } : undefined);

    // Tag composite ingredients linked to a parent sub-recipe
    if (item.composite) {
        const parentId = registry.registerIngredient(item.composite.parent, { is_composite: true });
        registry.registerIngredient(item.name, { is_composite: true, parent: parentId });
    }

    // Process RelativeQuantity nodes (e.g. 50% of another ingredient/variable)
    if (item.quantity && item.quantity.type === ASTNodeType.RelativeQuantity) {
         const rel = item.quantity;
         const targetName = rel.target;
         const targetId = registry.getIngredientId(targetName);
         const percent = rel.percent;
         
         let isGhost = false;
         const formulaStr = `${percent}% of ${targetName}`;

         if (rel.referenceType === 'variable') {
              if (!ctx.definedIntermediates.has(targetName)) {
                  isGhost = true;
                  pushWarning(ctx, WarningCode.VARIABLE_NOT_FOUND, { targetName, item: item.name, loc: item.loc });
              }
         } else {
              const found = secIngredients.some(i => i.id === targetId);
              if (!found) {
                  isGhost = true;
                  pushWarning(ctx, WarningCode.RELATIVE_QUANTITY_UNRESOLVED, { targetName, item: item.name, loc: item.loc });
              }
         }
         
         const usage = createCleanUsage(item, id, ctx.options);
         usage.qty = item.quantity; // Defer evaluation to analyzer
         usage.unit = null;
         
         if (targetId === id) {
              usage.isCircular = true;
              pushWarning(ctx, WarningCode.CIRCULAR_REFERENCE, { name: item.name, item: item.name, loc: item.loc });
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
              pushWarning(ctx, WarningCode.UNDEFINED_REFERENCE, { prefix: '@&', name: item.name, item: item.name, loc: item.loc });
         }
         if (ctx.definedIntermediates.has(item.name)) ctx.usedIntermediates.add(item.name);
    } else {
         ctx.seenNames.add(item.name);
    }
    
    const hasQuantityValue = !!(item.quantity && (
         (item.quantity.type === ASTNodeType.Quantity && (item.quantity.value !== null || item.quantity.unit !== null)) ||
         item.quantity.type === ASTNodeType.TextQuantity
    ));
    
    if (!item.modifiers || !item.modifiers.includes('&') || hasQuantityValue) {
         secIngredients.push(usage);
    }
    
    return usage;
}

function processCookware(
    item: CookwareAST,
    ctx: ProcessorContext,
    registry: RecipeRegistry,
    secCookware: Usage[]
): Usage {
    checkModifiers(ctx, item.modifiers, item.name, item.loc);

    const id = registry.registerCookware(item.name);
    const usage = createCleanUsage(item, id, ctx.options);
    secCookware.push(usage);
    return usage;
}

function processAlternative(
    item: AlternativeAST,
    ctx: ProcessorContext,
    registry: RecipeRegistry,
    secIngredients: Usage[],
    secCookware: Usage[]
): Usage {
    const processedOptions: ProcessedBlockResult[] = [];
    let tempIngredientsScope = [...secIngredients];
    let tempCookwareScope = [...secCookware];

    item.options.forEach((opt) => {
        const captureIngredients = [...tempIngredientsScope];
        const captureCookware = [...tempCookwareScope];
        
        const result = processBlockItem(opt, ctx, registry, captureIngredients, captureCookware);
        if (result !== null) {
            processedOptions.push(result);
            
            if (typeof result !== 'string') {
                const r = result as Usage;
                if (r.type === 'ingredient' || r.type === 'drink' || (r.id && !r.type)) { 
                     tempIngredientsScope.push(r);
                }
                if (r.type === 'cookware') {
                     tempCookwareScope.push(r);
                }
            }
        }
    });

    const usage: Usage = { id: 'alternative', type: 'alternative', options: processedOptions };
    
    const firstOption = item.options[0];
    if (firstOption) {
         if (firstOption.type === ASTNodeType.Ingredient) {
              secIngredients.push(usage);
         } else if (firstOption.type === ASTNodeType.Cookware) {
              secCookware.push(usage);
         }
    }
    return usage;
}

function processReference(
    item: ReferenceAST,
    ctx: ProcessorContext,
    registry: RecipeRegistry,
    secIngredients: Usage[]
): Usage {
    // singleWordName stops at spaces but not punctuation, so "&crust." captures the trailing dot.
    // Strip trailing sentence punctuation before resolving the reference.
    const cleanName = item.name.replace(/[.,!?;:]+$/, '');
    const id = registry.getIngredientId(cleanName);
    if (!registry.ingredients.has(id)) {
         pushWarning(ctx, WarningCode.UNDEFINED_REFERENCE, { prefix: '&', name: cleanName, item: cleanName, loc: item.loc });
    }
    if (ctx.definedIntermediates.has(cleanName)) ctx.usedIntermediates.add(cleanName);

    const obj: Usage = { type: 'reference', id, name: cleanName, _usageId: String(Math.random()) };

    if (item.quantity) {
         if (item.quantity.type === ASTNodeType.Quantity) {
              if (item.quantity.value !== null || item.quantity.unit) {
                   const cleanQty = minifyQuantity(item.quantity);
                   if (cleanQty !== undefined) obj.qty = cleanQty;
                   if (item.quantity.unit) obj.unit = item.quantity.unit;
              }
         } else if (item.quantity.type === ASTNodeType.TextQuantity) {
              obj.qty = item.quantity.value;
         }
    }

    if (!ctx.currentSectionIntermediates.has(cleanName)) {
        secIngredients.push(obj);
    }
    
    return obj;
}

function processIntermediateDecl(
    item: IntermediateDecl,
    ctx: ProcessorContext,
    registry: RecipeRegistry
): ProcessedBlockResult {
    const id = registry.registerIngredient(item.name, { is_intermediate: true });
    ctx.intermediateDecl = id;
    ctx.currentSectionIntermediates.add(item.name);
    return { type: 'declaration', name: item.name, id };
}

function processTimer(
    item: TimerAST,
    ctx: ProcessorContext
): ProcessedBlockResult {
    const obj: { type: 'timer'; name?: string; isPassive?: boolean; quantity?: number | string | QuantityValueAST; unit?: string } = { type: 'timer' };
    if (item.name) obj.name = item.name;
    if (item.isPassive) obj.isPassive = true;
    if (item.quantity) {
         const q = item.quantity;
         if (q.type === ASTNodeType.Quantity) {
             if (q.value) obj.quantity = q.value;
             let unit = q.unit;
             if (unit === 'm' || unit === 'minutes') unit = 'min';
             if (unit) obj.unit = unit;
             if (!unit) {
                 pushWarning(ctx, WarningCode.MISSING_UNIT, { type: 'Timer', item: item.name || 'Timer', loc: item.loc });
             }
         } else if (q.type === ASTNodeType.TextQuantity) {
             pushWarning(ctx, WarningCode.INVALID_UNIT, { value: q.value, loc: item.loc });
             obj.quantity = { type: 'text', value: q.value }; 
         }
    }
    return obj;
}

function processTemperature(
    item: TemperatureAST,
    ctx: ProcessorContext
): ProcessedBlockResult {
    const obj: { type: 'temperature'; name?: string; text?: string; quantity?: QuantityValueAST; unit?: string } = { type: 'temperature' };
    if (item.name) obj.name = item.name;
    if (item.text) {
         obj.text = item.text;
    } else {
         if (item.value) obj.quantity = item.value;
         if (item.unit) {
             obj.unit = item.unit;
         } else {
             pushWarning(ctx, WarningCode.MISSING_UNIT, { type: 'Temperature', item: item.name || 'Temperature', loc: item.loc });
         }
    }
    return obj;
}

function processText(item: TextAST): ProcessedBlockResult {
    return item.value;
}

function processComment(item: CommentAST): ProcessedBlockResult {
    return { type: 'comment', value: item.value, kind: item.kind };
}

export function processBlockItem(
    item: ASTNode | null | undefined,
    ctx: ProcessorContext,
    registry: RecipeRegistry,
    secIngredients: Usage[],
    secCookware: Usage[]
): ProcessedBlockResult | null {
    if (!item) return null;

    switch (item.type) {
        case ASTNodeType.Ingredient:
            return processIngredient(item as IngredientAST, ctx, registry, secIngredients);
        case ASTNodeType.Cookware:
            return processCookware(item as CookwareAST, ctx, registry, secCookware);
        case ASTNodeType.Alternative:
            return processAlternative(item as AlternativeAST, ctx, registry, secIngredients, secCookware);
        case ASTNodeType.Reference:
            return processReference(item as ReferenceAST, ctx, registry, secIngredients);
        case ASTNodeType.IntermediateDecl:
            return processIntermediateDecl(item as IntermediateDecl, ctx, registry);
        case ASTNodeType.Text:
            return processText(item as TextAST);
        case ASTNodeType.Timer:
            return processTimer(item as TimerAST, ctx);
        case ASTNodeType.Temperature:
            return processTemperature(item as TemperatureAST, ctx);
        case ASTNodeType.Comment:
            return processComment(item as CommentAST);
        case ASTNodeType.Recipe:
        case ASTNodeType.Section:
        case ASTNodeType.Step:
            return null;
        default:
            const _exhaustiveCheck: never = item;
            throw new Error(`Unhandled AST node type: ${(item as any).type}`);
    }
}

/**
 * Main structural step/section processor.
 * Builds global scopes, registers intermediate recipe variables, schedules steps,
 * handles passive background tasks, and calculates active and total duration metrics.
 */
export function processSections(
    astChildren: ASTNode[],
    registry: RecipeRegistry,
    options?: CompilerOptions
): { sections: ProcessedSection[]; metrics: { cookTime: number; activeTime: number } } {
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
    let blocksToProcess: ASTNode[] = astChildren;
    
    // Group all top-level steps and comments into an implicit default section
    const topLevelBlocks: ASTNode[] = [];
    const actualSections: ASTNode[] = [];
    
    for (const child of astChildren) {
        if (child.type === ASTNodeType.Section) {
            actualSections.push(child);
        } else {
            topLevelBlocks.push(child);
        }
    }

    blocksToProcess = [...actualSections];
    if (topLevelBlocks.length > 0) {
        blocksToProcess.unshift({ type: ASTNodeType.Section, title: null, children: topLevelBlocks } as SectionAST);
    }

    let cookCursor = 0;
    let globalActiveTime = 0;
    const activeBackgroundTasks: Array<{ end: number }> = [];
    const intermediateReadyTimes = new Map<string, number>();

    blocksToProcess.forEach(section => {
        if (section.type !== ASTNodeType.Section) return; 
        ctx.currentSectionIntermediates.clear();

        // Register variables outputted by previous sections
        if (section.intermediateDecl) {
            const varName = section.intermediateDecl.name;
            if (ctx.globalScopes.has(varName)) {
                pushWarning(registry, WarningCode.SCOPE_CONFLICT, { varName, section: section.title, loc: section.intermediateDecl?.loc });
            } else {
                ctx.globalScopes.set(varName, section.title || '');
            }

            registry.registerIngredient(varName, { is_intermediate: true });
            ctx.definedIntermediates.add(varName);
        }

        const sectionIngredients: Usage[] = [];
        const sectionCookware: Usage[] = [];
        const steps: ProcessedStepItem[] = [];
        let sectionMaxBackgroundTaskEnd = 0;

        section.children.forEach((block) => {
             if (block.type === ASTNodeType.Step) {
                  let localActiveTime = 0;
                  const stepPassiveTasks: Array<{ name?: string; duration: number; startOffset: number }> = [];
                  const stepContentObjects: ProcessedBlockResult[] = [];
                  
                  ctx.intermediateDecl = null;
                  let maxDependencyReadyTime = 0;
                  
                  // Process all items in the step sequentially
                  block.children.forEach((item) => {
                      const processed = processBlockItem(item, ctx, registry, sectionIngredients, sectionCookware);
                      
                      if (processed) {
                           stepContentObjects.push(processed);

                           if (typeof processed !== 'string' && 'type' in processed && processed.type === 'reference' && processed.name) {
                               const readyTime = intermediateReadyTimes.get(processed.name);
                               if (readyTime !== undefined) {
                                   maxDependencyReadyTime = Math.max(maxDependencyReadyTime, readyTime);
                               }
                           }

                           if (typeof processed !== 'string') {
                               if ('type' in processed && processed.type === 'timer' && !('id' in processed) && processed.quantity) {
                                   const duration = quantityToMinutes({ value: processed.quantity, unit: processed.unit });
                                   
                                   // Passive background task (Gantt track split)
                                   if (processed.isPassive) {
                                       stepPassiveTasks.push({
                                           name: processed.name || 'Timer',
                                           duration: duration,
                                           startOffset: localActiveTime
                                       });
                                       // Background tasks are pushed to activeBackgroundTasks after cookCursor is finalized
                                   } else {
                                       // Active task (blocks the main workflow)
                                       localActiveTime += duration;
                                   }
                               }
                           }
                      }
                  });

                  // Apply standard fallback active duration for empty step actions (2 min)
                  if (localActiveTime === 0 && stepPassiveTasks.length === 0) {
                      localActiveTime = 2; 
                  }

                  if (maxDependencyReadyTime > cookCursor) {
                      cookCursor = maxDependencyReadyTime;
                  }

                  const startTime = cookCursor;
                  const endTime = cookCursor + localActiveTime;
                  
                  let stepMaxTaskEnd = endTime;
                  stepPassiveTasks.forEach(task => {
                      const taskEndTime = cookCursor + task.startOffset + task.duration;
                      activeBackgroundTasks.push({ end: taskEndTime });
                      sectionMaxBackgroundTaskEnd = Math.max(sectionMaxBackgroundTaskEnd, taskEndTime);
                      stepMaxTaskEnd = Math.max(stepMaxTaskEnd, taskEndTime);
                  });

                  // Add inline intermediates to ready map
                  stepContentObjects.forEach(obj => {
                      if (typeof obj !== 'string' && 'type' in obj && obj.type === 'declaration' && obj.name) {
                          intermediateReadyTimes.set(obj.name, stepMaxTaskEnd);
                      }
                  });
                  
                  const stepObj: ProcessedStep = {
                      type: 'step',
                      content: stepContentObjects,
                      timings: {
                          start: startTime,
                          end: endTime,
                          activeDuration: localActiveTime
                      },
                      backgroundTasks: stepPassiveTasks
                  };

                  if (block.action) {
                      stepObj.action = block.action;
                  }

                  cookCursor += localActiveTime;
                  globalActiveTime += localActiveTime;

                  if (ctx.intermediateDecl) { 
                      stepObj.intermediate_preparation = ctx.intermediateDecl;
                  }
                  
                  steps.push(stepObj);

             } else if (block.type === ASTNodeType.Comment) {
                  steps.push({ type: 'comment', value: block.value, kind: block.kind });
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
             intermediateReadyTimes.set(section.intermediateDecl.name, Math.max(cookCursor, sectionMaxBackgroundTaskEnd));
        }
        if (section.retroPlanning) {
             res.retro_planning = section.retroPlanning;
        }
        sections.push(res);
    });

    // Compute maximum workflow end time including background passive tasks
    let maxBackgroundTaskEnd = 0;
    activeBackgroundTasks.forEach(t => {
        if (t.end > maxBackgroundTaskEnd) maxBackgroundTaskEnd = t.end;
    });
    const cookTime = Math.max(cookCursor, maxBackgroundTaskEnd);

    return { 
        sections, 
        metrics: {
            cookTime,
            activeTime: globalActiveTime
        }
    };
}
