document.addEventListener('DOMContentLoaded', function() {
  const typeButtons = document.querySelectorAll('[data-project-filter]');
  const professorButtons = document.querySelectorAll('[data-project-professor-filter]');
  const projectItems = document.querySelectorAll('.project-item');
  const projectGroups = document.querySelectorAll('.project-group');

  function updateProjectGroups() {
    projectGroups.forEach((group) => {
      const hasVisibleProjects = Array.from(group.querySelectorAll('.project-item')).some(
        (item) => !item.classList.contains('hidden')
      );

      group.style.display = hasVisibleProjects ? 'block' : 'none';
    });
  }

  function applyFilters() {
    const activeTypeButton = document.querySelector('[data-project-filter].active');
    const activeProfessorButton = document.querySelector('[data-project-professor-filter].active');

    const selectedType = activeTypeButton ? activeTypeButton.dataset.projectFilter : 'all';
    const selectedProfessor = activeProfessorButton ? activeProfessorButton.dataset.projectProfessorFilter : 'all';

    projectItems.forEach((item) => {
      const matchesType = selectedType === 'all' || item.dataset.fundingType === selectedType;
      const matchesProfessor = selectedProfessor === 'all' || item.dataset.professor === selectedProfessor;

      item.classList.toggle('hidden', !(matchesType && matchesProfessor));
    });

    updateProjectGroups();
  }

  typeButtons.forEach((button) => {
    button.addEventListener('click', function() {
      typeButtons.forEach((btn) => btn.classList.remove('active'));
      this.classList.add('active');
      applyFilters();
    });
  });

  professorButtons.forEach((button) => {
    button.addEventListener('click', function() {
      professorButtons.forEach((btn) => btn.classList.remove('active'));
      this.classList.add('active');
      applyFilters();
    });
  });

  applyFilters();
});
