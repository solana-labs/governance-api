import { parse } from 'url';

import { convertStringBlockToRTDBlock } from '@lib/textManipulation/convertTextToRichTextDocument';
import { fetchTwitterEmbed } from '@lib/textManipulation/fetchTwitterEmbed';
import {
  AnchorNode,
  BlockNodeType,
  BlockNode,
  InlineNode,
  InlineNodeType,
  PublicKeyNode,
  RichTextDocument,
} from "@lib/types/RichTextDocument";

interface Props {
  twitterBearerToken: string;
}

export async function enhanceRichTextDocument(document: RichTextDocument, props: Props): Promise<RichTextDocument> {
  const blocks: RichTextDocument['content'] = [];

  for (const block of document.content) {
    // There aren't any enhancements to be done on an image
    if (block.t === BlockNodeType.Image) {
      blocks.push(block);
    }
    // In the case of a block node, look for text that we can evelate
    else if (block.t === BlockNodeType.Block) {
      const children: BlockNode['c'] = [];
      const extraBlocks: RichTextDocument['content'] = [];

      for (const child of block.c) {
        // In the case of plain text, scan the text for links, public keys, etc
        if (child.t === InlineNodeType.Inline) {
          const convertedChildren = await convertStringBlockToRTDBlock(child.c);
          const newChildren: (AnchorNode | InlineNode | PublicKeyNode)[] = []

          for (const newChild of convertedChildren) {
            // If any of the plain text got enhanced into an Anchor node, see
            // if those anchor nodes represent an embed
            if (newChild.t === InlineNodeType.Anchor) {
              const { node, additionalBlocks } = await enhanceAnchorNodes({
                ...newChild,
                c: newChild.c.map(c => ({
                  ...c,
                  s: c.s || child.s,
                })),
              }, props);

              extraBlocks.push(...additionalBlocks);
              newChildren.push(node);
            } else {
              newChildren.push({
                ...newChild,
                s: child.s,
              });
            }
          }

          children.push(...newChildren);
        }
        // Check if any of the anchor nodes represent an embed
        else if (child.t === InlineNodeType.Anchor) {
          const { node, additionalBlocks } = await enhanceAnchorNodes(child, props);
          children.push(node);
          extraBlocks.push(...additionalBlocks);
        } else {
          children.push(child);
        }
      }

      const newBlock: BlockNode = {
        t: BlockNodeType.Block,
        c: children,
        s: block.s,
      }

      blocks.push(newBlock);
      blocks.push(...extraBlocks);
    }
  }

  return {
    attachments: document.attachments,
    content: blocks,
  }
}

export async function enhanceAnchorNodes(node: AnchorNode, props: Props) {
  const newNode = { ...node };
  const additionalBlocks: RichTextDocument['content'] = [];
  const urlParts = parse(node.u);

  if (node.c.length === 1 && node.c[0].c === node.u) {
    newNode.c = [{
      t: InlineNodeType.Inline,
      c: (urlParts.host || 'link') + (
        urlParts.path ? urlParts.path.slice(0, 4) + "…" : ''
      )
    }];
  }

  if (urlParts.host?.includes('twitter')) {
    try {
      const embed = await fetchTwitterEmbed(node.u, props.twitterBearerToken);
      additionalBlocks.push(embed);
    } catch (e) {
      console.log(e);
    }
  }

  return {
    node: newNode,
    additionalBlocks,
  }
}
