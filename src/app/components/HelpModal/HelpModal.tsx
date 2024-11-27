import React from "react";
import { observer } from "mobx-react-lite";
import { toKeyName,} from "is-hotkey";

import { useViewStore } from "@/app/view/useViewStore";
import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import styles from "@/app/components/dev/DevTools.module.css";
import hotkeyStyles from "@/app/components/HelpModal/HelpModal.module.css"


type HotkeyItem = {
  name: string,
  keys: string[]
}

const modKey = toKeyName('mod') === "control" ? "Ctrl" : "⌘";

const list: HotkeyItem[] = [
  { name: "Move Up", keys: ["↑"] },
  { name: "Move Down", keys: ["↓"] },
  { name: "Move Left", keys: ["←"] },
  { name: "Move Right", keys: ["→"] },
  { name: "Move Selection Head Up", keys: ["Shift", "↑"] },
  { name: "Move Selection Head Down", keys: ["Shift", "↓"] },
  { name: "Move Selected Nodes Up", keys: [`${modKey}`, "Shift", "↑"] },
  { name: "Move Selected Nodes Down", keys: [`${modKey}`, "Shift", "↓"] },
  { name: "Delete Selection", keys: ["Delete/Backspace"] },
  { name: "Indent Selection", keys: ["Tab"] },
  { name: "Dedent Selection", keys: ["Shift", "Tab"] },
  { name: "Escape Selection", keys: ["Esc"] },
  { name: "Zoom In", keys: [`${modKey}`, "."] },
  { name: "Zoom Out", keys: [`${modKey}`, ","] },
  { name: "Copy", keys: [`${modKey}`, "C"] },
  { name: "Expand at Selection", keys: [`${modKey}`, "↓"] },
  { name: "Collapse at Selection", keys: [`${modKey}`, "↑"] },
  {name: "Open Command Bar", keys: [`${modKey}`,"Shift","K"]}
];

export const HelpModal = observer(function HelpModal() {

  const viewStore = useViewStore();

  if(viewStore.activeModal !== "help"){
    return <></>
  }

  return (
    <DataDialog title="" description="" modalType="help">
      <div className={styles.SettingsGroup}>
        <h1>Hotkey List</h1>
        <div>
          {
            list.map((item) => <HotKeyItem key={item.name} name={item.name} keys={item.keys}/>)
          }
        </div>
      </div>
    </DataDialog>
  );
});

function HotKeyItem ({name, keys}: HotkeyItem)  {
  return <div className={hotkeyStyles.HotkeyItem}>
    <div>{name}</div>
    <div className={hotkeyStyles.HotkeyItemKeys}>{keys.map((key, index) => {
      return <>{index > 0 ? <span>+</span> : <></>}<kbd className={hotkeyStyles.kbd} key={key}>{key}</kbd></>
    })}</div>
  </div>
}