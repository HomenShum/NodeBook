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
    const measureElement = document.createElement("div");
    measureElement.style.position = "absolute";
    measureElement.style.visibility = "hidden";
    measureElement.style.fontSize = "var(--font-size-h2)";
    measureElement.style.width = editorElement.offsetWidth + "px";
    measureElement.style.lineHeight = getComputedStyle(editorElement).lineHeight;
    measureElement.textContent = editorElement.textContent || "";
    document.body.appendChild(measureElement);

    // Calculate lines using the H2 font size
    const lineHeight = parseInt(getComputedStyle(measureElement).lineHeight);
    const titleHeight = measureElement.scrollHeight;
    const numberOfLines = Math.round(titleHeight / lineHeight);

    // Clean up measurement element
    document.body.removeChild(measureElement);

    // Find the closest h1 parent element
    let currentElement: HTMLElement | null = editorElement;
    while (currentElement && currentElement.tagName !== "H1") {
      currentElement = currentElement.parentElement;
    }

    if (!currentElement) return;

    // Remove all existing title size classes
    currentElement.classList.remove("title-large", "title-medium", "title-small", "title-compact");

    // Apply gradual size reduction based on line count
    if (numberOfLines > 12) {
      // 12+ lines: most compact size (21px)
      currentElement.classList.add("title-compact");
    } else if (numberOfLines > 10) {
      // 11-12 lines: small size (22.25px)
      currentElement.classList.add("title-small");
    } else if (numberOfLines > 8) {
      // 9-10 lines: medium size (23.5px)
      currentElement.classList.add("title-medium");
    } else if (numberOfLines > 6) {
      // 7-8 lines: large size (24.75px)
      currentElement.classList.add("title-large");
    }
    // 1-6 lines: default h2 size (26px - no class needed)
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
