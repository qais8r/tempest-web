import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { decodeHTML } from 'entities';

export const isPoetry = (category) => category.trim().toLowerCase() === 'poetry';

export function initials(name) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  return words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : words[0]?.[0] || '';
}

export function workExcerpt(body, category, limit = 320) {
  // Poetry is literal text; prose excerpts omit Markdown and HTML formatting.
  const text = isPoetry(category)
    ? body
    : decodeHTML(
        sanitizeHtml(
          marked
            .parse(body, { async: false })
            .replace(/<(?:\/(?:p|div|h[1-6]|li|blockquote|pre|tr|table)|br\b)[^>]*>/gi, ' '),
          { allowedTags: [], allowedAttributes: {} },
        ),
      );
  const normalized = text.replace(/\s+/gu, ' ').trim();
  const characters = Array.from(normalized);
  if (characters.length <= limit) return normalized;
  let opening = characters.slice(0, limit - 3).join('');
  if (characters[limit - 3] !== ' ' && opening.includes(' ')) {
    opening = opening.slice(0, opening.lastIndexOf(' '));
  }
  return `${opening.trimEnd().replace(/[.,;:!?]+$/u, '')}...`;
}
