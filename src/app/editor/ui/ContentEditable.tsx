import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";

interface Props {
  nodeId: string;
  bulletId?: string;
}

export const ContentEditable = ({ nodeId }: Props) => {
  return <LexicalContentEditable className="outline-none" style={{ maxWidth: "720px" }} data-nodeid={nodeId} />;
};
