// Navigation is rendered by Astro; only active-link state needs browser code.
(function () {
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar a.nav-link, .navbar a.dropdown-item').forEach(link => {
    if (link.getAttribute('href') !== current) return;
    link.classList.add('active');
    link.closest('.dropdown')?.querySelector('.dropdown-toggle')?.classList.add('active');
  });
})();
