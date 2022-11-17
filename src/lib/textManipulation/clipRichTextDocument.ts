import {
  AnchorNode,
  AttachmentType,
  RichTextDocument,
  BlockNodeType,
  BlockNode,
  InlineNodeType,
  InlineNode,
  PublicKeyNode,
} from "../types/RichTextDocument";

export function clipRichTextDocument(
  document: RichTextDocument,
  charLimit: number,
  attachmentLimit: number,
) {
  const clippedDocument: RichTextDocument = {
    attachments: [],
    content: [],
  };

  const maxParagraphs = Math.ceil(charLimit / 100);
  let budget = charLimit;
  let clippedIndex = 0;
  let isClipped = false;
  let nodesSkipped = false;

  for (let index = 0; index < document.content.length; index++) {
    const block = document.content[index];

    if (isClipped) {
      break;
    }

    if (index > maxParagraphs) {
      isClipped = true;
      clippedIndex = index;
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
              const newInlineNode: InlineNode | PublicKeyNode = {
                ...i,
                c: text.slice(0, budget),
              };
              budget = 0;
              isClipped = true;
              clippedIndex = index;
              newNode.c.push(newInlineNode);
            }
          }

          newBlock.c.push(newNode);
        } else if (
          node.t === InlineNodeType.Inline ||
          node.t === InlineNodeType.PublicKey
        ) {
          const newNode = { ...node, c: '' };
          const text = node.c;

          if (budget > text.length) {
            newNode.c = text;
            budget -= text.length;
          } else {
            newNode.c = text.slice(0, budget);
            budget = 0;
            isClipped = true;
            clippedIndex = index;
          }

          newBlock.c.push(newNode);
        }
      }

      clippedDocument.content.push(newBlock);
    } else if (block.t === BlockNodeType.TwitterEmbed) {
      if (clippedDocument.attachments.length < attachmentLimit && (
        !isClipped || (index === clippedIndex + 1)
      )) {
        clippedDocument.attachments.push({
          t: AttachmentType.TwitterEmbed,
          c: block.c,
        });
      } else {
        nodesSkipped = true;
      }
    } else {
      nodesSkipped = true;
    }
  }

  return {
    document: clippedDocument,
    isClipped: isClipped || nodesSkipped,
  }
}
