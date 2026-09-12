document.addEventListener('DOMContentLoaded', () => {
  const hero = document.getElementById('homeHero');

  if (hero) {
    const wide = hero.dataset.backgroundWide;
    const square = hero.dataset.backgroundSquare;
    const mobile = hero.dataset.backgroundMobile;

    function setHeroBackground() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = width / height;

      let background = wide;

      // HP portrait
      if (width <= 600 && height > width) {
        background = mobile || square || wide;

        // TABLET portrait
      } else if (width <= 1200 && height > width) {
        background = square || wide;

        // Rasio 5:4 atau mendekati 5:4
      } else if (ratio >= 1.15 && ratio <= 1.35) {
        background = square || wide;

        // Landscape / desktop
      } else {
        background = wide;
      }

      if (background) {
        hero.style.backgroundImage = `url("${background.replace(/"/g, '%22')}")`;
      }
    }

    setHeroBackground();
    window.addEventListener('resize', setHeroBackground);
  }

  const menuButton = document.querySelector('[data-mobile-menu]');
  const menu = document.querySelector('[data-public-menu]');
  if (menuButton && menu)
    menuButton.addEventListener('click', () => menu.classList.toggle('open'));
  const modal = document.querySelector('[data-lightbox-modal]');
  if (modal) {
    const img = modal.querySelector('[data-lightbox-image]'),
      title = modal.querySelector('[data-lightbox-title]');
    document.querySelectorAll('[data-lightbox]').forEach((btn) =>
      btn.addEventListener('click', () => {
        img.src = btn.dataset.lightbox;
        title.textContent = btn.dataset.title || '';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
      })
    );
    const close = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      img.src = '';
    };
    modal
      .querySelector('[data-lightbox-close]')
      .addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }
  document.querySelectorAll('input[data-preview-target]').forEach((input) =>
    input.addEventListener('change', () => {
      const target = document.querySelector(input.dataset.previewTarget);
      if (!target) return;
      target.innerHTML = '';
      Array.from(input.files || []).forEach((file) => {
        const box = document.createElement('div');
        if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(file);
          img.onload = () => URL.revokeObjectURL(img.src);
          box.appendChild(img);
        } else {
          box.className = 'file-preview';
          box.textContent = 'PDF: ' + file.name;
        }
        target.appendChild(box);
      });
    })
  );
});
