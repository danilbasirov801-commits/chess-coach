/* ============================================================
   АННА ВЕТРОВА — интерактив лендинга тренера
   Бургер-меню · форма записи · анимации появления
   ============================================================ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Бургер-меню ---------- */

  const burger = $('#burger');

  burger.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  });

  // Клик по ссылке меню закрывает его
  $$('#nav a').forEach(a => a.addEventListener('click', () => {
    document.body.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
  }));

  // Клик мимо меню тоже закрывает
  document.addEventListener('click', e => {
    if (!document.body.classList.contains('nav-open')) return;
    if (e.target.closest('.topnav') || e.target.closest('#burger')) return;
    document.body.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.body.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
  });

  /* ---------- Форма записи ---------- */

  const form = $('#lessonForm');
  const success = $('#formSuccess');

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    // Здесь подключается реальная отправка (Formspree, Telegram-бот, ваш бэкенд).
    // Сейчас — демонстрационная имитация успешной отправки.
    form.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('#formAgain').addEventListener('click', () => {
    form.reset();
    success.hidden = true;
    form.hidden = false;
    $('#fName').focus();
  });

  /* ---------- Год в подвале ---------- */

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Появление секций при прокрутке ---------- */

  const revealEls = $$('.reveal');

  if (!('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('in'));
  } else {
    let ioAlive = false; // пришёл ли от наблюдателя хотя бы один колбэк
    const io = new IntersectionObserver(entries => {
      ioAlive = true;
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));

    // Страховка: во фоновых вкладках и старых браузерах колбэки наблюдателя
    // могут не доставляться. Показываем блоки при прокрутке вручную,
    // а если наблюдатель не подал признаков жизни — показываем всё.
    const sweep = () => {
      const vh = window.innerHeight;
      for (const el of revealEls) {
        if (el.classList.contains('in')) continue;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('in');
      }
    };
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { sweep(); ticking = false; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    sweep();
    setTimeout(() => {
      if (!ioAlive) revealEls.forEach(el => el.classList.add('in'));
    }, 4000);
  }
})();
