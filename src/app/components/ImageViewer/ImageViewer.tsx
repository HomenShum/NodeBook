import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { XIcon } from "lucide-react";

import { useViewStore } from "@/app/view/useViewStore";

import s from "./ImageViewer.module.css";
const ImageViewer = observer(function ImageViewer() {
  const viewStore = useViewStore();
  const imageRef = useRef<HTMLImageElement>(null);

  const srcForImageViewer = viewStore.srcForImageViewer;

  useEffect(() => {
    if (!srcForImageViewer) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        viewStore.setSrcForImageViewer(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [viewStore, srcForImageViewer]);

  if (!srcForImageViewer) {
    return <></>;
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target !== imageRef.current) {
      viewStore.setSrcForImageViewer(null);
    }
  };

  return (
    <div className={s.Container} onClick={handleContainerClick}>
      <div className={s.Header}>
        <div className={s.Close}>
          <XIcon onClick={() => viewStore.setSrcForImageViewer(null)} />
        </div>
      </div>
      <div className={s.Body}>
        <img ref={imageRef} src={srcForImageViewer} alt="" />
      </div>
    </div>
  );
});

export default ImageViewer;
