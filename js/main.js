/* Navigation and small page utilities; no application dependencies. */
(() => {
  'use strict';
  const header = document.querySelector('#site-header');
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#primary-navigation');
  const toast = document.querySelector('#notice-toast');
  let toastTimer;
  const setMenu = (open, returnFocus = false) => {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (returnFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('menu-open')) setMenu(false, true);
  });
  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) setMenu(false);
  });
  header.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!header.contains(document.activeElement)) setMenu(false);
    });
  });
  const desktop = window.matchMedia('(min-width: 1024px)');
  desktop.addEventListener('change', () => setMenu(false));
  const updateHeader = () => header.classList.toggle('scrolled', header.classList.contains('interior-header') || window.scrollY > 24);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
  document.querySelector('#copyright-year').textContent = String(new Date().getFullYear());
  document.querySelectorAll('[data-future]').forEach((link) => {
    link.addEventListener('click', () => {
      const page = link.dataset.future;
      toast.textContent = page === 'Admission'
        ? 'For admission enquiries, please call or email KBC using the contact details below.'
        : `${page} page is planned for a future phase.`;
      toast.classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('visible'), 5000);
    });
  });
})();

/* Native dialog makes the background inert and contains keyboard focus. */
(() => {
  'use strict';
  const dialog = document.querySelector('.gallery-lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const links = [...document.querySelectorAll('[data-gallery-image]')];
  const frame = dialog.querySelector('.lightbox-image-frame');
  const image = dialog.querySelector('.lightbox-image');
  let current = 0;
  let opener;
  const display = (index) => {
    current = (index + links.length) % links.length;
    const link = links[current];
    image.src = link.getAttribute('href');
    image.alt = link.querySelector('img').alt;
    frame.style.setProperty('--image-ratio', link.dataset.ratio);
    frame.classList.toggle('photo-rotated', link.dataset.rotated === 'true');
    dialog.querySelector('.lightbox-caption').textContent = link.dataset.caption;
    dialog.querySelector('.lightbox-count').textContent = `${current + 1} / ${links.length}`;
  };
  links.forEach((link, index) => link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    display(index);
    dialog.showModal();
    document.body.classList.add('lightbox-open');
  }));
  dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.lightbox-previous').addEventListener('click', () => display(current - 1));
  dialog.querySelector('.lightbox-next').addEventListener('click', () => display(current + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      display(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    document.body.classList.remove('lightbox-open');
    image.removeAttribute('src');
    opener?.focus({ preventScroll: true });
  });
})();
