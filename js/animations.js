/* Reusable reveal system with a progressive enhancement fallback. */
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;
  const elements = document.querySelectorAll('.reveal');
  document.querySelectorAll('.course-grid, .principle-grid').forEach((group) => {
    [...group.children].forEach((card, index) => {
      card.style.setProperty('--reveal-delay', `${(index % 4) * 65}ms`);
    });
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('is-pending');
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  elements.forEach((element) => {
    element.classList.add('is-pending');
    observer.observe(element);
  });
  motion.addEventListener('change', (event) => {
    if (!event.matches) return;
    observer.disconnect();
    elements.forEach((element) => element.classList.remove('is-pending'));
  });
})();
