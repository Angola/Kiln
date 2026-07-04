const URL_RE = /^https?:\/\/[^\s]+$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const IMAGE_KEY_RE = /(image|avatar|thumbnail|photo|picture|icon|cover)/i;

export function isUrl(v: string): boolean {
  return URL_RE.test(v.trim());
}

export function isImageUrl(v: string): boolean {
  return isUrl(v) && IMAGE_EXT_RE.test(v);
}

export function looksLikeImageKey(key: string): boolean {
  return IMAGE_KEY_RE.test(key);
}

export function isDateOnly(v: string): boolean {
  return DATE_ONLY_RE.test(v.trim()) && !Number.isNaN(Date.parse(v.trim()));
}

export function isDateTime(v: string): boolean {
  const s = v.trim();
  return DATETIME_RE.test(s) && !Number.isNaN(Date.parse(s));
}

const ID_KEY_RE = /(^id$|_id$|Id$|^uuid$|^guid$|^slug$)/;

export function looksLikeIdKey(key: string): boolean {
  return ID_KEY_RE.test(key);
}

const TITLE_KEY_RE = /^(title|name|label|heading|subject)$/i;

export function looksLikeTitleKey(key: string): boolean {
  return TITLE_KEY_RE.test(key);
}
