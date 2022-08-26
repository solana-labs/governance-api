import { URL } from 'url';

export function isValidUrl(text: string, protocols: string[]) {
  try {
    const url = new URL(text);
    return protocols
      ? url.protocol
          ? protocols.map(x => `${x.toLowerCase()}:`).includes(url.protocol)
          : false
      : true;
  } catch (err) {
      return false;
  }
}
