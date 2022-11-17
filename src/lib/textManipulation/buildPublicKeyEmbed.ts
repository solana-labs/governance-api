import { abbreviateAddress } from "@lib/textManipulation/abbreviateAddress";
import { PublicKeyNode, InlineNodeType } from "@lib/types/RichTextDocument";

const isBase58 = (value: string): boolean => /^[A-HJ-NP-Za-km-z1-9]*$/.test(value);

export function buildPublicKeyEmbed(text: string) {
  if (text.length !== 44) {
    return null;
  }

  if (!isBase58(text)) {
    return null;
  }

  const node: PublicKeyNode = {
    t: InlineNodeType.PublicKey,
    c: abbreviateAddress(text),
    k: text,
  };

  return node;
}
