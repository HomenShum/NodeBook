"use client";

import { Check } from "lucide-react";
import * as React from "react";

import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { cn } from "@/lib/utils";
import { observer } from "mobx-react-lite";
import { GraphRelationType } from "../../model/GraphRelation";
import { useGraphStore } from "../../store/useGraphStore";
import { useRelationAtPath } from "./RelatedNodeContext";

const relToKey = (relationType: GraphRelationType, isForward: boolean) =>
  `${relationType.id}-${isForward ? "forward" : "reverse"}`;

export const RelationCombobox = observer(
  ({ setUpdatingRelationType }: { setUpdatingRelationType: (updating: boolean) => void }) => {
    const graphStore = useGraphStore();

    const { node, parent, relation } = useRelationAtPath();
    const isForward = relation.to.id === node.id;

    const [isOpen, setIsOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [selected, setSelected] = React.useState(`${relation.type.id}-${isForward ? "forward" : "reverse"}`);
    const open = () => {
      setIsOpen(true);
    };
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
            if (relationType.id === relation.type.id) {
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
            if (relationType.id === relation?.type.id) {
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
            reverseLabel: `is ${search} of`,
          });
          relation.setType(relationType);
        },
      });
    }

    const label = isForward ? relation.type.label : relation.type.reverseLabel;
    const isParent = relation.type.id === defaultRelationTypes.child.id && isForward;

    return (
      <Popover
        open={isOpen}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            open();
          } else {
            close();
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={`border-none text-md justify-between h-4 p-0 m-0 font-normal text-gray-400 ${
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
                  close();
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    relToKey(relation.type, isForward) === key ? "opacity-100" : "opacity-0",
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
