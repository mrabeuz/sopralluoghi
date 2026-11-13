/* Sopralluoghi – PWA offline
 * Dati locali in IndexedDB, coda di sincronizzazione verso Apps Script (CONFIG.API_URL).
 */
'use strict';

/* ======================= ICONE ======================= */
const I = {
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  gal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  xls:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
  zip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>'
};

/* ======================= UTILITÀ ======================= */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };
const fmt = (n, d = 2) => n == null ? '' : n.toLocaleString('it-IT', {maximumFractionDigits:d});
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const arr = v => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (x) { return []; } };
const dataIt = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
const dataOra = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5] : ''; };
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const oggi = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const nowIso = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); };
function mq(e) { const l = num(e.larghezza_mm), h = num(e.altezza_mm); if (l == null || h == null) return null; const q = num(e.quantita) || 1; return l * h / 1e6 * q; }
function dimStr(e) { const p = [e.larghezza_mm, e.altezza_mm, e.profondita_mm].filter(v => String(v || '').trim() !== ''); return p.length ? p.join(' × ') + ' mm' : ''; }

let toastT;
function toast(msg, actionLabel, action, ms = 3500) {
  clearTimeout(toastT);
  const old = $('.toast'); if (old) old.remove();
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (actionLabel ? '<button>' + esc(actionLabel) + '</button>' : '');
  if (actionLabel) t.querySelector('button').onclick = () => { t.remove(); action(); };
  document.body.appendChild(t);
  toastT = setTimeout(() => t.remove(), ms);
}
function busy(msg) {
  let b = $('.busy');
  if (msg === false) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.className = 'busy'; b.innerHTML = '<div><span class="spin"></span><span class="m"></span></div>'; document.body.appendChild(b); }
  b.querySelector('.m').textContent = msg || 'Attendere…';
}
function fail(err) { busy(false); console.error(err); toast((err && err.net) ? 'Nessuna connessione: riprova quando c\'è rete.' : 'Errore: ' + (err && err.message ? err.message : err), null, null, 6000); }
const spinner = () => '<div class="empty"><div class="spin" style="margin:0 auto"></div></div>';

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector('script[src="' + src + '"]')) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('Componente di export non disponibile: apri l\'app una volta con la rete per scaricarlo.')); };
    document.head.appendChild(s);
  });
}
const LIB = { xlsx: 'lib/xlsx.full.min.js', pdf: 'lib/jspdf.umd.min.js', zip: 'lib/jszip.min.js' };
/** Accetta solo immagini come data URL (difesa contro contenuti inattesi dal server). */
const safeImg = du => (typeof du === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(du)) ? du : '';

function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}
function dataUrlToBlob(du) {
  const [h, b] = du.split(','); const type = (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type });
}
function compressBlob(file, max, q) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const r = Math.min(1, max / Math.max(w, h)); w = Math.round(w * r); h = Math.round(h * r);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('Compressione non riuscita')), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Formato immagine non supportato')); };
    img.src = url;
  });
}

/* ======================= ARCHIVIO LOCALE (IndexedDB) ======================= */
const STORES = ['kv', 'sop', 'area', 'el', 'photo', 'thumb', 'lavq'];
let IDB = null;
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('sopralluoghi', 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('kv');
      db.createObjectStore('sop', { keyPath: 'id' });
      db.createObjectStore('area', { keyPath: 'id' });
      db.createObjectStore('el', { keyPath: 'id' });
      db.createObjectStore('photo', { keyPath: 'c' });
      db.createObjectStore('thumb');
      db.createObjectStore('lavq', { keyPath: 'cid' });
    };
    r.onsuccess = () => { IDB = r.result; res(IDB); };
    r.onerror = () => rej(r.error);
  });
}
function idb(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = IDB.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    const r = fn(s);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Spazio di archiviazione insufficiente sul dispositivo'));
  });
}
const dbGet = (st, k) => idb(st, 'readonly', s => s.get(k));
const dbAll = st => idb(st, 'readonly', s => s.getAll());
const dbPut = (st, v, k) => idb(st, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k));
const dbDel = (st, k) => idb(st, 'readwrite', s => s.delete(k));
const dbClear = st => idb(st, 'readwrite', s => s.clear());

/* ======================= STATO ======================= */
const S = {
  token: '', email: '', liste: { tipo_intervento: [], superficie: [], stato: [] }, dbUrl: '', folderUrl: '', lavoriOn: false,
  sop: {}, area: {}, el: {}, photoMeta: {}, localThumb: {}, thumbs: {},
  view: 'home', sopId: null, areaId: null, q: '',
  syncing: false, lastSync: '', errors: [], online: navigator.onLine
};
const L = { q: '', risultati: null, live: false, recenti: [], idx: null, job: null, giorni: null, data: oggi(), note: '', queue: [] };

async function kvGet(k, def) { const v = await dbGet('kv', k); return v === undefined ? def : v; }
const kvSet = (k, v) => dbPut('kv', v, k);

function normRec(type, r) {
  const o = Object.assign({}, r);
  if (type === 'el') { o.foto = arr(r.foto); o.misure_extra = arr(r.misure_extra); }
  return o;
}
async function saveLocal(type, rec) {
  rec._rev = (rec._rev || 0) + 1;
  rec._dirty = 1;
  rec.modificato_il = nowIso();
  S[type][rec.id] = rec;
  await dbPut(type, rec);
  scheduleSync();
}
async function putClean(type, rec) { S[type][rec.id] = rec; await dbPut(type, rec); }
async function dropLocal(type, id) { delete S[type][id]; await dbDel(type, id); }

const live = t => Object.values(S[t]).filter(r => !r._del);
const sopList = () => live('sop').sort((a, b) => String(b.data || b.creato_il || '').localeCompare(String(a.data || a.creato_il || '')));
const areeOf = sid => live('area').filter(a => a.sopralluogo_id === sid).sort((a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0) || String(a.creato_il || '').localeCompare(String(b.creato_il || '')));
const elOfSop = sid => live('el').filter(e => e.sopralluogo_id === sid).sort((a, b) => String(a.codice || 'ZZZ' + a.creato_il).localeCompare(String(b.codice || 'ZZZ' + b.creato_il)));
const elOfArea = aid => live('el').filter(e => e.area_id === aid).sort((a, b) => String(a.codice || 'ZZZ' + a.creato_il).localeCompare(String(b.codice || 'ZZZ' + b.creato_il)));
const codiceEl = e => e.codice || 'nuovo';
const nuovoBadge = r => (r._dirty || r._new) ? '<span class="badge">da inviare</span>' : '';

/* ======================= SERVER ======================= */
async function api(action, args, timeoutMs = 90000) {
  if (!navigator.onLine) { const e = new Error('offline'); e.net = true; throw e; }
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action, args: args || {}, token: S.token }), signal: ctrl.signal, redirect: 'follow' });
  } catch (x) { const e = new Error('Rete non disponibile'); e.net = true; throw e; }
  finally { clearTimeout(tm); }
  let j;
  try { j = await res.json(); } catch (x) { const e = new Error('Risposta non valida dal server (' + res.status + ')'); e.net = res.status >= 500 || res.status === 0; throw e; }
  if (!j.ok) {
    const e = new Error(j.error || 'Errore'); e.code = j.code;
    if (j.code === 'AUTH') authLost();
    throw e;
  }
  return j.data;
}

/* ======================= ABBINAMENTO ======================= */
function configOk() { return CONFIG && /^https:\/\/script\.google\.com\//.test(CONFIG.API_URL || ''); }

function renderPair(msg) {
  $('#hdr').innerHTML = '<h1>Sopralluoghi</h1>';
  const def = /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computer';
  $('#app').innerHTML = '<div class="pair"><h1>Collega questo dispositivo</h1>' +
    (msg ? '<div class="warnbox">' + esc(msg) + '</div>' : '') +
    (!configOk() ? '<div class="warnbox">L\'app non è ancora configurata: inserisci gli indirizzi in <b>config.js</b> (vedi LEGGIMI).</div>' : '') +
    '<div class="card"><ol style="padding-left:20px;margin:0">' +
    '<li>Da un <b>computer</b> (o dal telefono) apri la pagina <b>Collega dispositivo</b> e accedi con l\'account <b>@serifoto.it</b>.</li>' +
    '<li>Premi <b>Genera codice</b>.</li><li>Scrivi qui il codice entro 10 minuti.</li></ol>' +
    (CONFIG.COLLEGA_URL && !/INCOLLA/.test(CONFIG.COLLEGA_URL) ? '<div style="margin-top:10px"><a href="' + esc(CONFIG.COLLEGA_URL) + '" target="_blank" rel="noopener">Apri la pagina Collega dispositivo</a></div>' : '') +
    '</div>' +
    '<label class="f"><span>Codice</span><input class="in-f codein" id="pc" placeholder="XXXXX-XXXXX" autocomplete="one-time-code" autocapitalize="characters" maxlength="11"></label>' +
    '<label class="f"><span>Nome di questo dispositivo</span><input class="in-f" id="pn" value="' + esc(def) + '" maxlength="60"></label>' +
    '<div style="margin-top:18px"><button class="btn pri block" id="pgo">Collega</button></div>' +
    '<div class="t2" style="margin-top:16px">I dati inseriti offline restano sul dispositivo finché non vengono inviati. Tieni attivo il blocco schermo del telefono.</div></div>';
  const pc = $('#pc');
  pc.oninput = () => { let v = pc.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5); pc.value = v; };
  $('#pgo').onclick = async () => {
    const code = pc.value.replace(/[^A-Z0-9]/gi, '');
    if (code.length !== 10) return toast('Il codice ha 10 caratteri');
    if (!navigator.onLine) return toast('Serve la connessione per collegare il dispositivo');
    busy('Collegamento…');
    try {
      const r = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'abbina', codice: code, dispositivo: $('#pn').value.trim() }) }).then(x => x.json());
      busy(false);
      if (!r.ok) return toast(r.error || 'Codice non valido', null, null, 6000);
      S.token = r.data.token; S.email = r.data.email;
      await kvSet('token', S.token); await kvSet('email', S.email);
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (x) {}
      toast('Dispositivo collegato: ' + S.email);
      startApp();
    } catch (e) { busy(false); toast('Collegamento non riuscito: controlla la rete e riprova', null, null, 6000); }
  };
}

let authLostShown = false;
async function authLost() {
  S.token = ''; await kvSet('token', '');
  if (authLostShown) return; authLostShown = true;
  closeModal();
  renderPair('Questo dispositivo non è più collegato (scollegato o non usato da molto tempo). I dati non ancora inviati sono al sicuro sul telefono: collegalo di nuovo e verranno sincronizzati.');
}

/* ======================= SINCRONIZZAZIONE ======================= */
let syncTimer = null;
function scheduleSync(ms = 1500) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(), ms); updateSyncPill(); }

function pendingCount() {
  let n = 0;
  ['sop', 'area', 'el'].forEach(t => Object.values(S[t]).forEach(r => { if (r._dirty || r._del) n++; }));
  n += Object.values(S.photoMeta).filter(p => !p.f || !p.t).length;
  n += L.queue.filter(q => q.st !== 'ok').length;
  return n;
}

function updateSyncPill() {
  const p = $('#syncPill'); if (!p) return;
  const n = pendingCount();
  let cls = '', txt = 'Sincronizzato';
  if (!navigator.onLine) { cls = 'off'; txt = n ? 'Offline · ' + n + ' in coda' : 'Offline'; }
  else if (S.syncing) { cls = 'pend run'; txt = n ? 'Invio… ' + n : 'Aggiorno…'; }
  else if (S.errors.length) { cls = 'err'; txt = n ? n + ' da inviare' : 'Errori'; }
  else if (n) { cls = 'pend'; txt = n + ' in coda'; }
  p.className = 'sync ' + cls;
  p.innerHTML = '<span class="dot"></span>' + esc(txt);
}

function payloadOf(type, r) {
  if (type === 'sop') return { id: r.id, cliente: r.cliente, punto_vendita: r.punto_vendita, indirizzo: r.indirizzo, data: r.data, stato: r.stato, referente: r.referente, note: r.note };
  if (type === 'area') return { id: r.id, sopralluogo_id: r.sopralluogo_id, nome: r.nome, piano: r.piano, note: r.note };
  return { id: r.id, sopralluogo_id: r.sopralluogo_id, area_id: r.area_id, descrizione: r.descrizione, tipo_intervento: r.tipo_intervento,
    superficie: r.superficie, larghezza_mm: r.larghezza_mm, altezza_mm: r.altezza_mm, profondita_mm: r.profondita_mm,
    quantita: r.quantita, note: r.note, misure_extra: r.misure_extra || [],
    foto: (r.foto || []).map(f => { const m = S.photoMeta[f.c] || {}; return { f: f.f || m.f || '', t: f.t || m.t || '', n: f.n || '', c: f.c || '' }; }) };
}

async function pushRecord(type, r, action) {
  const sentRev = r._rev;
  const saved = normRec(type, await api(action, { rec: payloadOf(type, r) }));
  const cur = S[type][r.id];
  if (!cur || cur._del) return;
  if (cur._rev === sentRev) {
    await putClean(type, Object.assign(saved, { _rev: cur._rev, _dirty: 0, _new: 0 }));
  } else {
    // modificato di nuovo durante l'invio: tiene i dati locali ma prende i campi del server
    ['codice', 'cartella_foto', 'creato_da', 'creato_il', 'ordine'].forEach(k => { if (saved[k] !== undefined) cur[k] = saved[k]; });
    cur._new = 0;
    await putClean(type, cur);
  }
}

async function sync(opts = {}) {
  if (S.syncing || !S.token || !configOk()) return;
  if (!navigator.onLine) { updateSyncPill(); return; }
  S.syncing = true; S.errors = []; updateSyncPill();
  const errs = [];
  const step = async (label, fn) => {
    try { await fn(); }
    catch (e) {
      if (e.net || e.code === 'AUTH') throw e;
      errs.push(label + ': ' + e.message);
    }
  };
  try {
    if (!S.liste.stato.length || opts.full) {
      const r = await api('init');
      S.liste = r.liste; S.dbUrl = r.dbUrl; S.folderUrl = r.folderUrl; S.lavoriOn = !!(r.lavori && r.lavori.configurato);
      await kvSet('meta', { liste: S.liste, dbUrl: S.dbUrl, folderUrl: S.folderUrl, lavoriOn: S.lavoriOn });
    }
    // 1. foto dei sopralluoghi
    const usedC = {};
    live('el').forEach(e => (e.foto || []).forEach(f => { if (f.c) usedC[f.c] = true; }));
    for (const meta of Object.values(S.photoMeta)) {
      if (meta.f && meta.t) continue;
      if (!usedC[meta.c]) continue; // foto non (ancora) salvata in un elemento
      const sop = S.sop[meta.sopId];
      if (!sop || sop._new) continue; // il sopralluogo va creato prima
      await step('Foto', async () => {
        const p = await dbGet('photo', meta.c);
        if (!p) return;
        if (!p.f) p.f = await api('uploadFoto', { sopId: p.sopId, dataUrl: await blobToDataUrl(p.full), nome: 'foto_' + p.c + '.jpg' });
        if (!p.t) p.t = await api('uploadFoto', { sopId: p.sopId, dataUrl: await blobToDataUrl(p.thumb), nome: 'foto_' + p.c + '_mini.jpg' });
        await dbPut('photo', p);
        meta.f = p.f; meta.t = p.t;
      });
    }
    // dopo l'upload delle foto bisogna creare i sopralluoghi nuovi e poi caricare le loro foto: ripete se servono
    // 2. sopralluoghi, aree, elementi modificati
    for (const r of Object.values(S.sop)) if (r._dirty && !r._del) await step('Sopralluogo ' + (r.cliente || ''), () => pushRecord('sop', r, 'saveSop'));
    for (const r of Object.values(S.area)) if (r._dirty && !r._del && !(S.sop[r.sopralluogo_id] || {})._new) await step('Area ' + (r.nome || ''), () => pushRecord('area', r, 'saveArea'));
    // foto dei sopralluoghi appena creati
    for (const meta of Object.values(S.photoMeta)) {
      if ((meta.f && meta.t) || !usedC[meta.c]) continue;
      const sop = S.sop[meta.sopId];
      if (!sop || sop._new) continue;
      await step('Foto', async () => {
        const p = await dbGet('photo', meta.c); if (!p) return;
        if (!p.f) p.f = await api('uploadFoto', { sopId: p.sopId, dataUrl: await blobToDataUrl(p.full), nome: 'foto_' + p.c + '.jpg' });
        if (!p.t) p.t = await api('uploadFoto', { sopId: p.sopId, dataUrl: await blobToDataUrl(p.thumb), nome: 'foto_' + p.c + '_mini.jpg' });
        await dbPut('photo', p); meta.f = p.f; meta.t = p.t;
      });
    }
    for (const r of Object.values(S.el)) {
      if (!r._dirty || r._del) continue;
      if ((S.sop[r.sopralluogo_id] || {})._new || (S.area[r.area_id] || {})._new) continue;
      const missing = (r.foto || []).some(f => !(f.f || (S.photoMeta[f.c] || {}).f) || !(f.t || (S.photoMeta[f.c] || {}).t));
      if (missing) continue;
      await step('Elemento ' + codiceEl(r), () => pushRecord('el', r, 'saveEl'));
    }
    // 3. eliminazioni
    for (const [type, action] of [['el', 'deleteEl'], ['area', 'deleteArea'], ['sop', 'deleteSop']]) {
      for (const r of Object.values(S[type])) {
        if (!r._del) continue;
        await step('Eliminazione', async () => { await api(action, { id: r.id }); await dropLocal(type, r.id); });
      }
    }
    // 4. pulizia foto già inviate e registrate
    for (const meta of Object.values(S.photoMeta)) {
      if (!meta.f || !meta.t) continue;
      const el = Object.values(S.el).find(e => (e.foto || []).some(f => f.c === meta.c));
      if (el && el._dirty) continue;
      if (el) {
        const p = await dbGet('photo', meta.c);
        if (p && p.thumb) { const du = await blobToDataUrl(p.thumb); S.thumbs[meta.t] = du; await dbPut('thumb', du, meta.t); }
        (el.foto || []).forEach(f => { if (f.c === meta.c) { f.f = meta.f; f.t = meta.t; } });
      }
      await dbDel('photo', meta.c);
      delete S.photoMeta[meta.c];
    }
    // 5. lavori completati
    await syncLavori(step);
    // 6. aggiornamento dal server
    const all = await api('pull');
    await mergePull(all);
    if (S.lavoriOn) {
      const age = L.idx && L.idx.ts ? Date.now() - L.idx.ts : Infinity;
      if (age > 12 * 3600000 || opts.full) await step('Indice archivio', refreshIndex);
    }
    S.lastSync = nowIso(); await kvSet('lastSync', S.lastSync);
  } catch (e) {
    if (e.code !== 'AUTH' && !e.net) errs.push(e.message);
  } finally {
    S.syncing = false; S.errors = errs;
    updateSyncPill();
    const ae = document.activeElement;
    if (!$('.modal') && !$('.viewer') && !(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) render();
  }
}

async function mergePull(all) {
  const map = { sop: all.sopralluoghi || [], area: all.aree || [], el: all.elementi || [] };
  for (const type of ['sop', 'area', 'el']) {
    const seen = {};
    const tx = IDB.transaction(type, 'readwrite'); const st = tx.objectStore(type);
    map[type].forEach(r0 => {
      const r = normRec(type, r0); seen[r.id] = true;
      const loc = S[type][r.id];
      if (loc && (loc._dirty || loc._del)) return;
      r._rev = loc ? loc._rev || 0 : 0; r._dirty = 0;
      S[type][r.id] = r; st.put(r);
    });
    Object.values(S[type]).forEach(r => { if (!seen[r.id] && !r._dirty && !r._del && !r._new) { delete S[type][r.id]; st.delete(r.id); } });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
}

window.addEventListener('online', () => { S.online = true; updateSyncPill(); scheduleSync(300); });
window.addEventListener('offline', () => { S.online = false; updateSyncPill(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(500); });
setInterval(() => { if (document.visibilityState === 'visible' && pendingCount()) sync(); }, 60000);
window.addEventListener('beforeunload', e => { if (S.syncing && pendingCount()) { e.preventDefault(); e.returnValue = ''; } });

function openSyncPanel() {
  const n = pendingCount();
  const dirty = t => Object.values(S[t]).filter(r => r._dirty || r._del).length;
  const body = '<div class="card"><div class="list-k">' +
    '<span>Stato</span><b>' + (navigator.onLine ? (S.syncing ? 'Sincronizzazione in corso' : 'Online') : 'Offline') + '</b>' +
    '<span>Ultima sincronizzazione</span><b>' + (dataOra(S.lastSync) || '—') + '</b>' +
    '<span>Sopralluoghi da inviare</span><b>' + dirty('sop') + '</b>' +
    '<span>Aree da inviare</span><b>' + dirty('area') + '</b>' +
    '<span>Elementi da inviare</span><b>' + dirty('el') + '</b>' +
    '<span>Foto sopralluoghi da inviare</span><b>' + Object.values(S.photoMeta).filter(p => !p.f || !p.t).length + '</b>' +
    '<span>Foto lavori da inviare</span><b>' + L.queue.filter(q => q.st !== 'ok').length + '</b>' +
    '</div></div>' +
    (S.errors.length ? '<div class="warnbox"><b>Problemi all\'ultimo invio</b><br>' + S.errors.map(esc).join('<br>') + '</div>' : '') +
    '<div class="card"><div class="t2">Dispositivo collegato come</div><div class="t1">' + esc(S.email) + '</div></div>' +
    '<button class="btn block" id="spFull" style="margin-top:6px">Aggiorna tutto (elenchi e indice archivio)</button>' +
    '<button class="btn dan block" id="spOut" style="margin-top:22px">Scollega questo dispositivo</button>';
  const m = openModal('Sincronizzazione', body, '<button class="btn" data-c>Chiudi</button><button class="btn pri" data-s' + (navigator.onLine ? '' : ' disabled') + '>Sincronizza ora</button>');
  m.querySelector('[data-c]').onclick = closeModal;
  m.querySelector('[data-s]').onclick = () => { closeModal(); sync(); };
  $('#spFull').onclick = () => { closeModal(); sync({ full: true }); };
  $('#spOut').onclick = async () => {
    if (n && !confirm('Ci sono ' + n + ' elementi non ancora inviati: scollegando il dispositivo andranno PERSI. Continuare?')) return;
    if (!n && !confirm('Scollegare questo dispositivo? Dovrai generare un nuovo codice per usarlo.')) return;
    try { if (navigator.onLine) await api('logout', {}); } catch (e) {}
    for (const st of STORES) await dbClear(st);
    location.reload();
  };
}

/* ======================= NAVIGAZIONE ======================= */
function go(view, sopId, areaId, push = true) {
  S.view = view; S.sopId = sopId || null; S.areaId = areaId || null;
  if (push) history.pushState({ v: view, s: sopId || '', a: areaId || '' }, '');
  window.scrollTo(0, 0);
  if (view === 'home' || view === 'lavori') kvSet('tab', view);
  if (view === 'lavoro') return openLavoro(sopId);
  render();
}
window.addEventListener('popstate', e => {
  if ($('.viewer')) { $('.viewer').remove(); return; }
  if ($('.modal')) { tryCloseModal(); history.pushState({ v: S.view, s: S.sopId || '', a: S.areaId || '' }, ''); return; }
  const st = e.state || { v: 'home' };
  go(st.v || 'home', st.s, st.a, false);
});

/* ======================= RENDER ======================= */
function headerRight() { return '<button class="sync" id="syncPill"></button>'; }
function bindHeader() { const p = $('#syncPill'); if (p) { p.onclick = openSyncPanel; updateSyncPill(); } }

function renderHeader() {
  const h = $('#hdr');
  if (S.view === 'home' || S.view === 'lavori') {
    h.innerHTML = '<h1>' + (S.view === 'home' ? 'Sopralluoghi' : 'Lavori completati') + '<small>' + esc(S.email) + '</small></h1>' +
      headerRight() + '<button class="ib" id="bMenu" title="Altro">' + I.more + '</button>';
    $('#bMenu').onclick = toggleMenu;
    return bindHeader();
  }
  if (S.view === 'lavoro') {
    const j = L.job || {};
    h.innerHTML = '<button class="ib" id="bBack" title="Indietro">' + I.back + '</button>' +
      '<h1>' + esc(j.nome || '') + '<small>' + esc(j.cliente || '') + '</small></h1>' + headerRight();
    $('#bBack').onclick = () => history.back();
    return bindHeader();
  }
  const sop = S.sop[S.sopId];
  const area = S.view === 'area' ? S.area[S.areaId] : null;
  const title = area ? esc(area.nome) : (sop ? esc(sop.cliente || 'Sopralluogo') : '');
  const sub = sop ? esc(sop.codice || 'nuovo') + (area ? ' · ' + esc(sop.cliente) : (sop.punto_vendita ? ' · ' + esc(sop.punto_vendita) : '')) : '';
  h.innerHTML = '<button class="ib" id="bBack" title="Indietro">' + I.back + '</button><h1>' + title + '<small>' + sub + '</small></h1>' + headerRight();
  $('#bBack').onclick = () => history.back();
  bindHeader();
}

function render() {
  if (!S.token) return;
  renderHeader();
  if (S.view === 'home') return renderHome();
  if (S.view === 'lavori') return renderLavori();
  if (S.view === 'lavoro') return L.job ? renderLavoro() : null;
  if (S.view === 'sop') return S.sop[S.sopId] && !S.sop[S.sopId]._del ? renderSop() : go('home', null, null, false);
  if (S.view === 'area') return S.area[S.areaId] && !S.area[S.areaId]._del ? renderArea() : go('sop', S.sopId, null, false);
}

function statoChip(s) {
  if (!s) return '';
  const l = S.liste.stato || [];
  const cls = s === l[l.length - 1] ? 'ok' : s === l[0] ? 'warn' : '';
  return '<span class="chip ' + cls + '">' + esc(s) + '</span>';
}
function tabsHtml() {
  return '<div class="tabs"><button data-tab="home" class="' + (S.view === 'home' ? 'on' : '') + '">Sopralluoghi</button>' +
    '<button data-tab="lavori" class="' + (S.view === 'lavori' ? 'on' : '') + '">Lavori completati</button></div>';
}
function bindTabs() { document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { if (b.dataset.tab !== S.view) go(b.dataset.tab); }); }

function renderHome() {
  const q = norm(S.q);
  const all = sopList();
  const list = all.filter(s => !q || norm([s.codice, s.cliente, s.punto_vendita, s.indirizzo, s.referente].join(' ')).includes(q));
  let h = tabsHtml() + '<input class="search" id="q" placeholder="Cerca per cliente, punto vendita, indirizzo…" value="' + esc(S.q) + '">';
  if (!all.length) h += '<div class="empty">' + (S.lastSync ? 'Nessun sopralluogo ancora.<br>Tocca <b>Nuovo sopralluogo</b> per iniziare.' : (navigator.onLine ? 'Scarico i dati…' : 'Nessun dato sul dispositivo. Collegati a internet per scaricare i sopralluoghi esistenti.')) + '</div>';
  else if (!list.length) h += '<div class="empty">Nessun risultato.</div>';
  list.forEach(s => {
    const el = elOfSop(s.id);
    const nf = el.reduce((t, e) => t + (e.foto || []).length, 0);
    h += '<div class="card tap" data-id="' + esc(s.id) + '"><div class="row"><div class="grow">' +
      '<div class="t1">' + esc(s.cliente || '(senza cliente)') + (s.punto_vendita ? ' – ' + esc(s.punto_vendita) : '') + nuovoBadge(s) + '</div>' +
      '<div class="t2">' + esc(s.codice || 'nuovo') + (s.data ? ' · ' + dataIt(s.data) : '') + (s.indirizzo ? ' · ' + esc(s.indirizzo) : '') + '</div>' +
      '</div>' + statoChip(s.stato) + '</div>' +
      '<div class="stats"><span>' + areeOf(s.id).length + ' aree</span><span>' + el.length + ' elementi</span><span>' + nf + ' foto</span></div></div>';
  });
  h += '<button class="btn pri fab" id="bNew">' + I.plus + ' Nuovo sopralluogo</button>';
  $('#app').innerHTML = h;
  bindTabs();
  const qi = $('#q');
  qi.oninput = () => { S.q = qi.value; const pos = qi.selectionStart; renderHome(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  document.querySelectorAll('.card.tap').forEach(c => c.onclick = () => go('sop', c.dataset.id));
  $('#bNew').onclick = () => editSop(null);
}

function renderSop() {
  const s = S.sop[S.sopId];
  const aree = areeOf(s.id), elementi = elOfSop(s.id);
  let h = '<div class="card"><div class="row" style="align-items:flex-start"><div class="grow">' +
    '<div class="t1" style="white-space:normal">' + esc(s.cliente) + (s.punto_vendita ? ' – ' + esc(s.punto_vendita) : '') + nuovoBadge(s) + '</div>' +
    '<div class="t2">' + esc(s.codice || 'codice assegnato all\'invio') + '</div></div>' + statoChip(s.stato) +
    '<button class="ib" id="bEditSop" title="Modifica">' + I.edit + '</button></div>' +
    '<dl class="kv" style="margin-top:12px">' +
    (s.data ? '<dt>Data</dt><dd>' + dataIt(s.data) + '</dd>' : '') +
    (s.indirizzo ? '<dt>Indirizzo</dt><dd>' + esc(s.indirizzo) + '</dd>' : '') +
    (s.referente ? '<dt>Referente</dt><dd>' + esc(s.referente) + '</dd>' : '') +
    (s.note ? '<dt>Note</dt><dd>' + esc(s.note).replace(/\n/g, '<br>') + '</dd>' : '') +
    (s.creato_da ? '<dt>Creato da</dt><dd>' + esc(s.creato_da) + '</dd>' : '') +
    '</dl></div>';
  const totMq = elementi.reduce((t, e) => t + (mq(e) || 0), 0);
  h += '<div class="sec"><h2>Esporta</h2><span class="t2">' + elementi.length + ' elementi · ' + fmt(totMq) + ' m²</span></div>' +
    '<div class="exp"><button class="btn" id="eXls">' + I.xls + ' Excel</button><button class="btn" id="ePdf">' + I.pdf + ' PDF</button><button class="btn" id="eZip">' + I.zip + ' Foto</button></div>';
  h += '<div class="sec"><h2>Aree</h2></div>';
  if (!aree.length) h += '<div class="empty">Nessuna area. Aggiungi la prima zona del locale<br>(es. Vetrina, Ingresso, Reparto…)</div>';
  aree.forEach(a => {
    const el = elOfArea(a.id);
    const f = el.reduce((t, e) => t + (e.foto || []).length, 0);
    const m = el.reduce((t, e) => t + (mq(e) || 0), 0);
    h += '<div class="card tap" data-id="' + esc(a.id) + '"><div class="t1">' + esc(a.nome) + (a.piano ? ' <span class="t2">· ' + esc(a.piano) + '</span>' : '') + nuovoBadge(a) + '</div>' +
      '<div class="stats"><span>' + el.length + ' elementi</span><span>' + f + ' foto</span><span>' + fmt(m) + ' m²</span></div></div>';
  });
  h += '<button class="btn pri fab" id="bNewArea">' + I.plus + ' Nuova area</button>';
  $('#app').innerHTML = h;
  $('#bEditSop').onclick = () => editSop(s);
  document.querySelectorAll('.card.tap').forEach(c => c.onclick = () => go('area', s.id, c.dataset.id));
  $('#bNewArea').onclick = () => editArea(null);
  $('#eXls').onclick = () => exportExcelSop().catch(fail);
  $('#ePdf').onclick = () => exportPdf().catch(fail);
  $('#eZip').onclick = () => exportZip().catch(fail);
}

/* ---------- miniature ---------- */
function thumbUrl(fo) {
  if (fo.c && S.localThumb[fo.c]) return S.localThumb[fo.c];
  const t = fo.t || (S.photoMeta[fo.c] || {}).t;
  if (t && S.thumbs[t]) return S.thumbs[t];
  return '';
}
async function ensureThumbs(fotos) {
  const need = [];
  for (const fo of fotos) {
    if (thumbUrl(fo) || !fo.t) continue;
    const du = await dbGet('thumb', fo.t);
    if (safeImg(du)) S.thumbs[fo.t] = du; else need.push(fo.t);
  }
  if (need.length && navigator.onLine && S.token) {
    for (let i = 0; i < need.length; i += 20) {
      try {
        const r = await api('images', { ids: need.slice(i, i + 20) });
        for (const [id, du0] of Object.entries(r)) { const du = safeImg(du0); if (du) { S.thumbs[id] = du; dbPut('thumb', du, id); } }
      } catch (e) { if (e.net) break; }
    }
  }
}

function renderArea() {
  const area = S.area[S.areaId];
  const el = elOfArea(area.id);
  let h = '<div class="card"><div class="row"><div class="grow"><div class="t1">' + esc(area.nome) + nuovoBadge(area) + '</div>' +
    '<div class="t2">' + [area.piano, area.note].filter(Boolean).map(esc).join(' · ') + '</div></div>' +
    '<button class="ib" id="bEditArea" title="Modifica area">' + I.edit + '</button></div></div>';
  h += '<div class="sec"><h2>Elementi</h2><span class="t2">' + el.length + '</span></div>';
  if (!el.length) h += '<div class="empty">Nessun elemento in quest\'area.</div>';
  el.forEach(e => {
    const f = e.foto || [];
    const u = f[0] ? thumbUrl(f[0]) : '';
    const m = mq(e);
    h += '<div class="card tap" data-id="' + esc(e.id) + '"><div class="row">' +
      '<div class="thumb" data-k="' + esc(f[0] ? (f[0].c || f[0].t) : '') + '">' + (u ? '<img src="' + u + '">' : (f[0] ? '…' : 'no foto')) + '</div>' +
      '<div class="grow"><div class="t1">' + esc(codiceEl(e)) + ' · ' + esc(e.descrizione || e.tipo_intervento || 'Elemento') + nuovoBadge(e) + '</div>' +
      '<div class="t2">' + [e.tipo_intervento, e.superficie].filter(Boolean).map(esc).join(' · ') + '</div>' +
      '<div class="t2">' + esc(dimStr(e)) + (num(e.quantita) > 1 ? ' · ×' + esc(e.quantita) : '') + (m != null ? ' · ' + fmt(m) + ' m²' : '') + (f.length ? ' · ' + f.length + ' foto' : '') + '</div>' +
      '</div></div></div>';
  });
  h += '<button class="btn pri fab" id="bNewEl">' + I.plus + ' Nuovo elemento</button>';
  $('#app').innerHTML = h;
  $('#bEditArea').onclick = () => editArea(area);
  document.querySelectorAll('.card.tap').forEach(c => c.onclick = () => editEl(S.el[c.dataset.id]));
  $('#bNewEl').onclick = () => editEl(null);
  const firsts = el.map(e => (e.foto || [])[0]).filter(Boolean).filter(fo => !thumbUrl(fo));
  if (firsts.length) ensureThumbs(firsts).then(() => {
    if (S.view !== 'area') return;
    el.forEach(e => { const fo = (e.foto || [])[0]; if (!fo) return; const u = thumbUrl(fo); const d = document.querySelector('.thumb[data-k="' + CSS.escape(fo.c || fo.t) + '"]'); if (u && d) d.innerHTML = '<img src="' + u + '">'; });
  });
}

/* ======================= MENU ======================= */
function toggleMenu(ev) {
  ev.stopPropagation();
  let m = $('.menu'); if (m) return m.remove();
  m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = '<button id="mSync">Sincronizzazione e account</button><button id="mAll">Esporta tutto in Excel</button>' +
    (S.dbUrl ? '<button id="mDb">Apri il database (Foglio Google)</button>' : '') +
    (S.folderUrl ? '<button id="mFo">Apri la cartella foto su Drive</button>' : '');
  document.body.appendChild(m);
  $('#mSync').onclick = () => { m.remove(); openSyncPanel(); };
  $('#mAll').onclick = () => { m.remove(); exportExcelAll().catch(fail); };
  if ($('#mDb')) $('#mDb').onclick = () => { m.remove(); window.open(S.dbUrl, '_blank'); };
  if ($('#mFo')) $('#mFo').onclick = () => { m.remove(); window.open(S.folderUrl, '_blank'); };
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
}

/* ======================= MODALE ======================= */
let modalClose = null;
function openModal(title, body, footer, onClose) {
  closeModal();
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = '<div class="sheet"><div class="hd"><h3>' + esc(title) + '</h3><button class="ib" data-x>✕</button></div>' +
    '<div class="bd">' + body + '</div><div class="ft">' + footer + '</div></div>';
  $('#layer').appendChild(m);
  modalClose = onClose || null;
  m.querySelector('[data-x]').onclick = () => tryCloseModal();
  m.onclick = e => { if (e.target === m) tryCloseModal(); };
  return m;
}
function tryCloseModal() { if (modalClose) modalClose(); else closeModal(); }
function closeModal() { $('#layer').innerHTML = ''; modalClose = null; }
const field = (label, html) => '<label class="f"><span>' + label + '</span>' + html + '</label>';
const inp = (id, v, extra = '') => '<input class="in-f" id="' + id + '" value="' + esc(v) + '" ' + extra + '>';

/* ---------- Sopralluogo ---------- */
function editSop(s) {
  const isNew = !s;
  const d = s || { data: oggi(), stato: (S.liste.stato || [])[0] || '' };
  const stati = S.liste.stato.length ? S.liste.stato : ['Da fare', 'In corso', 'Completato'];
  const body =
    field('Cliente *', inp('fCli', d.cliente, 'autocomplete="off"')) +
    field('Punto vendita / sede', inp('fPv', d.punto_vendita)) +
    field('Indirizzo', inp('fInd', d.indirizzo)) +
    '<div class="g3" style="grid-template-columns:1fr 1fr">' +
    field('Data', '<input class="in-f" type="date" id="fData" value="' + esc(String(d.data || '').slice(0, 10)) + '">') +
    field('Stato', '<select class="in-f" id="fStato">' + stati.map(o => '<option' + (o === d.stato ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>') +
    '</div>' +
    field('Referente sul posto', inp('fRef', d.referente)) +
    field('Note', '<textarea class="in-f" id="fNote">' + esc(d.note) + '</textarea>') +
    (isNew ? '' : '<div style="margin-top:24px"><button class="btn dan block" id="fDel">Elimina sopralluogo</button></div>');
  const m = openModal(isNew ? 'Nuovo sopralluogo' : 'Modifica sopralluogo', body, '<button class="btn" data-c>Annulla</button><button class="btn pri" data-s>Salva</button>');
  m.querySelector('[data-c]').onclick = closeModal;
  m.querySelector('[data-s]').onclick = async () => {
    const rec = Object.assign({}, s || { id: uid(), _new: 1, creato_da: S.email, creato_il: nowIso() }, {
      cliente: $('#fCli').value.trim(), punto_vendita: $('#fPv').value.trim(), indirizzo: $('#fInd').value.trim(),
      data: $('#fData').value, stato: $('#fStato').value, referente: $('#fRef').value.trim(), note: $('#fNote').value.trim() });
    if (!rec.cliente) { toast('Inserisci il cliente'); return $('#fCli').focus(); }
    try { await saveLocal('sop', rec); } catch (e) { return fail(e); }
    closeModal();
    if (isNew) go('sop', rec.id); else render();
    toast(navigator.onLine ? 'Salvato' : 'Salvato sul dispositivo: verrà inviato quando c\'è rete');
  };
  if (!isNew) m.querySelector('#fDel').onclick = async () => {
    if (!confirm('Eliminare il sopralluogo ' + (s.codice || '') + ' con tutte le aree, gli elementi e le foto?\nL\'operazione non si può annullare.')) return;
    await deleteSopLocal(s.id);
    closeModal(); go('home'); toast('Sopralluogo eliminato');
  };
  if (isNew) setTimeout(() => $('#fCli').focus(), 50);
}

async function deleteSopLocal(id) {
  const s = S.sop[id];
  for (const e of Object.values(S.el).filter(e => e.sopralluogo_id === id)) { await dropPhotosOf(e); await dropLocal('el', e.id); }
  for (const a of Object.values(S.area).filter(a => a.sopralluogo_id === id)) await dropLocal('area', a.id);
  if (s._new) await dropLocal('sop', id);
  else { s._del = 1; await dbPut('sop', s); }
  scheduleSync();
}
async function dropPhotosOf(e) {
  for (const f of (e.foto || [])) if (f.c && S.photoMeta[f.c]) { await dbDel('photo', f.c); delete S.photoMeta[f.c]; if (S.localThumb[f.c]) { URL.revokeObjectURL(S.localThumb[f.c]); delete S.localThumb[f.c]; } }
}

/* ---------- Area ---------- */
function editArea(a) {
  const isNew = !a; const d = a || {};
  const body = field('Nome area *', inp('fNome', d.nome, 'placeholder="es. Vetrina principale, Ingresso, Reparto vini"')) +
    field('Piano / zona', inp('fPiano', d.piano, 'placeholder="es. Piano terra"')) +
    field('Note', '<textarea class="in-f" id="fNote">' + esc(d.note) + '</textarea>') +
    (isNew ? '' : '<div style="margin-top:24px"><button class="btn dan block" id="fDel">Elimina area</button></div>');
  const m = openModal(isNew ? 'Nuova area' : 'Modifica area', body, '<button class="btn" data-c>Annulla</button><button class="btn pri" data-s>Salva</button>');
  m.querySelector('[data-c]').onclick = closeModal;
  m.querySelector('[data-s]').onclick = async () => {
    const rec = Object.assign({}, a || { id: uid(), _new: 1, sopralluogo_id: S.sopId, creato_il: nowIso(), ordine: String(areeOf(S.sopId).length + 1) }, {
      nome: $('#fNome').value.trim(), piano: $('#fPiano').value.trim(), note: $('#fNote').value.trim() });
    if (!rec.nome) { toast('Inserisci il nome dell\'area'); return $('#fNome').focus(); }
    try { await saveLocal('area', rec); } catch (e) { return fail(e); }
    closeModal();
    if (isNew) go('area', S.sopId, rec.id); else render();
  };
  if (!isNew) m.querySelector('#fDel').onclick = async () => {
    const n = elOfArea(a.id).length;
    if (!confirm('Eliminare l\'area "' + a.nome + '"' + (n ? ' e i suoi ' + n + ' elementi con le foto' : '') + '?')) return;
    for (const e of Object.values(S.el).filter(e => e.area_id === a.id)) { await dropPhotosOf(e); await dropLocal('el', e.id); }
    if (a._new) await dropLocal('area', a.id); else { a._del = 1; await dbPut('area', a); }
    scheduleSync(); closeModal(); history.back(); toast('Area eliminata');
  };
  if (isNew) setTimeout(() => $('#fNome').focus(), 50);
}

/* ---------- Elemento ---------- */
let ED = null;
function chipGroup(id, options, value) {
  const custom = value && !options.includes(value);
  return '<div class="chips" id="' + id + '">' + options.map(o => '<button type="button" data-v="' + esc(o) + '" class="' + (o === value ? 'on' : '') + '">' + esc(o) + '</button>').join('') + '</div>' +
    '<input class="in-f' + (custom || value === 'Altro' ? '' : ' hidden') + '" id="' + id + 'X" placeholder="Specifica…" value="' + esc(custom ? value : '') + '" style="margin-top:6px">';
}
function chipValue(id) {
  const on = document.querySelector('#' + id + ' button.on'); const x = $('#' + id + 'X');
  if (!on) return x.value.trim();
  if (on.dataset.v === 'Altro' && x.value.trim()) return x.value.trim();
  return on.dataset.v;
}
function bindChips(id) {
  document.querySelectorAll('#' + id + ' button').forEach(b => b.onclick = () => {
    const was = b.classList.contains('on');
    document.querySelectorAll('#' + id + ' button').forEach(x => x.classList.remove('on'));
    if (!was) b.classList.add('on');
    $('#' + id + 'X').classList.toggle('hidden', !(b.dataset.v === 'Altro' && !was));
  });
}

function editEl(e) {
  const isNew = !e;
  const base = e ? Object.assign({}, e) : { id: uid(), _new: 1, sopralluogo_id: S.sopId, area_id: S.areaId, quantita: '1', creato_da: S.email, creato_il: nowIso() };
  ED = { rec: base, isNew, foto: (base.foto || []).map(f => Object.assign({}, f)), extra: (base.misure_extra || []).map(x => Object.assign({}, x)), added: [], working: 0 };
  const aree = areeOf(base.sopralluogo_id);
  const body =
    field('Descrizione', inp('fDesc', base.descrizione, 'placeholder="es. Vetrata sinistra ingresso"')) +
    field('Tipo intervento', chipGroup('cTipo', S.liste.tipo_intervento || [], base.tipo_intervento)) +
    field('Superficie / materiale', chipGroup('cSup', S.liste.superficie || [], base.superficie)) +
    '<div class="g3">' +
    field('Largh.', '<div class="unit"><input class="in-f" id="fL" inputmode="decimal" value="' + esc(base.larghezza_mm) + '"><em>mm</em></div>') +
    field('Alt.', '<div class="unit"><input class="in-f" id="fH" inputmode="decimal" value="' + esc(base.altezza_mm) + '"><em>mm</em></div>') +
    field('Prof.', '<div class="unit"><input class="in-f" id="fP" inputmode="decimal" value="' + esc(base.profondita_mm) + '"><em>mm</em></div>') +
    '</div>' +
    '<div class="g3" style="grid-template-columns:1fr 2fr">' + field('Quantità', inp('fQ', base.quantita, 'inputmode="numeric"')) +
    '<div class="calc" id="calc" style="align-self:end;padding-bottom:12px"></div></div>' +
    '<label class="f"><span>Altre misure</span></label><div id="extraBox"></div>' +
    '<button type="button" class="btn" id="bExtra" style="margin-top:6px">' + I.plus + ' Aggiungi misura</button>' +
    '<label class="f"><span>Foto</span></label><div class="photos" id="phBox"></div>' +
    field('Note', '<textarea class="in-f" id="fNote" placeholder="Accessi, ostacoli, colori, condizioni della superficie…">' + esc(base.note) + '</textarea>') +
    (aree.length > 1 ? field('Area', '<select class="in-f" id="fArea">' + aree.map(a => '<option value="' + esc(a.id) + '"' + (a.id === base.area_id ? ' selected' : '') + '>' + esc(a.nome) + '</option>').join('') + '</select>') : '') +
    (isNew ? '' : '<div class="t2" style="margin-top:14px">Codice ' + esc(codiceEl(base)) + (base.creato_da ? ' · creato da ' + esc(base.creato_da) : '') + (base.modificato_da ? ' · ultima modifica ' + esc(base.modificato_da) : '') + '</div>' +
      '<div style="margin-top:16px"><button class="btn dan block" id="fDel">Elimina elemento</button></div>');
  const m = openModal(isNew ? 'Nuovo elemento' : (codiceEl(base) + ' · ' + (base.descrizione || 'Elemento')), body,
    '<button class="btn" data-c>Annulla</button>' + (isNew ? '<button class="btn" data-sn>Salva e nuovo</button>' : '') + '<button class="btn pri" data-s>Salva</button>', cancelEl);
  bindChips('cTipo'); bindChips('cSup');
  ['fL', 'fH', 'fQ'].forEach(id => $('#' + id).addEventListener('input', updCalc)); updCalc();
  renderExtra(); renderPhotos();
  $('#bExtra').onclick = () => { ED.extra.push({ n: '', v: '' }); renderExtra(); const ins = document.querySelectorAll('#extraBox input'); ins[ins.length - 2].focus(); };
  m.querySelector('[data-c]').onclick = cancelEl;
  m.querySelector('[data-s]').onclick = () => saveEl(false);
  if (isNew) m.querySelector('[data-sn]').onclick = () => saveEl(true);
  if (!isNew) m.querySelector('#fDel').onclick = async () => {
    if (!confirm('Eliminare l\'elemento ' + codiceEl(e) + ' e le sue foto?')) return;
    await discardAdded();
    await dropPhotosOf(e);
    if (e._new) await dropLocal('el', e.id); else { const r = S.el[e.id]; r._del = 1; await dbPut('el', r); }
    ED = null; scheduleSync(); closeModal(); render(); toast('Elemento eliminato');
  };
  ensureThumbs(ED.foto).then(renderPhotos);
}
function updCalc() {
  const m = mq({ larghezza_mm: $('#fL').value, altezza_mm: $('#fH').value, quantita: $('#fQ').value });
  $('#calc').textContent = m != null ? 'Superficie totale: ' + fmt(m, 3) + ' m²' : '';
}
function renderExtra() {
  const box = $('#extraBox');
  box.innerHTML = ED.extra.map((x, i) => '<div class="extra"><input class="in-f" data-i="' + i + '" data-k="n" placeholder="es. Altezza da terra" value="' + esc(x.n) + '">' +
    '<input class="in-f" data-i="' + i + '" data-k="v" placeholder="valore" value="' + esc(x.v) + '"><button type="button" class="ib" data-del="' + i + '">✕</button></div>').join('');
  box.querySelectorAll('input').forEach(el => el.oninput = () => { ED.extra[el.dataset.i][el.dataset.k] = el.value; });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { ED.extra.splice(Number(b.dataset.del), 1); renderExtra(); });
}
function renderPhotos() {
  if (!ED) return;
  const box = $('#phBox'); if (!box) return;
  let h = ED.foto.map((f, i) => { const u = thumbUrl(f); return '<div class="ph">' + (u ? '<img data-i="' + i + '" src="' + u + '">' : '…') + '<button type="button" class="x" data-del="' + i + '">✕</button></div>'; }).join('');
  for (let i = 0; i < ED.working; i++) h += '<div class="ph"><span class="spin"></span></div>';
  h += '<button type="button" class="ph add" id="addCam">' + I.cam + 'Scatta</button><button type="button" class="ph add" id="addGal">' + I.gal + 'Galleria</button>';
  box.innerHTML = h;
  box.querySelectorAll('img[data-i]').forEach(img => img.onclick = () => viewFoto(ED.foto[img.dataset.i]));
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Rimuovere questa foto?')) return;
    const f = ED.foto.splice(Number(b.dataset.del), 1)[0];
    const ai = ED.added.indexOf(f.c);
    if (ai >= 0) { ED.added.splice(ai, 1); await dbDel('photo', f.c); delete S.photoMeta[f.c]; }
    renderPhotos();
  });
  $('#addCam').onclick = () => { $('#fileCam').value = ''; $('#fileCam').click(); };
  $('#addGal').onclick = () => { $('#fileGal').value = ''; $('#fileGal').click(); };
  document.querySelectorAll('[data-s],[data-sn]').forEach(b => { b.disabled = ED.working > 0; });
}

async function addFiles(files) {
  if (!ED || !files || !files.length) return;
  const ed = ED;
  const list = Array.from(files);
  ed.working += list.length; renderPhotos();
  for (const file of list) {
    try {
      const [full, thumb] = await Promise.all([compressBlob(file, 2000, 0.85), compressBlob(file, 400, 0.72)]);
      const c = uid();
      await dbPut('photo', { c, sopId: ed.rec.sopralluogo_id, elId: ed.rec.id, full, thumb, f: '', t: '', ts: Date.now() });
      S.photoMeta[c] = { c, sopId: ed.rec.sopralluogo_id, f: '', t: '' };
      S.localThumb[c] = URL.createObjectURL(thumb);
      ed.foto.push({ c, f: '', t: '', n: file.name || ('foto_' + c + '.jpg') });
      ed.added.push(c);
    } catch (err) { fail(err); }
    finally { ed.working--; if (ED === ed) renderPhotos(); }
  }
}

async function viewFoto(f) {
  const v = document.createElement('div'); v.className = 'viewer';
  v.innerHTML = '<span class="spin"></span><button>✕</button>';
  document.body.appendChild(v);
  v.querySelector('button').onclick = () => v.remove();
  v.onclick = e => { if (e.target === v) v.remove(); };
  try {
    let src = '';
    const p = f.c && S.photoMeta[f.c] ? await dbGet('photo', f.c) : null;
    if (p && p.full) src = URL.createObjectURL(p.full);
    else if (f.f) { const r = await api('images', { ids: [f.f] }); src = safeImg(r[f.f]); }
    if (!document.body.contains(v)) return;
    v.querySelector('.spin').outerHTML = src ? '<img src="' + src + '">' : '<span style="color:#fff">Foto non disponibile</span>';
  } catch (e) {
    if (!document.body.contains(v)) return;
    const u = thumbUrl(f);
    v.querySelector('.spin').outerHTML = u ? '<img src="' + u + '">' : '<span style="color:#fff;padding:20px;text-align:center">Foto a piena risoluzione disponibile solo online</span>';
  }
}
async function discardAdded() {
  if (!ED) return;
  for (const c of ED.added) { await dbDel('photo', c); delete S.photoMeta[c]; }
  ED.added = [];
}
async function cancelEl() {
  if (!ED) return closeModal();
  if (ED.working > 0 && !confirm('Ci sono foto in elaborazione. Uscire comunque?')) return;
  if (ED.added.length && !confirm('Hai aggiunto ' + ED.added.length + ' foto senza salvare. Uscire e scartarle?')) return;
  await discardAdded();
  ED = null; closeModal();
}
async function saveEl(andNew) {
  if (!ED || ED.working > 0) return;
  const rec = Object.assign({}, S.el[ED.rec.id] || ED.rec, {
    area_id: $('#fArea') ? $('#fArea').value : ED.rec.area_id,
    descrizione: $('#fDesc').value.trim(), tipo_intervento: chipValue('cTipo'), superficie: chipValue('cSup'),
    larghezza_mm: $('#fL').value.trim().replace(',', '.'), altezza_mm: $('#fH').value.trim().replace(',', '.'),
    profondita_mm: $('#fP').value.trim().replace(',', '.'), quantita: $('#fQ').value.trim(),
    note: $('#fNote').value.trim(), misure_extra: ED.extra.filter(x => x.n || x.v), foto: ED.foto, modificato_da: S.email
  });
  if (!rec.descrizione && !rec.tipo_intervento) { toast('Inserisci almeno descrizione o tipo intervento'); return; }
  try { await saveLocal('el', rec); } catch (e) { return fail(e); }
  const moved = S.view === 'area' && S.areaId !== rec.area_id;
  ED = null; closeModal();
  if (moved) S.areaId = rec.area_id;
  render();
  toast(navigator.onLine ? 'Salvato' : 'Salvato sul dispositivo');
  if (andNew) editEl(null);
}

document.getElementById('fileCam').onchange = ev => S.view === 'lavoro' ? addLavoroFiles(ev.target.files) : addFiles(ev.target.files);
document.getElementById('fileGal').onchange = ev => S.view === 'lavoro' ? addLavoroFiles(ev.target.files) : addFiles(ev.target.files);

/* ======================= EXPORT ======================= */
function rowsForExcel(sops, aree, elementi) {
  const sopById = {}, areaById = {};
  sops.forEach(s => sopById[s.id] = s); aree.forEach(a => areaById[a.id] = a);
  return elementi.map(e => {
    const s = sopById[e.sopralluogo_id] || {}, a = areaById[e.area_id] || {};
    const ex = arr(e.misure_extra), fo = arr(e.foto);
    return {
      'Sopralluogo': s.codice || '', 'Data': dataIt(s.data), 'Cliente': s.cliente || '', 'Punto vendita': s.punto_vendita || '',
      'Indirizzo': s.indirizzo || '', 'Area': a.nome || '', 'Piano': a.piano || '', 'Codice': e.codice || '',
      'Descrizione': e.descrizione, 'Tipo intervento': e.tipo_intervento, 'Superficie': e.superficie,
      'Larghezza mm': num(e.larghezza_mm), 'Altezza mm': num(e.altezza_mm), 'Profondità mm': num(e.profondita_mm),
      'Quantità': num(e.quantita), 'm² totali': mq(e) != null ? Math.round(mq(e) * 1000) / 1000 : null,
      'Altre misure': ex.map(x => x.n + ': ' + x.v).join(' | '), 'Note': e.note, 'N° foto': fo.length,
      'Creato da': e.creato_da, 'Modificato': e.modificato_il
    };
  });
}
function buildWorkbook(sops, aree, elementi) {
  const wb = XLSX.utils.book_new();
  const rows = rowsForExcel(sops, aree, elementi);
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Nessun elemento': '' }]);
  ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.min(40, Math.max(k.length + 2, ...rows.map(r => String(r[k] == null ? '' : r[k]).length + 1))) }));
  if (rows.length) ws['!autofilter'] = { ref: ws['!ref'] };
  XLSX.utils.book_append_sheet(wb, ws, 'Elementi');
  const sRows = sops.map(s => ({ 'Codice': s.codice, 'Data': dataIt(s.data), 'Cliente': s.cliente, 'Punto vendita': s.punto_vendita,
    'Indirizzo': s.indirizzo, 'Referente': s.referente, 'Stato': s.stato, 'Note': s.note, 'Creato da': s.creato_da }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sRows), 'Sopralluoghi');
  return wb;
}
function sopFileBase(s) { return [s.codice || 'nuovo', slug(s.cliente), slug(s.punto_vendita)].filter(Boolean).join('_'); }
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function exportExcelSop() {
  busy('Preparo Excel…');
  await loadScript(LIB.xlsx);
  const s = S.sop[S.sopId];
  const wb = buildWorkbook([s], areeOf(s.id), elOfSop(s.id));
  busy(false);
  deliver(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: XLSX_TYPE }), sopFileBase(s) + '.xlsx', s);
}
async function exportExcelAll() {
  busy('Preparo Excel…');
  await loadScript(LIB.xlsx);
  const wb = buildWorkbook(sopList(), live('area'), live('el'));
  busy(false);
  deliver(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: XLSX_TYPE }), 'Sopralluoghi_tutti_' + oggi() + '.xlsx', null);
}

/** Foto intere: dal dispositivo se ancora presenti, altrimenti dal server. Ritorna {chiave: dataUrl}. */
async function fetchFull(fotos, label) {
  const out = {}, remote = [];
  for (const fo of fotos) {
    const p = fo.c && S.photoMeta[fo.c] ? await dbGet('photo', fo.c) : null;
    if (p && p.full) out[fo.c || fo.f] = await blobToDataUrl(p.full);
    else if (fo.f) remote.push(fo);
  }
  if (remote.length && !navigator.onLine) throw new Error('Per includere tutte le foto serve la connessione.');
  for (let i = 0; i < remote.length; i += 4) {
    busy(label + ' ' + Math.min(i + 4, remote.length) + '/' + remote.length);
    const chunk = remote.slice(i, i + 4);
    const r = await api('images', { ids: chunk.map(f => f.f) });
    chunk.forEach(f => { out[f.c || f.f] = safeImg(r[f.f]); });
  }
  return out;
}
const fkey = fo => fo.c || fo.f;
function imgInfo(dataUrl, max, q) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const r = Math.min(1, max / Math.max(w, h)); w = Math.round(w * r); h = Math.round(h * r);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      res({ data: c.toDataURL('image/jpeg', q), w, h });
    };
    img.onerror = () => res(null);
    img.src = dataUrl;
  });
}

async function exportPdf() {
  busy('Preparo PDF…');
  await loadScript(LIB.pdf);
  const s = S.sop[S.sopId], aree = areeOf(s.id), elementi = elOfSop(s.id);
  const all = []; elementi.forEach(e => (e.foto || []).forEach(f => all.push(f)));
  const imgs = all.length ? await fetchFull(all, 'Recupero foto') : {};
  busy('Impagino PDF…');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 14, CW = PW - 2 * M;
  let y = M;
  const ensure = h => { if (y + h > PH - M - 8) { doc.addPage(); y = M; } };
  const text = (t, size, style, color, x = M, w = CW) => {
    doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); doc.setTextColor(...(color || [24, 33, 43]));
    const lines = doc.splitTextToSize(String(t), w);
    ensure(lines.length * size * 0.42);
    doc.text(lines, x, y + size * 0.35);
    y += lines.length * size * 0.42 + 1;
  };
  doc.setFillColor(15, 111, 184); doc.rect(0, 0, PW, 30, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('Report sopralluogo', M, 14);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text((s.codice || '') + (s.data ? '  ·  ' + dataIt(s.data) : ''), M, 22);
  y = 40;
  text([s.cliente, s.punto_vendita].filter(Boolean).join(' – '), 15, 'bold');
  if (s.indirizzo) text(s.indirizzo, 10, 'normal', [100, 114, 131]);
  if (s.referente) text('Referente: ' + s.referente, 10, 'normal', [100, 114, 131]);
  if (s.note) { y += 2; text('Note: ' + s.note, 10); }
  const totMq = elementi.reduce((t, e) => t + (mq(e) || 0), 0);
  y += 2; text(aree.length + ' aree · ' + elementi.length + ' elementi · ' + fmt(totMq) + ' m² totali', 10, 'bold', [15, 111, 184]);
  y += 4;
  for (const a of aree) {
    const el = elOfArea(a.id);
    ensure(20);
    doc.setFillColor(227, 240, 250); doc.rect(M, y, CW, 9, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(15, 111, 184);
    doc.text(a.nome + (a.piano ? '  (' + a.piano + ')' : '') + '   –   ' + el.length + ' elementi', M + 3, y + 6.2);
    y += 13;
    if (a.note) text(a.note, 9, 'italic', [100, 114, 131]);
    for (const e of el) {
      ensure(24);
      text(codiceEl(e) + '  ·  ' + (e.descrizione || e.tipo_intervento || 'Elemento'), 11.5, 'bold');
      const det = [];
      if (e.tipo_intervento) det.push('Intervento: ' + e.tipo_intervento);
      if (e.superficie) det.push('Superficie: ' + e.superficie);
      if (dimStr(e)) det.push('Misure: ' + dimStr(e));
      if (num(e.quantita) && num(e.quantita) !== 1) det.push('Q.tà: ' + e.quantita);
      if (mq(e) != null) det.push(fmt(mq(e), 3) + ' m²');
      if (det.length) text(det.join('   ·   '), 9.5, 'normal', [60, 70, 82]);
      const ex = e.misure_extra || [];
      if (ex.length) text('Altre misure: ' + ex.map(x => x.n + ' ' + x.v).join('; '), 9.5, 'normal', [60, 70, 82]);
      if (e.note) text('Note: ' + e.note, 9.5, 'normal', [60, 70, 82]);
      const fs = e.foto || [];
      const gap = 4, cellW = (CW - 2 * gap) / 3, cellH = 46;
      for (let i = 0; i < fs.length; i += 3) {
        ensure(cellH + 3);
        for (let k = 0; k < 3 && i + k < fs.length; k++) {
          const src = imgs[fkey(fs[i + k])]; if (!src) continue;
          const info = await imgInfo(src, 1100, 0.75); if (!info) continue;
          const r = Math.min(cellW / info.w, cellH / info.h);
          const w = info.w * r, h = info.h * r;
          doc.addImage(info.data, 'JPEG', M + k * (cellW + gap) + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
        }
        y += cellH + 3;
      }
      y += 2; doc.setDrawColor(221, 227, 234); doc.line(M, y, PW - M, y); y += 4;
    }
  }
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(140, 150, 160); doc.setFont('helvetica', 'normal');
    doc.text((s.codice || '') + ' – ' + (s.cliente || ''), M, PH - 7);
    doc.text('Pagina ' + p + ' di ' + n, PW - M, PH - 7, { align: 'right' });
  }
  busy(false);
  deliver(doc.output('blob'), sopFileBase(s) + '_report.pdf', s);
}

async function exportZip() {
  const s = S.sop[S.sopId], aree = areeOf(s.id), elementi = elOfSop(s.id);
  const all = []; elementi.forEach(e => (e.foto || []).forEach(f => all.push(f)));
  if (!all.length) return toast('Nessuna foto in questo sopralluogo');
  busy('Preparo ZIP…');
  await Promise.all([loadScript(LIB.zip), loadScript(LIB.xlsx)]);
  const imgs = await fetchFull(all, 'Recupero foto');
  busy('Comprimo…');
  const zip = new JSZip();
  const root = zip.folder(sopFileBase(s));
  aree.forEach((a, ai) => {
    const dir = root.folder(String(ai + 1).padStart(2, '0') + '_' + (slug(a.nome) || 'area'));
    elOfArea(a.id).forEach(e => (e.foto || []).forEach((f, i) => {
      const src = imgs[fkey(f)]; if (!src) return;
      const name = [codiceEl(e), slug(e.descrizione || e.tipo_intervento)].filter(Boolean).join('_') + '_' + String(i + 1).padStart(2, '0') + '.jpg';
      dir.file(name, src.split(',')[1], { base64: true });
    }));
  });
  root.file(sopFileBase(s) + '.xlsx', XLSX.write(buildWorkbook([s], aree, elementi), { bookType: 'xlsx', type: 'array' }));
  const blob = await zip.generateAsync({ type: 'blob' });
  busy(false);
  deliver(blob, sopFileBase(s) + '_foto.zip', s);
}

function deliver(blob, name, sop) {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 8000);
  } catch (e) { console.error(e); }
  const canDrive = navigator.onLine && (!sop || !sop._new);
  toast('File pronto: ' + name, canDrive ? 'Salva su Drive' : null, () => saveToDrive(blob, name, sop ? sop.id : ''), 9000);
}
async function saveToDrive(blob, name, sopId) {
  busy('Salvo su Drive…');
  try {
    const url = await api('exportDrive', { sopId, dataUrl: await blobToDataUrl(blob), nome: name }, 180000);
    busy(false);
    toast('Salvato su Drive', 'Apri', () => window.open(url, '_blank'), 10000);
  } catch (e) { fail(e); }
}

/* ======================= LAVORI COMPLETATI ======================= */
async function refreshIndex() {
  const r = await api('indice', {}, 180000);
  L.idx = { righe: r.righe, indice: r.indice, ts: Date.now() };
  await kvSet('idx', L.idx);
}

function searchLocal(q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length || !L.idx) return [];
  return L.idx.righe.filter(r => { const h = norm(r[1] + ' ' + r[3]); return terms.every(t => h.includes(t)); })
    .slice(0, 50).map(r => ({ id: r[0], nome: r[1], cliente: r[2], percorso: r[3] }));
}

function renderLavori() {
  let h = tabsHtml();
  if (!S.lavoriOn) {
    $('#app').innerHTML = h + '<div class="card" style="margin-top:16px"><div class="t1">Modulo non ancora configurato</div>' +
      '<div class="t2" style="margin-top:6px;white-space:normal">Va inserito l\'ID della cartella Archivio UG nel motore Apps Script (vedi LEGGIMI). ' +
      (S.lastSync ? '' : 'Se l\'hai appena configurato, collegati a internet e sincronizza.') + '</div></div>';
    return bindTabs();
  }
  h += '<div class="row" style="margin-top:10px"><input class="search grow" style="margin:0" id="lq" enterkeyhint="search" ' +
    'placeholder="Codice o nome lavoro (es. ESSELUNGA040, Losanna)" value="' + esc(L.q) + '"><button class="btn pri" id="lgo">Cerca</button></div>';
  if (!L.idx) h += '<div class="warnbox">L\'indice dell\'archivio non è ancora sul dispositivo: ' + (navigator.onLine ? 'lo sto scaricando…' : 'collegati a internet una volta per poter cercare anche offline.') + '</div>';
  if (L.risultati) {
    h += '<div class="sec"><h2>Risultati</h2><span class="t2">' + L.risultati.length + (L.live ? ' · cercati direttamente su Drive' : '') + '</span></div>';
    if (!L.risultati.length) h += '<div class="empty">Nessuna cartella lavoro trovata.' + (navigator.onLine ? '' : '<br>Offline cerco solo nell\'indice salvato sul dispositivo.') + '</div>';
    L.risultati.forEach(r => { h += '<div class="card tap" data-job="' + esc(r.id) + '"><div class="t1">' + esc(r.nome) + '</div><div class="t2">' + esc(r.percorso) + '</div></div>'; });
  }
  const pend = {};
  L.queue.filter(q => q.st !== 'ok').forEach(q => { pend[q.jobId] = pend[q.jobId] || { id: q.jobId, nome: q.jobNome, cliente: q.jobCliente, n: 0 }; if (q.type === 'foto') pend[q.jobId].n++; });
  if (Object.keys(pend).length) {
    h += '<div class="sec"><h2>In attesa di invio</h2></div>';
    Object.values(pend).forEach(p => { h += '<div class="card tap" data-job="' + esc(p.id) + '"><div class="t1">' + esc(p.nome) + '<span class="badge">' + p.n + ' foto</span></div><div class="t2">' + esc(p.cliente || '') + '</div></div>'; });
  }
  h += '<div class="sec"><h2>Caricamenti recenti</h2></div>';
  if (!L.recenti.length) h += '<div class="empty">' + (navigator.onLine ? 'Nessun caricamento ancora.' : 'Disponibile online.') + '</div>';
  else L.recenti.forEach(r => {
    h += '<div class="card tap" data-job="' + esc(r.cartella_lavoro_id) + '"><div class="t1">' + esc(r.cartella_lavoro) + '</div>' +
      '<div class="t2">' + [r.cliente, dataIt(r.data), r.n_foto + ' foto', r.utente].filter(Boolean).map(esc).join(' · ') + '</div></div>';
  });
  h += '<div style="margin-top:22px"><button class="btn block" id="lnew"' + (navigator.onLine ? '' : ' disabled') + '>' + I.plus + ' Lavoro senza codice' + (navigator.onLine ? '' : ' (solo online)') + '</button></div>';
  h += '<div class="t2" style="margin-top:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span>' +
    (L.idx ? 'Indice archivio: ' + L.idx.righe.length + ' lavori · aggiornato ' + dataOra(L.idx.indice && L.idx.indice.aggiornato) : '') +
    '</span><button class="btn" id="lidx" style="min-height:36px"' + (navigator.onLine ? '' : ' disabled') + '>Aggiorna indice</button></div>';
  $('#app').innerHTML = h;
  bindTabs();
  const q = $('#lq');
  q.oninput = () => { L.q = q.value; };
  q.onkeydown = e => { if (e.key === 'Enter') cercaLavori(); };
  $('#lgo').onclick = cercaLavori;
  document.querySelectorAll('[data-job]').forEach(c => c.onclick = () => go('lavoro', c.dataset.job));
  $('#lidx').onclick = async () => {
    busy('Aggiorno l\'indice dell\'archivio… (può richiedere fino a un minuto)');
    try { await api('aggiornaIndice', {}, 360000); await refreshIndex(); busy(false); renderLavori(); toast('Indice aggiornato: ' + L.idx.righe.length + ' lavori'); }
    catch (e) { fail(e); }
  };
  $('#lnew').onclick = async () => {
    const nome = prompt('Nome identificativo del lavoro (es. "Negozio Via Roma Milano").\nVerrà creata una cartella in "_LAVORI SENZA CODICE" nell\'archivio.');
    if (!nome || !nome.trim()) return;
    busy('Creo la cartella…');
    try {
      const r = await api('creaLavoro', { nome: nome.trim() });
      if (L.idx && !L.idx.righe.some(x => x[0] === r.id)) { L.idx.righe.push([r.id, r.nome, r.cliente, r.percorso]); await kvSet('idx', L.idx); }
      busy(false); go('lavoro', r.id);
    } catch (e) { fail(e); }
  };
  if (!L.recenti.length && navigator.onLine) loadRecenti();
}
let recentiLoading = false;
async function loadRecenti() {
  if (recentiLoading) return; recentiLoading = true;
  try { const r = await api('lavoriRecenti'); L.recenti = r.recenti || []; await kvSet('recenti', L.recenti); if (S.view === 'lavori' && L.recenti.length) renderLavori(); }
  catch (e) {} finally { recentiLoading = false; }
}

async function cercaLavori() {
  const q = ($('#lq') ? $('#lq').value : L.q).trim();
  L.q = q;
  if (!q) return toast('Scrivi un codice o un nome');
  L.risultati = searchLocal(q); L.live = false;
  if (!L.risultati.length && navigator.onLine) {
    busy('Cerco su Drive…');
    try { const r = await api('cercaLavori', { q }); L.risultati = r.risultati; L.live = r.live; busy(false); }
    catch (e) { busy(false); if (!e.net) fail(e); }
  }
  renderLavori();
}

function jobInfo(id) {
  const r = L.idx && L.idx.righe.find(x => x[0] === id);
  if (r) return { id, nome: r[1], cliente: r[2], percorso: r[3] };
  const q = L.queue.find(x => x.jobId === id);
  if (q) return { id, nome: q.jobNome, cliente: q.jobCliente, percorso: q.jobPercorso || '' };
  const rr = L.recenti.find(x => x.cartella_lavoro_id === id);
  if (rr) return { id, nome: rr.cartella_lavoro, cliente: rr.cliente, percorso: rr.percorso };
  return { id, nome: 'Lavoro', cliente: '', percorso: '' };
}

async function openLavoro(id) {
  if (!L.job || L.job.id !== id) { L.job = jobInfo(id); L.giorni = null; L.data = oggi(); L.note = ''; }
  renderHeader(); renderLavoro();
  if (navigator.onLine) {
    try {
      const r = await api('apriLavoro', { id });
      if (!L.job || L.job.id !== id) return;
      Object.assign(L.job, { nome: r.nome, cliente: r.cliente, percorso: r.percorso, url: r.url, urlFoto: r.urlFoto });
      L.giorni = r.giorni;
      const g = L.giorni.find(x => x.key === L.data.replace(/-/g, ''));
      if (g && !L.note) L.note = g.note;
      if (S.view === 'lavoro') { renderHeader(); renderLavoro(); }
    } catch (e) { if (!e.net) fail(e); }
  }
}

function renderLavoro() {
  const j = L.job;
  let h = '<div class="card"><div class="t1" style="white-space:normal">' + esc(j.nome) + '</div><div class="t2">' + esc(j.percorso) + '</div>' +
    (j.url ? '<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn" id="lopen">Apri cartella lavoro</button>' +
      (j.urlFoto ? '<button class="btn" id="lopenF">Apri FOTO LAVORAZIONI</button>' : '') + '</div>' : '') + '</div>';
  h += '<div class="sec"><h2>Nuova decorazione</h2></div><div class="card">' +
    field('Data decorazione', '<input class="in-f" type="date" id="ldata" value="' + esc(L.data) + '">') +
    field('Note (facoltative)', '<textarea class="in-f" id="lnote" placeholder="es. vetrine lato strada, manca adesivo porta laterale…">' + esc(L.note) + '</textarea>') +
    '<div class="dest" id="ldest"></div>' +
    '<label class="f"><span>Foto</span></label><div class="photos" id="lph"></div>' +
    '<div class="t2" id="lsum" style="margin-top:8px"></div></div>';
  h += '<div class="sec"><h2>Decorazioni registrate</h2></div><div id="lgiorni"></div>';
  $('#app').innerHTML = h;
  if ($('#lopen')) $('#lopen').onclick = () => window.open(j.url, '_blank');
  if ($('#lopenF')) $('#lopenF').onclick = () => window.open(j.urlFoto, '_blank');
  $('#ldata').onchange = () => {
    if (!$('#ldata').value) { $('#ldata').value = L.data; return; }
    L.data = $('#ldata').value;
    const g = (L.giorni || []).find(x => x.key === L.data.replace(/-/g, ''));
    L.note = g ? g.note : ''; $('#lnote').value = L.note;
    renderLavoroDyn();
  };
  $('#lnote').oninput = () => { L.note = $('#lnote').value; };
  $('#lnote').onblur = queueNota;
  renderLavoroDyn();
}

async function queueNota() {
  const note = L.note.trim();
  const g = (L.giorni || []).find(x => x.key === L.data.replace(/-/g, ''));
  const hasLocal = L.queue.some(q => q.jobId === L.job.id && q.data === L.data && q.type === 'foto');
  if ((g ? g.note : '') === note || (!g && !hasLocal && !note)) return;
  const prev = L.queue.find(q => q.type === 'nota' && q.jobId === L.job.id && q.data === L.data && q.st !== 'ok');
  const item = prev || { cid: uid(), type: 'nota', jobId: L.job.id, jobNome: L.job.nome, jobCliente: L.job.cliente, jobPercorso: L.job.percorso, data: L.data, st: 'wait', ts: Date.now() };
  item.note = note; item.st = 'wait';
  if (!prev) L.queue.push(item);
  await dbPut('lavq', item);
  if (g) g.note = note;
  scheduleSync(800);
}

function cartellaGiornoNome() { return 'Decorazione del ' + L.data.split('-').reverse().join('-'); }

function renderLavoroDyn() {
  if (S.view !== 'lavoro' || !L.job || !$('#lph')) return;
  const j = L.job;
  $('#ldest').innerHTML = 'Le foto vanno in: <b>' + esc(j.nome) + ' › FOTO LAVORAZIONI › ' + esc(cartellaGiornoNome()) + '</b>';
  const items = L.queue.filter(q => q.jobId === j.id && q.type === 'foto');
  let h = items.map(q => {
    const lab = q.st === 'ok' ? '✓' : q.st === 'err' ? 'Errore · tocca' : q.st === 'up' ? 'Invio…' : (navigator.onLine ? 'In coda' : 'Offline');
    return '<div class="ph' + (q.st === 'ok' ? '' : ' dim') + '" data-cid="' + esc(q.cid) + '">' +
      (q.thumb ? '<img src="' + q.thumb + '">' : '<span class="spin"></span>') +
      '<span class="st ' + (q.st === 'ok' ? 'ok' : q.st === 'err' ? 'err' : '') + '">' + lab + '</span></div>';
  }).join('');
  h += '<button type="button" class="ph add" id="addCam">' + I.cam + 'Scatta</button><button type="button" class="ph add" id="addGal">' + I.gal + 'Galleria</button>';
  $('#lph').innerHTML = h;
  $('#addCam').onclick = () => { $('#fileCam').value = ''; $('#fileCam').click(); };
  $('#addGal').onclick = () => { $('#fileGal').value = ''; $('#fileGal').click(); };
  document.querySelectorAll('#lph [data-cid]').forEach(el => el.onclick = async () => {
    const q = L.queue.find(x => x.cid === el.dataset.cid);
    if (q && q.st === 'err') { if (q.err) toast(q.err); q.st = 'wait'; await dbPut('lavq', q); renderLavoroDyn(); scheduleSync(200); }
  });
  const ok = items.filter(q => q.st === 'ok').length, pend = items.filter(q => q.st === 'up' || q.st === 'wait').length, err = items.filter(q => q.st === 'err').length;
  $('#lsum').textContent = items.length ? [ok + ' inviate', pend ? pend + ' in coda' : '', err ? err + ' con errore' : ''].filter(Boolean).join(' · ') +
    (pend && !navigator.onLine ? ' — verranno inviate appena c\'è rete' : pend ? ' — puoi continuare a scattare' : '') :
    'Scatta o scegli dalla galleria: le foto restano sul telefono finché non vengono inviate.';
  let g = '';
  if (L.giorni === null) g = '<div class="empty">' + (navigator.onLine ? 'Caricamento…' : 'Lo storico è visibile online.') + '</div>';
  else if (!L.giorni.length) g = '<div class="empty">Nessuna decorazione registrata per questo lavoro.</div>';
  else L.giorni.forEach(d => {
    g += '<div class="card tap" data-url="' + esc(d.url) + '"><div class="row"><div class="grow"><div class="t1">' + esc(d.nome) + '</div>' +
      '<div class="t2">' + d.n + ' foto' + (d.note ? ' · ' + esc(d.note) : '') + '</div></div><span class="chip">Apri</span></div></div>';
  });
  $('#lgiorni').innerHTML = g;
  document.querySelectorAll('#lgiorni [data-url]').forEach(c => c.onclick = () => window.open(c.dataset.url, '_blank'));
}

async function addLavoroFiles(files) {
  if (!L.job || !files || !files.length) return;
  const job = L.job, data = L.data;
  for (const f of Array.from(files)) {
    try {
      const [blob, th] = await Promise.all([compressBlob(f, 2560, 0.88), compressBlob(f, 320, 0.7)]);
      const q = { cid: uid(), type: 'foto', jobId: job.id, jobNome: job.nome, jobCliente: job.cliente, jobPercorso: job.percorso,
        data, blob, thumb: await blobToDataUrl(th), st: 'wait', ts: Date.now() };
      await dbPut('lavq', q);
      L.queue.push(q);
      renderLavoroDyn(); updateSyncPill();
    } catch (e) { fail(e); }
  }
  scheduleSync(300);
}

async function syncLavori(step) {
  const items = L.queue.filter(q => q.st === 'wait' || q.st === 'err' || q.st === 'up');
  let sent = 0;
  for (const q of items) {
    if (q.st === 'err' && q.errCount >= 3) continue;
    q.st = 'up'; if (S.view === 'lavoro') renderLavoroDyn();
    const curNote = (L.job && L.job.id === q.jobId && L.data === q.data) ? L.note.trim() : '';
    try {
      if (q.type === 'foto') {
        const r = await api('fotoLavoro', { req: { cartella_id: q.jobId, data: q.data, note: curNote, cid: q.cid }, dataUrl: await blobToDataUrl(q.blob) });
        q.nome = r.nome; delete q.blob; sent++;
        if (L.job && L.job.id === q.jobId && L.giorni) {
          const g = L.giorni.find(x => x.id === r.giorno.id);
          if (g) { if (!r.doppione) g.n++; } else L.giorni.unshift({ id: r.giorno.id, nome: r.giorno.nome, url: r.giorno.url, n: 1, note: curNote, key: q.data.replace(/-/g, '') });
        }
      } else {
        await api('notaLavoro', { req: { cartella_id: q.jobId, data: q.data, note: q.note } });
      }
      q.st = 'ok'; q.err = ''; await dbPut('lavq', q);
    } catch (e) {
      if (e.net || e.code === 'AUTH') { q.st = 'wait'; throw e; }
      q.st = 'err'; q.err = e.message; q.errCount = (q.errCount || 0) + 1; await dbPut('lavq', q);
      await step('Foto lavoro', async () => { throw e; });
    } finally { if (S.view === 'lavoro') renderLavoroDyn(); updateSyncPill(); }
  }
  if (sent) { toast(sent + ' foto lavori inviate'); L.recenti = []; }
  // pulizia: elementi inviati da più di 3 giorni
  const lim = Date.now() - 3 * 86400000;
  for (const q of L.queue.filter(x => x.st === 'ok' && x.ts < lim)) await dbDel('lavq', q.cid);
  L.queue = L.queue.filter(x => !(x.st === 'ok' && x.ts < lim));
}

/* ======================= AVVIO ======================= */
async function startApp() {
  authLostShown = false;
  const meta = await kvGet('meta', null);
  if (meta) { S.liste = meta.liste; S.dbUrl = meta.dbUrl; S.folderUrl = meta.folderUrl; S.lavoriOn = meta.lavoriOn; }
  S.lastSync = await kvGet('lastSync', '');
  for (const t of ['sop', 'area', 'el']) (await dbAll(t)).forEach(r => { S[t][r.id] = r; });
  (await dbAll('photo')).forEach(p => {
    S.photoMeta[p.c] = { c: p.c, sopId: p.sopId, f: p.f || '', t: p.t || '' };
    if (p.thumb) S.localThumb[p.c] = URL.createObjectURL(p.thumb);
  });
  L.queue = (await dbAll('lavq')).map(q => { if (q.st === 'up') q.st = 'wait'; return q; }).sort((a, b) => a.ts - b.ts);
  L.idx = await kvGet('idx', null);
  L.recenti = await kvGet('recenti', []);
  const tab = await kvGet('tab', 'home');
  S.view = tab === 'lavori' ? 'lavori' : 'home';
  history.replaceState({ v: S.view }, '');
  render();
  sync({ full: !S.lastSync });
}

(async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !navigator.serviceWorker.controller) return;
      toast('Nuova versione dell\'app disponibile', 'Aggiorna', () => { reloaded = true; location.reload(); }, 15000);
    });
  }
  try { await idbOpen(); } catch (e) {
    $('#app').innerHTML = '<div class="pair"><h1>Archivio non disponibile</h1><p>Il browser non permette di salvare dati (forse sei in navigazione privata). Apri l\'app normalmente o installala sulla schermata Home.</p></div>';
    return;
  }
  S.token = await kvGet('token', '');
  S.email = await kvGet('email', '');
  if (!S.token) return renderPair();
  startApp();
})();
