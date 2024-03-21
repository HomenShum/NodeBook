import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";

interface Props {
  nodeId: string;
  bulletId?: string;
}

export const ContentEditable = ({ nodeId, bulletId }: Props) => {
  return <LexicalContentEditable data-nodeid={nodeId} data-bulletid={bulletId} />;
};
