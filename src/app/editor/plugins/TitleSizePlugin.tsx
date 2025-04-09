import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCallback, useEffect } from "react";

function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function TitleSizePlugin() {
  const [editor] = useLexicalComposerContext();

  const updateTitleSize = useCallback(() => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    // Create a temporary element to measure text height with H2 font size
    const measureElement = document.createElement('div');
    measureElement.style.position = 'absolute';
    measureElement.style.visibility = 'hidden';
    measureElement.style.fontSize = 'var(--font-size-h2)';
    measureElement.style.width = editorElement.offsetWidth + 'px';
    measureElement.style.lineHeight = getComputedStyle(editorElement).lineHeight;
    measureElement.textContent = editorElement.textContent || '';
    document.body.appendChild(measureElement);

    // Calculate lines using the H2 font size
    const lineHeight = parseInt(getComputedStyle(measureElement).lineHeight);
    const titleHeight = measureElement.scrollHeight;
    const numberOfLines = Math.round(titleHeight / lineHeight);

    // Clean up measurement element
    document.body.removeChild(measureElement);

    // Find the closest h1 parent element
    let currentElement: HTMLElement | null = editorElement;
    while (currentElement && currentElement.tagName !== 'H1') {
      currentElement = currentElement.parentElement;
    }

    if (!currentElement) return;

    if (numberOfLines > 6) {
      currentElement.classList.add('long-title');
    } else {
      currentElement.classList.remove('long-title');
    }
  }, [editor]);

  useEffect(() => {
    const debouncedUpdate = debounce(updateTitleSize, 250);

    // Update on changes
    return editor.registerUpdateListener(() => {
      debouncedUpdate();
    });
  }, [editor, updateTitleSize]);

  return null;
} 