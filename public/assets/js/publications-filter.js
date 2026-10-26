// Search publications by author, citation, year, journal, or link label.
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('publication-search');
  const topicInput = document.getElementById('publication-topic');
  const yearInput = document.getElementById('publication-map-year');
  const status = document.getElementById('publication-search-status');
  const publications = Array.from(document.querySelectorAll('.publication-item'));
  const yearGroups = document.querySelectorAll('.publication-year-group');

  let searching = false;
  const savedOpen = new Map();

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function updateResults() {
    const terms = normalize(searchInput?.value).split(/\s+/).filter(Boolean);
    const hasQuery = terms.length > 0 || Boolean(topicInput?.value) || Boolean(yearInput?.value);
    if (hasQuery && !searching) yearGroups.forEach(group => savedOpen.set(group, group.open));
    let visibleCount = 0;

    publications.forEach((publication) => {
      const searchText = normalize(publication.dataset.search);
      const matches = terms.every((term) => searchText.includes(term))
        && (!topicInput?.value || (publication.dataset.topics || '').split(',').includes(topicInput.value))
        && (!yearInput?.value || publication.dataset.year === yearInput.value);
      publication.classList.toggle('hidden', !matches);
      if (matches) visibleCount += 1;
    });

    yearGroups.forEach((group) => {
      const hasVisiblePublications = Array.from(group.querySelectorAll('.publication-item'))
        .some((publication) => !publication.classList.contains('hidden'));
      group.style.display = hasVisiblePublications ? 'block' : 'none';
      if (hasQuery) group.open = hasVisiblePublications;
      else if (searching) group.open = savedOpen.get(group) ?? false;
    });

    searching = hasQuery;
    document.dispatchEvent(new CustomEvent('publications:filtered'));

    if (status) {
      status.textContent = visibleCount === 0
        ? 'No publications found.'
        : `${visibleCount} ${visibleCount === 1 ? 'publication' : 'publications'}`;
    }
  }

  searchInput?.addEventListener('input', updateResults);
  topicInput?.addEventListener('change', updateResults);
  yearInput?.addEventListener('change', updateResults);
  document.getElementById('publication-reset-filters')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (topicInput) topicInput.value = '';
    if (yearInput) yearInput.value = '';
    updateResults();
  });
  updateResults();

  // Reveal direct links even when their year is collapsed.
  function revealLinkedPublication() {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    const targetElement = id ? document.getElementById(id) : null;
    if (!targetElement?.classList.contains('publication-item')) return;
    document.dispatchEvent(new CustomEvent('publications:reveal'));
    if (targetElement.classList.contains('hidden') && searchInput) {
      searchInput.value = '';
      if (topicInput) topicInput.value = '';
      if (yearInput) yearInput.value = '';
      updateResults();
    }
    const group = targetElement.closest('.publication-year-group');
    if (group) group.open = true;
    targetElement.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    targetElement.classList.add('highlight');
    setTimeout(() => targetElement.classList.remove('highlight'), 4000);
  }
  window.addEventListener('load', revealLinkedPublication);
  window.addEventListener('hashchange', revealLinkedPublication);
});
