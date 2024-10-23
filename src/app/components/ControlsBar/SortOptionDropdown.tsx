import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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
}: {
  sortOption: SortOption;
  updateSortOption: (partialSortOption: Partial<SortOption>) => void;
}) => {
  return (
    <div className={styles.SortOptionDropdown}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="default">
            {sortOption.mode !== "manual" ? (
              sortOption.direction === "asc" ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              )
            ) : (
              <ArrowUpDown size={14} />
            )}
            Sort By
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <Button
              size="sm"
              variant={sortOption.mode === "createdAt" ? "active" : "ghost"}
              onClick={(event) => {
                event.preventDefault();
                updateSortOption({ mode: "createdAt" });
              }}
            >
              Creation Date
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Button
              size="sm"
              variant={sortOption.mode === "updatedAt" ? "active" : "ghost"}
              onClick={(event) => {
                event.preventDefault();
                updateSortOption({ mode: "updatedAt" });
              }}
            >
              Update Date
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Button
              size="sm"
              variant={sortOption.mode === "manual" ? "active" : "ghost"}
              onClick={(event) => {
                event.preventDefault();
                updateSortOption({ mode: "manual" });
              }}
            >
              Manual
            </Button>
          </DropdownMenuItem>
          {sortOption.mode !== "manual" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Button
                  size="sm"
                  variant={sortOption.direction === "asc" ? "active" : "ghost"}
                  onClick={(event) => {
                    event.preventDefault();
                    updateSortOption({ direction: "asc" });
                  }}
                >
                  <ArrowUp size={14} />
                  Oldest
                </Button>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Button
                  size="sm"
                  variant={sortOption.direction === "desc" ? "active" : "ghost"}
                  onClick={(event) => {
                    event.preventDefault();
                    updateSortOption({ direction: "desc" });
                  }}
                >
                  <ArrowDown size={14} />
                  Newest
                </Button>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
