import { observer } from "mobx-react-lite";

import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import styles from "@/app/components/dev/DevTools.module.css";
import hotkeyStyles from "@/app/components/HelpModal/HelpModal.module.css";
import { modKeyName, optionKeyName } from "@/app/hotkeys";
import { useViewStore } from "@/app/view/useViewStore";

type HotkeyItem = {
  name: string;
  keys: string[];
  annotation?: string;
};

const list: HotkeyItem[] = [
  // Help
  { name: "Show Keyboard Shortcuts", keys: [`${modKeyName}`, "Shift", "/"] },

  // Movement
  { name: "Move Up", keys: ["↑"] },
  { name: "Move Down", keys: ["↓"] },
  { name: "Move Left", keys: ["←"] },
  { name: "Move Right", keys: ["→"] },
  { name: "Move Selection Head Up", keys: ["Shift", "↑"] },
  { name: "Move Selection Head Down", keys: ["Shift", "↓"] },
  { name: "Move Selected Nodes Up", keys: [`${modKeyName}`, "Shift", "↑"] },
  { name: "Move Selected Nodes Down", keys: [`${modKeyName}`, "Shift", "↓"] },

  // Selection and Structure
  { name: "Delete Selection", keys: ["Delete/Backspace"] },
  { name: "Indent Selection", keys: ["Tab"] },
  { name: "Dedent Selection", keys: ["Shift", "Tab"] },
  { name: "Escape Selection", keys: ["Esc"] },
  { name: "Select All Nodes", keys: [`${modKeyName}`, "A"], annotation: "(twice)" },
  { name: "Save Expansion State", keys: [`${modKeyName}`, "S"] },

  // Zoom and Navigation
  { name: "Zoom In", keys: [`${modKeyName}`, "."] },
  { name: "Zoom Out", keys: [`${modKeyName}`, ","] },
  { name: "Expand at Selection", keys: [`${modKeyName}`, "↓"] },
  { name: "Collapse at Selection", keys: [`${modKeyName}`, "↑"] },
  { name: "Go to Home (in Notes View)", keys: [`${modKeyName}`, "Shift", "H"] },

  // Copy and Editing
  { name: "Copy", keys: [`${modKeyName}`, "C"] },
  { name: "Undo", keys: [`${modKeyName}`, "Z"] },
  { name: "Redo", keys: [`${modKeyName}`, "Shift", "Z"] },
  { name: "Paste as Plain Text", keys: [`${modKeyName}`, "Shift", "V"] },

  // Formatting
  { name: "Toggle Bold", keys: [`${modKeyName}`, "B"] },
  { name: "Toggle Italic", keys: [`${modKeyName}`, "I"] },
  { name: "Toggle Underline", keys: [`${modKeyName}`, "U"] },
  { name: "Toggle Code", keys: [`${modKeyName}`, "E"] },
  { name: "Add Todo Checkbox", keys: ["[", "]"], annotation: "(at the start of the line)" },
  { name: "Toggle Todo Status", keys: [`${modKeyName}`, "Shift", "Y"] },

  // Interface and Search
  { name: "Open Command Bar", keys: [`${modKeyName}`, "Shift", "K"] },
  { name: "Create Node/Child", keys: [`${modKeyName}`, "K"] },
  { name: "Open Quick Capture", keys: [`${modKeyName}`, `${optionKeyName}`, "K"] },
  { name: "Focus Search", keys: [`${modKeyName}`, "/"] },
  { name: "Open Search and Replace Dropdown", keys: [`${modKeyName}`, ";"] },

  // Sidebars
  { name: "Toggle Left Sidebar", keys: [`${modKeyName}`, "Shift", "B"] },
  { name: "Open Right Side Panel", keys: [`${modKeyName}`, `${optionKeyName}`, "S"] },

  // AI Features
  { name: "Contextual Generation", keys: [`${modKeyName}`, "Shift", "G"] },
];

export const HelpModal = observer(function HelpModal() {
  const viewStore = useViewStore();

  if (viewStore.activeModal !== "help") {
    return <></>;
  }

  return (
    <DataDialog title="" description="" modalType="help">
      <div className={styles.SettingsGroup}>
        <h1 style={{ paddingLeft: "6px" }}>Keyboard Shortcuts</h1>
        <div>
          {list.map((item) => (
            <HotKeyItem key={item.name} name={item.name} keys={item.keys} annotation={item.annotation} />
          ))}
        </div>
      </div>
    </DataDialog>
  );
});

function HotKeyItem({ name, keys, annotation }: HotkeyItem) {
  return (
    <div className={hotkeyStyles.HotkeyItem}>
      <div>{name}</div>
      <div className={hotkeyStyles.HotkeyItemKeys}>
        {keys.map((key, index) => {
          return (
            <>
              {index > 0 ? <span>+</span> : <></>}
              <kbd className={hotkeyStyles.kbd} key={key}>
                {key}
              </kbd>
            </>
          );
        })}
        {annotation && <span style={{ marginLeft: "4px", fontSize: "var(--font-size-sm)" }}>{annotation}</span>}
      </div>
    </div>
  );
}
