import React from "react";
import { observer } from "mobx-react-lite";
import { XIcon } from "lucide-react";

import { useViewStore } from "@/app/view/useViewStore";

import s from "./ImageViewer.module.css";
const ImageViewer = observer(function ImageViewer() {
  const viewStore = useViewStore();

  const srcForImageViewer = viewStore.srcForImageViewer;

  if (!srcForImageViewer) {
    return <></>;
  }

  return (
    <div className={s.Container}>
      <div className={s.Header}>
        <div className={s.Close}>
          <XIcon onClick={() => viewStore.setSrcForImageViewer(null)} />
        </div>
      </div>
      <div className={s.Body}>
        <img src={srcForImageViewer} />
      </div>
    </div>
  );
});

export default ImageViewer;
