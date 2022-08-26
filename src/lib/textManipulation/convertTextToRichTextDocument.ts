import * as RTD from '@lib/types/RichTextDocument';
import { isValidUrl } from '@lib/url/isValidUrl';

export async function convertTextToRichTextDocument(text: string) {
  const parts = text
    .split('\n')
    .map((part) => part.trim())
    .filter((part) => !!part);

  return {
    attachments: [],
    content: parts.map((part) => ({
      t: RTD.BlockNodeType.Block,
      c: convertStringBlockToRTDBlock(part),
      s: RTD.BlockStyle.P,
    })),
  } as RTD.RichTextDocument;
}

export function convertStringBlockToRTDBlock(stringBlock: string) {
  const parts = stringBlock.split(' ');
  const nodes: (RTD.InlineNode | RTD.AnchorNode)[] = [];
  let contiguousStrings: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    if (isValidUrl(part, ['http', 'https'])) {
      if (contiguousStrings.length) {
        const text = contiguousStrings.join(' ') + ' ';
        nodes.push({
          t: RTD.InlineNodeType.Inline,
          c: text,
        });
        contiguousStrings = [];
      }

      nodes.push({
        t: RTD.InlineNodeType.Anchor,
        c: [
          {
            t: RTD.InlineNodeType.Inline,
            c: part,
          },
        ],
        u: part,
      });

      if (!isLast) {
        nodes.push({
          t: RTD.InlineNodeType.Inline,
          c: ' ',
        });
      }
    } else {
      contiguousStrings.push(part);
    }
  }

  if (contiguousStrings.length) {
    const text = contiguousStrings.join(' ');

    nodes.push({
      t: RTD.InlineNodeType.Inline,
      c: text,
    });
  }

  return nodes;
}
