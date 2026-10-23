// Search publications by author, citation, year, journal, or link label.
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('publication-search');
  const status = document.getElementById('publication-search-status');
  const publications = Array.from(document.querySelectorAll('.publication-item'));
  const yearGroups = document.querySelectorAll('.publication-year-group');

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
    let visibleCount = 0;

    publications.forEach((publication) => {
      const searchText = normalize(publication.dataset.search);
      const matches = terms.every((term) => searchText.includes(term));
      publication.classList.toggle('hidden', !matches);
      if (matches) visibleCount += 1;
    });

    yearGroups.forEach((group) => {
      const hasVisiblePublications = Array.from(group.querySelectorAll('.publication-item'))
        .some((publication) => !publication.classList.contains('hidden'));
      group.style.display = hasVisiblePublications ? 'block' : 'none';
    });

    if (status) {
      status.textContent = visibleCount === 0
        ? 'No publications found.'
        : `${visibleCount} ${visibleCount === 1 ? 'publication' : 'publications'}`;
    }
  }

  searchInput?.addEventListener('input', updateResults);
  updateResults();

  // Highlight publications linked from the homepage slider.
  window.addEventListener('load', function() {
    const targetElement = window.location.hash
      ? document.querySelector(window.location.hash)
      : null;
    if (targetElement?.classList.contains('publication-item')) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetElement.classList.add('highlight');
      setTimeout(() => targetElement.classList.remove('highlight'), 4000);
    }
  });
});
