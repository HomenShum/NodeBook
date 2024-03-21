"use client";

import { Check } from "lucide-react";
import * as React from "react";

import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/lib/utils";
import { observer } from "mobx-react-lite";
import { GraphRelationType } from "../model/GraphRelation";
import { Bullet } from "../model/OutlineBullet";
import { useGraphStore } from "../store/graph";

const relToKey = (relationType: GraphRelationType, isForward: boolean) =>
  `${relationType.id}-${isForward ? "forward" : "reverse"}`;

export const RelationCombobox = observer(({ bullet }: { bullet: Bullet }) => {
  const graphStore = useGraphStore();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState(
    `${bullet.graphRelation?.type.id}-${bullet.isRelationToThis() ? "forward" : "reverse"}`,
  );
  const graphNode = bullet.graphNode;

  // list of relation types, only forward and backward
  const items = graphStore.relationTypes
    .map((relationType) => [
      {
        key: `${relationType.id}-forward`,
        label: relationType.label,
        onSelect: () => {
          if (relationType.id === bullet.graphRelation?.type.id) {
            if (bullet.isRelationToThis()) {
              return; // already selected
            } else {
              graphStore.reverseRelation(bullet.graphRelation!);
            }
          } else {
            graphStore.updateRelationsType(bullet.graphRelation!, relationType);
            if (!bullet.isRelationToThis()) {
              graphStore.reverseRelation(bullet.graphRelation!);
            }
          }
        },
      },
      {
        key: `${relationType.id}-reverse`,
        label: relationType.reverseLabel,
        onSelect: () => {
          if (relationType.id === bullet.graphRelation?.type.id) {
            if (bullet.isRelationToThis()) {
              graphStore.reverseRelation(bullet.graphRelation!);
            } else {
              return; // already selected
            }
          } else {
            graphStore.updateRelationsType(bullet.graphRelation!, relationType);
            if (bullet.isRelationToThis()) {
              graphStore.reverseRelation(bullet.graphRelation!);
            }
          }
        },
      },
    ])
    .flat()
    .filter(({ label }) => label.toLowerCase().includes(search.toLowerCase()));
  if (search.length > 0) {
    items.push({
      key: "new",
      label: `Create "${search}" relation type`,
      onSelect: () => {
        const relationType = graphStore.createRelationType({
          id: search,
          label: search,
          reverseLabel: `is ${search} of`,
        });
        graphStore.deleteRelation(bullet.graphRelation!);
        const rel = graphStore.createRelation({
          from: bullet.parent!.graphNode,
          to: graphNode,
          type: relationType,
        });
        bullet.setRelation(rel);
      },
    });
  }

  const type = bullet.graphRelation?.type;
  const label = bullet.isRelationToThis() ? type?.label : type?.reverseLabel;

  // If the bullet is a child, we don't want to show the relation type combobox
  if (type === graphStore.relationTypesById.child && bullet.isRelationToThis()) {
    return null;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between p-1 m-0 h-5 text-black border-black"
        >
          {label}:
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            const index = items.findIndex(({ key }) => key === selected);
            setSelected(items[(index + 1) % items.length].key);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const index = items.findIndex(({ key }) => key === selected);
            setSelected(items[(index - 1 + items.length) % items.length].key);
          } else if (e.key === "Enter") {
            const item = items.find(({ key }) => key === selected);
            if (item) {
              item.onSelect();
              setOpen(false);
            }
          }
        }}
      >
        <input
          placeholder="Search relation types..."
          className="flex items-center border-b px-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div>
          {items.map(({ key, label, onSelect }) => (
            <div
              key={key}
              className={cn("flex items-center p-2", selected === key ? "bg-gray-200" : "")}
              onMouseEnter={() => setSelected(key)}
              onClick={() => {
                onSelect();
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  relToKey(bullet.graphRelation?.type!, bullet.isRelationToThis()) === key
                    ? "opacity-100"
                    : "opacity-0",
                )}
              />
              <div>{label}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});
