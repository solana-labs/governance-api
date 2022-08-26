import { URL } from 'url';

/**
 * Checks if some text is a valid urls. If protocols are given, only urls that
 * match one of the protocols would be considered valid.
 */
export function isValidUrl(text: string, protocols?: string[]) {
  try {
    const url = new URL(text);
    return protocols?.length
      ? url.protocol
          ? protocols.map(x => `${x.toLowerCase()}:`).includes(url.protocol)
          : false
      : true;
  } catch (err) {
      return false;
  }
}
