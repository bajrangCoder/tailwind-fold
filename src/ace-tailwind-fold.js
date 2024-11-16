/**
 * TailwindFoldHandler for Ace Editor
 * Folds long class/className attributes in various web frameworks and template languages
 * 
 * @example
 * // Basic usage
 * const editor = ace.edit("editor");
 * const foldHandler = new TailwindFoldHandler(editor);
 * 
 * @example
 * // Custom configuration
 * const foldHandler = new TailwindFoldHandler(editor, {
 *   minClasses: 4,
 *   autoFold: false,
 *   placeholder: '···',
 *   attributes: ['custom-class'], // These will be added to default attributes
 *   modes: {
 *     // Custom mode configuration
 *     'ace/mode/custom': {
 *       pattern: /(?:custom-attr)\s*=\s*["']/ // Custom pattern
 *     }
 *   }
 * });
 */

const Range = ace.require('ace/range').Range;

export default class TailwindFoldHandler {
    /**
     * Creates a new TailwindFoldHandler instance
     * @param {Object} editor - Ace editor instance
     * @param {Object} options - Configuration options
     * @param {number} [options.minClasses=3] - Minimum number of classes before folding
     * @param {string} [options.placeholder='...'] - Text to show when folded
     * @param {boolean} [options.autoFold=true] - Whether to fold automatically on changes
     * @param {string[]} [options.attributes=[]] - Additional attributes to watch for folding
     * @param {Object} [options.modes] - Custom mode configurations
     */
    constructor(editor, options = {}) {
        this.editor = editor;
        this.defaultAttributes = [
            'class',
            'className',
            ':class',
            'v-bind:class',
            'class:list',
            'class:names',
            'tw',
            'tailwind'
        ];

        this.options = {
            minClasses: 3,
            placeholder: '...',
            autoFold: true,
            attributes: [],
            modes: {},
            ...options
        };

        // Merge custom attributes with defaults
        this.options.attributes = [
            ...this.defaultAttributes,
            ...this.options.attributes
        ];

        this.folds = new Map();
        this.setupDefaultModes();
        this.setupEditor();
        this.allFolds = new Set(); // Track all possible fold positions
    }

    /**
     * Sets up default patterns for common languages/frameworks
     * @private
     */
    setupDefaultModes() {
        const defaultModes = {
            // JSX/TSX
            'ace/mode/jsx': {
                pattern: this.buildAttributePattern(true)
            },
            'ace/mode/tsx': {
                pattern: this.buildAttributePattern(true)
            },
            // Vue
            'ace/mode/vue': {
                pattern: this.buildAttributePattern(true)
            },
            // Svelte
            'ace/mode/svelte': {
                pattern: this.buildPattern([
                    ...this.options.attributes,
                    'class:.*?(?=\\s|>|$)', // Svelte class directives
                ], true)
            },
            // Astro
            'ace/mode/astro': {
                pattern: this.buildAttributePattern(true)
            },
            // Blade
            'ace/mode/blade': {
                pattern: this.buildPattern([
                    ...this.options.attributes,
                    '(?:{!!|{\\??)\\s*class\\s*(?:}|\\?})',
                ], true)
            },
            // Twig
            'ace/mode/twig': {
                pattern: this.buildPattern([
                    ...this.options.attributes,
                    '{{\\s*class\\s*}}',
                ], true)
            },
            // Liquid
            'ace/mode/liquid': {
                pattern: this.buildPattern([
                    ...this.options.attributes,
                    '{%\\s*class\\s*%}',
                ], true)
            },
            // Pug
            'ace/mode/pug': {
                pattern: this.buildPattern([
                    '(?:^|\\s)(?:class|className)\\s*\\(',
                    '\\.([-\\w]+)',
                ], false)
            },
            // PHP
            'ace/mode/php': {
                pattern: this.buildPattern([
                    ...this.options.attributes,
                    '(?:<?php\\s*)?(?:class|className)\\s*=\\s*["\']',
                ], false)
            },
            // Default
            'default': {
                pattern: this.buildAttributePattern(false)
            }
        };

        this.modes = { ...defaultModes, ...this.options.modes };
    }

    /**
     * Builds the main attribute pattern
     * @private
     * @param {boolean} includeTemplates - Whether to include template literal/expression syntax
     * @returns {RegExp} Compiled regular expression
     */
    buildAttributePattern(includeTemplates) {
        return this.buildPattern(this.options.attributes, includeTemplates);
    }

    /**
     * Builds a RegExp pattern for matching attributes
     * @private
     * @param {string[]} patterns - Array of patterns
     * @param {boolean} includeTemplates - Whether to include template literal/expression syntax
     * @returns {RegExp} Compiled regular expression
     */
    buildPattern(patterns, includeTemplates) {
        const quotes = includeTemplates ? '["\'`{]' : '["\']';
        const patternString = patterns
            .map(attr => `(?:${attr})\\s*=\\s*${quotes}`)
            .join('|');
        return new RegExp(patternString);
    }

    setupEditor() {
        if (this.options.autoFold) {
            this.editor.on('change', () => {
                setTimeout(() => this.updateFolds(), 10);
            });

            this.editor.session.selection.on('changeCursor', () => {
                this.handleCursorChange();
            });
        }

        this.editor.commands.addCommand({
            name: 'toggleTailwindFold',
            bindKey: { win: 'Alt-T', mac: 'Command-T' },
            exec: () => {
                if (!this.folds.size) {
                    // Ensure folds are created if they aren't already.
                    this.updateFolds(true);
                }
                this.toggleAllFolds();
            }
        });

        // Initial fold discovery
        this.updateFolds(true);
    }

    handleCursorChange() {
        const cursorPosition = this.editor.getCursorPosition();
        const fold = this.editor.session.getFoldAt(
            cursorPosition.row,
            cursorPosition.column
        );

        if (fold && fold.placeholder === this.options.placeholder) {
            this.editor.session.unfold(cursorPosition.row);
            if (this.options.autoFold) {
                this.setupAutoFold();
            }
        }
    }

    setupAutoFold() {
        if (this.autoFoldTimeout) {
            clearTimeout(this.autoFoldTimeout);
        }

        this.autoFoldTimeout = setTimeout(() => {
            const cursorPosition = this.editor.getCursorPosition();
            const fold = this.findMultiLineFoldAtRow(cursorPosition.row);

            if (!fold || !this.isCursorInClassRange(cursorPosition, fold.range)) {
                this.updateFolds();
            }
        }, 1000);
    }

    findMultiLineFoldAtRow(row) {
        return Array.from(this.folds.values()).find(fold =>
            row >= fold.range.start.row && row <= fold.range.end.row
        );
    }

    isCursorInClassRange(cursor, range) {
        if (cursor.row < range.start.row || cursor.row > range.end.row) return false;
        if (cursor.row === range.start.row && cursor.column < range.start.column) return false;
        if (cursor.row === range.end.row && cursor.column > range.end.column) return false;
        return true;
    }

    getCurrentPattern() {
        const modeId = this.editor.session.getMode().$id;
        return (this.modes[modeId] || this.modes.default).pattern;
    }

    findClassAttributeRange(startRow) {
        const session = this.editor.session;
        const doc = session.getDocument();
        let foundRanges = [];
        let currentRow = startRow;
        const line = doc.getLine(currentRow);
        const pattern = this.getCurrentPattern();
        let lastIndex = 0;

        while (true) {
            const match = pattern.exec(line.slice(lastIndex));
            if (!match) break;

            const matchIndex = lastIndex + match.index;
            const classRange = this.findClassEnd(currentRow, matchIndex + match[0].length);
            if (classRange) {
                foundRanges.push(classRange);
            }
            lastIndex = matchIndex + match[0].length;
        }

        return foundRanges;
    }
    findClassEnd(startRow, startCol) {
        const session = this.editor.session;
        const doc = session.getDocument();
        let currentRow = startRow;
        let openQuote = null;
        const classStart = { row: startRow, column: startCol };

        const line = doc.getLine(startRow);
        const char = line[startCol - 1];

        if (char === '{') {
            openQuote = '}';
        } else if (char === '`') {
            openQuote = '`';
        } else if (char === '"' || char === "'") {
            openQuote = char;
        } else {
            return null;
        }

        while (currentRow < doc.getLength()) {
            const line = doc.getLine(currentRow);
            let closeIndex = -1;

            if (openQuote === '}') {
                let braceCount = 1;
                for (let i = currentRow === startRow ? startCol : 0; i < line.length; i++) {
                    if (line[i] === '{') braceCount++;
                    if (line[i] === '}') braceCount--;
                    if (braceCount === 0) {
                        closeIndex = i;
                        break;
                    }
                }
            } else {
                closeIndex = line.indexOf(openQuote, currentRow === startRow ? startCol : 0);
            }

            if (closeIndex !== -1) {
                return {
                    start: classStart,
                    end: { row: currentRow, column: closeIndex }
                };
            }

            currentRow++;
        }

        return null;
    }
    parseTailwindClasses(range) {
        const session = this.editor.session;
        const doc = session.getDocument();
        let classes = [];

        for (let row = range.start.row; row <= range.end.row; row++) {
            const line = doc.getLine(row);
            let content;

            if (row === range.start.row && row === range.end.row) {
                content = line.substring(range.start.column, range.end.column);
            } else if (row === range.start.row) {
                content = line.substring(range.start.column);
            } else if (row === range.end.row) {
                content = line.substring(0, range.end.column);
            } else {
                content = line;
            }

            const lineClasses = content.trim().split(/\s+/).filter(Boolean);
            classes.push(...lineClasses);
        }

        return classes;
    }

    createFold(classRange, classes) {
        return {
            range: new Range(
                classRange.start.row,
                classRange.start.column,
                classRange.end.row,
                classRange.end.column
            ),
            placeholder: this.options.placeholder,
            classes
        };
    }

    updateFolds(discoverOnly = false) {
        const session = this.editor.session;
        const doc = session.getDocument();
        const currentFolds = new Map();
        const cursorPosition = this.editor.getCursorPosition();

        for (let row = 0; row < doc.getLength(); row++) {
            const ranges = this.findClassAttributeRange(row);

            for (const classRange of ranges) {
                const classes = this.parseTailwindClasses(classRange);

                if (classes.length >= this.options.minClasses) {
                    if (!this.isCursorInClassRange(cursorPosition, classRange)) {
                        const fold = this.createFold(classRange, classes);
                        if (fold) {
                            currentFolds.set(`${row}-${classRange.start.column}`, fold);
                            this.allFolds.add(`${row}-${classRange.start.column}`);
                        }
                    }
                }
            }
        }

        this.folds = currentFolds;
        if (!discoverOnly) {
            this.applyFolds();
        }
    }

    applyFolds() {
        const session = this.editor.session;

        session.getAllFolds()
            .filter(fold => fold.placeholder === this.options.placeholder)
            .forEach(fold => session.removeFold(fold));

        this.folds.forEach(fold => {
            session.addFold(fold.placeholder, fold.range);
        });
    }

    toggleAllFolds() {
        const session = this.editor.session;
        // Check if all discovered positions are currently folded
        const allFolded = Array.from(this.allFolds).every(pos => {
            const [row, col] = pos.split('-').map(Number);
            return session.getFoldAt(row, col);
        });

        if (allFolded) {
            this.expandAll();
        } else {
            this.updateFolds();
        }
    }

    collapseAll() {
        this.updateFolds();
    }

    expandAll() {
        const session = this.editor.session;
        session.unfold();
    }

    /**
    * Sets new configuration options and updates the behavior accordingly.
    * @param {Object} newOptions - New configuration options
    */
    setOptions(newOptions = {}) {
        // Merge new options with the existing ones
        this.options = { ...this.options, ...newOptions };

        // Update attributes list
        this.options.attributes = [
            ...this.defaultAttributes,
            ...this.options.attributes
        ];

        if (newOptions.modes) {
            this.modes = { ...this.modes, ...newOptions.modes };
        }

        if (this.options.autoFold) {
            this.updateFolds(true);
            this.applyFolds();
        }
    }

    /**
    * Cleans up all resources, removes event listeners, and resets state.
    */
    destroy() {
        // Remove change and cursor listeners
        if (this.options.autoFold) {
            this.editor.off('change', this.updateFolds);
            this.editor.session.selection.off('changeCursor', this.handleCursorChange);
        }

        // Remove the command added to the editor
        this.editor.commands.removeCommand('toggleTailwindFold');

        // Remove all folds created by this handler
        const session = this.editor.session;
        session.getAllFolds()
            .filter(fold => fold.placeholder === this.options.placeholder)
            .forEach(fold => session.removeFold(fold));

        // Clear any stored state
        this.folds.clear();
        this.allFolds.clear();

        // Clear any remaining timeouts
        if (this.autoFoldTimeout) {
            clearTimeout(this.autoFoldTimeout);
            this.autoFoldTimeout = null;
        }

        // Nullify the editor reference for cleanup
        this.editor = null;
    }

}

// Make it globally available
window.TailwindFoldHandler = TailwindFoldHandler;

// Register as an Ace extension
ace.define('ace/ext/tailwind-fold', ['require', 'exports', 'module'], function (require, exports, module) {
    exports.TailwindFoldHandler = TailwindFoldHandler;
});