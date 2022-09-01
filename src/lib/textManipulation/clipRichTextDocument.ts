import { AnchorNode, RichTextDocument, BlockNodeType, BlockNode, InlineNodeType, InlineNode } from "../types/RichTextDocument";

export function clipRichTextDocument(document: RichTextDocument, charLimit: number) {
  const clippedDocument: RichTextDocument = {
    attachments: [],
    content: [],
  };

  let budget = charLimit;
  let isClipped = false;
  let nodesSkipped = false;

  for (const block of document.content) {
    if (isClipped) {
      break;
    }

    if (block.t === BlockNodeType.Block) {
      const newBlock: BlockNode = { ...block, c: [] };

      for (const node of block.c) {
        if (isClipped) {
          break;
        }

        if (node.t === InlineNodeType.Anchor) {
          const newNode: AnchorNode = { ...node, c: [] };

          for (const i of node.c) {
            if (isClipped) {
              break;
            }

            const text = i.c;

            if (budget > text.length) {
              newNode.c.push(i);
              budget -= text.length;
            } else {
              const newInlineNode: InlineNode = {
                ...i,
                c: text.slice(0, budget),
              };
              budget = 0;
              isClipped = true;
              newNode.c.push(newInlineNode);
            }
          }

          newBlock.c.push(newNode);
        } else if (node.t === InlineNodeType.Inline) {
          const newNode: InlineNode = { ...node, c: '' };
          const text = node.c;

          if (budget > text.length) {
            newNode.c = text;
            budget -= text.length;
          } else {
            newNode.c = text.slice(0, budget);
            budget = 0;
            isClipped = true;
          }

          newBlock.c.push(newNode);
        }
      }

      clippedDocument.content.push(newBlock);
    } else {
      nodesSkipped = true;
    }
  }

  return {
    document: clippedDocument,
    isClipped: isClipped || nodesSkipped,
  }
}
