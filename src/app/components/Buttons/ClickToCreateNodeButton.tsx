import { Dot } from "lucide-react";
import { observer } from "mobx-react-lite";
import React from "react";

import styles from "@/app/components/RelatedObject/styles/RelatedObjectView.module.css";
import { cn } from "@/lib/utils";
interface Props {
  onClick: (e: React.MouseEvent) => void;
}

export const ClickToCreateNodeButton = observer(function ClickToCreateNodeButton({ onClick }: Props) {
  return (
    <div className={cn(styles.RelatedObjectContainer)} onClick={onClick}>
      <div className={styles.RelatedObjectContent}>
        <div className={cn(styles.RelatedObjectBulletContainer)}>
          <Dot strokeWidth={5} height={16} className={cn(styles.Bullet, styles.DotInsideClickToCreateNode)} />
        </div>
        <div className={cn(styles.RelatedObjectNode)}>
          <div className={styles.ClickToCreateNode}>Start Writing...</div>
        </div>
      </div>
    </div>
  );
});
