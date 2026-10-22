import { parseFragment, serialize } from 'parse5';
import { parse, renderSync } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

const tags = ['p', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
export function sanitizeContent(value) {
  // Decode entities and normalize malformed HTML with an HTML5 parser first.
  const fragment = parseFragment(String(value || ''));
  function filter(node) {
    if (node.attrs) node.attrs = node.attrs.filter(attr => {
      if (attr.namespace) return false;
      if (['alt', 'title'].includes(attr.name)) return ['a', 'img'].includes(node.tagName);
      if (!((node.tagName === 'a' && attr.name === 'href') || (node.tagName === 'img' && attr.name === 'src'))) return false;
      const value = attr.value.trim();
      if (value.startsWith('//') || /[\u0000-\u0020\u007f]/.test(value)) return false;
      try {
        const url = new URL(value, 'https://www.hltrungviet.com');
        return ['https:', 'http:'].includes(url.protocol) || (node.tagName === 'a' && url.protocol === 'mailto:');
      } catch { return false; }
    });
    for (const child of node.childNodes || []) filter(child);
  }
  filter(fragment);
  const document = parse(serialize(fragment));
  return renderSync(sanitize({ allowElements: tags, dropElements: ['script', 'style', 'svg', 'math', 'iframe', 'object', 'template'] })(document));
}
export function plainText(value) {
  const document = parseFragment(String(value || ''));
  function text(node) {
    if (['script', 'style', 'template'].includes(node.tagName)) return '';
    return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
  }
  return text(document);
}
export function safePost(post) {
  const clean = { ...post, title: plainText(post.title) };
  if ('contentHtml' in post) clean.contentHtml = sanitizeContent(post.contentHtml);
  return clean;
}
