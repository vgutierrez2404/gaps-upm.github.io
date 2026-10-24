document.addEventListener('DOMContentLoaded', function() {
  const projectItems = document.querySelectorAll('.project-item');
  const projectGroups = document.querySelectorAll('.project-group');
  const searchInput = document.getElementById('project-search');
  const status = document.getElementById('project-search-status');

  function normalize(value) {
    return String(value || '').toLocaleLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  const searchText = new Map(Array.from(projectItems, (item) => [item, normalize(item.textContent)]));

  function updateProjectGroups() {
    projectGroups.forEach((group) => {
      const hasVisibleProjects = Array.from(group.querySelectorAll('.project-item')).some(
        (item) => !item.classList.contains('hidden')
      );

      group.style.display = hasVisibleProjects ? 'block' : 'none';
    });
  }

  function applySearch() {
    const terms = normalize(searchInput?.value).split(/\s+/).filter(Boolean);
    let visibleCount = 0;

    projectItems.forEach((item) => {
      const matchesSearch = terms.every((term) => searchText.get(item).includes(term));
      const visible = matchesSearch;
      item.classList.toggle('hidden', !visible);
      if (visible) visibleCount += 1;
    });

    updateProjectGroups();
    if (status) {
      status.textContent = visibleCount === 0 ? 'No projects found.'
        : `${visibleCount} ${visibleCount === 1 ? 'project' : 'projects'}`;
    }
  }

  searchInput?.addEventListener('input', applySearch);
  applySearch();
});
