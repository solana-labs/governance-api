import { parse } from 'url';

import { buildPublicKeyEmbed } from '@lib/textManipulation/buildPublicKeyEmbed';
import * as RTD from '@lib/types/RichTextDocument';
import { isValidUrl } from '@lib/url/isValidUrl';

/**
 * Takes plain text (not markdown) and attempts to convert it into a
 * RichTextDocument.
 */
export async function convertTextToRichTextDocument(text: string) {
  // Line breaks are interpreted as new paragraphs
  const parts = text
    .split('\n')
    .map((part) => part.trim())
    .filter((part) => !!part);

  return {
    attachments: [],
    content: await Promise.all(parts.map(async (part) => ({
      t: RTD.BlockNodeType.Block,
      c: await convertStringBlockToRTDBlock(part),
      s: RTD.BlockStyle.P,
    }))),
  } as RTD.RichTextDocument;
}

export async function convertStringBlockToRTDBlock(stringBlock: string) {
  // We're going to do some light formatting. We're going to extract valid urls
  // and convert those. The remaining text will be treated as plain text.
  const parts = stringBlock.split(' ');
  const nodes: (RTD.InlineNode | RTD.AnchorNode | RTD.PublicKeyNode)[] = [];
  let contiguousStrings: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    // See if we have a Public Key
    const publicKey = buildPublicKeyEmbed(part);

    // Check if we're dealing with a url
    const isUrl = isValidUrl(part, ['http', 'https']);

    // If we've found a url, we're going to first flush any of the text we've
    // seen so far. Then, using the url we discovered, we'll construct an
    // anchor node
    if (isUrl || publicKey) {
      if (contiguousStrings.length) {
        const text = contiguousStrings.join(' ') + ' ';
        nodes.push({
          t: RTD.InlineNodeType.Inline,
          c: text,
        });
        contiguousStrings = [];
      }

      if (isUrl) {
        const urlParts = parse(part);

        nodes.push({
          t: RTD.InlineNodeType.Anchor,
          c: [
            {
              t: RTD.InlineNodeType.Inline,
              c: (urlParts.host || 'link') + (
                urlParts.path ? urlParts.path.slice(0, 4) + "…" : ''
              ),
            },
          ],
          u: part,
        });
      } else if (publicKey) {
        nodes.push(publicKey);
      }

      // If the anchor node isn't the last element, add back the space that was
      // removed when we called `.split(' ')` above.
      if (!isLast) {
        nodes.push({
          t: RTD.InlineNodeType.Inline,
          c: ' ',
        });
      }
    } else {
      // If it's just a normal word, add it to our list of text
      contiguousStrings.push(part);
    }
  }


  // If we've made it to the end, we might have some text we haven't flushed
  // yet. Handle this text.
  if (contiguousStrings.length) {
    const text = contiguousStrings.join(' ');

    nodes.push({
      t: RTD.InlineNodeType.Inline,
      c: text,
    });
  }

  return nodes;
}
