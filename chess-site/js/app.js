/* ============================================================
   ГАМБИТ — логика сайта
   Правила шахмат: chess.js 0.10.3 (CDN)
   Компьютер: негамакс с альфа-бета отсечением, оценка
   «материал + таблицы позиций» (упрощённая функция оценки).
   ============================================================ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const FILES = 'abcdefgh';
  const GLYPH = { k: '♚\uFE0E', q: '♛\uFE0E', r: '♜\uFE0E', b: '♝\uFE0E', n: '♞\uFE0E', p: '♟\uFE0E' };
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PTS = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const RU_LETTER = { K: 'Кр', Q: 'Ф', R: 'Л', B: 'С', N: 'К' };

  // «Nf3» → «Кf3»: русская нотация для отображения
  const ruSan = san => san.replace(/[KQRBN]/g, ch => RU_LETTER[ch]);

  // Внезапный шахматный движок не загрузился — честно сообщаем и оставляем
  // статические разделы (историю, цитату) читабельными.
  if (typeof Chess === 'undefined') {
    $$('[data-engine]').forEach(box => {
      box.innerHTML = '<p class="engine-note">Не удалось загрузить шахматный движок. ' +
        'Проверьте подключение к интернету и обновите страницу.</p>';
    });
    return;
  }

  /* ---------- Таблицы позиций (упрощённая оценка, вид «сверху» = 8-я горизонталь) ---------- */

  const PST = {
    p: [
       0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
       5,  5, 10, 25, 25, 10,  5,  5,
       0,  0,  0, 20, 20,  0,  0,  0,
       5, -5,-10,  0,  0,-10, -5,  5,
       5, 10, 10,-20,-20, 10, 10,  5,
       0,  0,  0,  0,  0,  0,  0,  0
    ],
    n: [
     -50,-40,-30,-30,-30,-30,-40,-50,
     -40,-20,  0,  0,  0,  0,-20,-40,
     -30,  0, 10, 15, 15, 10,  0,-30,
     -30,  5, 15, 20, 20, 15,  5,-30,
     -30,  0, 15, 20, 20, 15,  0,-30,
     -30,  5, 10, 15, 15, 10,  5,-30,
     -40,-20,  0,  5,  5,  0,-20,-40,
     -50,-40,-30,-30,-30,-30,-40,-50
    ],
    b: [
     -20,-10,-10,-10,-10,-10,-10,-20,
     -10,  0,  0,  0,  0,  0,  0,-10,
     -10,  0,  5, 10, 10,  5,  0,-10,
     -10,  5,  5, 10, 10,  5,  5,-10,
     -10,  0, 10, 10, 10, 10,  0,-10,
     -10, 10, 10, 10, 10, 10, 10,-10,
     -10,  5,  0,  0,  0,  0,  5,-10,
     -20,-10,-10,-10,-10,-10,-10,-20
    ],
    r: [
       0,  0,  0,  0,  0,  0,  0,  0,
       5, 10, 10, 10, 10, 10, 10,  5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
       0,  0,  0,  5,  5,  0,  0,  0
    ],
    q: [
     -20,-10,-10, -5, -5,-10,-10,-20,
     -10,  0,  0,  0,  0,  0,  0,-10,
     -10,  0,  5,  5,  5,  5,  0,-10,
      -5,  0,  5,  5,  5,  5,  0, -5,
       0,  0,  5,  5,  5,  5,  0, -5,
     -10,  5,  5,  5,  5,  5,  0,-10,
     -10,  0,  5,  0,  0,  0,  0,-10,
     -20,-10,-10, -5, -5,-10,-10,-20
    ],
    k: [
     -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -20,-30,-30,-40,-40,-30,-30,-20,
     -10,-20,-20,-20,-20,-20,-20,-10,
      20, 20,  0,  0,  0,  0, 20, 20,
      20, 30, 10,  0,  0, 10, 30, 20
    ]
  };

  /* ---------- Общие инструменты доски ---------- */

  function buildSquares(el, onClick) {
    const list = [];
    for (let rank = 8; rank >= 1; rank--) {
      for (let fi = 0; fi < 8; fi++) {
        const name = FILES[fi] + rank;
        const sq = document.createElement('div');
        sq.className = 'sq ' + ((fi + rank) % 2 ? 'light' : 'dark');
        sq.dataset.square = name;
        if (onClick) sq.addEventListener('click', () => onClick(name));
        el.appendChild(sq);
        list.push(sq);
      }
    }
    return list;
  }

  function pieceMapOf(g) {
    const map = {};
    g.board().forEach((row, ri) => row.forEach((p, ci) => {
      if (p) map[FILES[ci] + (8 - ri)] = p;
    }));
    return map;
  }

  function findKing(g, color) {
    for (const [name, p] of Object.entries(pieceMapOf(g))) {
      if (p.type === 'k' && p.color === color) return name;
    }
    return null;
  }

  // opts: { orientation, selected, targets: Map, interactive }
  function paintBoard(squares, g, opts) {
    const { orientation = 'w', selected = null, targets = null, interactive = false } = opts;
    const map = pieceMapOf(g);
    const hist = g.history({ verbose: true });
    const last = hist.length ? hist[hist.length - 1] : null;
    const checkSq = g.in_check() ? findKing(g, g.turn()) : null;
    const bottomRank = orientation === 'w' ? '1' : '8';
    const leftFile = orientation === 'w' ? 'a' : 'h';

    for (const sq of squares) {
      const name = sq.dataset.square;
      const p = map[name];

      sq.querySelector('.piece')?.remove();
      $$('.coord', sq).forEach(c => c.remove());
      sq.classList.remove('sel', 'last', 'check', 'legal', 'capture', 'own');

      if (p) {
        const s = document.createElement('span');
        s.className = 'piece ' + p.color + (interactive && p.color === g.turn() ? ' own' : '');
        s.textContent = GLYPH[p.type];
        sq.appendChild(s);
      }

      if (name[1] === bottomRank) {
        const c = document.createElement('span');
        c.className = 'coord f';
        c.textContent = name[0];
        sq.appendChild(c);
      }
      if (name[0] === leftFile) {
        const c = document.createElement('span');
        c.className = 'coord r';
        c.textContent = name[1];
        sq.appendChild(c);
      }

      if (selected === name) sq.classList.add('sel');
      if (last && (name === last.from || name === last.to)) sq.classList.add('last');
      if (checkSq === name) sq.classList.add('check');
      if (targets && targets.has(name)) sq.classList.add(map[name] ? 'capture' : 'legal');
    }
  }

  /* ============================================================
     ПАРТИЯ
     ============================================================ */

  const boardEl = $('#board');
  const statusEl = $('#status');
  const movesEl = $('#movesList');
  const capW = $('#capW'), capB = $('#capB'), advW = $('#advW'), advB = $('#advB');
  const btnUndo = $('#btnUndo');
  const aiOnly = $$('.ai-only');

  const squares = buildSquares(boardEl, onSquare);

  let game = new Chess();
  let orientation = 'w';
  let selected = null;
  let legalTargets = new Map();
  let vsAI = true;
  let humanColor = 'w';
  let aiLevel = 2;
  let thinking = false;

  const isOver = () => game.in_checkmate() || game.in_stalemate() || game.in_draw();

  const canInteract = () =>
    !thinking && !isOver() && (!vsAI || game.turn() === humanColor);

  function onSquare(name) {
    if (!canInteract()) return;

    if (selected) {
      const mv = legalTargets.get(name);
      if (mv) {
        selected = null;
        legalTargets = new Map();
        game.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
        updateUI();
        if (vsAI && game.turn() !== humanColor) scheduleAI();
        return;
      }
      if (name === selected) {
        selected = null;
        legalTargets = new Map();
        updateUI();
        return;
      }
    }

    const pc = game.get(name);
    if (pc && pc.color === game.turn()) {
      selected = name;
      legalTargets = new Map();
      for (const m of game.moves({ square: name, verbose: true })) {
        if (!legalTargets.has(m.to) || m.promotion === 'q') legalTargets.set(m.to, m);
      }
    } else {
      selected = null;
      legalTargets = new Map();
    }
    updateUI();
  }

  /* ---------- Компьютер ---------- */

  function evaluate(g) {
    const board = g.board();
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const idx = p.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
        const v = VAL[p.type] + PST[p.type][idx];
        score += p.color === 'w' ? v : -v;
      }
    }
    return score;
  }

  const moveScore = m =>
    (m.captured ? 10 * VAL[m.captured] - VAL[m.piece] : 0) + (m.promotion ? 800 : 0);

  const orderMoves = moves => moves.sort((a, b) => moveScore(b) - moveScore(a));

  function negamax(g, depth, alpha, beta) {
    if (depth === 0) return (g.turn() === 'w' ? 1 : -1) * evaluate(g);
    const moves = g.moves({ verbose: true });
    if (!moves.length) return g.in_check() ? -100000 - depth : 0;
    orderMoves(moves);
    let best = -Infinity;
    for (const m of moves) {
      g.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
      const v = -negamax(g, depth - 1, -beta, -alpha);
      g.undo();
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseAiMove() {
    const moves = game.moves({ verbose: true });
    if (!moves.length) return null;
    orderMoves(moves);
    const noise = aiLevel === 1 ? 60 : aiLevel === 2 ? 12 : 0;
    let alpha = -Infinity;
    let best = null;
    for (const m of moves) {
      game.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
      let v = -negamax(game, aiLevel - 1, -Infinity, -alpha);
      game.undo();
      if (noise) v += Math.random() * noise * 2 - noise;
      if (!best || v > alpha) {
        alpha = v;
        best = m;
      }
    }
    return best;
  }

  function scheduleAI() {
    thinking = true;
    updateUI();
    // Небольшая пауза, чтобы интерфейс успел показать «думает…»
    setTimeout(() => {
      const mv = chooseAiMove();
      thinking = false;
      if (mv && !isOver()) {
        game.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
      }
      updateUI();
    }, 400);
  }

  /* ---------- Отрисовка панели ---------- */

  function updateStatus() {
    let text;
    let state = 'turn';
    if (game.in_checkmate()) {
      const winner = game.turn() === 'w' ? 'чёрные' : 'белые';
      text = `Мат. Побеждают ${winner}.`;
      state = 'over';
    } else if (game.in_stalemate()) {
      text = 'Пат — ничья.';
      state = 'over';
    } else if (game.in_draw()) {
      text = 'Ничья: недостаточно материала, троекратное повторение или правило 50 ходов.';
      state = 'over';
    } else {
      const side = game.turn() === 'w' ? 'белых' : 'чёрных';
      if (thinking) {
        text = 'Компьютер думает…';
        state = 'think';
      } else {
        text = game.in_check() ? `Шах! Ход ${side}.` : `Ход ${side}.`;
        if (game.in_check()) state = 'check';
      }
    }
    statusEl.textContent = text;
    statusEl.dataset.state = state;
  }

  function renderMoves() {
    const hist = game.history({ verbose: true });
    movesEl.innerHTML = '';
    if (!hist.length) {
      const p = document.createElement('p');
      p.className = 'moves-empty';
      p.textContent = 'Партия ещё не начата — белые делают первый ход.';
      movesEl.appendChild(p);
      return;
    }
    for (let i = 0; i < hist.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'mv';
      const no = document.createElement('span');
      no.className = 'no';
      no.textContent = (i / 2 + 1) + '.';
      row.appendChild(no);
      const w = document.createElement('span');
      w.textContent = ruSan(hist[i].san);
      if (i === hist.length - 1) w.classList.add('cur');
      row.appendChild(w);
      const b = document.createElement('span');
      if (hist[i + 1]) {
        b.textContent = ruSan(hist[i + 1].san);
        if (i + 1 === hist.length - 1) b.classList.add('cur');
      }
      row.appendChild(b);
      movesEl.appendChild(row);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
  }

  function renderCaptured() {
    const hist = game.history({ verbose: true });
    const taken = { w: [], b: [] }; // фигуры, взятые белыми / чёрными
    let score = 0;
    for (const m of hist) {
      if (!m.captured) continue;
      taken[m.color].push(m.captured);
      score += (m.color === 'w' ? 1 : -1) * PTS[m.captured];
    }
    const fill = (el, types) => {
      el.textContent = types.length
        ? types.sort((a, b) => PTS[b] - PTS[a]).map(t => GLYPH[t]).join('')
        : '—';
    };
    fill(capW, taken.w);
    fill(capB, taken.b);
    advW.textContent = score > 0 ? `+${score}` : '';
    advB.textContent = score < 0 ? `+${-score}` : '';
  }

  function updateUI() {
    const live = canInteract();
    paintBoard(squares, game, {
      orientation,
      selected,
      targets: selected ? legalTargets : null,
      interactive: live
    });
    boardEl.classList.toggle('interactive', live);
    renderMoves();
    renderCaptured();
    updateStatus();
    btnUndo.disabled = thinking || !game.history().length;
  }

  /* ---------- Управление ---------- */

  function newGame() {
    game = new Chess();
    selected = null;
    legalTargets = new Map();
    thinking = false;
    orientation = vsAI ? humanColor : 'w';
    updateUI();
    if (vsAI && humanColor === 'b') scheduleAI();
  }

  function undo() {
    if (thinking || !game.history().length) return;
    game.undo();
    if (vsAI) {
      while (game.history().length && game.turn() !== humanColor) game.undo();
    }
    selected = null;
    legalTargets = new Map();
    updateUI();
    if (vsAI && game.turn() !== humanColor && game.history().length) scheduleAI();
  }

  function setPressed(group, btn) {
    $$('button', group).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  }

  $('#btnNew').addEventListener('click', newGame);
  btnUndo.addEventListener('click', undo);
  $('#btnFlip').addEventListener('click', () => {
    orientation = orientation === 'w' ? 'b' : 'w';
    updateUI();
  });

  const segMode = $('#modeAI').parentElement;
  $('#modeAI').addEventListener('click', () => {
    if (vsAI) return;
    vsAI = true;
    setPressed(segMode, $('#modeAI'));
    aiOnly.forEach(el => (el.hidden = false));
    newGame();
  });
  $('#modeHuman').addEventListener('click', () => {
    if (!vsAI) return;
    vsAI = false;
    setPressed(segMode, $('#modeHuman'));
    aiOnly.forEach(el => (el.hidden = true));
    newGame();
  });

  const segSide = $('#sideW').parentElement;
  $('#sideW').addEventListener('click', () => {
    if (humanColor === 'w') return;
    humanColor = 'w';
    setPressed(segSide, $('#sideW'));
    newGame();
  });
  $('#sideB').addEventListener('click', () => {
    if (humanColor === 'b') return;
    humanColor = 'b';
    setPressed(segSide, $('#sideB'));
    newGame();
  });

  const segLevel = $('[data-level="1"]').parentElement;
  $$('[data-level]').forEach(b => b.addEventListener('click', () => {
    aiLevel = Number(b.dataset.level);
    setPressed(segLevel, b);
  }));

  /* ============================================================
     ДЕБЮТНЫЙ САЛОН
     ============================================================ */

  const OPENINGS = [
    {
      name: 'Испанская партия', eco: 'C60',
      desc: 'Самый классический ответ на 1…e5: белые связывают коня c6 и готовят атаку в медленном темпе.',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']
    },
    {
      name: 'Итальянская партия', eco: 'C50',
      desc: 'Спокойное развитие с давлением на f7 — «ахиллесову пяту» чёрных в дебюте.',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']
    },
    {
      name: 'Сицилианская защита', eco: 'B20',
      desc: 'Самый популярный и самый боевой ответ на 1.e4: чёрные борются за центр асимметрично.',
      moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']
    },
    {
      name: 'Французская защита', eco: 'C00',
      desc: 'Чёрные строят крепость и готовят подрыв центра ходом c5.',
      moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6']
    },
    {
      name: 'Ферзевый гамбит', eco: 'D06',
      desc: 'Белые предлагают пешку c4 ради перевеса в центре — гамбит, как правило, лишь номинальный.',
      moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6']
    }
  ];

  const demoGame = new Chess();
  const demoSquares = buildSquares($('#demoBoard'), null);
  const demoCaption = $('#demoCaption');
  const demoPills = $('#demoPills');
  const demoPlayBtn = $('#demoPlay');
  const demo = { list: [], idx: 0, name: '', timer: null };

  function demoRender() {
    paintBoard(demoSquares, demoGame, { orientation: 'w' });
    renderDemoPills();
    demoCaption.textContent = demo.idx === 0
      ? `Начальная позиция · ${demo.name}`
      : `Ход ${demo.idx} из ${demo.list.length} · ${ruSan(demo.list[demo.idx - 1])}`;
  }

  function renderDemoPills() {
    demoPills.innerHTML = '';
    demo.list.forEach((san, i) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill' + (i < demo.idx ? ' played' : '') + (i === demo.idx - 1 ? ' current' : '');
      pill.textContent = ruSan(san);
      pill.addEventListener('click', () => {
        demoStop();
        demoSeek(i + 1);
      });
      demoPills.appendChild(pill);
    });
  }

  function demoSeek(k) {
    k = Math.max(0, Math.min(demo.list.length, k));
    while (demo.idx > k) {
      demoGame.undo();
      demo.idx--;
    }
    while (demo.idx < k) {
      if (!demoGame.move(demo.list[demo.idx])) break;
      demo.idx++;
    }
    demoRender();
  }

  function demoStop() {
    if (demo.timer) {
      clearInterval(demo.timer);
      demo.timer = null;
      demoPlayBtn.textContent = '▶';
    }
  }

  demoPlayBtn.addEventListener('click', () => {
    if (demo.timer) {
      demoStop();
      return;
    }
    if (demo.idx >= demo.list.length) demoSeek(0);
    demoPlayBtn.textContent = '⏸';
    demo.timer = setInterval(() => {
      if (demo.idx >= demo.list.length) {
        demoStop();
        return;
      }
      demoSeek(demo.idx + 1);
    }, 950);
  });

  $('#demoReset').addEventListener('click', () => {
    demoStop();
    demoSeek(0);
  });
  $('#demoPrev').addEventListener('click', () => {
    demoStop();
    demoSeek(demo.idx - 1);
  });
  $('#demoNext').addEventListener('click', () => {
    demoStop();
    demoSeek(demo.idx + 1);
  });

  function loadOpening(i) {
    demoStop();
    demo.list = OPENINGS[i].moves.slice();
    demo.idx = 0;
    demo.name = OPENINGS[i].name;
    demoGame.reset();
    $$('.opening-card').forEach((c, ci) => c.classList.toggle('is-active', ci === i));
    demoRender();
  }

  const cardsEl = $('#openingCards');
  OPENINGS.forEach((op, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'opening-card';
    card.setAttribute('role', 'listitem');
    const head = document.createElement('span');
    head.className = 'card-head';
    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = op.name;
    const eco = document.createElement('span');
    eco.className = 'card-eco';
    eco.textContent = op.eco;
    head.append(name, eco);
    const desc = document.createElement('span');
    desc.className = 'card-desc';
    desc.textContent = op.desc;
    card.append(head, desc);
    card.addEventListener('click', () => loadOpening(i));
    cardsEl.appendChild(card);
  });

  loadOpening(0);

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

  /* ---------- Старт ---------- */

  newGame();
})();
