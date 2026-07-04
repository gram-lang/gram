import { getAST } from '@gram/parser';
import { compile } from '@gram/kitchen';
import { analyze } from '@gram/analyzer';
import codeInput from '@webcoder49/code-input';
import { createHighlighter } from 'shiki';
import gramGrammar from '@gram/parser/textmate' with { type: "json" };
import { toMarkdown, toHTML, escapeHtml } from '@gram/renderer';

let fullDatabase = {};

// Lazy load Ingredient Database
import('./db_bundle.js').then(({ DEFAULT_SOURCES }) => {
    // Build the lookup record for the analyzer
    DEFAULT_SOURCES.forEach(source => {
        if (source.data) {
            Object.assign(fullDatabase, source.data);
        }
    });

    // Actually compiler doesn't use it anymore for mass, but might use it for registry names?

    // Trigger update to re-calculate macros with data
    update();
}).catch(err => console.error("Failed to load database:", err));

let highlighter = null;
let shikiReady = false;

// Create Custom Template for code-input
codeInput.registerTemplate("syntax-highlighted", new codeInput.Template(
    (codeElement) => {
        if (!shikiReady || !highlighter) {
            // Fallback before shiki is ready
            codeElement.textContent = codeElement.textContent; 
            return;
        }
        
        const rawCode = codeElement.textContent;
        const isLight = document.body.classList.contains('light');
        const theme = isLight ? 'github-light' : 'github-dark';
        
        const highlightedHTML = highlighter.codeToHtml(rawCode, { lang: 'gram', theme });
        // Extract the inside of the <code> tag
        const match = highlightedHTML.match(/<code[^>]*>([\s\S]*?)<\/code>/);
        if (match) {
            codeElement.innerHTML = match[1];
        } else {
            codeElement.textContent = rawCode;
        }
    },
    false, // preElementStyled
    true   // isCode
));

// Initialize Shiki asynchronously
createHighlighter({
    langs: [
        { ...gramGrammar, name: 'gram' },
        'json',
        'lisp',
        'markdown'
    ],
    themes: ['github-dark', 'github-light']
}).then(h => {
    highlighter = h;
    shikiReady = true;
    
    // Trigger an initial update to highlight everything
    update();
    const inputEl = document.getElementById('input');
    if (inputEl) {
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
}).catch(e => console.error("Shiki initialization failed", e));

const input = document.getElementById('input');
const output = document.getElementById('output');

// Setup Update Listener
input.addEventListener('input', debounce(update, 300));

const status = document.getElementById('status');
const themeToggle = document.getElementById('theme-toggle');
// Output Mode Logic
const warningsArea = document.getElementById('warnings');
const viewSelect = document.getElementById('view-mode');

let outputMode = localStorage.getItem('view-mode');
if (!outputMode) {
    outputMode = viewSelect.value || 'json';
} else {
    viewSelect.value = outputMode;
}

const optMass = document.getElementById('opt-mass');
const optYield = document.getElementById('opt-yield');
const optNutrition = document.getElementById('opt-nutrition');

// Restore from localStorage, defaulting Mass and Nutrition to on
optMass.checked = localStorage.getItem('opt-mass') !== null ? localStorage.getItem('opt-mass') === 'true' : true;
optYield.checked = localStorage.getItem('opt-yield') === 'true';
optNutrition.checked = localStorage.getItem('opt-nutrition') !== null ? localStorage.getItem('opt-nutrition') === 'true' : true;

function updateAnalysisDeps() {
    const labelYield = document.getElementById('label-opt-yield');
    if (optMass.checked) {
        optYield.disabled = false;
        if (labelYield) labelYield.style.opacity = '1';
    } else {
        optYield.disabled = true;
        if (labelYield) labelYield.style.opacity = '0.5';
    }
}
updateAnalysisDeps();

[optMass, optYield, optNutrition].forEach(el => {
    el.addEventListener('change', () => {
        if (el.id === 'opt-mass') updateAnalysisDeps();
        localStorage.setItem(el.id, el.checked);
        // Nutrition panel is only visible in Preview — auto-switch so the user sees it
        if (el.id === 'opt-nutrition' && el.checked && outputMode !== 'preview') {
            outputMode = 'preview';
            viewSelect.value = 'preview';
            localStorage.setItem('view-mode', 'preview');
        }
        update();
    });
});

viewSelect.addEventListener('change', () => {
    outputMode = viewSelect.value;
    localStorage.setItem('view-mode', outputMode);
    update();
});
// Theme Logic
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
    
    // Trigger update to re-highlight with new theme
    update();
    const inputEl = document.getElementById('input');
    if (inputEl) {
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
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
// (outputMode is now initialized earlier)

const playgroundOptions = {
    icons: {
        hourglass: '<i class="ph ph-hourglass"></i>',
        timer: '<i class="ph ph-timer"></i>',
        thermometer: '<i class="ph ph-thermometer"></i>',
        caretRight: '<i class="ph ph-caret-circle-right"></i>',
        arrowRight: '<i class="ph ph-arrow-right"></i>',
        arrowUDownLeft: '<i class="ph ph-arrow-u-down-left"></i>',
        warning: '<i class="ph ph-warning"></i>',
        pencilSimple: '<i class="ph ph-pencil-simple"></i>',
        clock: '<i class="ph ph-clock"></i>',
        fire: '<i class="ph ph-fire"></i>',
        knife: '<i class="ph ph-knife"></i>',
        scales: '<i class="ph ph-scales"></i>',
        clockCounterClockwise: '<i class="ph ph-clock-counter-clockwise"></i>'
    }
};

function update() {
    const text = input.value;
    try {
        const ast = getAST(text);
        const compilerOptions = {
            enableMassStandardization: optMass.checked,
            enableYieldCalculation: optMass.checked && optYield.checked,
            enableNutritionalEstimation: optNutrition.checked
        };
        let result = compile(ast, compilerOptions);
        
        // Physical Analysis (Mass/Nutrition)
        const analysisOptions = {
            enableMassStandardization: optMass.checked,
            enableYieldCalculation: optMass.checked && optYield.checked,
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
             content = toMarkdown(result);
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
             content = toHTML(result, playgroundOptions);
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        }

        const previewOutput = document.getElementById('preview-output');
        const preOutput = document.getElementById('output').parentElement; // pre is parent of code#output
        
        // Toggle .show-macros so gram.css reveals the nutrition panel when enabled
        const previewOutput2 = document.getElementById('preview-output');
        if (optNutrition.checked) {
            previewOutput2.classList.add('show-macros');
        } else {
            previewOutput2.classList.remove('show-macros');
        }

        // Render
        if (outputMode === 'preview' || outputMode === 'json-tree') {
            // Hide Code View
            preOutput.style.display = 'none';
            
            // Show Preview (reused for tree as it's HTML content)
            previewOutput.style.display = 'block';
            
            // Preserve details open state
            const openDetails = new Set();
            if (outputMode === 'preview') {
                previewOutput.querySelectorAll('details[open]').forEach(details => {
                    const summary = details.querySelector('summary');
                    if (summary) openDetails.add(summary.textContent.trim());
                });
            }

            previewOutput.innerHTML = content;
            
            if (outputMode === 'preview' && openDetails.size > 0) {
                previewOutput.querySelectorAll('details').forEach(details => {
                    const summary = details.querySelector('summary');
                    if (summary && openDetails.has(summary.textContent.trim())) {
                        details.open = true;
                    }
                });
            }
            
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

            output.className = outputMode === 'json' ? 'language-json' : (outputMode === 'ast' ? 'language-lisp' : 'language-markdown');
            const rawCode = content;
            
            if (shikiReady && highlighter) {
                const lang = outputMode === 'json' ? 'json' : (outputMode === 'ast' ? 'lisp' : 'markdown');
                const isLight = document.body.classList.contains('light');
                const highlightedHTML = highlighter.codeToHtml(rawCode, { lang, theme: isLight ? 'github-light' : 'github-dark' });
                const match = highlightedHTML.match(/<code[^>]*>([\s\S]*?)<\/code>/);
                if (match) {
                    output.innerHTML = match[1];
                } else {
                    output.textContent = rawCode;
                }
            } else {
                output.textContent = rawCode;
            }
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

            // Auto-load a rich example by default if input is empty
            if (manifest.length > 0 && (!input.value || input.value.trim() === '')) {
                const defaultEx = manifest.find(ex => ex.id === 'empanadas') || manifest.find(ex => ex.id === 'canneles') || manifest[0];
                fetch(defaultEx.path)
                    .then(res => res.text())
                    .then(text => {
                        input.value = text;
                        update();
                    })
                    .catch(e => console.error('Failed to load default example:', e));
            }
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
