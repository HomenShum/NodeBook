export type GraphRelationType = {
  version: number;
  id: string;
  authorId: string;
  label: string; // e.g. author
  reverseLabel: string; // e.g. authored by
  isPublic: boolean;
};
