import { getAST } from '@gram/parser';
import { compile, configureIngredientDb } from '@gram/compiler';
import { analyze } from '@gram/analyzer';
import codeInput from '@webcoder49/code-input';
import hljsTemplate from '@webcoder49/code-input/templates/hljs.mjs';
import gramGrammar from './gram-highlight.js';

let fullDatabase = {};

// Lazy load Ingredient Database
import('./db_bundle.js').then(({ DEFAULT_SOURCES }) => {
    // Build the lookup record for the analyzer
    DEFAULT_SOURCES.forEach(source => {
        if (source.data) {
            Object.assign(fullDatabase, source.data);
        }
    });

    // Also keep the old configureIngredientDb for compiler if it still needs some registry info
    // Actually compiler doesn't use it anymore for mass, but might use it for registry names?
    // Let's keep it if it exists.
    if (typeof configureIngredientDb === 'function') {
        configureIngredientDb(DEFAULT_SOURCES);
    }

    // Trigger update to re-calculate macros with data
    update();
}).catch(err => console.error("Failed to load database:", err));

// Register Gram Grammar
if (window.hljs) {
    window.hljs.registerLanguage('gram', gramGrammar);
}

// Register code-input template
codeInput.registerTemplate("syntax-highlighted", new hljsTemplate(window.hljs));

const input = document.getElementById('input');
const output = document.getElementById('output');

// Setup Update Listener
input.addEventListener('input', debounce(update, 300));

const status = document.getElementById('status');
const themeToggle = document.getElementById('theme-toggle');
// Output Mode Logic
const warningsArea = document.getElementById('warnings');
const viewSelect = document.getElementById('view-mode');

// Experimental Features
const optMass = document.getElementById('opt-mass');
const optYield = document.getElementById('opt-yield');
const optNutrition = document.getElementById('opt-nutrition');

// if (localStorage.getItem('optMass') === 'true') optMass.checked = true;
// if (localStorage.getItem('optYield') === 'true') optYield.checked = true;
// if (localStorage.getItem('optNutrition') === 'true') optNutrition.checked = true;

optMass.checked = false;
optYield.checked = false;
optNutrition.checked = false;

function updateExperimentalDeps() {
    const labelYield = document.getElementById('label-opt-yield');
    if (optMass.checked) {
        optYield.disabled = false;
        if (labelYield) labelYield.style.opacity = '1';
    } else {
        optYield.disabled = true;
        if (labelYield) labelYield.style.opacity = '0.5';
    }
}
updateExperimentalDeps();

[optMass, optYield, optNutrition].forEach(el => {
    el.addEventListener('change', () => {
        if (el.id === 'opt-mass') updateExperimentalDeps();
        localStorage.setItem(el.id, el.checked);
        update();
    });
});

viewSelect.addEventListener('change', () => {
    outputMode = viewSelect.value;
    update();
});
// Theme Logic
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
});

function updateThemeIcon(isLight) {
    // Simple text or svg swap
    themeToggle.innerHTML = isLight 
        ? `<i class="ph ph-moon" style="font-size: 1.25rem;"></i>` // Moon for "Go Dark"
        : `<i class="ph ph-sun" style="font-size: 1.25rem;"></i>`; // Sun for "Go Light"
}

// Init Theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light');
    updateThemeIcon(true);
} else {
    updateThemeIcon(false);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Footer Info
const footer = document.getElementById('app-footer');
if (footer) {
    const version = process.env.GRAM_VERSION;
    const repoUrl = process.env.REPO_URL;

    footer.innerHTML = `
        <div>
            <a href="${repoUrl}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="ph ph-git-branch"></i> Repository
            </a>
        </div>
        <div>
            <span title="Version: ${version}">${version}</span>
        </div>
    `;
}

// Output Mode Logic
let outputMode = 'json'; // 'json' | 'markdown' | 'html'

function formatDecimalToFraction(value) {
    if (typeof value !== 'number') return String(value);
    
    // Exact integers
    if (Math.abs(value - Math.round(value)) < 0.01) {
        return String(Math.round(value));
    }

    // Fractions only for values strictly below 1
    if (value < 1) {
        const commonFractions = [
            { val: 0.5, str: '1/2' },
            { val: 0.25, str: '1/4' },
            { val: 0.75, str: '3/4' },
            { val: 1/3, str: '1/3' },
            { val: 2/3, str: '2/3' },
            { val: 0.125, str: '1/8' },
            { val: 0.375, str: '3/8' },
            { val: 0.625, str: '5/8' },
            { val: 0.875, str: '7/8' }
        ];
        const match = commonFractions.find(f => Math.abs(value - f.val) < 0.01);
        if (match) return match.str;
    }

    return String(parseFloat(value.toFixed(2)));
}

// Helper for minified properties
function getQty(item) {
    if (item.qty !== undefined) {
        if (typeof item.qty === 'number') return { value: item.qty, text: formatDecimalToFraction(item.qty) };
        if (typeof item.qty === 'object' && item.qty !== null && item.qty.type === 'RelativeQuantity') {
            const marker = item.qty.referenceType === 'variable' ? '&' : '@';
            return { 
                value: null, 
                text: `${item.qty.percent}% of ${marker}${item.qty.target}`,
                isRelative: true
            };
        }
        return item.qty;
    }
    // Fallback for old getters, check if S and S.quantity exists
    if (item.quantity) return item.quantity;
    return undefined;
}

// Helper for Timer/Temperature range display
function formatQuantityValue(q) {
    if (!q) return '';
    // Check if it's a semantic quantity object from the parser
    // { type: 'range', value: avg, range: { min, max }, text: "160-180" }
    if (q.type === 'range' && q.text) return q.text;
    
    // { type: 'fraction', value: 0.5, text: "1/2" }
    if (q.text) return q.text;

    if (q.type === 'RelativeQuantity') {
        const marker = q.referenceType === 'variable' ? '&' : '@';
        return `${q.percent}% of ${marker}${q.target}`;
    }
    
    // { value: 123 }
    if (q.value !== undefined) return q.value;
    
    // Simple number
    return q;
}

// Helper for duration formatting
function formatDuration(minutes) {
    if (!minutes) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m > 0 ? m + 'm' : ''}`;
    return `${m}m`;
}

function renderMarkdown(data) {
    const registry = data.registry || { ingredients: {}, cookware: {} };
    let md = '';
    
    // Title
    if (data.title) md += `# ${data.title}\n\n`;
    
    // Meta & Metrics
    if ((data.meta && Object.keys(data.meta).length > 0) || data.metrics) {
        md += `> **Metadata**\n`;
        if (data.metrics) {
            md += `> - **Total Time**: ${formatDuration(data.metrics.totalTime)}\n`;
            md += `> - **Active Time**: ${formatDuration(data.metrics.activeTime)}\n`;
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
        data.shopping_list.forEach(item => {
            if (item.type === 'alternative' || item.type === 'group') {
                md += `- **Alternative Group**:\n`;
                item.options.forEach(opt => {
                    md += `  - ${formatIngredient(opt, registry)}\n`;
                });
            } else if (item.type === 'composite') {
                 // Composite handling for MD
                 // Parent Quantity Display
                 let parentStr = formatIngredient(item, registry);
                 // If formatIngredient didn't add the quantity because it's usually for usage,
                 // we must handle it here. 
                 // However, formatIngredient uses getQty(item) which looks at item.qty.
                 // Composite item has 'qty' property (from maxQty).
                 // So formatIngredient SHOULD display it if present.
                 md += `- **${parentStr}** (Composite):\n`;
                 item.usage.forEach(child => {
                     md += `  - ${formatIngredient(child, registry)}\n`;
                 });
            } else if (item.display) {
                  // New Shopping List Format
                  md += `- ${item.display}\n`;
            } else {
                md += `- ${formatIngredient(item, registry)}\n`;
            }
        });
        md += '\n';
    }
    
    // Cookware
    if (data.cookware && data.cookware.length > 0) {
        md += `## 🍳 Cookware\n\n`;
        data.cookware.forEach(cw => {
             if (cw.type === 'alternative' || cw.type === 'group') {
                 md += `- **Alternative Group**:\n`;
                 cw.options.forEach(opt => {
                     md += `  - ${formatCookware(opt, registry)}\n`;
                 });
             } else {
                 md += `- ${formatCookware(cw, registry)}\n`;
             }
        });
        md += '\n';
    }
    
    // Instructions
    if (data.sections && data.sections.length > 0) {
        md += `## 👨‍🍳 Instructions\n\n`;
        data.sections.forEach(sec => {
            if (sec.title) {
                md += `### ${sec.title}`;
                if (sec.retro_planning) md += ` {T-${sec.retro_planning}}`;
                md += `\n\n`;
            }
            
            // Section Ingredients
            if (sec.ingredients && sec.ingredients.length > 0) {
                md += `**Ingredients**:\n`;
                sec.ingredients.forEach(item => {
                    if (item.type === 'alternative' || item.type === 'group') {
                        md += `- **Alternative Group**:\n`;
                        item.options.forEach(opt => {
                            md += `  - ${formatIngredient(opt, registry)}\n`;
                        });
                    } else {
                        md += `- ${formatIngredient(item, registry)}\n`;
                    }
                });
                md += '\n';
            }
            
            let stepCounter = 0;
            sec.steps.forEach((step, idx) => {
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
                     stepText += step.content.map((c, i, arr) => {
                         let str = '';
                         if (typeof c === 'string') {
                             str = c;
                         } else if (c.type === 'text') {
                             str = c.value;
                         } else if (c.type === 'timer') {
                             const qStr = `${formatQuantityValue(c.quantity)}${c.unit ? ' ' + c.unit : ''}`;
                             if (c.isAsync) {
                                 str = `⏳ ${qStr} (async)`;
                             } else {
                                 str = `⏲️ ${qStr}`;
                             }
                         } else if (c.type === 'temperature') {
                              if (c.text) {
                                  str = `🔥${c.text}`;
                              } else {
                                  str = `🔥${formatQuantityValue(c.quantity)}${c.unit ? ' ' + c.unit : ''}`;
                              }
                         } else if (c.type === 'reference') {
                             const name = registry.ingredients[c.id]?.name || c.id;
                             str = `👉*${name}*`;
                             const qty = getQty(c);
                             if (qty) {
                                 str += ` (${qty.text || qty.value}`;
                                 if (c.unit) str += ` ${c.unit}`;
                                 str += ')';
                             }
                         } else if (!c.type && c.id) {
                              if (registry.cookware[c.id]) str = `*${formatCookware(c, registry)}*`;
                              else str = `**${formatIngredient(c, registry)}**`;
                         } else if (c.type === 'ingredient') {
                             str = `**${formatIngredient(c, registry)}**`;
                         } else if (c.type === 'cookware') {
                             str = `*${formatCookware(c, registry)}*`;
                         } else if (c.type === 'alternative') {
                             str = c.options.map(opt => {
                                 const isCookware = opt.type === 'cookware' || registry.cookware[opt.id];
                                 if (isCookware) return `*${formatCookware(opt, registry)}*`;
                                 return `**${formatIngredient(opt, registry)}**`;
                             }).join(' or ');
                         } else if (c.type === 'group') {
                              str = c.options.map(opt => {
                                 const isCookware = opt.type === 'cookware' || registry.cookware[opt.id];
                                 if (isCookware) return `*${formatCookware(opt, registry)}*`;
                                 return `**${formatIngredient(opt, registry)}**`;
                             }).join(' or ');
                         } else if (c.type === 'comment') {
                             str = ` *${c.value.trim()}*`;
                         }

                         // Spacing Logic
                         const isObject = (typeof c !== 'string' && c.type !== 'text' && c.type !== 'comment');
                         if (isObject) {
                             const next = arr[i+1];
                             if (next) {
                                let nextChar = '';
                                if (typeof next === 'string') nextChar = next[0];
                                else if (next.type === 'text') nextChar = next.value ? next.value[0] : '';
                                
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

function formatIngredient(item, registry) {
    // Resolve name from registry
    const def = registry.ingredients[item.id];
    let str = def ? def.name : item.id;
    
    // Alias overrides name if present in usage
    if (item.alias) str = item.alias;
    
    // Shopping List Specific Display
    // If we have variableentries, we might want to display them cleanly.
    // The Input item here might be from shopping list OR from instructions.
    // Shopping list items have 'qty', 'unit', and potentially 'variable_entries'.
    
    const qty = getQty(item);
    
    // Formula handling
    const formulaStr = item.formula ? `${item.formula.percent}% of ${item.formula.target}` : null;
    const isPartial = item.formula && item.formula.is_partial;

    if (isPartial) {
        // Replace quantity with formula
        str += ` (${formulaStr} ⚠️)`;
    } else {
        let qtyParts = [];
        
        if (qty) {
            let qStr = qty.text || qty.value;
            if (item.unit) qStr += ` ${item.unit}`;
            qtyParts.push(qStr);
        }
        
        if (item.variable_entries && item.variable_entries.length > 0) {
             qtyParts.push(...item.variable_entries);
        }
        
        if (qtyParts.length > 0) {
             str += ` (${qtyParts.join(' + ')})`;
        }
        
        if (formulaStr) str += ` [${formulaStr}]`;
    }

    if (item.preparation) str += ` (${item.preparation})`;
    if (item.modifiers && item.modifiers.includes('optional')) str += ' (optional)';
    
    return str;
}

function formatCookware(item, registry) {
    const def = registry.cookware[item.id];
    let str = def ? def.name : item.id;
    
    if (item.alias) str = item.alias;
    
    const qty = getQty(item);
    if (qty) {
        str += ` (${qty.value})`;
    }
    return str;
}


function update() {
    const text = input.value;
    try {
        const ast = getAST(text);
        const compilerOptions = {
            enableMassNormalization: optMass.checked,
            enableYieldManagement: optMass.checked && optYield.checked,
            enableNutritionalEstimation: optNutrition.checked
        };
        let result = compile(ast, compilerOptions);
        
        // Physical Analysis (Mass/Nutrition)
        const analysisOptions = {
            enableMassNormalization: optMass.checked,
            enableYieldManagement: optMass.checked && optYield.checked,
            enableNutritionalEstimation: optNutrition.checked
        };
        const analysis = analyze(result, fullDatabase, analysisOptions);
        result = analysis.result;
        // In the playground, we gracefully ignore missingIngredients for now, 
        // as it's primarily for build-time database synchronization.
        
        // Prepare content
        let content = '';
        if (outputMode === 'json') {
             content = JSON.stringify(result, null, 2);
             // JSON view already shows them at the bottom.
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        } else if (outputMode === 'ast') {
             content = renderSExpr(ast);
             hideWarnings();
        } else if (outputMode === 'markdown') {
             content = renderMarkdown(result);
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        } else if (outputMode === 'json-tree') {
             content = renderJsonTree(result);
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        } else if (outputMode === 'preview') {
             content = renderHTML(result);
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        }

        const previewOutput = document.getElementById('preview-output');
        const preOutput = document.getElementById('output').parentElement; // pre is parent of code#output
        
        // Render
        if (outputMode === 'preview' || outputMode === 'json-tree') {
            // Hide Code View
            preOutput.style.display = 'none';
            
            // Show Preview (reused for tree as it's HTML content)
            previewOutput.style.display = 'block';
            previewOutput.innerHTML = content;
            
            if (outputMode === 'json-tree') {
                // Add listeners for Expand/Collapse All
                const btnExpand = previewOutput.querySelector('#btn-expand-all');
                const btnCollapse = previewOutput.querySelector('#btn-collapse-all');
                
                if (btnExpand && btnCollapse) {
                    btnExpand.addEventListener('click', () => {
                         const nodes = previewOutput.querySelectorAll('.json-node');
                         nodes.forEach(n => {
                             n.classList.remove('collapsed');
                             const t = n.querySelector('.json-toggle');
                             if (t) t.textContent = '▼';
                         });
                    });
                    
                    btnCollapse.addEventListener('click', () => {
                         const nodes = previewOutput.querySelectorAll('.json-node');
                         nodes.forEach((n, index) => {
                             if (index === 0) return; // Keep root expanded
                             n.classList.add('collapsed');
                             const t = n.querySelector('.json-toggle');
                             if (t) t.textContent = '▶';
                         });
                    });
                }
                
                const headers = previewOutput.querySelectorAll('.json-header');
                headers.forEach(h => {
                    h.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // The parent is the .json-node
                        const node = h.parentElement;
                        node.classList.toggle('collapsed');
                        
                        // Toggle arrow text
                        const toggle = h.querySelector('.json-toggle');
                        if (toggle) {
                             if (node.classList.contains('collapsed')) {
                                toggle.textContent = '▶';
                            } else {
                                toggle.textContent = '▼';
                            }
                        }
                     });
                });
            }
        } else {
            // Show Code View
            preOutput.style.display = 'block'; // Or flex/initial? pre has flex:1
            // pre styles: flex: 1. So display:flex or block? Pre is block by default but we set flex:1. 
            // Wait, pre is a flex item in .code-viewer?
            // "pre { flex: 1; ... }"
            // If we hide it, it's gone. If we show it, 'block' works for pre, but flex:1 applies if parent is flex.
            preOutput.style.removeProperty('display'); // Revert to css default
            
            // Hide Preview
            previewOutput.style.display = 'none';

            if (outputMode === 'json') {
                output.textContent = content;
                output.className = 'language-json';
            } else if (outputMode === 'ast') {
                output.textContent = content;
                output.className = 'language-lisp'; // Use Lisp highlighting for S-Expr
            } else {
                output.textContent = content; 
                output.className = 'language-markdown';
            }
            
            output.removeAttribute('data-highlighted');
            // Reset any previous line numbers structure
            // If we don't do this, hljs might not re-run or might stack tables
            // But output.textContent = content ALREADY destroys the table structure.
            // So we just need to tell hljs it's fresh.
            
            hljs.highlightElement(output);
            hljs.lineNumbersBlock(output);
        }
        
        status.textContent = 'Valid';
        status.className = 'status success';
    } catch (e) {
        output.textContent = e.message;
        output.textContent = e.message; 
        status.textContent = 'Error';
        status.className = 'status error';
    }
}


function renderHTML(data) {
    const registry = data.registry || { ingredients: {}, cookware: {} };
    let html = '';
    
    // Title
    if (data.title) {
        html += `<h1>${escapeHtml(data.title)}</h1>\n\n`;
    }
    
    // Display Metadata
    // Display Metadata
    html += `<div class="recipe-meta">\n`;
    if (data.metrics) {
        // Total Time
        html += ` <div class="meta-item">\n`;
        html += `   <div class="meta-icon"><i class="ph ph-clock"></i></div>\n`;
        html += `   <div class="meta-content">\n`;
        html += `     <span class="meta-label">Total Time</span>\n`;
        html += `     <span class="meta-value">${formatDuration(data.metrics.totalTime)}</span>\n`;
        html += `   </div>\n`;
        html += ` </div>\n`;

        // Active Time
        html += ` <div class="meta-item">\n`;
        html += `   <div class="meta-icon"><i class="ph ph-fire"></i></div>\n`;
        html += `   <div class="meta-content">\n`;
        html += `     <span class="meta-label">Active Time</span>\n`;
        html += `     <span class="meta-value">${formatDuration(data.metrics.activeTime)}</span>\n`;
        html += `   </div>\n`;
        html += ` </div>\n`;

        // Prep Time
        html += ` <div class="meta-item" title="Based on ingredient count and complexity">\n`;
        html += `   <div class="meta-icon"><i class="ph ph-knife"></i></div>\n`;
        html += `   <div class="meta-content">\n`;
        html += `     <span class="meta-label">Prep Time</span>\n`;
        html += `     <span class="meta-value">${formatDuration(data.metrics.preparationTime)} <span class="est">(est.)</span></span>\n`;
        html += `   </div>\n`;
        html += ` </div>\n`;
    }
    html += `</div>\n`;



    // Secondary Metrics (Mass, etc) & Metadata combined
    html += `<div class="recipe-meta-secondary">\n`;
    html += `<div class="metadata-grid">\n`;

    if (data.metrics && data.metrics.totalMass) {
         const mass = Math.round(data.metrics.totalMass);
         let msg = `${mass}g`;
         let title = "Total Recipe Input Mass";
         if (data.metrics.massStatus === 'estimated') {
             msg = `~${mass}g`;
             title += " (Estimated)";
         }
         if (data.metrics.massStatus === 'incomplete') {
             msg = `${mass}g?`;
             title += " (Incomplete)";
         }
         html += `  <div class="meta-secondary-item" title="${title}">\n`;
         html += `    <span class="label">Total Mass</span>\n`;
         html += `    <span class="value">${msg}</span>\n`;
         html += `  </div>\n`;
    }

    if (data.meta) {
        for (const [k, v] of Object.entries(data.meta)) {
            if (k !== 'title') {
                html += `  <div class="meta-secondary-item">\n`;
                html += `    <span class="label">${escapeHtml(k)}</span>\n`;
                html += `    <span class="value">${escapeHtml(v)}</span>\n`;
                html += `  </div>\n`;
            }
        }
    }
    
    html += `</div>\n`;
    html += `</div>\n\n`;


    
    // Shopping List
    if (data.shopping_list && data.shopping_list.length > 0) {
        html += `<div class="shopping-list">\n`;
        html += `  <h2>Shopping List</h2>\n`;
        html += `  <ul>\n`;
        data.shopping_list.forEach(item => {
            if (item.type === 'alternative' || item.type === 'group') {
                html += `    <li>\n`;
                html += `      <strong>Alternative Group</strong>:\n`;
                html += `      <ul>\n`;
                item.options.forEach(opt => {
                    html += `        <li>${formatIngredientHTML(opt, registry)}</li>\n`;
                });
                html += `      </ul>\n`;
                html += `    </li>\n`;
            } else if (item.type === 'composite') {
                html += `    <li>\n`;
                html += `      <strong>${formatIngredientHTML(item, registry)}</strong> (Composite):\n`;
                html += `      <ul>\n`;
                item.usage.forEach(child => {
                     html += `        <li>${formatIngredientHTML(child, registry)}</li>\n`;
                });
                html += `      </ul>\n`;
                html += `    </li>\n`;
            } else if (item.display) {
                html += `    <li>${escapeHtml(item.display)}</li>\n`;
            } else {
                let extraHtml = '';
                if (item.purchasingMass && item.purchasingMass !== item.normalizedMass) {
                     // Show Gross Mass if different from Net
                     const gross = Math.round(item.purchasingMass * 10) / 10;
                     extraHtml = ` <span class="gross-mass" title="Purchasing Weight (including waste/peel)">(${gross}g gross)</span>`;
                }
                html += `    <li>${formatIngredientHTML(item, registry)}${extraHtml}</li>\n`;
            }
        });
        html += `  </ul>\n`;
        html += `</div>\n\n`;
    }
    
    // Cookware
    if (data.cookware && data.cookware.length > 0) {
        html += `<div class="cookware">\n`;
        html += `  <h2>Cookware</h2>\n`;
        html += `  <ul>\n`;
        data.cookware.forEach(cw => {
            if (cw.type === 'alternative' || cw.type === 'group') {
                 html += `    <li>\n`;
                 html += `      <strong>Alternative Group</strong>:\n`;
                 html += `      <ul>\n`;
                 cw.options.forEach(opt => {
                     html += `        <li>${formatCookwareHTML(opt, registry)}</li>\n`;
                 });
                 html += `      </ul>\n`;
                 html += `    </li>\n`;
            } else {
                 html += `    <li>${formatCookwareHTML(cw, registry)}</li>\n`;
            }
        });
        html += `  </ul>\n`;
        html += `</div>\n\n`;
    }
    
    // Instructions
    if (data.sections && data.sections.length > 0) {
        html += `<div class="instructions">\n`;
        data.sections.forEach(sec => {
            html += `  <section>\n`;
            if (sec.title) {
                let titleHtml = escapeHtml(sec.title);
                if (sec.retro_planning) {
                    titleHtml += ` <small style="font-size:0.6em;opacity:0.8;border:1px solid currentColor;border-radius:4px;padding:2px 6px;vertical-align:middle;"><i class="ph ph-clock-counter-clockwise"></i> ${escapeHtml(sec.retro_planning)}</small>`;
                }
                
                // Section Mass
                if (sec.metrics && sec.metrics.totalMass > 0) {
                     const mass = Math.round(sec.metrics.totalMass);
                     let msg = `${mass}g`;
                     let title = "Section Input Mass";
                     if (sec.metrics.massStatus === 'estimated') {
                         msg = `~${mass}g`;
                         title += " (Estimated)";
                     }
                     if (sec.metrics.massStatus === 'incomplete') {
                     }
                     titleHtml += ` <small style="font-size:0.6em;opacity:0.8;border:1px solid currentColor;border-radius:4px;padding:2px 6px;vertical-align:middle;" title="${title}"><i class="ph ph-scales"></i> ${msg}</small>`;
                }

                if (sec.intermediate_preparation) {
                    titleHtml += ` <span class="declaration" title="Intermediate result for this section"><i class="ph ph-arrow-right"></i> ${escapeHtml(sec.intermediate_preparation)}</span>`;
                }

                html += `    <h3>${titleHtml}</h3>\n`;
            }
            
            // Section Ingredients
            if (sec.ingredients && sec.ingredients.length > 0) {
                html += `    <div class="section-ingredients">\n`;
                html += `      <h4>Ingredients</h4>\n`;
                html += `      <ul>\n`;
                sec.ingredients.forEach(item => {
                    if (item.type === 'alternative' || item.type === 'group') {
                        html += `        <li>\n`;
                        html += `          <strong>Alternative Group</strong>:\n`;
                        html += `          <ul>\n`;
                        item.options.forEach(opt => {
                            html += `            <li>${formatIngredientHTML(opt, registry)}</li>\n`;
                        });
                        html += `          </ul>\n`;
                        html += `        </li>\n`;
                    } else {
                        html += `        <li>${formatIngredientHTML(item, registry)}</li>\n`;
                    }
                });
                html += `      </ul>\n`;
                html += `    </div>\n`;
            }
            
            html += `    <ol class="steps">\n`;
            let stepCounter = 0;
            sec.steps.forEach((step, idx) => {
                if (step.type === 'comment') {
                    // Render differently, maybe as a note?
                    html += `      <li style="list-style: none; margin-left: -1em; color: gray; font-style: italic;">\n`;
                    html += `        ${escapeHtml(step.value)}\n`;
                    html += `      </li>\n`;
                    return;
                }

                stepCounter++;
                html += `      <li value="${stepCounter}">\n`;
                if (step.action) {
                     html += `        <span class="action">[${escapeHtml(step.action)}]</span> `;
                }
                
                let stepContent = '';
                if (step.type === 'text') {
                    stepContent = escapeHtml(step.value);
                } else if (step.type === 'step') {
                     stepContent = step.content.map((c, i, arr) => {
                         let str = '';
                         if (typeof c === 'string') {
                             str = escapeHtml(c);
                         } else if (c.type === 'text') {
                             str = escapeHtml(c.value);
                         } else if (c.type === 'timer') {
                             const q = c.quantity || { value: '' };
                             const qVal = formatQuantityValue(q);
                             const asyncClass = c.isAsync ? ' async' : '';
                             const icon = c.isAsync ? '<i class="ph ph-hourglass"></i>' : '<i class="ph ph-timer"></i>';
                             str = `<span class="timer${asyncClass}" data-value="${q.value}" data-unit="${c.unit || ''}">${icon} ${qVal}${c.unit ? ' ' + c.unit : ''}</span>`;
                         } else if (c.type === 'temperature') {
                              if (c.text) {
                                  str = `<span class="temp" data-semantic="${escapeHtml(c.text)}"><i class="ph ph-thermometer"></i> ${escapeHtml(c.text)}</span>`;
                              } else {
                                  const q = c.quantity || { value: '' };
                                  const qVal = formatQuantityValue(q);
                                  str = `<span class="temp" data-value="${q.value}" data-unit="${c.unit || ''}"><i class="ph ph-thermometer"></i> ${qVal}${c.unit ? ' ' + c.unit : ''}</span>`;
                              }
                         } else if (c.type === 'reference') {
                             const name = registry.ingredients[c.id]?.name || c.id;
                             let refStr = `<span class="reference"><i class="ph ph-caret-circle-right"></i> ${escapeHtml(name)}`;
                             const qty = getQty(c);
                             if (qty) {
                                  refStr += ` <span class="quantity">${qty.text || qty.value}`;
                                  if (c.unit) refStr += ` <span class="unit">${c.unit}</span>`;
                                  refStr += `</span>`;
                             }
                             refStr += `</span>`;
                             str = refStr;
                         } else if (!c.type && c.id) {
                              if (registry.cookware[c.id]) str = formatCookwareHTML(c, registry);
                              else str = formatIngredientHTML(c, registry);
                         } else if (c.type === 'ingredient') {
                             str = formatIngredientHTML(c, registry);
                         } else if (c.type === 'cookware') {
                             str = formatCookwareHTML(c, registry);
                         } else if (c.type === 'alternative' || c.type === 'group') {
                             str = c.options.map(opt => {
                                 const isCookware = opt.type === 'cookware' || registry.cookware[opt.id];
                                 if (isCookware) return formatCookwareHTML(opt, registry);
                                 return formatIngredientHTML(opt, registry);
                             }).join(' <span class="keyword">or</span> ');
                         } else if (c.type === 'declaration') {
                             str = `<span class="declaration" title="Intermediate result declaring this step's output"><i class="ph ph-arrow-right"></i> ${escapeHtml(c.name)}</span>`;
                         } else if (c.type === 'comment') {
                             str = `<!-- ${escapeHtml(c.value.trim())} -->`;
                         }

                         // Spacing Logic
                         const isObject = (typeof c !== 'string' && c.type !== 'text' && c.type !== 'comment');
                         if (isObject) {
                             const next = arr[i+1];
                             if (next) {
                                let nextChar = '';
                                if (typeof next === 'string') nextChar = next[0];
                                else if (next.type === 'text') nextChar = next.value ? next.value[0] : '';
                                
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
                html += `        ${stepContent}\n`;
                html += `      </li>\n`;
            });
            html += `    </ol>\n`;
            html += `  </section>\n`;
        });
        html += `</div>\n`;
    }

    // Nutrition Panel (Moved to bottom)
    if (data.metrics && data.metrics.nutrition && data.metrics.nutrition.total && data.metrics.nutrition.total.calories > 0) {
        const nut = data.metrics.nutrition;
        
        // Hide if data is incomplete (User Request: "ne devraient pas apparaître")
        if (nut.warnings && nut.warnings.length > 0) {
            return html;
        }

        const total = nut.total;
        
        let portionText = '';
        let portionVals = null;
        if (nut.perPortion) {
             portionText = ` (Per Portion)`;
             portionVals = nut.perPortion;
        }
        
        const displayVals = portionVals || total;
        
        const cal = Math.round(displayVals.calories);
        const p = displayVals.protein;
        const c = displayVals.carbs;
        const f = displayVals.fat;

        // Granular
        const sugar = displayVals.sugar !== undefined ? displayVals.sugar : '-';
        const fiber = displayVals.fiber !== undefined ? displayVals.fiber : '-';
        const salt = displayVals.salt !== undefined ? displayVals.salt : '-';
        
        html += `<div class="nutrition-panel">\n`;
        html += `  <div class="nut-header">Nutrition <span class="est-badge" title="Coverage: ${Math.round(nut.coverage * 100)}%">Estimate</span>${portionText}</div>\n`;
        html += `  <div class="nut-grid">\n`;
        html += `    <div class="nut-item"><strong>${cal}</strong> <small>kcal</small></div>\n`;
        html += `    <div class="nut-item"><span class="label">Protein</span> <strong>${p}g</strong></div>\n`;
        html += `    <div class="nut-item"><span class="label">Carbs</span> <strong>${c}g</strong><small style="font-size:0.6em; opacity:0.8; margin-top:2px;">(sugar: ${sugar}g)</small></div>\n`;
        html += `    <div class="nut-item"><span class="label">Fat</span> <strong>${f}g</strong></div>\n`;
        html += `    <div class="nut-item"><span class="label">Fiber</span> <strong>${fiber}g</strong></div>\n`;
        html += `    <div class="nut-item"><span class="label">Salt</span> <strong>${salt}g</strong></div>\n`;
        html += `  </div>\n`;
        html += `</div>\n`;
    }
    
    return html;
}

function renderJsonTree(data) {
    // Controls
    let html = `<div class="json-controls">
        <button id="btn-expand-all" class="tree-btn">Expand All</button>
        <button id="btn-collapse-all" class="tree-btn">Collapse All</button>
    </div>`;
    
    html += `<div class="json-tree">${renderJsonNode(data, null, false)}</div>`;
    return html;
}

function renderJsonNode(item, key = null, addComma = false) {
    const commaHtml = addComma ? `<span class="json-comma">,</span>` : '';
    const keyHtml = key ? `<span class="json-key">"${escapeHtml(key)}"</span>: ` : '';
    
    // Primitives
    if (item === null || typeof item !== 'object') {
        let valHtml = '';
        if (item === null) valHtml = `<span class="json-null">null</span>`;
        if (typeof item === 'boolean') valHtml = `<span class="json-bool">${item}</span>`;
        if (typeof item === 'number') valHtml = `<span class="json-num">${item}</span>`;
        if (typeof item === 'string') valHtml = `<span class="json-str">"${escapeHtml(item)}"</span>`;
        
        // Wrap in a div to maintain line structure (item vs prop)
        const content = `${keyHtml}${valHtml}${commaHtml}`;
        return `<div class="${key ? 'json-prop' : 'json-item'}">${content}</div>`;
    }
    
    // Object or Array
    const isArray = Array.isArray(item);
    const keys = isArray ? item : Object.keys(item);
    const isEmpty = keys.length === 0;
    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';
    const typeClass = isArray ? 'json-bracket' : 'json-brace';
    const countText = `${keys.length} items`;
    
    if (isEmpty) {
        return `<div class="${key ? 'json-prop' : 'json-item'}">${keyHtml}<span class="${typeClass}">${openChar}${closeChar}</span>${commaHtml}</div>`;
    }

    let html = `<div class="json-node expanded">`;
    
    // Header Line
    html += `<div class="json-header">`;
    html += `<span class="json-toggle">▼</span>`;
    html += keyHtml;
    html += `<span class="${typeClass}">${openChar}</span>`;
    html += `<span class="json-count">${countText}</span>`;
    html += `</div>`;
    
    // Children
    html += `<div class="json-children">`;
    keys.forEach((k, index) => {
        const child = isArray ? k : item[k];
        const childKey = isArray ? null : k;
        html += renderJsonNode(child, childKey, index < keys.length - 1);
    });
    html += `</div>`;
    
    // Footer (Close)
    // For proper clicking, maybe the closure shouldn't be part of the header, but standard flow.
    // The user wants "},".
    html += `<div class="json-footer"><span class="${typeClass}">${closeChar}</span>${commaHtml}</div>`;
    
    html += `</div>`;
    return html;
}

function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatIngredientHTML(item, registry) {
    // Lookup
    const def = registry.ingredients[item.id];
    const name = def ? def.name : item.id;
    
    let displayName = name;
    if (item.alias) displayName = item.alias;

    const className = (item.type === 'reference') ? 'reference' : 'ingredient';
    let str = `<span class="${className}" data-name="${escapeHtml(name)}">${escapeHtml(displayName)}`;
    
    const qty = getQty(item);
    
    // Formula Setup
    const formulaStr = item.formula ? `${item.formula.percent}% of ${escapeHtml(item.formula.target)}` : null;
    const isPartial = item.formula && item.formula.is_partial;

    if (isPartial) {
        // Show Formula AS Quantity (with warning)
        str += ` <span class="quantity formula-qty" title="Calculation partial or failed">(${formulaStr} <i class="ph ph-warning"></i>)</span>`;
    } else {
        // Normal Quantity
        let qtyContent = '';
        if (qty) {
            qtyContent += qty.text || qty.value;
            if (item.unit) qtyContent += ` <span class="unit">${escapeHtml(item.unit)}</span>`;
        }
        
        // Variable entries support
        if (item.variable_entries && item.variable_entries.length > 0) {
             const vars = item.variable_entries.join(' + ');
             if (qtyContent) qtyContent += ` + ${vars}`;
             else qtyContent = vars;
        }

        if (qtyContent) {
            str += ` <span class="quantity">(${qtyContent})</span>`;
        }

        // Normal Formula indicator
        if (formulaStr) {
             str += ` <span class="formula" title="Base Mass Used: ${item.formula ? item.formula.base_mass_used : ''}g">[${formulaStr}]</span>`;
        }
    }

    // Mass Badge
    if (item.normalizedMass) {
         // Round to max 1 decimal for display
         const mass = Math.round(item.normalizedMass * 10) / 10;
         let display = `${mass}g`;
         let title = `Calculated Mass: ${mass}g\nMethod: ${item.conversionMethod}`;
         
         if (item.isEstimate) {
             display = `~${display}`;
             title += ` (Estimated)`;
         }
         
         if (item.conversionMethod === 'explicit') {
             display = `<i class="ph ph-pencil-simple"></i> ${display}`;
             title += ` (User Override)`;
         } else if (item.conversionMethod === 'physical') {
             title += ` (Exact)`;
         }

         str += ` <span class="mass-badge" title="${title}">${display}</span>`;
    }
    
    if (item.preparation) str += ` <span class="prep">(${escapeHtml(item.preparation)})</span>`;
    if (item.modifiers && item.modifiers.includes('optional')) str += ` <span class="opt">(optional)</span>`;
    if (item.modifiers && item.modifiers.includes('reference')) str += ` <span class="ref" title="Reference to existing ingredient"><i class="ph ph-arrow-u-down-left"></i></span>`;
    
    str += `</span>`;
    return str;
}

function renderSExpr(node, level = 0) {
    if (node === null || node === undefined) return 'nil';
    if (typeof node !== 'object') {
        if (typeof node === 'string') return `"${node}"`;
        return String(node);
    }
    
    // Array handling
    if (Array.isArray(node)) {
        return node.map(n => renderSExpr(n, level)).join('\n');
    }

    const indent = '  '.repeat(level);
    const type = node.type || 'Object';
    
    // Collect attributes and children
    let attrs = '';
    let children = [];

    // Keys to ignore or handle specifically
    const ignore = new Set(['type', 'loc']);

    Object.entries(node).forEach(([k, v]) => {
        if (ignore.has(k)) return;
        
        if (v === null) return;

        if (typeof v !== 'object') {
            attrs += ` :${k} ${typeof v === 'string' ? `"${v}"` : v}`;
        } else if (Array.isArray(v)) {
            // Array of children
            v.forEach(child => children.push(child));
        } else {
            // Single child object
            // If it's a "Range" value object (special case in gram)
            if (v.min !== undefined && v.max !== undefined) {
                 attrs += ` :${k} ${v.min}-${v.max}`;
            } else {
                 children.push(v);
            }
        }
    });

    if (children.length === 0) {
        return `${indent}(${type}${attrs})`;
    }

    // Format children
    const childrenStr = children.map(c => renderSExpr(c, level + 1)).join('\n');
    return `${indent}(${type}${attrs}\n${childrenStr})`;
}

function formatCookwareHTML(item, registry) {
    const def = registry.cookware[item.id];
    const name = def ? def.name : item.id;
    
    let displayName = name;
    if (item.alias) displayName = item.alias;

    let str = `<span class="cookware" data-name="${escapeHtml(name)}">${escapeHtml(displayName)}`;
    
    const qty = getQty(item);
    if (qty) {
         str += ` <span class="quantity">(${qty.value})</span>`;
    }
    str += `</span>`;
    return str;
}


// Initial state
if (input && input.value) {
    const lines = input.value.split('\n');
    let minIndent = Infinity;
    for (const line of lines) {
        if (line.trim() !== '') {
            const match = line.match(/^(\s*)/);
            if (match) {
                minIndent = Math.min(minIndent, match[1].length);
            }
        }
    }
    if (minIndent !== Infinity && minIndent > 0) {
        input.value = lines.map(line => {
            if (line.trim() === '') return '';
            return line.slice(minIndent);
        }).join('\n');
    }
    input.value = input.value.trim();
}
update();


let isWarningsCollapsed = false;

// Event listener for warning clicks (Delegation)
if (warningsArea) {
    warningsArea.addEventListener('click', (e) => {
        // Handle Jump Button
        const btn = e.target.closest('.warning-jump');
        if (btn) {
            const start = parseInt(btn.dataset.start);
            const end = parseInt(btn.dataset.end);
            highlightWarning(start, end);
            return;
        }
        
        // Handle Header Click (Collapse/Expand)
        const header = e.target.closest('.warning-header');
        if (header) {
            isWarningsCollapsed = !isWarningsCollapsed;
            const panel = warningsArea.querySelector('.warnings-panel');
            const icon = header.querySelector('.toggle-icon');
            if (panel) {
                if (isWarningsCollapsed) {
                    panel.classList.add('collapsed');
                } else {
                    panel.classList.remove('collapsed');
                }
            }
        }
    });
}

function showWarnings(warnings) {
    if (!warningsArea) return;
    warningsArea.style.display = 'block';
    
    const collapsedClass = isWarningsCollapsed ? ' collapsed' : '';
    const rotateStyle = isWarningsCollapsed ? 'transform: rotate(-90deg);' : '';
    
    let html = `
    <div class="warnings-panel${collapsedClass}">
        <div class="warning-header" style="cursor: pointer; user-select: none;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                <i class="ph ph-warning-circle" style="font-size: 1.25rem;"></i>
                <span>${warnings.length} Warning${warnings.length > 1 ? 's' : ''}</span>
            </div>
            <i class="ph ph-caret-down toggle-icon" style="transition: transform 0.2s; ${rotateStyle}"></i>
        </div>
        <ul class="warning-list">
    `;
    
    warnings.forEach(w => {
        const hasLoc = w.loc && w.loc.start !== undefined;
        
        html += `<li class="warning-item">
            <div class="warning-icon"><i class="ph ph-warning"></i></div>
            <div class="warning-content">
                <span class="warning-code">[${escapeHtml(w.code)}]</span>
                <span class="warning-message">${escapeHtml(w.message)}</span>
                ${w.item ? `<span style="font-size:0.8em; opacity:0.7;">Item: ${escapeHtml(w.item)}</span>` : ''}
            </div>`;
            
        if (hasLoc) {
            html += `
            <button class="warning-jump" data-start="${w.loc.start}" data-end="${w.loc.end}">
                <i class="ph ph-crosshair"></i> Show
            </button>
            `;
        }
        
        html += `</li>`;
    });
    
    html += `   </ul>
    </div>`;
    
    warningsArea.innerHTML = html;
}

function hideWarnings() {
    if (warningsArea) {
        warningsArea.style.display = 'none';
        warningsArea.innerHTML = '';
    }
}

function highlightWarning(start, end) {
    if (!input) return;
    
    // Attempt to focus and select text
    // If 'input' is the <code-input> custom element, we might need to access its internal textarea
    // or it implements these methods.
    input.focus();
    
    // Check if setSelectionRange exists on the element itself
    if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(start, end);
    } else {
        // Fallback: try to find a textarea inside if it's a wrapper
        const textarea = input.querySelector ? input.querySelector('textarea') : null;
        if (textarea && typeof textarea.setSelectionRange === 'function') {
            textarea.focus();
            textarea.setSelectionRange(start, end);
        }
    }
}
const copyBtn = document.getElementById('copy-btn');

copyBtn.addEventListener('click', () => {
    const textToCopy = output.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
        // Visual feedback
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,55.51a8,8,0,0,0-11.32,0L102.5,171.34,49.66,118.51a8,8,0,0,0-11.32,11.32l58.5,58.5a8,8,0,0,0,11.32,0L229.66,66.83A8,8,0,0,0,229.66,55.51Z"></path></svg>`;
        copyBtn.style.color = 'var(--token-def)'; // Use our green token color
        
        setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
            copyBtn.style.color = ''; // Reset color
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
});
// Examples Logic
const examplesSelect = document.getElementById('examples-select');

// Load Manifest and Populate Select
if (examplesSelect) {
    fetch('dist/examples/manifest.json')
        .then(res => {
            if (!res.ok) throw new Error('Could not load manifest');
            return res.json();
        })
        .then(manifest => {
            // Clear existing options (keep the placeholder)
            if (examplesSelect.options.length > 1) {
                // Remove all except first
                while (examplesSelect.options.length > 1) {
                    examplesSelect.remove(1);
                }
            }

            // Populate
            manifest.forEach(ex => {
                const opt = document.createElement('option');
                opt.value = ex.id; // We store ID, but we need path
                opt.dataset.path = ex.path; // fix path for runtime
                opt.textContent = ex.title;
                examplesSelect.appendChild(opt);
            });
        })
        .catch(e => console.error('Manifest Error:', e));

    examplesSelect.addEventListener('change', (e) => {
        const option = e.target.selectedOptions[0];
        if (!option || !option.dataset.path) return;

        const path = option.dataset.path;
        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.text();
            })
            .then(text => {
                input.value = text;
                update();
            })
            .catch(err => {
                console.error('Could not load example:', err);
                alert('Error loading example file.');
            });

        // Reset selection
        e.target.value = "";
    });
}
