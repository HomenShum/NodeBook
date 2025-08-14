import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $patchStyleText } from "@lexical/selection";
import {
  $getSelection,
  $isRangeSelection
} from "lexical";
import {
  Type,
  Highlighter,
  Slash
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, MouseEvent } from "react";

import { cn } from "@/lib/utils";

import styles from "./ColorPickerPlugin.module.css";

// Color palettes matching Workflowy style
const TEXT_COLORS = [
  { name: 'Default', value: 'inherit', class: 'text-default' },
  { name: 'Red', value: '#dc2626', class: 'text-red' },
  { name: 'Orange', value: '#ea580c', class: 'text-orange' },
  { name: 'Yellow', value: '#ca8a04', class: 'text-yellow' },
  { name: 'Green', value: '#16a34a', class: 'text-green' },
  { name: 'Teal', value: '#0d9488', class: 'text-teal' },
  { name: 'Blue', value: '#2563eb', class: 'text-blue' },
  { name: 'Indigo', value: '#4f46e5', class: 'text-indigo' },
  { name: 'Purple', value: '#9333ea', class: 'text-purple' },
  { name: 'Pink', value: '#db2777', class: 'text-pink' },
  { name: 'Gray', value: '#6b7280', class: 'text-gray' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: 'transparent', class: 'highlight-none' },
  { name: 'Red', value: '#fecaca', class: 'highlight-red' },
  { name: 'Orange', value: '#fed7aa', class: 'highlight-orange' },
  { name: 'Yellow', value: '#fef08a', class: 'highlight-yellow' },
  { name: 'Green', value: '#bbf7d0', class: 'highlight-green' },
  { name: 'Teal', value: '#99f6e4', class: 'highlight-teal' },
  { name: 'Blue', value: '#bfdbfe', class: 'highlight-blue' },
  { name: 'Indigo', value: '#c7d2fe', class: 'highlight-indigo' },
  { name: 'Purple', value: '#ddd6fe', class: 'highlight-purple' },
  { name: 'Pink', value: '#fbcfe8', class: 'highlight-pink' },
  { name: 'Gray', value: '#e5e7eb', class: 'highlight-gray' },
];

interface ColorPickerProps {
  onClose?: () => void;
  position: { x: number; y: number } | null;
}

export function ColorPicker({ onClose, position }: ColorPickerProps) {
  const [editor] = useLexicalComposerContext();
  const [activeTab, setActiveTab] = useState<'text' | 'highlight'>('text');
  const [currentTextColor, setCurrentTextColor] = useState<string>('inherit');
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>('transparent');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Apply text color using Lexical's $patchStyleText
  const applyTextColor = useCallback((color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (selection) {
        // Use $patchStyleText which works with BaseSelection
        $patchStyleText(selection, {
          color: color === 'inherit' ? '' : color
        });
      }
    });
    
    setCurrentTextColor(color);
    // Don't close the picker - let user apply multiple colors
    editor.focus();
  }, [editor]);

  // Apply highlight color using Lexical's $patchStyleText
  const applyHighlightColor = useCallback((color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (selection) {
        // Apply background color to selected text
        $patchStyleText(selection, {
          'background-color': color === 'transparent' ? '' : color
        });
      }
    });
    
    setCurrentHighlightColor(color);
    // Don't close the picker - let user apply multiple colors
    editor.focus();
  }, [editor]);

  // Handle color click
  const handleColorClick = useCallback((e: MouseEvent, color: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (activeTab === 'text') {
      applyTextColor(color);
    } else {
      applyHighlightColor(color);
    }
    
    // Don't close immediately - let user apply multiple colors
    // onClose?.();
  }, [activeTab, applyTextColor, applyHighlightColor]);

  if (!position) return null;

  const colors = activeTab === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const currentColor = activeTab === 'text' ? currentTextColor : currentHighlightColor;

  return (
    <div
      ref={pickerRef}
      className={styles.ColorPicker}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Tab Header */}
      <div className={styles.TabHeader}>
        <button
          className={cn(styles.Tab, { [styles.active]: activeTab === 'text' })}
          onClick={() => setActiveTab('text')}
          title="Text Color"
        >
          <Type size={14} />
          <span>Text</span>
        </button>
        <button
          className={cn(styles.Tab, { [styles.active]: activeTab === 'highlight' })}
          onClick={() => setActiveTab('highlight')}
          title="Highlight Color"
        >
          <Highlighter size={14} />
          <span>Highlight</span>
        </button>
      </div>

      {/* Color Grid */}
      <div className={styles.ColorGrid}>
        {colors.map((color) => (
          <button
            key={color.name}
            className={cn(styles.ColorButton, {
              [styles.active]: currentColor === color.value,
              [styles.transparent]: color.value === 'transparent',
              [styles.inherit]: color.value === 'inherit',
            })}
            style={{
              backgroundColor: color.value === 'inherit' ? 'transparent' : 
                             color.value === 'transparent' ? 'transparent' : color.value,
              color: activeTab === 'text' ? color.value : 'inherit',
              border: color.value === 'transparent' || color.value === 'inherit' ? 
                     '1px solid var(--gray-6)' : 'none',
            }}
            onClick={(e) => handleColorClick(e, color.value)}
            title={color.name}
          >
            {(color.value === 'transparent' || color.value === 'inherit') ? (
              <Slash size={16} strokeWidth={2} style={{ color: 'var(--gray-9)' }} />
            ) : (
              <span className={styles.ColorPreview}>A</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}