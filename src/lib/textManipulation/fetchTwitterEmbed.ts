import { dedupe } from '@lib/cacheAndDedupe';
import { TwitterEmbedNode, BlockNodeType } from '@lib/types/RichTextDocument';

export const fetchTwitterEmbed = dedupe(
  async (url: string, bearerToken: string) => {
    const parts = [
      `url=${encodeURIComponent(url)}`,
      'omit_script=1',
      'dnt=true',
    ];

    const resp = await fetch(
      `https://publish.twitter.com/oembed?${parts.join('&')}`,
      {
        method: 'get',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        }
      }
    );

    const data: {
      url: string;
      title: string;
      html: string;
      width: null | number;
      height: null | number;
      type: string;
      cache_age: string;
      provider_name: string;
      provider_url: string;
      version: string;
    } = await resp.json();

    const node: TwitterEmbedNode = {
      t: BlockNodeType.TwitterEmbed,
      c: {
        u: data.url,
        t: data.title,
        h: data.html,
      }
    };

    return node;
  },
  {
    key: (url, token) => url + token,
  }
)
