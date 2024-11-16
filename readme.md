# Tailwind Fold

Simplify your HTML with **Tailwind Fold**! This plugin enhances code readability by automatically folding long class attributes, reducing visual clutter in your code.(You can disable autoFold from settings)

> [!Note]
> Tailwind Fold collapses all class attributes, not just Tailwind-specific ones.

## Features

- Seamlessly integrates with various languages and templating engines.  
- Fully customizable to fit your needs.

## Folding/Unfolding with Shortcuts

Press `Alt-T` to fold or unfold all class attributes, or search for "toggleTailwindFold" in the command palette for quick access.

## Using Tailwind Fold in Ace Editor

1. Download the file `src/ace-tailwind-fold.js` from this repository.  
2. Include it in your HTML file as shown below:

   ```html
   <script src="ace-tailwind-fold.js"></script>
   ```

3. Initialize Tailwind Fold in your Ace editor:

   ```javascript
   // Ensure you have initialized Ace and passed its editor instance
   const foldHandler = new TailwindFoldHandler(editor);

   // To customize behavior, pass configuration options
   const foldHandler = new TailwindFoldHandler(editor, {
      minClasses: 4,                  // Minimum number of classes before folding
      autoFold: false,                // Disable automatic folding
      placeholder: '···',             // Placeholder for folded attributes
      attributes: ['custom-class'],   // Add custom attributes to fold
      modes: {
          // Custom mode settings
          'ace/mode/custom': {
              pattern: /(?:custom-attr)\s*=\s*["']/ // Custom pattern matching
          }
      }
   });
   ```  
4. Done 👍 