import { RendererOptions, RenderContext } from '../types';
import { formatDuration as defaultFormatDuration, aggToRendererItem } from '../utils';
import { formatElement } from './element';
import { aggregateSectionIngredients } from '@gram/kitchen';

export function toMarkdown(data: any, options: RendererOptions = {}): string {
    const registry = data.registry || { ingredients: {}, cookware: {} };
    const formatDuration = options.formatDuration || defaultFormatDuration;
    const context: RenderContext = {
        registry,
        icons: options.icons,
        classes: options.classes,
        formatDuration,
        formatFraction: options.formatFraction,
        bakersMathOnly: options.bakersMathOnly
    };
    
    let md = '';
    
    // Title
    if (data.title) md += `# ${data.title}\n\n`;
    
    // Meta & Metrics
    if ((data.meta && Object.keys(data.meta).length > 0) || data.metrics) {
        md += `> **Metadata**\n`;
        if (data.metrics) {
            if (data.metrics.totalTime) {
                md += `> - **Total Time**: ${formatDuration(data.metrics.totalTime)}\n`;
            }
            if (data.metrics.cookTime) {
                md += `> - **Cook Time**: ${formatDuration(data.metrics.cookTime)}\n`;
            }
            if (data.metrics.activeTime) {
                md += `> - **Active Time**: ${formatDuration(data.metrics.activeTime)}\n`;
            }
            if (data.metrics.preparationTime) {
                md += `> - **Prep Time**: ${formatDuration(data.metrics.preparationTime)} (est.)\n`;
            }
        }
        if (data.meta) {
            for (const [k, v] of Object.entries(data.meta)) {
                if (k !== 'title') md += `> - ${k}: ${v}\n`;
            }
        }
        md += '\n';
    }
    
    // Shopping List
    if (data.shopping_list && data.shopping_list.length > 0) {
        md += `## 🛒 Shopping List\n\n`;
        data.shopping_list.forEach((item: any) => {
            if (item.type === 'alternative' || item.type === 'group') {
                md += `- **Alternative Group**:\n`;
                item.options.forEach((opt: any) => {
                    md += `  - ${formatElement(opt, 'md', { ...context, formatMode: 'shopping-list' })}\n`;
                });
            } else if (item.type === 'composite') {
                 let parentStr = formatElement(item, 'md', { ...context, formatMode: 'shopping-list' });
                 md += `- ${parentStr} **(Composite)**:\n`;
                 item.usage.forEach((child: any) => {
                     md += `  - ${formatElement(child, 'md', { ...context, formatMode: 'shopping-list' })}\n`;
                 });
            } else if (item.display) {
                  md += `- ${item.display}\n`;
            } else {
                md += `- ${formatElement(item, 'md', { ...context, formatMode: 'shopping-list' })}\n`;
            }
        });
        md += '\n';
    }
    
    // Cookware
    if (data.cookware && data.cookware.length > 0) {
        md += `## 🍳 Cookware\n\n`;
        data.cookware.forEach((cw: any) => {
             if (cw.type === 'alternative' || cw.type === 'group') {
                 md += `- **Alternative Group**:\n`;
                 cw.options.forEach((opt: any) => {
                     md += `  - ${formatElement(opt, 'md', context)}\n`;
                 });
             } else {
                 md += `- ${formatElement(cw, 'md', context)}\n`;
             }
        });
        md += '\n';
    }
    
    // Instructions
    if (data.sections && data.sections.length > 0) {
        md += `## 👨‍🍳 Instructions\n\n`;
        data.sections.forEach((sec: any) => {
            if (sec.title) {
                md += `### ${sec.title}`;
                if (sec.retro_planning) md += ` ~{${sec.retro_planning}}`;
                md += `\n\n`;
            }
            
            // Section Ingredients — aggregated to remove duplicates and apply addition/segregation rules
            const sectionItems = aggregateSectionIngredients(sec.ingredients ?? []).map(aggToRendererItem);
            if (sectionItems.length > 0) {
                md += `**Ingredients**:\n`;
                sectionItems.forEach((item: any) => {
                    md += `- ${formatElement(item, 'md', { ...context, formatMode: 'mise-en-place' })}\n`;
                });
                md += '\n';
            }
            
            let stepCounter = 0;
            sec.steps.forEach((step: any) => {
                if (step.type === 'comment') {
                     md += `> *${step.value ? step.value.trim() : ''}*\n\n`;
                     return;
                }

                stepCounter++;
                const stepNum = stepCounter;
                let stepText = '';
                
                // Prepend Action if exists
                if (step.action) {
                     stepText += `**[${step.action}]** `;
                }

                if (step.type === 'text') {
                    stepText += step.value;
                } else if (step.type === 'step') {
                     stepText += step.content.map((c: any, i: number, arr: any[]) => {
                         let str = formatElement(c, 'md', context);

                         // Spacing Logic
                         const isObject = (typeof c !== 'string' && c.type !== 'text' && c.type !== 'comment');
                         if (isObject) {
                             const next = arr[i+1];
                             if (next) {
                                let nextChar = '';
                                if (typeof next === 'string') nextChar = next.charAt(0);
                                else if (next.type === 'text') nextChar = next.value ? next.value.charAt(0) : '';
                                
                                // Don't add space if next is glue (punctuation or space)
                                const isGlue = nextChar && /^[.,!?:;)]/.test(nextChar) || (nextChar && /^\s/.test(nextChar));
                                if (!isGlue) {
                                    str += ' ';
                                }
                             }
                         }
                         return str;
                     }).join('');
                }
                md += `${stepNum}. ${stepText}\n`;
            });
            md += '\n';
        });
    }
    
    return md;
}
