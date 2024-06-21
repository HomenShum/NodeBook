"use client";

import { Check } from "lucide-react";
import { observer } from "mobx-react-lite";
import * as React from "react";

import { Button } from "@/app/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/Popover";
import { GraphRelationType } from "@/app/graph/GraphRelation";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { DescendantTreeNode } from "@/app/view/Tree";
import { cn } from "@/lib/utils";

const relToKey = (relationType: GraphRelationType, isForward: boolean) =>
  `${relationType.id}-${isForward ? "forward" : "reverse"}`;

export const RelationCombobox = observer(
  ({
    setUpdatingRelationType,
    treeNode,
    isOpen,
    setIsOpen,
  }: {
    setUpdatingRelationType: (updating: boolean) => void;
    treeNode: DescendantTreeNode;
    isOpen: boolean;
    setIsOpen: (value: boolean) => void;
  }) => {
    const object = treeNode.object;
    const parent = treeNode.parent.object;
    const relation = treeNode.relationWithParent;
    const graphStore = useGraphStore();
    const isForward = relation.to.id === object.id;

    const [search, setSearch] = React.useState(relation.relationType.label);
    const [selected, setSelected] = React.useState(`${relation.relationType.id}-${isForward ? "forward" : "reverse"}`);

    const close = () => {
      setIsOpen(false);
      setUpdatingRelationType(false);
    };

    // list of relation types, only forward and backward
    const items = graphStore.relationTypes
      .map((relationType) => [
        {
          key: `${relationType.id}-forward`,
          label: relationType.label,
          onSelect: () => {
            if (relationType.id === relation.relationType.id) {
              if (isForward) {
                return; // already selected
              } else {
                graphStore.reverseRelation(relation);
              }
            } else {
              graphStore.updateRelationsType(relation, relationType);
              if (!isForward) {
                graphStore.reverseRelation(relation);
              }
            }
          },
        },
        {
          key: `${relationType.id}-reverse`,
          label: relationType.reverseLabel,
          onSelect: () => {
            if (relationType.id === relation?.relationType.id) {
              if (isForward) {
                graphStore.reverseRelation(relation!);
              } else {
                return; // already selected
              }
            } else {
              graphStore.updateRelationsType(relation!, relationType);
              if (isForward) {
                graphStore.reverseRelation(relation!);
              }
            }
          },
        },
      ])
      .flat()
      .filter(({ label }) => label.toLowerCase().includes(search.toLowerCase()));

    if (search.length > 0 && parent !== null) {
      items.push({
        key: "new",
        label: `Create "${search}" relation type`,
        onSelect: () => {
          const relationType = graphStore.createRelationType({
            id: search,
            label: search,
          });
          relation.setType(relationType);
        },
      });
    }

    items.push({
      key: "delete",
      label: "Delete relation",
      onSelect: () => {
        graphStore.deleteRelation(relation);
      },
    });

    const label = isForward ? relation.relationType.label : relation.relationType.reverseLabel;
    const isParent = relation.relationType.id === defaultRelationTypes.child.id && isForward;

    return (
      <Popover
        open={isOpen}
        onOpenChange={(newIsOpen) => {
          if (newIsOpen) {
            setIsOpen(true);
          } else {
            close();
          }
        }}
      >
        <PopoverTrigger className="z-10" asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={`border-none z-10 text-md justify-between h-4 p-0 m-0 font-normal text-gray-400 ${
              isParent ? "" : ""
            }`}
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
                close();
              }
            } else if (e.key === "Backspace" && search === "") {
              const targetKey = isForward ? "child" : "parent";
              const item = items.find(({ label }) => label === targetKey);
              if (item) {
                item.onSelect();
                close();
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
          <div className="overflow-y-scroll max-h-64">
            {items.map(({ key, label, onSelect }) => (
              <div
                key={key}
                className={cn("flex items-center p-2", selected === key ? "bg-gray-200" : "")}
                onMouseEnter={() => setSelected(key)}
                onClick={() => {
                  onSelect();
                  close();
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    relToKey(relation.relationType, isForward) === key ? "opacity-100" : "opacity-0",
                  )}
                />
                <div>{label}</div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);
