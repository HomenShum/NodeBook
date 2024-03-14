"use client";

import { Check } from "lucide-react";
import * as React from "react";

import { Button } from "@/app/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem } from "@/app/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/lib/utils";
import { Bullet } from "../model/OutlineBullet";
import { useGraphStore } from "../store/graph";

export function RelationCombobox({ bullet }: { bullet: Bullet }) {
  const graphStore = useGraphStore();
  const [open, setOpen] = React.useState(false);

  // list of relation types, only forward and backward
  const items = graphStore.relationTypes
    .map((relationType) => [
      { relationType, isForward: true },
      { relationType, isForward: false },
    ])
    .flat();

  const type = bullet.graphRelation?.type;
  const label = bullet.isRelationToThis() ? type?.label : type?.reverseLabel;
  const node = bullet.graphNode;
  const parent = bullet.parent?.graphNode;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between p-1 m-0 h-5 w-16 text-black border-black"
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search relation types..." />
          <CommandGroup>
            {items.map(({ relationType, isForward }) => (
              <CommandItem
                key={`${relationType.id}-${isForward}`}
                onSelect={() => {
                  if (bullet.isRelationToThis() === isForward) {
                    graphStore.updateRelationType(bullet.graphRelation!, relationType);
                  } else {
                    graphStore.deleteRelation(bullet.graphRelation!);
                    const rel = graphStore.createRelation({
                      from: isForward ? parent! : node,
                      to: isForward ? node : parent!,
                      type: relationType,
                    });
                    bullet.setRelation(rel);
                  }
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    bullet.graphRelation?.type.id === relationType.id && isForward === bullet.isRelationToThis()
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />
                {isForward ? relationType.label : relationType.reverseLabel}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
