const directory = document.querySelector<HTMLElement>('[data-author-directory]');
const form = directory?.querySelector<HTMLFormElement>('.author-search');
const input = form?.querySelector<HTMLInputElement>('input');
const clear = form?.querySelector<HTMLButtonElement>('.author-search-clear');
const count = directory?.querySelector<HTMLElement>('.archive-count');
const grid = directory?.querySelector<HTMLUListElement>('.author-directory-grid');
const empty = directory?.querySelector<HTMLElement>('.author-search-empty');

if (form && input && clear && count && grid && empty) {
  const normalize = (value: string) =>
    value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const authors = Array.from(grid.querySelectorAll<HTMLElement>('[data-author-name]'), (card) => ({
    card,
    name: normalize(card.dataset.authorName || ''),
  }));

  const filter = () => {
    const words = normalize(input.value).split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const { card, name } of authors) {
      card.hidden = !words.every((word) => name.includes(word));
      if (!card.hidden) matches++;
    }
    count.textContent = words.length
      ? `${matches} of ${authors.length} authors`
      : `${authors.length} ${authors.length === 1 ? 'author' : 'authors'}`;
    clear.hidden = input.value.length === 0;
    grid.hidden = matches === 0;
    empty.hidden = matches !== 0;
  };

  const reset = () => {
    input.value = '';
    filter();
    input.focus();
  };

  form.hidden = false;
  form.addEventListener('submit', (event) => event.preventDefault());
  input.addEventListener('input', filter);
  input.addEventListener('search', filter);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      reset();
    }
  });
  clear.addEventListener('click', reset);
  // Browsers can restore the input when returning from an author's profile.
  window.addEventListener('pageshow', filter);
  filter();
}
