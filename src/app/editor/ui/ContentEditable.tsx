import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";

interface Props {
  nodeId: string;
  bulletId?: string;
}

export const ContentEditable = ({ nodeId, bulletId }: Props) => {
  return <LexicalContentEditable style={{ maxWidth: "400px" }} data-nodeid={nodeId} data-bulletid={bulletId} />;
};
