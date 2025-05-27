import { ArrowDown10, ArrowUp01, ArrowUpDown, FolderEdit, FolderSync, Hand, SortAsc } from "lucide-react";

import { Button } from "@/app/components/UIPrimitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { SortOption } from "@/app/tree/Tree";

import styles from "./ControlsBar.module.css";

export const SortOptionDropdown = ({
  sortOption,
  updateSortOption,
  isMobileSize,
}: {
  sortOption: SortOption;
  updateSortOption: (partialSortOption: Partial<SortOption>) => void;
  isMobileSize?: boolean;
}) => (
  <div className={styles.SortOptionDropdown}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={isMobileSize ? "icon" : "sm"} variant={sortOption.mode !== "manual" ? "active" : "default"}>
          <ArrowUpDown size={14} />
          <span className={styles.HideOnMobile}>Sort by</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4}>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            updateSortOption({ mode: "alphabetical" });
          }}
          data-highlighted={sortOption.mode === "alphabetical" || undefined}
        >
          <SortAsc size={14} />
          <span>Alphabetical</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            updateSortOption({ mode: "createdAt" });
          }}
          data-highlighted={sortOption.mode === "createdAt" || undefined}
        >
          <FolderEdit size={14} />
          <span>Created time</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            updateSortOption({ mode: "updatedAt" });
          }}
          data-highlighted={sortOption.mode === "updatedAt" || undefined}
        >
          <FolderSync size={14} />
          <span>Updated time</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            updateSortOption({ mode: "manual" });
          }}
          data-highlighted={sortOption.mode === "manual" || undefined}
        >
          <Hand size={14} />
          <span>Manual ordering</span>
        </DropdownMenuItem>

        {sortOption.mode !== "manual" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                updateSortOption({ direction: "asc" });
              }}
              data-highlighted={sortOption.direction === "asc" || undefined}
            >
              <ArrowUp01 size={14} />
              <span>{sortOption.mode === "alphabetical" ? "A to Z" : "Oldest first"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                updateSortOption({ direction: "desc" });
              }}
              data-highlighted={sortOption.direction === "desc" || undefined}
            >
              <ArrowDown10 size={14} />
              <span>{sortOption.mode === "alphabetical" ? "Z to A" : "Newest first"}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
