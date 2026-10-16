// Publications filter and highlight functionality
document.addEventListener('DOMContentLoaded', function() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const publications = document.querySelectorAll('.publication-item');
  const yearGroups = document.querySelectorAll('.publication-year-group');
  
  function updateYearGroups() {
    yearGroups.forEach(group => {
      const hasVisiblePubs = Array.from(group.querySelectorAll('.publication-item')).some(
        (item) => !item.classList.contains('hidden')
      );

      group.style.display = hasVisiblePubs ? 'block' : 'none';
    });
  }
  
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Update active button
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      const selectedAuthor = this.dataset.author;
      
      // Filter publications
      publications.forEach(pub => {
        if (selectedAuthor === 'all') {
          pub.classList.remove('hidden');
        } else {
          const authors = (pub.dataset.authors || '')
            .split(',')
            .map(author => author.trim());

          if (authors.includes(selectedAuthor)) {
            pub.classList.remove('hidden');
          } else {
            pub.classList.add('hidden');
          }
        }
      });
      
      // Update year headers visibility
      updateYearGroups();
    });
  });
  
  // Initial update
  updateYearGroups();
  
  // Highlight publication if coming from slider with hash
  window.addEventListener('load', function() {
    const hash = window.location.hash;
    if (hash) {
      const targetElement = document.querySelector(hash);
      if (targetElement && targetElement.classList.contains('publication-item')) {
        // Scroll to the element
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight class
        targetElement.classList.add('highlight');
        
        // Remove highlight after animation completes (4 seconds)
        setTimeout(() => {
          targetElement.classList.remove('highlight');
        }, 4000);
      }
    }
  });
});
