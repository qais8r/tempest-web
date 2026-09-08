import raw from '../generated/content.json';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
export { initials, isPoetry } from '../../scripts/text.mjs';

export interface ImageSource {
  src: string;
  width: number;
}

export interface Issue {
  year: string;
  description: string;
  pdf: string;
  heroCredit: string;
  featuredWorks: string[];
  sections: { title: string; page: number }[];
  cover: string;
  coverWidth: number;
  coverHeight: number;
  coverSources: ImageSource[];
  pageCount: number;
  pageRatio: number;
  fileSize: string;
  status: string;
}
export interface Work {
  slug: string;
  title: string;
  authors: string[];
  issue: string;
  category: string;
  order: number | null;
  excerpt: string;
  body: string;
  bodyFormat: 'plain' | 'markdown';
  poetryAlignment: 'left' | 'center';
  pdfPage: number | null;
  about: string;
  artworks: {
    image: string;
    alt: string;
    caption: string;
    width?: number;
    height?: number;
    thumbnailSources?: ImageSource[];
  }[];
  recordings: { file: string; title: string; description: string }[];
  status: string;
}
export interface Author {
  slug: string;
  name: string;
  bio: string;
  portrait: string;
  portraitSources?: ImageSource[];
  status: string;
}
export const content = raw as {
  preview: boolean;
  site: typeof raw.site;
  issues: Issue[];
  works: Work[];
  authors: Author[];
};
export const { site, issues, works, authors, preview } = content;
export const currentIssue = issues.find((i) => i.year === site.currentIssue) || issues[0];
export const url = (p = '/') =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
export const imageSrcset = (sources?: ImageSource[]) =>
  sources?.map(({ src, width }) => `${url(src)} ${width}w`).join(', ');
export const issueUrl = (i: Issue | string) =>
  url(`/issues/${typeof i === 'string' ? i : i.year}/`);
export const readerUrl = (i: Issue | string, page?: number | null) =>
  `${issueUrl(i)}reader/${page ? `?page=${page}` : ''}`;
export const authorsFor = (w: Work) =>
  w.authors.map((slug) => authors.find((a) => a.slug === slug)!);
export const authorNames = (w: Work) =>
  new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(
    authorsFor(w).map((author) => author.name),
  );
export const worksFor = (i: Issue) => works.filter((w) => w.issue === i.year);
export function poetry(value: string) {
  return sanitizeHtml(marked.parseInline(value, { async: false }) as string, {
    allowedTags: ['em', 'strong', 'br'],
    allowedAttributes: {},
  });
}
export function prose(value: string) {
  return sanitizeHtml(marked.parse(value, { async: false }) as string, {
    allowedTags: ['p', 'br', 'em', 'strong', 'a', 'blockquote', 'ul', 'ol', 'li', 'h2', 'h3', 'hr'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['https', 'http', 'mailto'],
  });
}
