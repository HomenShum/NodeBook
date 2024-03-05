import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";

interface Props {
  nodeId: string;
}

export const ContentEditable = ({ nodeId }: Props) => {
  return <LexicalContentEditable data-nodeid={nodeId} />;
};
