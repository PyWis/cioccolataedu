/*
 * La Fabbrica del Cioccolato - logica del gioco.
 *
 * Giochi disponibili:
 *  - prendi:      la barretta è già divisa, metti nel piatto i quadretti del numeratore
 *  - dividi:      prima dividi la barretta (denominatore), poi prendi i quadretti (numeratore)
 *  - riconosci:   guarda piatto/barretta e scrivi la frazione (anche "quanto resta?")
 *  - equivalenti: prepara la stessa quantità con quadretti più piccoli (es. 1/2 = 2/4)
 *  - confronta:   scegli <, = oppure > tra due frazioni
 *
 * NB: le classi Tailwind usate qui devono comparire per intero (niente stringhe
 * composte) perché `npm run build:css` le trovi e le includa in css/styles.css.
 */
(function () {
    'use strict';

    // ==========================================
    // MEMORIA LOCALE (stelle, gioco scelto, suoni)
    // ==========================================
    const STORAGE = { score: 'cioccolata.stelle', mode: 'cioccolata.gioco', sound: 'cioccolata.suoni' };

    function load(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v === null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function save(key, value) {
        try { localStorage.setItem(key, String(value)); } catch (e) { /* modalità privata: pazienza */ }
    }

    // ==========================================
    // DATI E UTILITÀ
    // ==========================================
    const MODES = [
        { id: 'prendi', label: 'Prendi', icon: '🍫' },
        { id: 'dividi', label: 'Dividi e prendi', icon: '🔪' },
        { id: 'riconosci', label: 'Che frazione è?', icon: '🔍' },
        { id: 'equivalenti', label: 'Equivalenti', icon: '⚖️' },
        { id: 'confronta', label: 'Confronta', icon: '🆚' },
    ];
    const MODE_IDS = MODES.map(m => m.id);

    const MAX_PARTS = 12;
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const plural = (n, one, many) => (n === 1 ? one : many);
    const qq = n => `${n} ${plural(n, 'quadretto', 'quadretti')}`;

    // Tutte le frazioni proprie con denominatore da 2 a 9 (36 frazioni).
    // Si estrae in modo uniforme da questa lista: ogni frazione ha la stessa probabilità.
    const PROPER = [];
    for (let den = 2; den <= 9; den++) {
        for (let num = 1; num < den; num++) PROPER.push({ num, den });
    }

    // Frazioni base (ridotte) + fattore k per le equivalenti, con al massimo 12 quadretti
    const EQUIVALENTS = [];
    for (let den = 2; den <= 6; den++) {
        for (let num = 1; num < den; num++) {
            if (gcd(num, den) !== 1) continue;
            for (let k = 2; den * k <= MAX_PARTS; k++) EQUIVALENTS.push({ num, den, k });
        }
    }

    // Coppie di frazioni con lo stesso valore (es. 1/2 e 3/6), per il gioco "Confronta"
    const SAME_VALUE_PAIRS = [];
    PROPER.forEach(a => PROPER.forEach(b => {
        if ((a.num !== b.num || a.den !== b.den) && a.num * b.den === b.num * a.den) SAME_VALUE_PAIRS.push([a, b]);
    }));

    // Estrae un elemento evitando quelli usciti di recente nello stesso gioco
    function pickFresh(list, keyOf, mode) {
        const recent = state.recent[mode] || (state.recent[mode] = []);
        const memory = Math.min(6, Math.floor(list.length / 2));
        let candidates = list.filter(x => !recent.includes(keyOf(x)));
        if (candidates.length === 0) candidates = list;
        const item = candidates[randInt(0, candidates.length - 1)];
        recent.push(keyOf(item));
        while (recent.length > memory) recent.shift();
        return item;
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = randInt(0, i);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ==========================================
    // STATO
    // ==========================================
    const initialMode = load(STORAGE.mode, 'prendi');
    const state = {
        mode: MODE_IDS.includes(initialMode) ? initialMode : 'prendi',
        score: Math.max(0, parseInt(load(STORAGE.score, '0'), 10) || 0),
        sound: load(STORAGE.sound, '1') === '1',
        solved: false,
        num: 0,             // numeratore obiettivo / mostrato
        den: 0,             // denominatore obiettivo / mostrato
        parts: 0,           // in quante parti è divisa ora la barretta
        pieces: [],         // { id, location: 'bar' | 'plate' }
        locked: false,      // true = i quadretti non si possono spostare
        equiv: null,        // { k } nel gioco equivalenti
        recog: null,        // { ask: 'piatto' | 'barretta', num, den } nel gioco riconosci
        cmp: null,          // { a, b, choice } nel gioco confronta
        lastMoved: null,    // id dell'ultimo quadretto spostato (solo lui fa l'animazione)
        recent: {},
    };

    // ==========================================
    // RIFERIMENTI DOM
    // ==========================================
    const el = {
        tabs: document.getElementById('mode-tabs'),
        badge: document.getElementById('mission-badge'),
        title: document.getElementById('mission-title'),
        desc: document.getElementById('mission-desc'),
        tip: document.getElementById('mission-tip'),
        fractionBox: document.getElementById('fraction-box'),
        playArea: document.getElementById('play-area'),
        compareArea: document.getElementById('compare-area'),
        compareBars: document.getElementById('compare-bars'),
        dividerControls: document.getElementById('divider-controls'),
        dividerValue: document.getElementById('divider-value'),
        dividerMinus: document.getElementById('divider-minus'),
        dividerPlus: document.getElementById('divider-plus'),
        barWrapper: document.getElementById('chocolate-bar-wrapper'),
        barGrid: document.getElementById('chocolate-bar-grid'),
        barCounter: document.getElementById('bar-counter'),
        barHint: document.getElementById('bar-hint'),
        plate: document.getElementById('plate-dropzone'),
        plateGrid: document.getElementById('plate-grid'),
        platePlaceholder: document.getElementById('plate-placeholder'),
        plateCounter: document.getElementById('plate-counter'),
        plateHint: document.getElementById('plate-hint'),
        score: document.getElementById('score-display'),
        feedbackBox: document.getElementById('feedback-box'),
        feedbackTitle: document.getElementById('feedback-title'),
        feedbackMsg: document.getElementById('feedback-message'),
        srLive: document.getElementById('sr-live'),
        btnCheck: document.getElementById('btn-check'),
        btnNext: document.getElementById('btn-next'),
        btnReset: document.getElementById('btn-reset'),
        ghost: document.getElementById('drag-ghost'),
        soundBtn: document.getElementById('toggle-sound'),
        soundIcon: document.getElementById('sound-icon'),
        helpModal: document.getElementById('help-modal'),
    };

    // ==========================================
    // AUDIO (Web Audio API, nessun file esterno)
    // ==========================================
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function initAudio() {
        if (!AudioCtx) return null;
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function tone(type, from, to, duration, volume, delay) {
        const ctx = initAudio();
        if (!ctx) return;
        const t0 = ctx.currentTime + (delay || 0);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, t0);
        if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
        gain.gain.setValueAtTime(volume, t0);
        gain.gain.exponentialRampToValueAtTime(0.01, t0 + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.01);
    }

    function play(kind) {
        if (!state.sound) return;
        try {
            if (kind === 'pop') tone('sine', 320, 580, 0.08, 0.2);
            if (kind === 'error') tone('sine', 280, 210, 0.25, 0.2);
            if (kind === 'win') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('triangle', f, f, 0.3, 0.25, i * 0.1));
        } catch (e) { /* audio non disponibile */ }
    }

    function updateSoundButton() {
        el.soundIcon.textContent = state.sound ? '🔊' : '🔇';
        el.soundBtn.setAttribute('aria-pressed', String(state.sound));
        el.soundBtn.setAttribute('aria-label', state.sound ? 'Disattiva i suoni' : 'Attiva i suoni');
    }

    function toggleAudio() {
        state.sound = !state.sound;
        save(STORAGE.sound, state.sound ? '1' : '0');
        updateSoundButton();
        play('pop');
    }

    // ==========================================
    // HTML DELLE FRAZIONI (solo numeri e testi fissi, nessun input utente)
    // ==========================================
    function fractionHTML(num, den, opts) {
        const o = opts || {};
        const size = o.small ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl';
        const bar = o.small ? 'w-9 h-1 my-1' : 'w-14 h-1.5 my-2';
        const pad = o.small ? 'px-3 py-1.5 min-w-[56px]' : 'px-7 py-3 min-w-[100px]';
        const border = o.dashed ? 'border-dashed border-sky-400' : 'border-sky-200';
        const numId = o.numId ? ` id="${o.numId}"` : '';
        return `
            <div class="bg-white ${pad} rounded-2xl shadow-md border-2 ${border} flex flex-col items-center justify-center" aria-label="${num} su ${den}">
                <span${numId} class="${size} font-extrabold text-rose-500 leading-none">${num}</span>
                <div class="${bar} bg-slate-800 rounded-full"></div>
                <span class="${size} font-extrabold text-emerald-600 leading-none">${den}</span>
            </div>`;
    }

    const LEGEND_HTML = `
        <div class="text-center sm:text-right sm:order-first">
            <div class="text-xs font-bold text-rose-600 uppercase">Numeratore</div>
            <div class="text-[11px] text-slate-500 mb-2">(quante parti prendi)</div>
            <div class="text-xs font-bold text-emerald-600 uppercase">Denominatore</div>
            <div class="text-[11px] text-slate-500">(parti uguali in tutto)</div>
        </div>`;

    function stepperRow(field, color) {
        return `
            <div class="flex items-center gap-2">
                <button type="button" data-step="${field}" data-delta="-1" aria-label="${field === 'num' ? 'Numeratore' : 'Denominatore'} meno uno" class="btn-3d w-11 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 text-2xl font-bold rounded-xl border-2 border-slate-300 cursor-pointer">−</button>
                <span id="in-${field}" class="w-14 text-center text-4xl sm:text-5xl font-extrabold ${color} leading-none" aria-live="polite">?</span>
                <button type="button" data-step="${field}" data-delta="1" aria-label="${field === 'num' ? 'Numeratore' : 'Denominatore'} più uno" class="btn-3d w-11 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 text-2xl font-bold rounded-xl border-2 border-slate-300 cursor-pointer">+</button>
            </div>`;
    }

    // ==========================================
    // TESTI E BOX DELLA MISSIONE
    // ==========================================
    function renderMission() {
        const m = state.mode;
        let badge = 'Missione Cioccolatosa';
        let title = '';
        let desc = '';
        let tip = '';
        let box = '';

        if (m === 'prendi') {
            title = 'Prepara la frazione nel piatto!';
            desc = 'Sposta dalla barretta al piatto tanti quadretti quanti ne dice il numeratore.';
            tip = '💡 Puoi anche riportare i quadretti indietro se cambi idea!';
            box = fractionHTML(state.num, state.den) + LEGEND_HTML;
        } else if (m === 'dividi') {
            badge = 'Missione da Pasticcere';
            title = 'Dividi e prendi!';
            desc = 'Prima taglia la barretta in parti uguali (il denominatore), poi metti nel piatto le parti del numeratore.';
            tip = '🔪 Usa i tasti − e + sopra la barretta per tagliarla.';
            box = fractionHTML(state.num, state.den) + LEGEND_HTML;
        } else if (m === 'riconosci') {
            badge = 'Missione Detective';
            const askPlate = state.recog.ask === 'piatto';
            title = askPlate ? 'Che frazione c\'è nel piatto?' : 'Quanto cioccolato è rimasto?';
            desc = askPlate
                ? 'Guarda il cioccolato nel piatto e scrivi la frazione di barretta che rappresenta.'
                : 'Qualcuno ha già preso dei quadretti! Scrivi la frazione di barretta che è rimasta.';
            tip = '🔢 Usa i tasti − e + per scrivere numeratore e denominatore.';
            box = `
                <div class="bg-white px-4 py-3 rounded-2xl shadow-md border-2 border-dashed border-sky-400 flex flex-col items-center gap-2" role="group" aria-label="La tua frazione">
                    ${stepperRow('num', 'text-rose-500')}
                    <div class="w-28 h-1.5 bg-slate-800 rounded-full"></div>
                    ${stepperRow('den', 'text-emerald-600')}
                </div>
                ${LEGEND_HTML}`;
        } else if (m === 'equivalenti') {
            badge = 'Missione Bilancia';
            title = 'Stessa quantità, quadretti più piccoli!';
            desc = `Questa barretta è tagliata in quadretti più piccoli. Metti nel piatto la stessa quantità di cioccolato di ${state.num}/${state.den}.`;
            tip = `⚖️ Ogni parte di ${state.num}/${state.den} ora è fatta da più quadretti piccoli.`;
            box = `
                <div class="flex items-center gap-3">
                    ${fractionHTML(state.num, state.den)}
                    <span class="text-4xl font-extrabold text-slate-700" aria-hidden="true">=</span>
                    ${fractionHTML('?', state.parts, { dashed: true, numId: 'equiv-live' })}
                </div>`;
        } else if (m === 'confronta') {
            badge = 'Missione Golosa';
            title = 'Chi ha più cioccolato?';
            desc = 'Confronta le due frazioni e scegli il segno giusto: minore, uguale o maggiore.';
            tip = '👀 Le due barrette sono lunghe uguali: guarda quanto cioccolato c\'è!';
            const { a, b } = state.cmp;
            box = `
                <div class="flex items-center gap-3">
                    ${fractionHTML(a.num, a.den)}
                    <span id="cmp-sign" class="w-16 h-16 flex items-center justify-center rounded-2xl border-4 border-dashed border-sky-400 bg-white text-4xl font-extrabold text-sky-700">?</span>
                    ${fractionHTML(b.num, b.den)}
                </div>`;
        }

        el.badge.textContent = badge;
        el.title.textContent = title;
        el.desc.textContent = desc;
        el.tip.textContent = tip;
        el.fractionBox.innerHTML = box;
        if (m === 'riconosci') updateRecogInputs();
    }

    function renderTabs() {
        el.tabs.innerHTML = '';
        MODES.forEach(mode => {
            const b = document.createElement('button');
            b.type = 'button';
            const active = mode.id === state.mode;
            b.className = 'btn-3d px-4 py-2 rounded-2xl font-bold text-sm sm:text-base cursor-pointer flex items-center gap-1.5 shadow-sm ' +
                (active ? 'bg-amber-500 text-white border-amber-700' : 'bg-white/90 hover:bg-amber-100 text-amber-900 border-amber-300');
            b.setAttribute('aria-pressed', String(active));
            b.innerHTML = `<span aria-hidden="true">${mode.icon}</span><span>${mode.label}</span>`;
            b.addEventListener('click', () => setMode(mode.id));
            el.tabs.appendChild(b);
        });
    }

    // ==========================================
    // NUOVO TURNO
    // ==========================================
    function makePieces(n) {
        state.pieces = [];
        for (let i = 0; i < n; i++) state.pieces.push({ id: i, location: 'bar' });
        state.lastMoved = null;
    }

    function newRound() {
        state.solved = false;
        state.locked = false;
        const m = state.mode;

        if (m === 'prendi' || m === 'dividi') {
            const f = pickFresh(PROPER, x => `${x.num}/${x.den}`, m);
            state.num = f.num;
            state.den = f.den;
            state.parts = m === 'dividi' ? 1 : f.den;
            makePieces(state.parts);
        } else if (m === 'equivalenti') {
            const f = pickFresh(EQUIVALENTS, x => `${x.num}/${x.den}x${x.k}`, m);
            state.num = f.num;
            state.den = f.den;
            state.equiv = { k: f.k };
            state.parts = f.den * f.k;
            makePieces(state.parts);
        } else if (m === 'riconosci') {
            const f = pickFresh(PROPER, x => `${x.num}/${x.den}`, m);
            state.num = f.num;
            state.den = f.den;
            state.parts = f.den;
            state.recog = { ask: Math.random() < 0.5 ? 'piatto' : 'barretta', num: null, den: null };
            makePieces(state.parts);
            // Mette nel piatto `num` quadretti scelti a caso: restano dei "buchi" nella barretta
            shuffle(state.pieces.map(p => p.id)).slice(0, f.num).forEach(id => { state.pieces[id].location = 'plate'; });
            state.locked = true;
        } else if (m === 'confronta') {
            let a, b;
            if (Math.random() < 0.25) {
                [a, b] = pickFresh(SAME_VALUE_PAIRS, p => `${p[0].num}/${p[0].den}=${p[1].num}/${p[1].den}`, m);
            } else {
                do {
                    a = PROPER[randInt(0, PROPER.length - 1)];
                    b = PROPER[randInt(0, PROPER.length - 1)];
                } while (a.num * b.den === b.num * a.den);
            }
            state.cmp = { a, b, choice: null };
        }

        hideFeedback();
        el.btnCheck.classList.remove('hidden');
        el.btnReset.classList.remove('hidden');
        el.btnNext.classList.add('hidden');
        el.btnNext.firstElementChild.textContent = m === 'confronta' ? 'Prossimo confronto' : 'Prossima frazione';
        renderAll();
    }

    function setMode(id) {
        if (!MODE_IDS.includes(id)) return;
        if (id !== state.mode) play('pop');
        state.mode = id;
        save(STORAGE.mode, id);
        renderTabs();
        const isCompare = id === 'confronta';
        el.playArea.classList.toggle('hidden', isCompare);
        el.compareArea.classList.toggle('hidden', !isCompare);
        el.dividerControls.classList.toggle('hidden', id !== 'dividi');
        el.dividerControls.classList.toggle('flex', id === 'dividi');
        newRound();
    }

    function resetRound() {
        if (state.solved) return;
        const m = state.mode;
        if (m === 'riconosci') {
            state.recog.num = null;
            state.recog.den = null;
            updateRecogInputs();
        } else if (m === 'confronta') {
            state.cmp.choice = null;
            updateCompareChoice();
        } else if (m === 'dividi') {
            state.parts = 1;
            makePieces(1);
        } else {
            state.pieces.forEach(p => { p.location = 'bar'; });
            state.lastMoved = null;
        }
        hideFeedback();
        play('pop');
        renderBoard();
    }

    // ==========================================
    // DISEGNO DI BARRETTA E PIATTO
    // ==========================================

    // Colonne della barretta: sempre un rettangolo pieno (es. 6 = 2x3, 8 = 2x4, 5 e 7 in una riga)
    function barColumns(n) {
        return { 4: 2, 6: 3, 8: 4, 9: 3, 10: 5, 12: 4 }[n] || n;
    }

    function renderAll() {
        renderMission();
        if (state.mode === 'confronta') renderCompare();
        else renderBoard();
    }

    function renderBoard() {
        if (state.mode === 'confronta') return;
        const strip = state.mode === 'dividi'; // nel gioco "dividi" la barretta è una striscia che si taglia
        const whole = strip && state.parts === 1;

        // ---- Barretta ----
        el.barGrid.innerHTML = '';
        if (strip) {
            el.barGrid.style.gridTemplateColumns = `repeat(${state.parts}, minmax(0, 1fr))`;
            el.barGrid.style.width = '100%';
        } else {
            el.barGrid.style.gridTemplateColumns = `repeat(${barColumns(state.parts)}, minmax(0, 5rem))`;
            el.barGrid.style.width = '';
        }

        state.pieces.forEach(piece => {
            const slot = document.createElement('div');
            slot.className = strip
                ? 'choco-slot strip h-14 sm:h-24 w-full p-1 flex items-center justify-center'
                : 'choco-slot aspect-square w-full p-1 flex items-center justify-center';
            if (piece.location === 'bar') {
                slot.appendChild(createChoco(piece, strip ? 'strip' : 'square', whole));
            } else {
                slot.setAttribute('aria-hidden', 'true');
            }
            el.barGrid.appendChild(slot);
        });

        if (state.mode === 'riconosci') el.barCounter.textContent = 'In quante parti è divisa?';
        else el.barCounter.textContent = whole ? 'Barretta intera' : `Divisa in ${state.parts} parti`;
        el.dividerValue.textContent = state.parts;
        el.dividerMinus.disabled = state.solved || state.parts <= 1;
        el.dividerPlus.disabled = state.solved || state.parts >= MAX_PARTS;

        if (state.locked) el.barHint.textContent = 'Guarda bene: gli spazi vuoti sono i quadretti finiti nel piatto.';
        else if (whole) el.barHint.textContent = 'La barretta è ancora intera: prima tagliala con il tasto +';
        else el.barHint.textContent = 'Trascina un quadretto verso il piatto (o toccalo per spostarlo subito)';

        // ---- Piatto ----
        const onPlate = state.pieces.filter(p => p.location === 'plate');
        const n = onPlate.length;
        el.plateGrid.innerHTML = '';
        el.platePlaceholder.classList.toggle('hidden', n > 0);
        const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
        el.plateGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 4.5rem))`;
        onPlate.forEach(piece => el.plateGrid.appendChild(createChoco(piece, 'square', false)));

        el.plateCounter.textContent = state.mode === 'riconosci' ? 'Quanti quadretti?' : `Quadretti nel piatto: ${n}`;
        if (state.mode === 'equivalenti') {
            el.plateHint.innerHTML = `Ogni quadretto vale <span class="font-bold">1/${state.parts}</span> di barretta.`;
            const live = document.getElementById('equiv-live');
            if (live) live.textContent = n === 0 ? '?' : n;
        } else if (state.mode === 'riconosci') {
            el.plateHint.textContent = 'Conta bene i quadretti… e non dimenticare gli spazi vuoti!';
        } else {
            el.plateHint.innerHTML = 'Controlla che il numero di quadretti corrisponda al <span class="text-rose-500 font-bold">numeratore</span>!';
        }

        state.lastMoved = null;
    }

    function createChoco(piece, shape, wholeBar) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.id = piece.id;
        b.className = shape === 'strip' ? 'choco-piece fill' : 'choco-piece w-full aspect-square';

        if (state.locked || wholeBar || state.solved) {
            b.classList.add('locked');
            b.tabIndex = -1;
            b.setAttribute('aria-disabled', 'true');
            b.setAttribute('aria-label', wholeBar ? 'Barretta intera, ancora da tagliare' : 'Quadretto di cioccolato');
            if (wholeBar) b.addEventListener('click', () => {
                showFeedback('warning', '🔪 Prima taglia la barretta!', 'Usa il tasto + per dividerla in parti uguali. Il denominatore ti dice in quante.');
                play('error');
            });
        } else {
            const where = piece.location === 'bar' ? 'nella barretta: premi per metterlo nel piatto' : 'nel piatto: premi per rimetterlo nella barretta';
            b.setAttribute('aria-label', `Quadretto ${piece.id + 1}, ${where}`);
            b.addEventListener('pointerdown', onPointerDown);
            // Attivazione da tastiera (Invio / Spazio): il click arriva con detail = 0
            b.addEventListener('click', e => {
                if (e.detail !== 0 || drag || performance.now() - lastPointerUp < 600) return;
                const id = piece.id;
                movePiece(id, piece.location === 'bar' ? 'plate' : 'bar');
                const again = document.querySelector(`.choco-piece[data-id="${id}"]:not(.locked)`);
                if (again) again.focus();
            });
        }
        if (piece.id === state.lastMoved) b.classList.add('animate-pop');
        return b;
    }

    function movePiece(id, to) {
        if (state.solved || state.locked) return false;
        const piece = state.pieces.find(p => p.id === id);
        if (!piece || piece.location === to) return false;
        piece.location = to;
        state.lastMoved = id;
        play('pop');
        hideFeedback();
        renderBoard();
        announce(`Quadretti nel piatto: ${state.pieces.filter(p => p.location === 'plate').length}`);
        return true;
    }

    function setParts(n) {
        if (state.solved) return;
        n = Math.max(1, Math.min(MAX_PARTS, n));
        if (n === state.parts) return;
        state.parts = n;
        makePieces(n);
        play('pop');
        hideFeedback();
        renderBoard();
        announce(n === 1 ? 'Barretta intera' : `Barretta divisa in ${n} parti`);
    }

    // ==========================================
    // TRASCINAMENTO (mouse + touch + LIM, un dito alla volta)
    // ==========================================
    let drag = null; // { id, pointerId, x, y, moving, el }
    let lastPointerUp = 0;

    function onPointerDown(e) {
        if (state.solved || state.locked) return;
        if (e.button !== undefined && e.button > 0) return; // solo tasto sinistro
        if (drag) return; // un altro dito sta già trascinando: ignora (multi-touch su LIM)
        e.preventDefault();
        drag = { id: parseInt(e.currentTarget.dataset.id, 10), pointerId: e.pointerId, x: e.clientX, y: e.clientY, moving: false, el: e.currentTarget };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
    }

    function isOver(target, x, y) {
        const r = target.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function onPointerMove(e) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        if (!drag.moving && (Math.abs(e.clientX - drag.x) > 6 || Math.abs(e.clientY - drag.y) > 6)) {
            drag.moving = true;
            drag.el.style.opacity = '0.3';
            el.ghost.classList.remove('hidden');
        }
        if (!drag.moving) return;
        el.ghost.style.left = `${e.clientX - 32}px`;
        el.ghost.style.top = `${e.clientY - 32}px`;
        el.plate.classList.toggle('drag-over', isOver(el.plate, e.clientX, e.clientY));
        const overBar = isOver(el.barWrapper, e.clientX, e.clientY);
        el.barWrapper.classList.toggle('ring-4', overBar);
        el.barWrapper.classList.toggle('ring-amber-300', overBar);
    }

    function endDrag() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        el.plate.classList.remove('drag-over');
        el.barWrapper.classList.remove('ring-4', 'ring-amber-300');
        el.ghost.classList.add('hidden');
        const d = drag;
        drag = null;
        if (d && d.el) d.el.style.opacity = '';
        return d;
    }

    function onPointerCancel(e) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        endDrag();
    }

    function onPointerUp(e) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const d = endDrag();
        lastPointerUp = performance.now();
        const piece = state.pieces.find(p => p.id === d.id);
        if (!piece) return;

        if (!d.moving) {
            // Semplice tocco: sposta il quadretto dall'altra parte
            movePiece(piece.id, piece.location === 'bar' ? 'plate' : 'bar');
        } else if (isOver(el.plate, e.clientX, e.clientY)) {
            movePiece(piece.id, 'plate');
        } else if (isOver(el.barWrapper, e.clientX, e.clientY)) {
            movePiece(piece.id, 'bar');
        }
    }

    // ==========================================
    // GIOCO "CHE FRAZIONE È?": inserimento numeri
    // ==========================================
    function stepInput(field, delta) {
        if (state.solved || !state.recog) return;
        const r = state.recog;
        const min = field === 'num' ? 0 : 1;
        const current = r[field];
        let next;
        if (current === null) next = delta > 0 ? Math.max(1, min) : min;
        else next = Math.max(min, Math.min(MAX_PARTS, current + delta));
        r[field] = next;
        play('pop');
        hideFeedback();
        updateRecogInputs();
    }

    function updateRecogInputs() {
        const n = document.getElementById('in-num');
        const d = document.getElementById('in-den');
        if (n) n.textContent = state.recog.num === null ? '?' : state.recog.num;
        if (d) d.textContent = state.recog.den === null ? '?' : state.recog.den;
        el.fractionBox.querySelectorAll('[data-step]').forEach(b => { b.disabled = state.solved; });
    }

    // ==========================================
    // GIOCO "CONFRONTA"
    // ==========================================
    function compareBarHTML(f) {
        let cells = '';
        for (let i = 0; i < f.den; i++) {
            cells += i < f.num
                ? '<div class="choco-slot strip h-12 sm:h-16 p-1"><div class="choco-piece fill locked"></div></div>'
                : '<div class="choco-slot strip h-12 sm:h-16"></div>';
        }
        return `
            <div class="flex items-center gap-3 sm:gap-4">
                ${fractionHTML(f.num, f.den, { small: true })}
                <div class="choco-wrapper flex-1 p-2 sm:p-3 rounded-2xl" role="img" aria-label="Barretta divisa in ${f.den} parti, ${f.num} piene">
                    <div class="grid gap-1 sm:gap-1.5" style="grid-template-columns: repeat(${f.den}, minmax(0, 1fr));">${cells}</div>
                </div>
            </div>`;
    }

    function renderCompare() {
        el.compareBars.innerHTML = compareBarHTML(state.cmp.a) + compareBarHTML(state.cmp.b);
        updateCompareChoice();
    }

    function updateCompareChoice() {
        const choice = state.cmp ? state.cmp.choice : null;
        document.querySelectorAll('.compare-sign').forEach(b => {
            const on = b.dataset.sign === choice;
            b.setAttribute('aria-pressed', String(on));
            b.classList.toggle('bg-sky-500', on);
            b.classList.toggle('text-white', on);
            b.classList.toggle('bg-white', !on);
            b.classList.toggle('text-sky-900', !on);
            b.disabled = state.solved;
        });
        const sign = document.getElementById('cmp-sign');
        if (sign) sign.textContent = choice || '?';
    }

    function chooseSign(sign) {
        if (state.solved) return;
        state.cmp.choice = sign;
        play('pop');
        hideFeedback();
        updateCompareChoice();
    }

    // ==========================================
    // VERIFICA DELLA RISPOSTA
    // ==========================================
    function success(title, message) {
        state.solved = true;
        state.score += 1;
        save(STORAGE.score, state.score);
        el.score.textContent = state.score;
        play('win');
        launchConfetti();
        showFeedback('success', title, message);
        el.btnCheck.classList.add('hidden');
        el.btnReset.classList.add('hidden');
        el.btnNext.classList.remove('hidden');
        el.btnNext.focus({ preventScroll: true });
        // Blocca i comandi del turno appena risolto
        if (state.mode === 'confronta') updateCompareChoice();
        else if (state.mode === 'riconosci') updateRecogInputs();
        else renderBoard();
    }

    function mistake(title, message, target) {
        play('error');
        const shakeEl = target || el.plate;
        shakeEl.classList.remove('animate-shake');
        void shakeEl.offsetWidth; // riavvia l'animazione
        shakeEl.classList.add('animate-shake');
        setTimeout(() => shakeEl.classList.remove('animate-shake'), 450);
        showFeedback('warning', title, message);
    }

    function checkTake() {
        const count = state.pieces.filter(p => p.location === 'plate').length;
        const { num, den } = state;

        if (state.mode === 'dividi') {
            if (state.parts === 1) {
                return mistake('🔪 La barretta è ancora intera!', `Prima tagliala in parti uguali con il tasto +. Il denominatore (il numero in basso) ti dice in quante parti.`, el.barWrapper);
            }
            if (state.parts !== den) {
                return mistake('🤔 Le parti non sono giuste!', `Hai tagliato la barretta in ${state.parts} parti, ma il denominatore è ${den}: dividila in ${den} parti uguali!`, el.barWrapper);
            }
        }

        if (count === num) {
            const extra = state.mode === 'dividi' ? ' L\'hai anche tagliata nel modo giusto!' : '';
            return success('🎉 Ottimo lavoro! Fantastico!', `Hai preparato esattamente ${num}/${den} della barretta di cioccolato!${extra} Hai guadagnato una stella!`);
        }
        if (count === 0) {
            return mistake('🍽️ Il piatto è ancora vuoto!', `Metti nel piatto ${qq(num)} di cioccolato.`);
        }
        if (count < num) {
            const missing = num - count;
            return mistake('🤔 Manca ancora qualche quadretto!', `Hai messo ${qq(count)}, ma il numeratore (il numero in alto) ti chiede di prenderne ${num}. Aggiungine ancora ${missing}!`);
        }
        const extra = count - num;
        return mistake('😅 Ops! Hai messo troppi quadretti!', `Nel piatto ci sono ${qq(count)}, ma ne servono solo ${num}. Riporta ${qq(extra)} nella barretta!`);
    }

    function checkEquivalent() {
        const count = state.pieces.filter(p => p.location === 'plate').length;
        const { num, den, parts } = state;
        const k = state.equiv.k;

        if (count * den === num * parts) {
            return success('🎉 Perfetto, sono equivalenti!', `${num}/${den} = ${count}/${parts}: è la stessa quantità di cioccolato, solo tagliata in quadretti più piccoli! Hai guadagnato una stella!`);
        }
        if (count === 0) {
            return mistake('🍽️ Il piatto è ancora vuoto!', `Metti nel piatto la stessa quantità di cioccolato di ${num}/${den}.`);
        }
        const less = count * den < num * parts;
        return mistake(
            less ? '🤏 Un po\' poco cioccolato!' : '😅 Troppo cioccolato!',
            `Nel piatto c'è ${count}/${parts} di barretta: è ${less ? 'meno' : 'più'} di ${num}/${den}. Suggerimento: ogni parte di ${num}/${den} è stata tagliata in ${k} quadretti piccoli.`
        );
    }

    function checkRecognize() {
        const r = state.recog;
        const { num, den } = state;
        const askPlate = r.ask === 'piatto';
        const wantNum = askPlate ? num : den - num;
        const where = askPlate ? 'nel piatto' : 'rimasti nella barretta';

        if (r.num === null || r.den === null) {
            return mistake('✏️ Completa la frazione!', 'Usa i tasti − e + per scegliere sia il numeratore (in alto) sia il denominatore (in basso).', el.fractionBox);
        }
        if (r.num * den === wantNum * r.den) {
            const same = r.num === wantNum && r.den === den;
            const note = same ? '' : ` Hai scritto ${r.num}/${r.den}, che è equivalente a ${wantNum}/${den}: bravissimo!`;
            return success('🎉 Esatto, detective!', `${askPlate ? 'Nel piatto c\'è' : 'Nella barretta sono rimasti'} ${wantNum}/${den} di barretta.${note} Hai guadagnato una stella!`);
        }
        if (r.den !== den) {
            return mistake('🔍 Controlla il denominatore!', 'Il denominatore dice in quante parti uguali è divisa TUTTA la barretta: conta anche gli spazi vuoti!', el.fractionBox);
        }
        if (r.num === (askPlate ? den - num : num)) {
            return mistake('🔄 Attenzione alla domanda!', `Hai contato i quadretti ${askPlate ? 'rimasti nella barretta' : 'nel piatto'}, ma la domanda chiede quelli ${where}.`, el.fractionBox);
        }
        return mistake('🔍 Il denominatore è giusto!', `Ora conta bene i quadretti ${where}: quello è il numeratore.`, el.fractionBox);
    }

    function checkCompare() {
        const { a, b, choice } = state.cmp;
        if (!choice) {
            return mistake('👆 Scegli un segno!', 'Tocca uno dei tre tasti: minore (<), uguale (=) o maggiore (>).', el.compareArea);
        }
        const left = a.num * b.den;
        const right = b.num * a.den;
        const correct = left < right ? '<' : left > right ? '>' : '=';
        const fa = `${a.num}/${a.den}`;
        const fb = `${b.num}/${b.den}`;

        if (choice === correct) {
            const text = correct === '='
                ? `${fa} e ${fb} sono equivalenti: le barrette hanno la stessa quantità di cioccolato!`
                : `${fa} ${correct === '<' ? 'è minore di' : 'è maggiore di'} ${fb}: guarda quanto cioccolato c'è nelle barrette!`;
            return success('🎉 Giusto!', `${text} Hai guadagnato una stella!`);
        }

        let hint = 'Guarda bene le due barrette: quale ha più cioccolato?';
        if (a.den === b.den) hint = 'Le barrette sono divise nello stesso numero di parti: vince chi ha il numeratore più grande!';
        else if (a.num === b.num) hint = 'Hanno lo stesso numeratore: con il denominatore più piccolo i pezzi sono più grandi!';
        else if (correct === '=') hint = 'Guarda bene: forse le due barrette hanno la stessa quantità di cioccolato…';
        return mistake('🤔 Non proprio!', hint, el.compareArea);
    }

    function checkAnswer() {
        if (state.solved) return;
        const m = state.mode;
        if (m === 'prendi' || m === 'dividi') checkTake();
        else if (m === 'equivalenti') checkEquivalent();
        else if (m === 'riconosci') checkRecognize();
        else if (m === 'confronta') checkCompare();
    }

    // ==========================================
    // FEEDBACK
    // ==========================================
    function showFeedback(type, title, message) {
        el.feedbackBox.classList.remove('hidden', 'bg-emerald-100', 'border-emerald-400', 'text-emerald-900', 'bg-amber-100', 'border-amber-400', 'text-amber-900');
        if (type === 'success') el.feedbackBox.classList.add('bg-emerald-100', 'border-emerald-400', 'text-emerald-900');
        else el.feedbackBox.classList.add('bg-amber-100', 'border-amber-400', 'text-amber-900');
        el.feedbackTitle.textContent = title;
        el.feedbackMsg.textContent = message;
        announce(`${title} ${message}`);
    }

    function hideFeedback() {
        el.feedbackBox.classList.add('hidden');
    }

    function announce(text) {
        el.srLive.textContent = '';
        // piccolo ritardo: così il lettore di schermo legge anche messaggi uguali al precedente
        setTimeout(() => { el.srLive.textContent = text; }, 30);
    }

    function launchConfetti() {
        if (typeof window.confetti !== 'function') return;
        window.confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.6 },
            colors: ['#F59E0B', '#10B981', '#EC4899', '#3B82F6', '#8B5CF6'],
            disableForReducedMotion: true,
        });
    }

    // ==========================================
    // FINESTRA DI AIUTO (Esc, clic fuori, focus intrappolato)
    // ==========================================
    let focusBeforeModal = null;

    function modalFocusables() {
        return Array.from(el.helpModal.querySelectorAll('button:not([disabled])'));
    }

    function openHelpModal() {
        play('pop');
        focusBeforeModal = document.activeElement;
        el.helpModal.classList.remove('hidden');
        el.helpModal.classList.add('flex');
        document.getElementById('help-close').focus();
        document.addEventListener('keydown', onModalKeydown);
    }

    function closeHelpModal() {
        play('pop');
        el.helpModal.classList.add('hidden');
        el.helpModal.classList.remove('flex');
        document.removeEventListener('keydown', onModalKeydown);
        if (focusBeforeModal && typeof focusBeforeModal.focus === 'function') focusBeforeModal.focus();
    }

    function onModalKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeHelpModal();
        } else if (e.key === 'Tab') {
            const items = modalFocusables();
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    function resetScore() {
        if (!window.confirm('Vuoi davvero azzerare tutte le stelle?')) return;
        state.score = 0;
        save(STORAGE.score, 0);
        el.score.textContent = '0';
        play('pop');
    }

    // ==========================================
    // AVVIO
    // ==========================================
    function bindEvents() {
        el.soundBtn.addEventListener('click', toggleAudio);
        document.getElementById('btn-help').addEventListener('click', openHelpModal);
        document.getElementById('help-close').addEventListener('click', closeHelpModal);
        document.getElementById('help-close-x').addEventListener('click', closeHelpModal);
        document.getElementById('btn-reset-score').addEventListener('click', resetScore);
        el.helpModal.addEventListener('click', e => { if (e.target === el.helpModal) closeHelpModal(); });

        el.btnCheck.addEventListener('click', checkAnswer);
        el.btnReset.addEventListener('click', resetRound);
        el.btnNext.addEventListener('click', () => { play('pop'); newRound(); });

        el.dividerMinus.addEventListener('click', () => setParts(state.parts - 1));
        el.dividerPlus.addEventListener('click', () => setParts(state.parts + 1));

        el.fractionBox.addEventListener('click', e => {
            const btn = e.target.closest('[data-step]');
            if (btn) stepInput(btn.dataset.step, parseInt(btn.dataset.delta, 10));
        });

        document.querySelectorAll('.compare-sign').forEach(b => b.addEventListener('click', () => chooseSign(b.dataset.sign)));
    }

    function init() {
        el.score.textContent = state.score;
        updateSoundButton();
        bindEvents();
        setMode(state.mode);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
