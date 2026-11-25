/*!
 * Nutgraph — whiteboard met plakbriefjes voor verhaalstructuren.
 * Alles draait in de browser. Er gaat geen verhaalinhoud naar de server.
 *
 * Basisonderdelen (zie CLAUDE.md). Elk onderdeel heeft een @basis-markering;
 * de controle in GitHub weigert een versie waarin er een ontbreekt.
 */
(function () {
	'use strict';

	// Interne opslagnamen bewust ongewijzigd (oude naam), zodat bestaande borden blijven werken.
	var STORE_KEY = 'verhaalbord.v1.library';
	var CURRENT_KEY = 'verhaalbord.v1.current';
	var TAB_KEY = 'verhaalbord.v1.tab';
	var FORMAT = 'nutgraph';
	var FORMAT_LIBRARY = 'nutgraph-bibliotheek';
	var OLD_FORMATS = ['verhaalbord', 'verhaalbord-bibliotheek'];
	var FORMAT_VERSION = 1;

	var COLORS = [
		{ hex: '#FFE873', name: 'color_yellow' },
		{ hex: '#FFB8CB', name: 'color_pink' },
		{ hex: '#B9EBC1', name: 'color_green' },
		{ hex: '#AED9F5', name: 'color_blue' },
		{ hex: '#FFC98F', name: 'color_orange' },
		{ hex: '#D7C6F6', name: 'color_lilac' },
		{ hex: '#FFFFFF', name: 'color_white' }
	];
	// Kleuren voor de draden op de crazywall.
	var LINE_COLORS = [
		{ hex: '#C62828', name: 'color_red' },
		{ hex: '#1D2733', name: 'color_black' },
		{ hex: '#1F4FBF', name: 'color_blue' },
		{ hex: '#2E7D32', name: 'color_green' },
		{ hex: '#EF6C00', name: 'color_orange' }
	];
	// Toegestane soorten wandbriefjes (zie KINDS bij de crazywall voor de pictogrammen).
	var WALL_KINDS = ['person', 'organization', 'place', 'event', 'situation', 'time', 'object', 'evidence', 'photo', 'document', 'money', 'vehicle', 'phone', 'message', 'quote', 'source', 'article', 'legal', 'question', 'idea', 'other'];
	var SPINE_COLOR = '#FFE873';
	var DETAIL_COLOR = '#AED9F5';

	/* ------------------------------------------------------------------ *
	 * Talen — de teksten komen uit includes/class-nutgraph-i18n.php
	 * ------------------------------------------------------------------ */

	var LANG_KEY = 'verhaalbord.v1.language';
	var I18N = window.NutgraphI18n || { languages: [{ code: 'nl', name: 'Nederlands' }], default: 'nl', strings: {} };
	var LANG = pickLanguage();
	var apps = [];

	function hasLanguage(code) {
		return I18N.languages.some(function (l) { return l.code === code; });
	}
	function pickLanguage() {
		var saved = null;
		try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* geen opslag */ }
		if (saved && hasLanguage(saved)) return saved;
		return hasLanguage(I18N.default) ? I18N.default : 'nl';
	}
	// Tekst in de gekozen taal. Ontbreekt een vertaling, dan Engels, dan Nederlands.
	function t(key, vars) {
		var s = (I18N.strings[LANG] || {})[key] || (I18N.strings.en || {})[key] || (I18N.strings.nl || {})[key] || key;
		if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? String(vars[k]) : m; });
		return s;
	}
	function plural(n, one, many) { return t(n === 1 ? one : many, { n: n }); }
	function locale() {
		return LANG === 'nl' ? 'nl-NL' : LANG === 'en' ? 'en-GB' : LANG;
	}
	function setLanguage(code, fromApp) {
		if (!hasLanguage(code) || code === LANG) return;
		LANG = code;
		try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* niet erg */ }
		apps.forEach(function (app) { app.relabel(app === fromApp); });
	}

	/* ------------------------------------------------------------------ *
	 * Hulpfuncties
	 * ------------------------------------------------------------------ */

	function uid() {
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	}

	// Bouwt DOM-elementen. Tekst wordt altijd als tekst ingevoegd, nooit als HTML.
	function h(tag, attrs) {
		var el = document.createElement(tag);
		attrs = attrs || {};
		Object.keys(attrs).forEach(function (key) {
			var val = attrs[key];
			if (val === null || val === undefined || val === false) return;
			if (key === 'class') el.className = val;
			else if (key === 'style') el.setAttribute('style', val);
			else if (key.indexOf('on') === 0) el.addEventListener(key.slice(2), val);
			else if (key === 'value') el.value = val;
			else if (val === true) el.setAttribute(key, '');
			else el.setAttribute(key, val);
		});
		for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
		return el;
	}
	function append(el, child) {
		if (child === null || child === undefined || child === false) return;
		if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
		el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
	}

	function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

	function formatDate(ts) {
		try {
			return new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
		} catch (e) { return ''; }
	}

	function formatSize(bytes) {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1048576) return Math.round(bytes / 1024) + ' kB';
		return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
	}

	function safeUrl(url) {
		url = String(url || '').trim();
		if (!url) return '';
		if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
		return /^https?:\/\//i.test(url) ? url : '';
	}

	function slugify(name) {
		return String(name || 'verhaal').toLowerCase()
			.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'verhaal';
	}

	// Een vaste, kleine scheefstand per briefje: het voelt als papier.
	function tilt(id) {
		var n = 0;
		for (var i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 1000;
		return ((n / 1000) * 2.4 - 1.2).toFixed(2);
	}

	function download(filename, content, type) {
		var blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/octet-stream' });
		var url = URL.createObjectURL(blob);
		var a = h('a', { href: url, download: filename, style: 'display:none' });
		document.body.appendChild(a);
		a.click();
		setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
	}

	function blobToDataUrl(blob) {
		return new Promise(function (resolve, reject) {
			var r = new FileReader();
			r.onload = function () { resolve(r.result); };
			r.onerror = function () { reject(r.error); };
			r.readAsDataURL(blob);
		});
	}

	function dataUrlToBlob(dataUrl) {
		var parts = String(dataUrl).split(',');
		var mime = (parts[0].match(/data:([^;]*)/) || [])[1] || 'application/octet-stream';
		var bin = atob(parts[1] || '');
		var bytes = new Uint8Array(bin.length);
		for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return new Blob([bytes], { type: mime });
	}

	/* ------------------------------------------------------------------ *
	 * @basis:opslag — bibliotheek in localStorage (alleen in deze browser)
	 * ------------------------------------------------------------------ */

	var Store = {
		load: function () {
			try {
				var raw = localStorage.getItem(STORE_KEY);
				var lib = raw ? JSON.parse(raw) : null;
				if (lib && Array.isArray(lib.projects)) { lib.projects.forEach(upgradeProject); return lib; }
			} catch (e) { /* kapotte opslag: begin leeg */ }
			return { projects: [] };
		},
		save: function (lib) {
			try {
				localStorage.setItem(STORE_KEY, JSON.stringify(lib));
				return true;
			} catch (e) {
				toast(t('storage_full'), true);
				return false;
			}
		},
		getCurrent: function () { try { return localStorage.getItem(CURRENT_KEY); } catch (e) { return null; } },
		setCurrent: function (id) { try { if (id) localStorage.setItem(CURRENT_KEY, id); else localStorage.removeItem(CURRENT_KEY); } catch (e) { /* niets */ } }
	};

	/* ------------------------------------------------------------------ *
	 * @basis:bronnen — documenten in IndexedDB (ook alleen in deze browser)
	 * ------------------------------------------------------------------ */

	var Files = (function () {
		var dbPromise = null;
		var memory = {}; // noodoplossing als IndexedDB ontbreekt
		function db() {
			if (!window.indexedDB) return Promise.resolve(null);
			if (!dbPromise) {
				dbPromise = new Promise(function (resolve) {
					var req = indexedDB.open('verhaalbord', 1);
					req.onupgradeneeded = function () { req.result.createObjectStore('files'); };
					req.onsuccess = function () { resolve(req.result); };
					req.onerror = function () { resolve(null); };
				});
			}
			return dbPromise;
		}
		function tx(mode, fn) {
			return db().then(function (d) {
				if (!d) { var r = fn(null); return r && r.result !== undefined ? r.result : r; }
				return new Promise(function (resolve, reject) {
					var t = d.transaction('files', mode);
					var store = t.objectStore('files');
					var result = fn(store);
					t.oncomplete = function () { resolve(result && result.result !== undefined ? result.result : result); };
					t.onerror = function () { reject(t.error); };
				});
			});
		}
		return {
			put: function (id, blob) {
				return tx('readwrite', function (s) { if (!s) { memory[id] = blob; return null; } return s.put(blob, id); });
			},
			get: function (id) {
				return tx('readonly', function (s) { if (!s) return { result: memory[id] || null }; return s.get(id); })
					.then(function (r) { return r || null; });
			},
			del: function (id) {
				return tx('readwrite', function (s) { if (!s) { delete memory[id]; return null; } return s.delete(id); });
			}
		};
	})();

	function projectFileIds(project) {
		var ids = [];
		project.notes.forEach(function (n) {
			(n.sources || []).forEach(function (s) { if (s.type === 'file' && s.fileId) ids.push(s.fileId); });
		});
		return ids;
	}

	/* ------------------------------------------------------------------ *
	 * Datamodel
	 * ------------------------------------------------------------------ */

	function newProject(name) {
		var now = Date.now();
		return { id: uid(), name: name || t('new_story'), created: now, updated: now, notes: [], wall: emptyWall() };
	}

	function newNote(row, col) {
		return { id: uid(), row: row, col: col, title: '', text: '', color: col === 0 ? SPINE_COLOR : DETAIL_COLOR, sources: [], refs: [] };
	}

	function emptyWall() {
		return { items: [], lines: [], view: { x: 40, y: 40, z: 1 } };
	}

	// Borden van vóór versie 1.2 hebben nog geen crazywall en geen onderliggende briefjes.
	// Deze kleine aanvulling verandert verder niets aan bestaande gegevens.
	function upgradeProject(p) {
		if (!p || typeof p !== 'object') return p;
		if (!p.wall || !Array.isArray(p.wall.items) || !Array.isArray(p.wall.lines)) p.wall = emptyWall();
		if (!p.wall.view) p.wall.view = { x: 40, y: 40, z: 1 };
		(p.notes || []).forEach(function (n) { if (!Array.isArray(n.refs)) n.refs = []; });
		return p;
	}

	// Maakt geïmporteerde of gedeelde gegevens veilig en volledig.
	function normalizeProject(p) {
		var out = {
			id: typeof p.id === 'string' ? p.id : uid(),
			name: String(p.name || t('imported_story')).slice(0, 200),
			created: Number(p.created) || Date.now(),
			updated: Number(p.updated) || Date.now(),
			notes: [],
			wall: normalizeWall(p.wall)
		};
		var wallIds = {};
		out.wall.items.forEach(function (it) { wallIds[it.id] = true; });
		var taken = {};
		(Array.isArray(p.notes) ? p.notes : []).forEach(function (n) {
			var row = Math.max(0, Math.min(500, parseInt(n.row, 10) || 0));
			var col = Math.max(0, Math.min(50, parseInt(n.col, 10) || 0));
			while (taken[row + ':' + col]) row++;
			taken[row + ':' + col] = true;
			out.notes.push({
				id: typeof n.id === 'string' ? n.id : uid(),
				row: row,
				col: col,
				title: String(n.title || '').slice(0, 300),
				text: String(n.text || '').slice(0, 20000),
				color: /^#[0-9a-f]{6}$/i.test(n.color) ? n.color : (col === 0 ? SPINE_COLOR : DETAIL_COLOR),
				// Onderliggende briefjes: verwijzingen naar briefjes op de crazywall (nieuw in 1.2).
				refs: (Array.isArray(n.refs) ? n.refs : []).filter(function (id, i, all) {
					return typeof id === 'string' && wallIds[id] && all.indexOf(id) === i;
				}),
				sources: (Array.isArray(n.sources) ? n.sources : []).map(function (s) {
					var type = s.type === 'file' || s.type === 'missing' ? s.type : 'link';
					return {
						id: typeof s.id === 'string' ? s.id : uid(),
						type: type,
						label: String(s.label || '').slice(0, 300),
						url: type === 'link' ? safeUrl(s.url) : '',
						fileId: type === 'file' ? String(s.fileId || '') : '',
						mime: String(s.mime || ''),
						size: Number(s.size) || 0
					};
				}).filter(function (s) { return s.type !== 'link' || s.url; })
			});
		});
		return out;
	}

	// Crazywall van een geïmporteerd of gedeeld verhaal veilig maken. Ontbreekt hij (oude bestanden), dan een lege wand.
	function normalizeWall(w) {
		var out = emptyWall();
		if (!w || typeof w !== 'object') return out;
		function coord(v) { v = Number(v); return isFinite(v) ? Math.max(-1000000, Math.min(1000000, Math.round(v))) : 0; }
		var ids = {};
		(Array.isArray(w.items) ? w.items : []).slice(0, 2000).forEach(function (it) {
			if (!it || typeof it !== 'object') return;
			var id = typeof it.id === 'string' && it.id && !ids[it.id] ? it.id : uid();
			ids[id] = true;
			out.items.push({
				id: id,
				x: coord(it.x),
				y: coord(it.y),
				kind: typeof it.kind === 'string' && WALL_KINDS.indexOf(it.kind) >= 0 ? it.kind : '', // nieuw in 1.3
				title: String(it.title || '').slice(0, 300),
				text: String(it.text || '').slice(0, 20000),
				color: /^#[0-9a-f]{6}$/i.test(it.color) ? it.color : COLORS[0].hex
			});
		});
		var pairs = {};
		(Array.isArray(w.lines) ? w.lines : []).forEach(function (l) {
			if (!l || !ids[l.from] || !ids[l.to] || l.from === l.to) return;
			var key = [l.from, l.to].sort().join('|');
			if (pairs[key]) return;
			pairs[key] = true;
			out.lines.push({ id: typeof l.id === 'string' && l.id ? l.id : uid(), from: l.from, to: l.to, color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : LINE_COLORS[0].hex });
		});
		if (w.view && typeof w.view === 'object') {
			var z = Number(w.view.z);
			out.view = { x: coord(w.view.x), y: coord(w.view.y), z: isFinite(z) && z > 0 ? Math.max(0.2, Math.min(2.5, z)) : 1 };
		}
		return out;
	}

	/* ------------------------------------------------------------------ *
	 * @basis:export en @basis:import — JSON-bestanden
	 * ------------------------------------------------------------------ */

	function collectFiles(projects) {
		var files = {};
		var jobs = [];
		projects.forEach(function (p) {
			projectFileIds(p).forEach(function (fid) {
				jobs.push(Files.get(fid).then(function (blob) {
					if (blob) return blobToDataUrl(blob).then(function (d) { files[fid] = d; });
				}));
			});
		});
		return Promise.all(jobs).then(function () { return files; });
	}

	function exportProject(project) {
		return collectFiles([project]).then(function (files) {
			var data = { format: FORMAT, version: FORMAT_VERSION, exported: Date.now(), project: project, files: files };
			download(slugify(project.name) + '.nutgraph.json', JSON.stringify(data, null, 1), 'application/json');
		});
	}

	function exportLibrary(lib) {
		return collectFiles(lib.projects).then(function (files) {
			var data = { format: FORMAT_LIBRARY, version: FORMAT_VERSION, exported: Date.now(), projects: lib.projects, files: files };
			download('nutgraph-bibliotheek-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 1), 'application/json');
		});
	}

	// Leest een exportbestand en geeft een lijst projecten terug, met nieuwe bestands-id's.
	function readImport(text) {
		var data = JSON.parse(text);
		var list;
		var fmt = data && data.format;
		if (fmt === OLD_FORMATS[0]) fmt = FORMAT;
		if (fmt === OLD_FORMATS[1]) fmt = FORMAT_LIBRARY;
		if (data && fmt === FORMAT && data.project) list = [data.project];
		else if (data && fmt === FORMAT_LIBRARY && Array.isArray(data.projects)) list = data.projects;
		else throw new Error(t('not_nutgraph'));
		var files = data.files || {};
		var jobs = [];
		var projects = list.map(function (raw) {
			var p = normalizeProject(raw);
			p.notes.forEach(function (n) {
				n.sources.forEach(function (s) {
					if (s.type !== 'file') return;
					var dataUrl = files[s.fileId];
					if (!dataUrl) { s.type = 'missing'; s.fileId = ''; return; }
					var newId = uid();
					s.fileId = newId;
					jobs.push(Files.put(newId, dataUrlToBlob(dataUrl)));
				});
			});
			return p;
		});
		return Promise.all(jobs).then(function () { return projects; });
	}

	/* ------------------------------------------------------------------ *
	 * @basis:delen — de hele structuur zit gecomprimeerd in de link
	 * ------------------------------------------------------------------ */

	function bytesToB64u(bytes) {
		var s = '';
		for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
		return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}
	function b64uToBytes(str) {
		str = str.replace(/-/g, '+').replace(/_/g, '/');
		while (str.length % 4) str += '=';
		var bin = atob(str);
		var out = new Uint8Array(bin.length);
		for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	}
	function pipe(bytes, stream) {
		return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
	}

	// Compacte vorm: geen documenten (te groot), wel links en tekst.
	// Crazywall (w = briefjes, l = draden) en onderliggende briefjes (7e veld) gaan mee als volgnummers.
	function packForShare(project) {
		var wall = project.wall || emptyWall();
		var index = {};
		wall.items.forEach(function (it, i) { index[it.id] = i; });
		var d = {
			n: project.name,
			t: project.notes.map(function (n) {
				var a = [n.row, n.col, n.color, n.title, n.text, n.sources.map(function (s) {
					return s.type === 'link' ? [s.label, s.url] : [s.label || t('document'), ''];
				})];
				var refs = (n.refs || []).filter(function (id) { return index[id] !== undefined; }).map(function (id) { return index[id]; });
				if (refs.length) a.push(refs);
				return a;
			})
		};
		if (wall.items.length) {
			d.w = wall.items.map(function (it) {
				var a = [Math.round(it.x), Math.round(it.y), it.color, it.title, it.text];
				if (it.kind) a.push(it.kind);
				return a;
			});
			d.l = wall.lines.map(function (l) { return [index[l.from], index[l.to], l.color]; });
		}
		return d;
	}
	function unpackShare(d) {
		var ids = (d.w || []).map(function () { return uid(); });
		return normalizeProject({
			name: d.n,
			wall: {
				items: (d.w || []).map(function (a, i) { return { id: ids[i], x: a[0], y: a[1], color: a[2], title: a[3], text: a[4], kind: a[5] }; }),
				lines: (d.l || []).map(function (a) { return { from: ids[a[0]], to: ids[a[1]], color: a[2] }; })
			},
			notes: (d.t || []).map(function (a) {
				return {
					row: a[0], col: a[1], color: a[2], title: a[3], text: a[4],
					sources: (a[5] || []).map(function (s) {
						return s[1] ? { type: 'link', label: s[0], url: s[1] } : { type: 'missing', label: s[0] };
					}),
					refs: (a[6] || []).map(function (i) { return ids[i]; })
				};
			})
		});
	}

	function encodeShare(project) {
		var bytes = new TextEncoder().encode(JSON.stringify(packForShare(project)));
		if (window.CompressionStream) {
			return pipe(bytes, new CompressionStream('deflate-raw')).then(function (c) { return 'z' + bytesToB64u(c); });
		}
		return Promise.resolve('j' + bytesToB64u(bytes));
	}
	function decodeShare(str) {
		var kind = str.charAt(0);
		var bytes = b64uToBytes(str.slice(1));
		var p = kind === 'z' ? pipe(bytes, new DecompressionStream('deflate-raw')) : Promise.resolve(bytes);
		return p.then(function (b) { return unpackShare(JSON.parse(new TextDecoder().decode(b))); });
	}
	function shareBaseUrl() {
		return location.href.split('#')[0];
	}

	/* ------------------------------------------------------------------ *
	 * @basis:tekstoverzicht — de structuur als Markdown-schets
	 * ------------------------------------------------------------------ */

	function toMarkdown(project) {
		var rows = {};
		project.notes.forEach(function (n) { (rows[n.row] = rows[n.row] || []).push(n); });
		var lines = ['# ' + project.name, ''];
		Object.keys(rows).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
			var notes = rows[r].sort(function (a, b) { return a.col - b.col; });
			var spine = notes[0].col === 0 ? notes.shift() : null;
			lines.push('## ' + (spine ? (spine.title || t('untitled')) : t('row_n', { n: r + 1 })));
			if (spine) {
				if (spine.text) lines.push('', spine.text);
				if (spine.sources.length || kidLines(project, spine).length) lines.push('');
				sourceLines(spine).forEach(function (l) { lines.push(l); });
				kidLines(project, spine).forEach(function (l) { lines.push(l); });
			}
			notes.forEach(function (n) {
				lines.push('', '- **' + (n.title || t('detail')) + '**' + (n.text ? ': ' + n.text.replace(/\n+/g, ' ') : ''));
				sourceLines(n).forEach(function (l) { lines.push('  ' + l); });
				kidLines(project, n).forEach(function (l) { lines.push('  ' + l); });
			});
			lines.push('');
		});
		var wall = project.wall || emptyWall();
		if (wall.items.length) {
			var names = {};
			lines.push('## ' + t('tab_wall'), '');
			wall.items.forEach(function (it) {
				names[it.id] = it.title || t('untitled');
				lines.push('- ' + (it.kind ? '(' + kindLabel(it.kind) + ') ' : '') + '**' + names[it.id] + '**' + (it.text ? ': ' + it.text.replace(/\n+/g, ' / ') : ''));
			});
			if (wall.lines.length) {
				lines.push('', '### ' + t('wires'), '');
				wall.lines.forEach(function (l) { lines.push('- ' + names[l.from] + ' \u2014 ' + names[l.to]); });
			}
			lines.push('');
		}
		return lines.join('\n');
	}
	function kidsOf(project, n) {
		var items = (project.wall || emptyWall()).items;
		return (n.refs || []).map(function (id) {
			for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
			return null;
		}).filter(Boolean);
	}
	function kidLines(project, n) {
		return kidsOf(project, n).map(function (k) {
			return '- \u21b3 ' + (k.kind ? '(' + kindLabel(k.kind) + ') ' : '') + (k.title || t('untitled')) + (k.text ? ': ' + k.text.replace(/\n+/g, ' / ') : '');
		});
	}
	function sourceLines(n) {
		return n.sources.map(function (s) {
			if (s.type === 'link') return '- ' + t('md_source') + ': [' + (s.label || s.url) + '](' + s.url + ')';
			return '- ' + t('md_source_doc') + ': ' + (s.label || t('unnamed'));
		});
	}

	/* ------------------------------------------------------------------ *
	 * Meldingen en vensters
	 * ------------------------------------------------------------------ */

	var toastBox = null;
	function toast(message, isError) {
		if (!toastBox) {
			toastBox = h('div', { class: 'vb-toasts', role: 'status', 'aria-live': 'polite' });
			document.body.appendChild(toastBox);
		}
		var t = h('div', { class: 'vb-toast' + (isError ? ' is-error' : '') }, message);
		toastBox.appendChild(t);
		setTimeout(function () { t.remove(); }, isError ? 7000 : 3500);
	}

	function modal(title, body, actions) {
		var previous = document.activeElement;
		var overlay = h('div', { class: 'vb-overlay vb-scope' });
		function close() { overlay.remove(); document.removeEventListener('keydown', onKey); if (previous && previous.focus) previous.focus(); }
		function onKey(e) { if (e.key === 'Escape') close(); }
		var box = h('div', { class: 'vb-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
			h('h2', { class: 'vb-modal-title' }, title),
			h('div', { class: 'vb-modal-body' }, body),
			h('div', { class: 'vb-modal-actions' }, (actions || [{ label: t('close') }]).map(function (a) {
				return h('button', {
					type: 'button',
					class: 'vb-btn' + (a.primary ? ' vb-btn-primary' : '') + (a.danger ? ' vb-btn-danger' : ''),
					onclick: function () { if (a.onClick && a.onClick() === false) return; close(); }
				}, a.label);
			}))
		);
		overlay.appendChild(box);
		overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
		document.addEventListener('keydown', onKey);
		document.body.appendChild(overlay);
		var focusable = box.querySelector('input, textarea, .vb-btn-primary, button');
		if (focusable) focusable.focus();
		return close;
	}

	function confirmBox(title, text, okLabel, onOk) {
		modal(title, h('p', null, text), [
			{ label: t('cancel') },
			{ label: okLabel, danger: true, onClick: onOk }
		]);
	}

	/* ------------------------------------------------------------------ *
	 * De app
	 * ------------------------------------------------------------------ */

	function App(root) {
		this.root = root;
		this.lib = Store.load();
		this.view = 'board';
		this.project = null;
		this.selectedId = null;
		this.selectedWallId = null;
		this.selectedLineId = null;
		this.panelMode = null;
		this.textTimer = null;
		this.wallZ = 10;
		this.tab = 'board';
		try { if (localStorage.getItem(TAB_KEY) === 'wall') this.tab = 'wall'; } catch (e) { /* niet erg */ }

		root.classList.add('vb-scope');
		root.innerHTML = '';
		this.top = h('div', { class: 'vb-top' });
		this.main = h('div', { class: 'vb-main' });
		this.panel = h('aside', { class: 'vb-panel', 'aria-label': t('edit_note_label'), hidden: true });
		root.setAttribute('lang', LANG);
		root.appendChild(this.top);
		root.appendChild(this.main);
		root.appendChild(this.panel);

		var current = Store.getCurrent();
		this.project = this.find(current) || this.lib.projects[0] || null;
		if (!this.project) {
			this.project = newProject(t('first_story'));
			this.lib.projects.push(this.project);
			this.persist();
		}
		Store.setCurrent(this.project.id);

		if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

		var self = this;
		window.addEventListener('storage', function (e) {
			if (e.key !== STORE_KEY || self.panel.hidden === false) return;
			self.lib = Store.load();
			self.project = self.find(self.project && self.project.id) || self.lib.projects[0] || null;
			self.render();
		});
		this.render();
		this.checkSharedLink();
	}

	App.prototype.find = function (id) {
		for (var i = 0; i < this.lib.projects.length; i++) if (this.lib.projects[i].id === id) return this.lib.projects[i];
		return null;
	};

	App.prototype.persist = function () {
		if (this.project) this.project.updated = Date.now();
		var ok = Store.save(this.lib);
		if (this.status) this.status.textContent = ok ? t('saved') : t('not_saved');
	};

	App.prototype.render = function () {
		this.top.innerHTML = '';
		this.main.innerHTML = '';
		if (this.view === 'library') this.renderLibrary();
		else this.renderBoard();
	};

	/* ---------- @basis:bibliotheek ---------- */

	App.prototype.openProject = function (id) {
		this.project = this.find(id);
		Store.setCurrent(id);
		this.view = 'board';
		this.closePanel();
		this.render();
	};

	App.prototype.renderLibrary = function () {
		var self = this;
		this.top.appendChild(h('div', { class: 'vb-bar' },
			h('h2', { class: 'vb-heading' }, t('library')),
			h('div', { class: 'vb-bar-group' },
				h('button', { type: 'button', class: 'vb-btn vb-btn-primary', onclick: function () { self.createProject(); } }, t('new_story_btn')),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { self.pickImport(); } }, t('import')),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { exportLibrary(self.lib); } }, t('export_all')),
				this.languageSelect()
			)
		));

		var projects = this.lib.projects.slice().sort(function (a, b) { return b.updated - a.updated; });
		if (!projects.length) {
			this.main.appendChild(h('p', { class: 'vb-empty' }, t('library_empty')));
			return;
		}
		var list = h('ul', { class: 'vb-library' });
		projects.forEach(function (p) {
			var spine = p.notes.filter(function (n) { return n.col === 0; }).sort(function (a, b) { return a.row - b.row; });
			list.appendChild(h('li', { class: 'vb-lib-item' + (self.project && p.id === self.project.id ? ' is-current' : '') },
				h('button', { type: 'button', class: 'vb-lib-open', onclick: function () { self.openProject(p.id); } },
					h('span', { class: 'vb-lib-name' }, p.name),
					h('span', { class: 'vb-lib-meta' }, plural(p.notes.length, 'notes_one', 'notes_many') + ', ' + t('edited_on', { date: formatDate(p.updated) })),
					h('span', { class: 'vb-lib-spine' }, spine.slice(0, 5).map(function (n) {
						return h('span', { class: 'vb-mini', style: 'background:' + n.color }, n.title || t('untitled'));
					}))
				),
				h('div', { class: 'vb-lib-actions' },
					h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { self.renameProject(p); } }, t('rename')),
					h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { self.duplicateProject(p); } }, t('duplicate')),
					h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { exportProject(p); } }, t('export')),
					h('button', { type: 'button', class: 'vb-btn vb-btn-small vb-btn-danger', onclick: function () { self.deleteProject(p); } }, t('delete'))
				)
			));
		});
		this.main.appendChild(list);
		this.main.appendChild(h('p', { class: 'vb-note-hint' }, t('library_hint')));
	};

	App.prototype.createProject = function () {
		var self = this;
		var input = h('input', { type: 'text', class: 'vb-input', value: t('new_story'), 'aria-label': t('story_name') });
		modal(t('new_story'), input, [
			{ label: t('cancel') },
			{ label: t('create'), primary: true, onClick: function () {
				var p = newProject(input.value.trim() || t('new_story'));
				self.lib.projects.push(p);
				self.persist();
				self.openProject(p.id);
			} }
		]);
		input.select();
		input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.closest('.vb-modal').querySelector('.vb-btn-primary').click(); });
	};

	App.prototype.renameProject = function (p) {
		var self = this;
		var input = h('input', { type: 'text', class: 'vb-input', value: p.name, 'aria-label': t('new_name') });
		modal(t('rename'), input, [
			{ label: t('cancel') },
			{ label: t('save'), primary: true, onClick: function () { p.name = input.value.trim() || p.name; self.persist(); self.render(); } }
		]);
		input.select();
	};

	App.prototype.duplicateProject = function (p) {
		var self = this;
		var copy = clone(p);
		copy.id = uid();
		copy.name = t('copy_suffix', { name: p.name });
		copy.created = copy.updated = Date.now();
		var jobs = [];
		copy.notes.forEach(function (n) {
			n.id = uid();
			n.sources.forEach(function (s) {
				if (s.type !== 'file') return;
				var oldId = s.fileId, newId = uid();
				s.fileId = newId;
				jobs.push(Files.get(oldId).then(function (blob) { if (blob) return Files.put(newId, blob); }));
			});
		});
		Promise.all(jobs).then(function () {
			self.lib.projects.push(copy);
			self.persist();
			self.render();
			toast(t('duplicated', { name: copy.name }));
		});
	};

	App.prototype.deleteProject = function (p) {
		var self = this;
		confirmBox(t('delete_story'), t('delete_story_text', { name: p.name }), t('delete'), function () {
			projectFileIds(p).forEach(function (fid) { Files.del(fid); });
			self.lib.projects = self.lib.projects.filter(function (x) { return x.id !== p.id; });
			if (self.project && self.project.id === p.id) {
				self.project = self.lib.projects[0] || null;
				if (!self.project) { self.project = newProject(t('new_story')); self.lib.projects.push(self.project); }
				Store.setCurrent(self.project.id);
			}
			self.persist();
			self.render();
		});
	};

	App.prototype.pickImport = function () {
		var self = this;
		var input = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
		input.addEventListener('change', function () {
			var file = input.files && input.files[0];
			input.remove();
			if (!file) return;
			file.text().then(readImport).then(function (projects) {
				projects.forEach(function (p) {
					if (self.find(p.id)) p.id = uid();
					self.lib.projects.push(p);
				});
				self.persist();
				toast(projects.length === 1 ? t('imported_one', { name: projects[0].name }) : t('imported_many', { n: projects.length }));
				if (projects.length === 1) self.openProject(projects[0].id);
				else { self.view = 'library'; self.render(); }
			}).catch(function (err) {
				toast(t('import_failed') + ' ' + (err && err.message ? err.message : t('file_unreadable')), true);
			});
		});
		document.body.appendChild(input);
		input.click();
	};

	App.prototype.checkSharedLink = function () {
		var self = this;
		var m = location.hash.match(/[#&]vb=([A-Za-z0-9_-]+)/);
		if (!m) return;
		decodeShare(m[1]).then(function (p) {
			history.replaceState(null, '', location.href.split('#')[0]);
			modal(t('share_received'), h('p', null,
				t('share_received_text', { name: p.name, n: p.notes.length })
			), [
				{ label: t('dont_add') },
				{ label: t('add'), primary: true, onClick: function () {
					p.id = uid();
					p.created = p.updated = Date.now();
					self.lib.projects.push(p);
					self.persist();
					self.openProject(p.id);
				} }
			]);
		}).catch(function () {
			toast(t('share_broken'), true);
		});
	};

	/* ---------- @basis:whiteboard ---------- */

	App.prototype.noteAt = function (row, col) {
		var notes = this.project.notes;
		for (var i = 0; i < notes.length; i++) if (notes[i].row === row && notes[i].col === col) return notes[i];
		return null;
	};

	App.prototype.noteById = function (id) {
		var notes = this.project.notes;
		for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return notes[i];
		return null;
	};

	App.prototype.renderBoard = function () {
		var self = this;
		var p = this.project;

		var nameInput = h('input', { type: 'text', class: 'vb-title-input', value: p.name, 'aria-label': t('story_name') });
		nameInput.addEventListener('change', function () { p.name = nameInput.value.trim() || p.name; self.persist(); });

		this.status = h('span', { class: 'vb-status' }, t('saved'));

		this.top.appendChild(h('div', { class: 'vb-bar' },
			h('div', { class: 'vb-bar-group' },
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { self.closePanel(); self.view = 'library'; self.render(); } }, t('library')),
				nameInput
			),
			h('div', { class: 'vb-bar-group' },
				h('button', { type: 'button', class: 'vb-btn vb-btn-primary vb-btn-add', onclick: function () { if (self.tab === 'wall') self.addWallItem(); else self.addNote(); } }, t('add_note_btn')),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { self.share(); } }, t('share_link')),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { exportProject(p); } }, t('export')),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { self.pickImport(); } }, t('import')),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () {
					download(slugify(p.name) + '.md', toMarkdown(p), 'text/markdown');
				} }, t('text_overview')),
				this.moreMenu(),
				this.languageSelect()
			)
		));
		this.top.appendChild(this.tabs());
		this.top.appendChild(h('div', { class: 'vb-substatus' }, this.status,
			h('span', { class: 'vb-help' }, t(this.tab === 'wall' ? 'wall_help' : 'help'))));

		this.grid = null;
		this.wallEl = this.wallItems = this.wallSvg = this.wallLayer = this.wireBar = null;
		this.selectedLineId = null;
		if (this.tab === 'wall') { this.renderWall(); return; }
		this.boardWrap = h('div', { class: 'vb-board-wrap' });
		this.main.appendChild(this.boardWrap);
		this.drawGrid();
	};

	App.prototype.drawGrid = function () {
		if (this.tab !== 'board' || !this.boardWrap) return;
		var self = this;
		var notes = this.project.notes;
		var maxRow = -1, maxCol = 0;
		notes.forEach(function (n) { if (n.row > maxRow) maxRow = n.row; if (n.col > maxCol) maxCol = n.col; });
		var rows = Math.max(4, maxRow + 2);
		var cols = Math.max(3, maxCol + 2);

		var grid = h('div', {
			class: 'vb-grid',
			style: 'grid-template-columns: var(--vb-rowhead) var(--vb-spine-w) repeat(' + (cols - 1) + ', var(--vb-cell-w));'
		});

		grid.appendChild(h('div', { class: 'vb-colhead vb-corner' }));
		grid.appendChild(h('div', { class: 'vb-colhead vb-colhead-spine' }, t('spine')));
		for (var c = 1; c < cols; c++) grid.appendChild(h('div', { class: 'vb-colhead' }, c === 1 ? t('details') : ''));

		for (var r = 0; r < rows; r++) {
			(function (row) {
				var rowNotes = notes.filter(function (n) { return n.row === row; }).length;
				grid.appendChild(h('div', { class: 'vb-rowhead' },
					h('span', { class: 'vb-rownum' }, String(row + 1)),
					h('button', { type: 'button', class: 'vb-icon-btn', title: t('insert_row_title'), 'aria-label': t('insert_row_label', { n: row + 1 }), onclick: function () { self.insertRow(row); } }, '+'),
					rowNotes ? h('button', { type: 'button', class: 'vb-icon-btn', title: t('delete_row_title'), 'aria-label': t('delete_row_label', { n: row + 1 }), onclick: function () { self.deleteRow(row); } }, '\u00d7') : null
				));
				for (var col = 0; col < cols; col++) {
					var note = self.noteAt(row, col);
					var cell = h('div', { class: 'vb-cell' + (col === 0 ? ' is-spine' : ''), 'data-row': row, 'data-col': col });
					if (note) cell.appendChild(self.noteElement(note));
					else {
						(function (rr, cc) {
							cell.appendChild(h('button', {
								type: 'button', class: 'vb-cell-add',
								'aria-label': cc === 0 ? t('add_note_spine_label', { row: rr + 1 }) : t('add_note_detail_label', { row: rr + 1, col: cc }),
								onclick: function () { self.addNote(rr, cc); }
							}, '+'));
						})(row, col);
					}
					grid.appendChild(cell);
				}
			})(r);
		}

		this.boardWrap.innerHTML = '';
		this.boardWrap.appendChild(grid);
		this.grid = grid;
	};

	App.prototype.noteElement = function (note) {
		var self = this;
		var srcCount = note.sources.length;
		var kids = kidsOf(this.project, note);
		var label = t(note.col === 0 ? 'note_label_spine' : 'note_label_detail', { title: note.title || t('untitled'), row: note.row + 1 });
		if (kids.length) label += ', ' + plural(kids.length, 'kids_count_one', 'kids_count_many');
		var el = h('div', {
			class: 'vb-note' + (note.id === this.selectedId ? ' is-selected' : '') + (note.col === 0 ? ' is-spine' : '') + (kids.length ? ' has-kids' : ''),
			style: 'background:' + note.color + ';--vb-tilt:' + tilt(note.id) + 'deg',
			tabindex: '0',
			role: 'button',
			'aria-label': label,
			'aria-haspopup': 'menu',
			'data-id': note.id
		},
			h('span', { class: 'vb-note-title' + (note.title ? '' : ' is-empty') }, note.title || t('untitled')),
			note.text ? h('span', { class: 'vb-note-text' }, note.text) : null,
			kids.length || srcCount ? h('span', { class: 'vb-note-foot' },
				kids.slice(0, 2).map(function (k) {
					return h('span', { class: 'vb-kid', style: 'background:' + k.color, title: (k.kind ? kindLabel(k.kind) + ': ' : '') + (k.title || t('untitled')) },
						k.kind ? kindIcon(k.kind, 'vb-kind-mini') : '\u21b3 ', k.title || t('untitled'));
				}),
				kids.length > 2 ? h('span', { class: 'vb-kid vb-kid-more' }, '+' + (kids.length - 2)) : null,
				srcCount ? h('span', { class: 'vb-note-badge' }, plural(srcCount, 'sources_one', 'sources_many')) : null
			) : null
		);
		this.makeDraggable(el, note);
		// Rechtermuisknop (of de menutoets / Shift+F10): briefje van de crazywall eronder hangen.
		el.addEventListener('contextmenu', function (e) {
			e.preventDefault();
			var x = e.clientX, y = e.clientY;
			if (!x && !y) { var r = el.getBoundingClientRect(); x = r.left + 24; y = r.top + 24; }
			self.openWallPicker(note, x, y, el);
		});
		el.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.openPanel(note.id); return; }
			if (!e.altKey) return;
			var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
			if (!d) return;
			e.preventDefault();
			var r = note.row + d[0], c = note.col + d[1];
			if (r < 0 || c < 0) return;
			self.moveNote(note, r, c);
			var moved = self.grid.querySelector('[data-id="' + note.id + '"]');
			if (moved) moved.focus();
		});
		return el;
	};

	/* ---------- @basis:slepen ---------- */

	App.prototype.makeDraggable = function (el, note) {
		var self = this;
		var start = null, ghost = null, target = null, scrollTimer = null;

		function cellAt(x, y) {
			var under = document.elementFromPoint(x, y);
			return under ? under.closest('.vb-cell') : null;
		}
		function autoscroll(x, y) {
			var wrap = self.boardWrap, rect = wrap.getBoundingClientRect(), edge = 50, dx = 0, dy = 0;
			if (x < rect.left + edge) dx = -14; else if (x > rect.right - edge) dx = 14;
			if (y < rect.top + edge) dy = -14; else if (y > rect.bottom - edge) dy = 14;
			if (dx || dy) wrap.scrollBy(dx, dy);
			if (y < 40) window.scrollBy(0, -14); else if (y > window.innerHeight - 40) window.scrollBy(0, 14);
		}

		el.addEventListener('pointerdown', function (e) {
			if (e.button !== 0) return;
			start = { x: e.clientX, y: e.clientY, id: e.pointerId };
			el.setPointerCapture(e.pointerId);
		});

		el.addEventListener('pointermove', function (e) {
			if (!start || e.pointerId !== start.id) return;
			if (!ghost) {
				if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) < 6) return;
				var rect = el.getBoundingClientRect();
				ghost = el.cloneNode(true);
				ghost.classList.add('vb-ghost');
				ghost.style.width = rect.width + 'px';
				ghost.style.height = rect.height + 'px';
				ghost._dx = start.x - rect.left;
				ghost._dy = start.y - rect.top;
				self.root.appendChild(ghost);
				el.classList.add('is-dragging');
			}
			ghost.style.transform = 'translate(' + (e.clientX - ghost._dx) + 'px,' + (e.clientY - ghost._dy) + 'px) rotate(-2deg)';
			var cell = cellAt(e.clientX, e.clientY);
			if (cell !== target) {
				if (target) target.classList.remove('is-target');
				target = cell;
				if (target) target.classList.add('is-target');
			}
			autoscroll(e.clientX, e.clientY);
		});

		function finish(e, cancelled) {
			if (!start) return;
			var wasDrag = !!ghost;
			if (ghost) { ghost.remove(); ghost = null; }
			el.classList.remove('is-dragging');
			if (target) target.classList.remove('is-target');
			clearTimeout(scrollTimer);
			start = null;
			if (cancelled) { target = null; return; }
			if (!wasDrag) { self.openPanel(note.id); return; }
			if (target) {
				var r = parseInt(target.getAttribute('data-row'), 10);
				var c = parseInt(target.getAttribute('data-col'), 10);
				target = null;
				self.moveNote(note, r, c);
			}
		}
		el.addEventListener('pointerup', function (e) { finish(e, false); });
		el.addEventListener('pointercancel', function (e) { finish(e, true); });
	};

	// Verplaatst een briefje. Staat er al een, dan wisselen ze van plek.
	App.prototype.moveNote = function (note, row, col) {
		if (note.row === row && note.col === col) return;
		var other = this.noteAt(row, col);
		if (other) { other.row = note.row; other.col = note.col; }
		note.row = row;
		note.col = col;
		this.persist();
		this.drawGrid();
		this.refreshPanelPosition();
	};

	/* ---------- @basis:plusknop ---------- */

	App.prototype.addNote = function (row, col) {
		var placedByHand = row !== undefined;
		if (row === undefined) {
			// De plusknop in de balk: eerste lege plek in de ruggengraat.
			col = 0;
			row = 0;
			while (this.noteAt(row, 0)) row++;
		}
		var note = newNote(row, col);
		this.project.notes.push(note);
		this.persist();
		this.selectedId = note.id;
		this.drawGrid();
		var el = this.grid.querySelector('[data-id="' + note.id + '"]');
		if (el) {
			el.classList.add('is-new');
			el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
			el.focus({ preventScroll: true });
		}
		// Via het plusje in een vak staat het briefje meteen goed: direct bewerken.
		if (placedByHand) this.openPanel(note.id);
	};

	App.prototype.insertRow = function (row) {
		this.project.notes.forEach(function (n) { if (n.row >= row) n.row++; });
		this.persist();
		this.drawGrid();
		this.refreshPanelPosition();
	};

	App.prototype.deleteRow = function (row) {
		var self = this;
		var inRow = this.project.notes.filter(function (n) { return n.row === row; });
		confirmBox(t('delete_row_label', { n: row + 1 }), plural(inRow.length, 'delete_row_text_one', 'delete_row_text_many'), t('delete'), function () {
			inRow.forEach(function (n) { n.sources.forEach(function (s) { if (s.type === 'file') Files.del(s.fileId); }); });
			self.project.notes = self.project.notes.filter(function (n) { return n.row !== row; });
			self.project.notes.forEach(function (n) { if (n.row > row) n.row--; });
			if (self.selectedId && !self.noteById(self.selectedId)) self.closePanel();
			self.persist();
			self.drawGrid();
			self.refreshPanelPosition();
		});
	};

	/* ---------- @basis:bewerken — titel, kleur, tekst en bronnen ---------- */

	App.prototype.openPanel = function (id) {
		var self = this;
		var note = this.noteById(id);
		if (!note) return;
		if (this.wallTimer) { clearTimeout(this.wallTimer); this.wallTimer = null; this.persist(); }
		this.panelMode = 'note';
		this.selectedWallId = null;
		this.selectedId = id;
		this.panel.hidden = false;
		this.panel.innerHTML = '';
		this.root.classList.add('has-panel');
		this.markSelected();
		this.kidList = h('ul', { class: 'vb-sources vb-kids' });
		this.drawKids(note);

		var titleInput = h('input', { type: 'text', class: 'vb-input', value: note.title, placeholder: t('title_placeholder'), id: 'vb-title-' + id });
		titleInput.addEventListener('input', function () { note.title = titleInput.value; self.changedText(); });

		var textArea = h('textarea', { class: 'vb-input vb-textarea', rows: '7', placeholder: t('text_placeholder'), id: 'vb-text-' + id });
		textArea.value = note.text;
		textArea.addEventListener('input', function () { note.text = textArea.value; self.changedText(); });

		var swatches = h('div', { class: 'vb-swatches', role: 'radiogroup', 'aria-label': t('color') });
		function drawSwatches() {
			swatches.innerHTML = '';
			COLORS.forEach(function (c) {
				var active = note.color.toLowerCase() === c.hex.toLowerCase();
				swatches.appendChild(h('button', {
					type: 'button', class: 'vb-swatch' + (active ? ' is-active' : ''), role: 'radio',
					'aria-checked': active ? 'true' : 'false', 'aria-label': t(c.name), title: t(c.name),
					style: 'background:' + c.hex,
					onclick: function () { note.color = c.hex; self.persist(); self.drawGrid(); drawSwatches(); }
				}));
			});
			var custom = h('input', { type: 'color', class: 'vb-swatch-custom', value: note.color, title: t('custom_color'), 'aria-label': t('custom_color_label') });
			custom.addEventListener('input', function () { note.color = custom.value; self.persist(); self.drawGrid(); });
			custom.addEventListener('change', drawSwatches);
			swatches.appendChild(custom);
		}
		drawSwatches();

		this.positionLabel = h('p', { class: 'vb-panel-pos' });
		this.sourceList = h('ul', { class: 'vb-sources' });
		this.drawSources(note);

		var linkLabel = h('input', { type: 'text', class: 'vb-input', placeholder: t('link_label_ph'), 'aria-label': t('link_label_aria') });
		var linkUrl = h('input', { type: 'url', class: 'vb-input', placeholder: 'https://…', 'aria-label': t('web_address') });
		function addLink() {
			var url = safeUrl(linkUrl.value);
			if (!url) { toast(t('invalid_url'), true); linkUrl.focus(); return; }
			note.sources.push({ id: uid(), type: 'link', label: linkLabel.value.trim(), url: url, fileId: '', mime: '', size: 0 });
			linkLabel.value = ''; linkUrl.value = '';
			self.persist(); self.drawSources(note); self.drawGrid();
		}
		linkUrl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addLink(); } });

		var fileInput = h('input', { type: 'file', multiple: true, class: 'vb-visually-hidden', id: 'vb-file-' + id });
		fileInput.addEventListener('change', function () {
			var files = Array.prototype.slice.call(fileInput.files || []);
			fileInput.value = '';
			files.forEach(function (file) {
				if (file.size > 25 * 1048576) { toast(t('file_too_big', { name: file.name }), true); return; }
				var fid = uid();
				Files.put(fid, file).then(function () {
					note.sources.push({ id: uid(), type: 'file', label: file.name, url: '', fileId: fid, mime: file.type, size: file.size });
					self.persist(); self.drawSources(note); self.drawGrid();
				}).catch(function () { toast(t('file_save_failed', { name: file.name }), true); });
			});
		});

		this.panel.appendChild(h('div', { class: 'vb-panel-head' },
			h('h2', { class: 'vb-panel-title' }, t('note')),
			h('button', { type: 'button', class: 'vb-icon-btn vb-close', 'aria-label': t('close'), onclick: function () { self.closePanel(); } }, '\u00d7')
		));
		this.panel.appendChild(h('div', { class: 'vb-panel-body' },
			this.positionLabel,
			h('label', { class: 'vb-label', for: 'vb-title-' + id }, t('title')), titleInput,
			h('span', { class: 'vb-label' }, t('color')), swatches,
			h('label', { class: 'vb-label', for: 'vb-text-' + id }, t('description')), textArea,
			h('span', { class: 'vb-label' }, t('kids')), this.kidList,
			h('div', { class: 'vb-kids-add' },
				h('button', { type: 'button', class: 'vb-btn vb-btn-small', 'aria-haspopup': 'menu', onclick: function (e) {
					var r = e.currentTarget.getBoundingClientRect();
					self.openWallPicker(note, r.left, r.bottom + 4, e.currentTarget);
				} }, t('kids_add'))
			),
			h('span', { class: 'vb-label' }, t('sources')), this.sourceList,
			h('div', { class: 'vb-addsource' },
				linkLabel, linkUrl,
				h('div', { class: 'vb-addsource-actions' },
					h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: addLink }, t('add_link')),
					h('label', { class: 'vb-btn vb-btn-small', for: 'vb-file-' + id }, t('add_document')),
					fileInput
				)
			),
			h('p', { class: 'vb-note-hint' }, t('docs_hint'))
		));
		this.panel.appendChild(h('div', { class: 'vb-panel-foot' },
			h('button', { type: 'button', class: 'vb-btn vb-btn-danger', onclick: function () { self.deleteNote(note); } }, t('delete_note'))
		));
		this.refreshPanelPosition();
		titleInput.focus();
		this.escHandler = this.escHandler || function (e) {
			if (e.key === 'Escape' && !document.querySelector('.vb-overlay, .vb-picker')) self.closePanel();
		};
		document.addEventListener('keydown', this.escHandler);
	};

	App.prototype.refreshPanelPosition = function () {
		var note = this.selectedId && this.noteById(this.selectedId);
		if (!note || !this.positionLabel) return;
		this.positionLabel.textContent = note.col === 0 ? t('pos_spine', { row: note.row + 1 }) : t('pos_detail', { col: note.col, row: note.row + 1 });
	};

	App.prototype.markSelected = function () {
		var id = this.selectedId;
		if (!this.grid) return;
		Array.prototype.forEach.call(this.grid.querySelectorAll('.vb-note'), function (n) {
			n.classList.toggle('is-selected', n.getAttribute('data-id') === id);
		});
	};

	App.prototype.changedText = function () {
		var self = this;
		clearTimeout(this.textTimer);
		this.textTimer = setTimeout(function () { self.persist(); self.drawGrid(); }, 350);
	};

	App.prototype.closePanel = function () {
		if (this.textTimer) { clearTimeout(this.textTimer); this.textTimer = null; this.persist(); }
		if (this.wallTimer) { clearTimeout(this.wallTimer); this.wallTimer = null; this.persist(); }
		if (this.picker) this.picker.close(false);
		var id = this.selectedId, wallId = this.selectedWallId;
		this.selectedId = null;
		this.selectedWallId = null;
		this.panelMode = null;
		this.panel.hidden = true;
		this.panel.innerHTML = '';
		this.positionLabel = null;
		this.kidList = this.wallFiles = this.wallLinks = null;
		this.root.classList.remove('has-panel');
		if (this.escHandler) document.removeEventListener('keydown', this.escHandler);
		if (this.view !== 'board') return;
		if (this.tab === 'wall' && this.wallItems) {
			this.drawWall();
			var item = wallId && this.wallItems.querySelector('[data-id="' + wallId + '"]');
			if (item) item.focus({ preventScroll: true });
		} else if (this.tab === 'board' && this.grid) {
			this.drawGrid();
			var el = id && this.grid.querySelector('[data-id="' + id + '"]');
			if (el) el.focus({ preventScroll: true });
		}
	};

	App.prototype.drawSources = function (note) {
		var self = this;
		var list = this.sourceList;
		list.innerHTML = '';
		if (!note.sources.length) {
			list.appendChild(h('li', { class: 'vb-source-empty' }, t('no_sources')));
			return;
		}
		note.sources.forEach(function (s) {
			var main;
			if (s.type === 'link') {
				main = h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', class: 'vb-source-link' }, s.label || s.url);
			} else if (s.type === 'file') {
				main = h('button', { type: 'button', class: 'vb-source-link', onclick: function () { self.openFile(s); } },
					s.label, h('span', { class: 'vb-source-size' }, ' ' + formatSize(s.size)));
			} else {
				main = h('span', { class: 'vb-source-missing', title: t('doc_missing_title') }, t('doc_unavailable', { name: s.label }));
			}
			list.appendChild(h('li', { class: 'vb-source vb-source-' + s.type },
				h('span', { class: 'vb-source-kind' }, s.type === 'link' ? t('link') : t('document')),
				main,
				h('button', {
					type: 'button', class: 'vb-icon-btn', 'aria-label': t('remove_source'), title: t('remove_source'),
					onclick: function () {
						if (s.type === 'file') Files.del(s.fileId);
						note.sources = note.sources.filter(function (x) { return x.id !== s.id; });
						self.persist(); self.drawSources(note); self.drawGrid();
					}
				}, '\u00d7')
			));
		});
	};

	App.prototype.openFile = function (s) {
		// Venster meteen openen, anders blokkeert de browser het als pop-up.
		var win = window.open('', '_blank');
		Files.get(s.fileId).then(function (blob) {
			if (!blob) { if (win) win.close(); toast(t('doc_gone'), true); return; }
			var url = URL.createObjectURL(blob);
			if (win) win.location.href = url;
			else download(s.label || 'document', blob);
			setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
		});
	};

	App.prototype.deleteNote = function (note) {
		var self = this;
		confirmBox(t('delete_note'), t('delete_note_text', { name: note.title || t('untitled') }), t('delete'), function () {
			note.sources.forEach(function (s) { if (s.type === 'file') Files.del(s.fileId); });
			self.project.notes = self.project.notes.filter(function (n) { return n.id !== note.id; });
			self.persist();
			self.closePanel();
		});
	};

	/* ------------------------------------------------------------------ *
	 * Crazywall — een onbeperkte wand met briefjes en draden.
	 * Uploaden kan hier niet: een regel met alleen een bestandsnaam
	 * wordt herkend en krijgt een pictogram van het bestandstype.
	 * ------------------------------------------------------------------ */

	var WALL_W = 190; // breedte van een briefje op de wand
	var FILE_TYPES = {
		pdf: ['pdf'],
		text: ['doc', 'docx', 'odt', 'rtf', 'pages', 'txt', 'md'],
		sheet: ['xls', 'xlsx', 'ods', 'csv', 'tsv', 'numbers'],
		slides: ['ppt', 'pptx', 'odp', 'key'],
		image: ['jpg', 'jpeg', 'png', 'gif', 'heic', 'webp', 'tif', 'tiff', 'bmp', 'svg', 'raw'],
		audio: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma', 'opus'],
		video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv'],
		archive: ['zip', 'rar', '7z', 'gz', 'tar'],
		mail: ['eml', 'msg', 'mbox'],
		web: ['html', 'htm']
	};
	var EXT_TYPE = {};
	Object.keys(FILE_TYPES).forEach(function (type) { FILE_TYPES[type].forEach(function (ext) { EXT_TYPE[ext] = type; }); });

	// Soorten briefjes op de crazywall, met een eigen getekend pictogram (24×24, lijnen).
	// Volgorde = volgorde in de keuzelijst. Nieuwe soort? Ook 'kind_<naam>' toevoegen in de vertalingen.
	var KINDS = {
		person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
		organization: '<path d="M4 21V5l8-3v19M12 9h8v12M3 21h18M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2"/>',
		place: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
		event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3v3H8z"/>',
		situation: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
		time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
		object: '<path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
		evidence: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
		photo: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/>',
		document: '<path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/>',
		money: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5a4.5 4.5 0 1 0 0 7M7.5 11h6M7.5 13.5h6"/>',
		vehicle: '<path d="M5 17H3v-5l2.5-5h13l2.5 5v5h-2M3 12h18M9.5 17h5"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
		phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
		message: '<path d="M4 4h16v12H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
		quote: '<path d="M4 18c3 0 5-2 5-6V6H4v6h4M14 18c3 0 5-2 5-6V6h-5v6h4"/>',
		source: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
		article: '<path d="M4 4h13v15a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 8h3v11a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/>',
		legal: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
		question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17h.01"/>',
		idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
		other: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.5"/>'
	};
	function kindIcon(kind, extraClass) {
		var span = h('span', { class: 'vb-kind-icon' + (extraClass ? ' ' + extraClass : ''), 'aria-hidden': 'true' });
		// Vaste, eigen SVG-tekst uit KINDS hierboven; nooit invoer van gebruikers.
		if (KINDS[kind]) span.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + KINDS[kind] + '</svg>';
		return span;
	}
	function kindLabel(kind) { return KINDS[kind] ? t('kind_' + kind) : ''; }

	// Een regel die alleen uit een bestandsnaam (of pad) bestaat, bijvoorbeeld "notulen raad 12-3.pdf".
	function fileOfLine(line) {
		var name = String(line || '').trim();
		if (!name || name.length > 200 || /:\/\//.test(name) || /[<>"|?*]/.test(name)) return null;
		if (name.indexOf(':') >= 0 && !/^[A-Za-z]:[\\\/]/.test(name)) return null;
		var m = /\.([a-z0-9]{1,7})$/i.exec(name);
		if (!m || name.length === m[0].length) return null;
		var ext = m[1].toLowerCase();
		return EXT_TYPE[ext] ? { name: name, ext: ext, type: EXT_TYPE[ext] } : null;
	}
	function filesIn(text) {
		return String(text || '').split('\n').map(fileOfLine).filter(Boolean);
	}
	function fileIcon(f) {
		return h('span', { class: 'vb-file-icon vb-ft-' + f.type, 'aria-hidden': 'true', title: t('ft_' + f.type) }, f.ext.slice(0, 4).toUpperCase());
	}
	function fileChip(f) {
		return h('span', { class: 'vb-file', title: t('ft_' + f.type) + ': ' + f.name },
			fileIcon(f),
			h('span', { class: 'vb-file-name' }, f.name),
			h('span', { class: 'vb-visually-hidden' }, ' (' + t('ft_' + f.type) + ')')
		);
	}
	// Tekst van een briefje, met bestandsregels als pictogram + naam.
	function richText(text) {
		return String(text || '').split('\n').map(function (line) {
			var f = fileOfLine(line);
			return f ? fileChip(f) : h('span', { class: 'vb-wall-line' }, line || ' ');
		});
	}

	function svgEl(tag, attrs) {
		var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
		Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
		return el;
	}

	// Een draad hangt een beetje door, als een touwtje tussen twee punaises.
	function wireGeometry(a, b) {
		var dist = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
		var sag = Math.min(80, dist * 0.18) + 6;
		var c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag };
		return {
			d: 'M ' + a.x + ' ' + a.y + ' Q ' + c.x + ' ' + c.y + ' ' + b.x + ' ' + b.y,
			mid: { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 }
		};
	}
	function pinPos(it) { return { x: it.x + WALL_W / 2, y: it.y + 3 }; }

	// Kleurkeuze voor een briefje (dezelfde kleuren als op het storyboard).
	function swatchPicker(getColor, setColor) {
		var box = h('div', { class: 'vb-swatches', role: 'radiogroup', 'aria-label': t('color') });
		function draw() {
			box.innerHTML = '';
			COLORS.forEach(function (c) {
				var active = getColor().toLowerCase() === c.hex.toLowerCase();
				box.appendChild(h('button', {
					type: 'button', class: 'vb-swatch' + (active ? ' is-active' : ''), role: 'radio',
					'aria-checked': active ? 'true' : 'false', 'aria-label': t(c.name), title: t(c.name),
					style: 'background:' + c.hex,
					onclick: function () { setColor(c.hex); draw(); }
				}));
			});
			var custom = h('input', { type: 'color', class: 'vb-swatch-custom', value: getColor(), title: t('custom_color'), 'aria-label': t('custom_color_label') });
			custom.addEventListener('input', function () { setColor(custom.value); });
			custom.addEventListener('change', draw);
			box.appendChild(custom);
		}
		draw();
		return box;
	}

	App.prototype.wallItem = function (id) {
		var items = this.project.wall.items;
		for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
		return null;
	};
	App.prototype.notesUsing = function (id) {
		return this.project.notes.filter(function (n) { return n.refs.indexOf(id) >= 0; });
	};
	// Schuiven en zoomen bewaren zonder "laatst bewerkt" te veranderen.
	App.prototype.saveView = function () {
		var self = this;
		clearTimeout(this.viewTimer);
		this.viewTimer = setTimeout(function () { Store.save(self.lib); }, 300);
	};

	App.prototype.setTab = function (tab) {
		if (tab === this.tab) return;
		this.closePanel();
		this.tab = tab;
		try { localStorage.setItem(TAB_KEY, tab); } catch (e) { /* niet erg */ }
		this.render();
		var btn = this.top.querySelector('.vb-tab.is-active');
		if (btn) btn.focus();
	};

	App.prototype.tabs = function () {
		var self = this;
		var list = [['board', t('tab_storyboard')], ['wall', t('tab_wall')]];
		var bar = h('div', { class: 'vb-tabs', role: 'tablist', 'aria-label': t('views') });
		list.forEach(function (tab, i) {
			var active = self.tab === tab[0];
			bar.appendChild(h('button', {
				type: 'button', role: 'tab', class: 'vb-tab' + (active ? ' is-active' : ''),
				'aria-selected': active ? 'true' : 'false', tabindex: active ? '0' : '-1',
				onclick: function () { self.setTab(tab[0]); },
				onkeydown: function (e) {
					if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
					e.preventDefault();
					self.setTab(list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length][0]);
				}
			}, tab[1], tab[0] === 'wall' && self.project.wall.items.length ? h('span', { class: 'vb-tab-count' }, String(self.project.wall.items.length)) : null));
		});
		return bar;
	};

	App.prototype.renderWall = function () {
		var self = this;
		this.wallEl = h('div', { class: 'vb-wall', role: 'region', 'aria-label': t('tab_wall') });
		this.wallLayer = h('div', { class: 'vb-wall-layer' });
		this.wallSvg = svgEl('svg', { class: 'vb-wall-lines' });
		this.wallItems = h('div', { class: 'vb-wall-items' });
		this.wallLayer.appendChild(this.wallSvg);
		this.wallLayer.appendChild(this.wallItems);
		this.wallEl.appendChild(this.wallLayer);
		this.zoomLabel = h('span', { class: 'vb-zoom-label' });
		function zoomBtn(text, label, factor) {
			return h('button', { type: 'button', class: 'vb-icon-btn vb-zoom-btn', title: label, 'aria-label': label, onclick: function () { self.zoomBy(factor); } }, text);
		}
		this.wallEl.appendChild(h('div', { class: 'vb-wall-tools' },
			zoomBtn('−', t('zoom_out'), 1 / 1.25),
			this.zoomLabel,
			zoomBtn('+', t('zoom_in'), 1.25),
			h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { self.fitWall(); } }, t('zoom_fit'))
		));
		this.wallEmpty = h('p', { class: 'vb-wall-empty' }, t('wall_empty'));
		this.wallEl.appendChild(this.wallEmpty);
		this.main.appendChild(this.wallEl);
		this.bindWall();
		this.applyView();
		this.drawWall();
	};

	App.prototype.applyView = function () {
		var v = this.project.wall.view;
		this.wallLayer.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
		this.wallEl.style.backgroundSize = (18 * v.z) + 'px ' + (18 * v.z) + 'px';
		this.wallEl.style.backgroundPosition = v.x + 'px ' + v.y + 'px';
		this.zoomLabel.textContent = Math.round(v.z * 100) + '%';
		if (this.wireBar) this.wireBar.style.transform = 'translate(-50%, -50%) scale(' + (1 / v.z) + ')';
	};

	App.prototype.zoomAt = function (sx, sy, factor) {
		var v = this.project.wall.view;
		var z = Math.max(0.2, Math.min(2.5, v.z * factor));
		var wx = (sx - v.x) / v.z, wy = (sy - v.y) / v.z;
		v.x = Math.round(sx - wx * z);
		v.y = Math.round(sy - wy * z);
		v.z = Math.round(z * 1000) / 1000;
		this.applyView();
		this.saveView();
	};
	App.prototype.zoomBy = function (factor) {
		this.zoomAt(this.wallEl.clientWidth / 2, this.wallEl.clientHeight / 2, factor);
	};
	App.prototype.fitWall = function () {
		var items = this.project.wall.items, v = this.project.wall.view;
		if (!items.length) { v.x = 40; v.y = 40; v.z = 1; this.applyView(); this.saveView(); return; }
		var self = this, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		items.forEach(function (it) {
			var el = self.wallItems.querySelector('[data-id="' + it.id + '"]');
			minX = Math.min(minX, it.x); minY = Math.min(minY, it.y - 10);
			maxX = Math.max(maxX, it.x + WALL_W); maxY = Math.max(maxY, it.y + (el ? el.offsetHeight : 120));
		});
		var W = this.wallEl.clientWidth, H = this.wallEl.clientHeight, pad = 60;
		var z = Math.max(0.2, Math.min(1.5, (W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY)));
		v.z = Math.round(z * 1000) / 1000;
		v.x = Math.round(W / 2 - (minX + maxX) / 2 * v.z);
		v.y = Math.round(H / 2 - (minY + maxY) / 2 * v.z);
		this.applyView();
		this.saveView();
	};
	App.prototype.toWorld = function (clientX, clientY) {
		var r = this.wallEl.getBoundingClientRect(), v = this.project.wall.view;
		return { x: (clientX - r.left - v.x) / v.z, y: (clientY - r.top - v.y) / v.z };
	};

	// Schuiven met slepen (ook met de middelste muisknop), zoomen met Ctrl + wiel of twee vingers.
	App.prototype.bindWall = function () {
		var self = this, el = this.wallEl, pointers = {}, pan = null, pinch = null;
		function view() { return self.project.wall.view; }
		function isBackground(target) {
			return target === el || target === self.wallLayer || target === self.wallItems || target === self.wallSvg || target === self.wallEmpty;
		}
		function dist(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)) || 1; }
		el.addEventListener('pointerdown', function (e) {
			if (!(e.button === 1 || (e.button === 0 && isBackground(e.target)))) return;
			e.preventDefault();
			pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
			el.setPointerCapture(e.pointerId);
			var ids = Object.keys(pointers);
			if (ids.length === 2) {
				pinch = { d: dist(pointers[ids[0]], pointers[ids[1]]), z: view().z };
				pan = null;
			} else if (ids.length === 1) {
				pan = { x: e.clientX, y: e.clientY, vx: view().x, vy: view().y, moved: false };
			}
		});
		el.addEventListener('pointermove', function (e) {
			if (!pointers[e.pointerId]) return;
			pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
			var ids = Object.keys(pointers);
			if (pinch && ids.length === 2) {
				var a = pointers[ids[0]], b = pointers[ids[1]], r = el.getBoundingClientRect();
				self.zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (dist(a, b) / pinch.d) * pinch.z / view().z);
			} else if (pan) {
				var dx = e.clientX - pan.x, dy = e.clientY - pan.y;
				if (Math.abs(dx) + Math.abs(dy) > 3) { pan.moved = true; el.classList.add('is-panning'); }
				view().x = pan.vx + dx;
				view().y = pan.vy + dy;
				self.applyView();
			}
		});
		function up(e) {
			if (!pointers[e.pointerId]) return;
			delete pointers[e.pointerId];
			if (pinch) { if (Object.keys(pointers).length < 2) { pinch = null; pan = null; } return; }
			if (pan) {
				if (pan.moved) self.saveView();
				else if (e.type === 'pointerup' && self.selectedLineId) self.selectLine(null);
				pan = null;
				el.classList.remove('is-panning');
			}
		}
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
		el.addEventListener('dblclick', function (e) {
			if (!isBackground(e.target)) return;
			var w = self.toWorld(e.clientX, e.clientY);
			self.addWallItem(w.x - WALL_W / 2, w.y - 12);
		});
		el.addEventListener('wheel', function (e) {
			e.preventDefault();
			var r = el.getBoundingClientRect();
			if (e.ctrlKey || e.metaKey) {
				self.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.002)));
			} else {
				var k = e.deltaMode ? 30 : 1;
				view().x -= Math.round(e.deltaX * k);
				view().y -= Math.round(e.deltaY * k);
				self.applyView();
				self.saveView();
			}
		}, { passive: false });
	};

	App.prototype.drawWall = function () {
		var self = this;
		this.wallItems.innerHTML = '';
		this.project.wall.items.forEach(function (it) { self.wallItems.appendChild(self.wallItemEl(it)); });
		this.wallEmpty.hidden = this.project.wall.items.length > 0;
		this.drawLines();
	};

	App.prototype.replaceWallItem = function (it) {
		var old = this.wallItems && this.wallItems.querySelector('[data-id="' + it.id + '"]');
		if (old) old.replaceWith(this.wallItemEl(it));
	};

	App.prototype.wallItemEl = function (it) {
		var self = this;
		var used = this.notesUsing(it.id).length;
		var pin = h('span', { class: 'vb-wall-pin', title: t('pin_hint') });
		var el = h('div', {
			class: 'vb-wall-item' + (it.id === this.selectedWallId ? ' is-selected' : ''),
			style: 'left:' + it.x + 'px;top:' + it.y + 'px;width:' + WALL_W + 'px;background:' + it.color + ';--vb-tilt:' + tilt(it.id) + 'deg',
			tabindex: '0', role: 'button', 'data-id': it.id,
			'aria-label': (it.kind ? kindLabel(it.kind) + ': ' : '') + t('wall_item_label', { title: it.title || t('untitled') })
		},
			pin,
			it.kind ? h('span', { class: 'vb-kind' }, kindIcon(it.kind), h('span', { class: 'vb-kind-label' }, kindLabel(it.kind))) : null,
			h('span', { class: 'vb-wall-title' + (it.title ? '' : ' is-empty') }, it.title || t('untitled')),
			it.text ? h('div', { class: 'vb-wall-text' }, richText(it.text)) : null,
			used ? h('span', { class: 'vb-note-badge vb-wall-used' }, used === 1 ? t('used_one') : t('used_many', { n: used })) : null
		);

		// Verslepen; klikken zonder slepen opent het briefje.
		var start = null, moved = false;
		el.addEventListener('pointerdown', function (e) {
			if (e.button !== 0 || e.target === pin) return;
			e.stopPropagation();
			start = { x: e.clientX, y: e.clientY, ix: it.x, iy: it.y, id: e.pointerId };
			moved = false;
			el.style.zIndex = String(++self.wallZ);
			el.setPointerCapture(e.pointerId);
		});
		el.addEventListener('pointermove', function (e) {
			if (!start || e.pointerId !== start.id) return;
			var z = self.project.wall.view.z;
			var dx = (e.clientX - start.x) / z, dy = (e.clientY - start.y) / z;
			if (!moved && Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) < 5) return;
			moved = true;
			el.classList.add('is-dragging');
			it.x = Math.round(start.ix + dx);
			it.y = Math.round(start.iy + dy);
			el.style.left = it.x + 'px';
			el.style.top = it.y + 'px';
			self.drawLines();
		});
		function end(cancelled) {
			if (!start) return;
			start = null;
			el.classList.remove('is-dragging');
			if (moved) self.persist();
			else if (!cancelled) self.openWallPanel(it.id);
		}
		el.addEventListener('pointerup', function () { end(false); });
		el.addEventListener('pointercancel', function () { end(true); });
		el.addEventListener('keydown', function (e) {
			if (e.target !== el) return;
			if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.openWallPanel(it.id); return; }
			if (e.key === 'Delete') { e.preventDefault(); self.deleteWallItem(it); return; }
			var step = e.shiftKey ? 50 : 10;
			var d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
			if (!d) return;
			e.preventDefault();
			it.x += d[0]; it.y += d[1];
			el.style.left = it.x + 'px'; el.style.top = it.y + 'px';
			self.drawLines();
			clearTimeout(self.moveTimer);
			self.moveTimer = setTimeout(function () { self.persist(); }, 400);
		});

		// Draad spannen: sleep vanaf de punaise naar een ander briefje.
		var linking = false, target = null;
		pin.addEventListener('pointerdown', function (e) {
			if (e.button !== 0) return;
			e.stopPropagation();
			e.preventDefault();
			linking = true;
			pin.setPointerCapture(e.pointerId);
		});
		pin.addEventListener('pointermove', function (e) {
			if (!linking) return;
			self.drawLines({ from: pinPos(it), to: self.toWorld(e.clientX, e.clientY) });
			var under = document.elementFromPoint(e.clientX, e.clientY);
			var item = under && under.closest('.vb-wall-item');
			if (item === el) item = null;
			if (item !== target) {
				if (target) target.classList.remove('is-target');
				target = item;
				if (target) target.classList.add('is-target');
			}
		});
		function stopLink(e, cancelled) {
			if (!linking) return;
			linking = false;
			if (target) target.classList.remove('is-target');
			var other = target && target.getAttribute('data-id');
			target = null;
			if (!cancelled && other) self.addLine(it.id, other);
			else self.drawLines();
		}
		pin.addEventListener('pointerup', function (e) { stopLink(e, false); });
		pin.addEventListener('pointercancel', function (e) { stopLink(e, true); });
		pin.addEventListener('click', function (e) { e.stopPropagation(); });
		return el;
	};

	App.prototype.drawLines = function (temp) {
		var self = this, wall = this.project.wall, svg = this.wallSvg;
		if (!svg) return;
		while (svg.firstChild) svg.removeChild(svg.firstChild);
		if (this.wireBar) { this.wireBar.remove(); this.wireBar = null; }
		var segs = [];
		wall.lines.forEach(function (l) {
			var a = self.wallItem(l.from), b = self.wallItem(l.to);
			if (a && b) segs.push({ line: l, a: a, b: b, from: pinPos(a), to: pinPos(b) });
		});
		if (temp) segs.push({ temp: true, from: temp.from, to: temp.to });
		if (!segs.length) { svg.style.display = 'none'; return; }
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		segs.forEach(function (s) {
			minX = Math.min(minX, s.from.x, s.to.x); maxX = Math.max(maxX, s.from.x, s.to.x);
			minY = Math.min(minY, s.from.y, s.to.y); maxY = Math.max(maxY, s.from.y, s.to.y);
		});
		minX -= 40; minY -= 40; maxX += 40; maxY += 130;
		svg.style.display = '';
		svg.style.left = minX + 'px';
		svg.style.top = minY + 'px';
		svg.setAttribute('width', maxX - minX);
		svg.setAttribute('height', maxY - minY);
		svg.setAttribute('viewBox', minX + ' ' + minY + ' ' + (maxX - minX) + ' ' + (maxY - minY));
		segs.forEach(function (s) {
			var geo = wireGeometry(s.from, s.to);
			if (s.temp) { svg.appendChild(svgEl('path', { d: geo.d, class: 'vb-wire-temp' })); return; }
			var l = s.line, selected = l.id === self.selectedLineId;
			var g = svgEl('g', {
				class: 'vb-wire' + (selected ? ' is-selected' : ''), tabindex: '0', role: 'button', 'data-id': l.id,
				'aria-label': t('wire_label', { a: s.a.title || t('untitled'), b: s.b.title || t('untitled') })
			});
			g.appendChild(svgEl('path', { d: geo.d, class: 'vb-wire-hit' }));
			g.appendChild(svgEl('path', { d: geo.d, class: 'vb-wire-line', stroke: l.color }));
			g.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
			g.addEventListener('click', function () { self.selectLine(l.id); });
			g.addEventListener('keydown', function (e) {
				if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.selectLine(l.id); }
				if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); self.deleteLine(l.id); }
				if (e.key === 'Escape') self.selectLine(null);
			});
			svg.appendChild(g);
			if (selected) self.showWireBar(l, geo.mid);
		});
		// Punaises bovenop de draden.
		segs.forEach(function (s) {
			if (s.temp) return;
			[s.from, s.to].forEach(function (p) { svg.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 2.4, class: 'vb-wire-end' })); });
		});
	};

	// Werkbalkje bij een geselecteerde draad: kleur kiezen of verwijderen.
	App.prototype.showWireBar = function (l, mid) {
		var self = this;
		var bar = h('div', { class: 'vb-wire-bar', style: 'left:' + mid.x + 'px;top:' + mid.y + 'px' },
			LINE_COLORS.map(function (c) {
				var active = c.hex.toLowerCase() === l.color.toLowerCase();
				return h('button', {
					type: 'button', class: 'vb-wire-color' + (active ? ' is-active' : ''), style: 'background:' + c.hex,
					title: t(c.name), 'aria-label': t('wire_color', { name: t(c.name) }), 'aria-pressed': active ? 'true' : 'false',
					onclick: function () { l.color = c.hex; self.persist(); self.drawLines(); self.focusWire(l.id); }
				});
			}),
			h('button', { type: 'button', class: 'vb-icon-btn', title: t('wire_remove'), 'aria-label': t('wire_remove'), onclick: function () { self.deleteLine(l.id); } }, '×')
		);
		bar.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
		bar.addEventListener('dblclick', function (e) { e.stopPropagation(); });
		this.wireBar = bar;
		this.wallLayer.appendChild(bar);
		this.applyView();
	};
	App.prototype.focusWire = function (id) {
		var g = this.wallSvg && this.wallSvg.querySelector('[data-id="' + id + '"]');
		if (g && g.focus) g.focus();
	};
	App.prototype.selectLine = function (id) {
		this.selectedLineId = id;
		this.drawLines();
		if (id) this.focusWire(id);
	};
	App.prototype.addLine = function (from, to) {
		if (!from || !to || from === to) return;
		var exists = this.project.wall.lines.some(function (l) { return (l.from === from && l.to === to) || (l.from === to && l.to === from); });
		if (exists) { toast(t('wire_exists')); this.drawLines(); return; }
		this.project.wall.lines.push({ id: uid(), from: from, to: to, color: LINE_COLORS[0].hex });
		this.persist();
		this.drawLines();
		if (this.panelMode === 'wall' && this.wallLinks) this.drawWallLinks();
	};
	App.prototype.deleteLine = function (id) {
		this.project.wall.lines = this.project.wall.lines.filter(function (l) { return l.id !== id; });
		if (this.selectedLineId === id) this.selectedLineId = null;
		this.persist();
		this.drawLines();
		if (this.panelMode === 'wall' && this.wallLinks) this.drawWallLinks();
	};

	App.prototype.addWallItem = function (x, y) {
		var items = this.project.wall.items;
		if (x === undefined) {
			var c = this.toWorld(this.wallEl.getBoundingClientRect().left + this.wallEl.clientWidth / 2, this.wallEl.getBoundingClientRect().top + this.wallEl.clientHeight / 2);
			x = c.x - WALL_W / 2;
			y = c.y - 60;
			// Niet precies op een ander briefje plakken.
			var busy = function () { return items.some(function (it) { return Math.abs(it.x - x) < 20 && Math.abs(it.y - y) < 20; }); };
			while (busy()) { x += 24; y += 24; }
		}
		var it = { id: uid(), x: Math.round(x), y: Math.round(y), kind: '', title: '', text: '', color: COLORS[0].hex };
		items.push(it);
		this.persist();
		this.drawWall();
		var el = this.wallItems.querySelector('[data-id="' + it.id + '"]');
		if (el) el.classList.add('is-new');
		this.openWallPanel(it.id);
	};

	App.prototype.deleteWallItem = function (it) {
		var self = this;
		var used = this.notesUsing(it.id).length;
		var name = it.title || t('untitled');
		confirmBox(t('delete_note'), used ? t('delete_wall_used', { name: name, n: used }) : t('delete_wall_text', { name: name }), t('delete'), function () {
			var wall = self.project.wall;
			wall.items = wall.items.filter(function (x) { return x.id !== it.id; });
			wall.lines = wall.lines.filter(function (l) { return l.from !== it.id && l.to !== it.id; });
			self.project.notes.forEach(function (n) { n.refs = n.refs.filter(function (id) { return id !== it.id; }); });
			if (self.selectedWallId === it.id) self.closePanel();
			self.persist();
			if (self.wallItems) self.drawWall();
		});
	};

	// Bewerkpaneel voor een briefje op de wand.
	App.prototype.openWallPanel = function (id) {
		var self = this;
		var it = this.wallItem(id);
		if (!it) return;
		if (this.textTimer) { clearTimeout(this.textTimer); this.textTimer = null; this.persist(); }
		this.panelMode = 'wall';
		this.selectedId = null;
		this.selectedWallId = id;
		this.panel.hidden = false;
		this.panel.innerHTML = '';
		this.root.classList.add('has-panel');
		Array.prototype.forEach.call(this.wallItems.querySelectorAll('.vb-wall-item'), function (n) {
			n.classList.toggle('is-selected', n.getAttribute('data-id') === id);
		});

		var titleInput = h('input', { type: 'text', class: 'vb-input', value: it.title, placeholder: t('title_placeholder'), id: 'vb-wtitle-' + id });
		titleInput.addEventListener('input', function () { it.title = titleInput.value; self.changedWall(it); });
		var textArea = h('textarea', { class: 'vb-input vb-textarea', rows: '7', placeholder: t('text_placeholder'), id: 'vb-wtext-' + id, 'aria-describedby': 'vb-whint-' + id });
		textArea.value = it.text;
		textArea.addEventListener('input', function () { it.text = textArea.value; self.drawWallFiles(it); self.changedWall(it); });
		var colors = swatchPicker(function () { return it.color; }, function (hex) { it.color = hex; self.persist(); self.replaceWallItem(it); });
		var kinds = h('div', { class: 'vb-kinds', role: 'radiogroup', 'aria-label': t('kind'), 'aria-describedby': 'vb-khint-' + id });
		function drawKinds() {
			kinds.innerHTML = '';
			[''].concat(Object.keys(KINDS)).forEach(function (k) {
				var active = (it.kind || '') === k;
				kinds.appendChild(h('button', {
					type: 'button', role: 'radio', class: 'vb-kind-btn' + (active ? ' is-active' : ''), 'aria-checked': active ? 'true' : 'false',
					tabindex: active ? '0' : '-1',
					onclick: function () { it.kind = k; self.persist(); self.replaceWallItem(it); drawKinds(); kinds.querySelector('.is-active').focus(); },
					onkeydown: function (e) {
						var btns = Array.prototype.slice.call(kinds.children), i = btns.indexOf(e.currentTarget);
						var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
						if (!d) return;
						e.preventDefault();
						btns[(i + d + btns.length) % btns.length].click();
					}
				}, k ? kindIcon(k) : h('span', { class: 'vb-kind-icon vb-kind-none', 'aria-hidden': 'true' }, '\u2013'), h('span', null, k ? kindLabel(k) : t('kind_none'))));
			});
		}
		drawKinds();

		this.wallFiles = h('ul', { class: 'vb-wall-files' });
		this.wallLinks = h('div', { class: 'vb-wall-links' });
		this.drawWallFiles(it);
		this.drawWallLinks();

		var usedBy = this.notesUsing(id);
		var usedList = usedBy.length ? h('ul', { class: 'vb-sources' }, usedBy.map(function (n) {
			return h('li', { class: 'vb-source' },
				h('button', { type: 'button', class: 'vb-source-link', onclick: function () { self.showOnBoard(n.id); } },
					(n.col === 0 ? t('pos_spine', { row: n.row + 1 }) : t('pos_detail', { col: n.col, row: n.row + 1 })) + ': ' + (n.title || t('untitled')))
			);
		})) : h('p', { class: 'vb-note-hint vb-hint-top' }, t('on_storyboard_none'));

		this.panel.appendChild(h('div', { class: 'vb-panel-head' },
			h('h2', { class: 'vb-panel-title' }, t('wall_note')),
			h('button', { type: 'button', class: 'vb-icon-btn vb-close', 'aria-label': t('close'), onclick: function () { self.closePanel(); } }, '×')
		));
		this.panel.appendChild(h('div', { class: 'vb-panel-body' },
			h('label', { class: 'vb-label', for: 'vb-wtitle-' + id }, t('title')), titleInput,
			h('span', { class: 'vb-label' }, t('kind')),
			h('p', { class: 'vb-note-hint vb-hint-top', id: 'vb-khint-' + id }, t('kind_hint')),
			kinds,
			h('span', { class: 'vb-label' }, t('color')), colors,
			h('label', { class: 'vb-label', for: 'vb-wtext-' + id }, t('description')), textArea,
			h('p', { class: 'vb-note-hint vb-hint-under', id: 'vb-whint-' + id }, t('wall_text_hint')),
			h('span', { class: 'vb-label' }, t('wall_files')), this.wallFiles,
			h('span', { class: 'vb-label' }, t('wires')), this.wallLinks,
			h('span', { class: 'vb-label' }, t('on_storyboard')), usedList
		));
		this.panel.appendChild(h('div', { class: 'vb-panel-foot' },
			h('button', { type: 'button', class: 'vb-btn vb-btn-danger', onclick: function () { self.deleteWallItem(it); } }, t('delete_note'))
		));
		titleInput.focus();
		this.escHandler = this.escHandler || function (e) {
			if (e.key === 'Escape' && !document.querySelector('.vb-overlay, .vb-picker')) self.closePanel();
		};
		document.addEventListener('keydown', this.escHandler);
	};

	App.prototype.changedWall = function (it) {
		var self = this;
		clearTimeout(this.wallTimer);
		this.wallTimer = setTimeout(function () { self.wallTimer = null; self.persist(); self.replaceWallItem(it); }, 300);
	};

	App.prototype.drawWallFiles = function (it) {
		var list = this.wallFiles;
		if (!list) return;
		list.innerHTML = '';
		var files = filesIn(it.text);
		if (!files.length) { list.appendChild(h('li', { class: 'vb-source-empty' }, t('wall_files_none'))); return; }
		files.forEach(function (f) { list.appendChild(h('li', null, fileChip(f))); });
	};

	App.prototype.drawWallLinks = function () {
		var self = this, box = this.wallLinks, id = this.selectedWallId, wall = this.project.wall;
		if (!box || !id) return;
		box.innerHTML = '';
		var mine = wall.lines.filter(function (l) { return l.from === id || l.to === id; });
		var list = h('ul', { class: 'vb-sources' });
		if (!mine.length) list.appendChild(h('li', { class: 'vb-source-empty' }, t('wires_none')));
		var linked = {};
		mine.forEach(function (l) {
			var other = self.wallItem(l.from === id ? l.to : l.from);
			if (!other) return;
			linked[other.id] = true;
			list.appendChild(h('li', { class: 'vb-source' },
				h('span', { class: 'vb-wire-dot', style: 'background:' + l.color, 'aria-hidden': 'true' }),
				h('span', { class: 'vb-wire-other' }, other.title || t('untitled')),
				h('button', { type: 'button', class: 'vb-icon-btn', title: t('wire_remove'), 'aria-label': t('wire_remove') + ': ' + (other.title || t('untitled')), onclick: function () { self.deleteLine(l.id); } }, '×')
			));
		});
		box.appendChild(list);
		var options = wall.items.filter(function (x) { return x.id !== id && !linked[x.id]; });
		if (!options.length) return;
		var selId = 'vb-wireto-' + id;
		var select = h('select', { class: 'vb-select vb-wire-select', id: selId },
			h('option', { value: '' }, t('wire_to')),
			options.map(function (x) { return h('option', { value: x.id }, x.title || t('untitled')); })
		);
		box.appendChild(h('div', { class: 'vb-addsource-actions vb-wire-add' },
			h('label', { class: 'vb-visually-hidden', for: selId }, t('wire_to')),
			select,
			h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { if (select.value) self.addLine(id, select.value); } }, t('wire_add'))
		));
	};

	// Van de wand naar het storyboard: het plakbriefje openen.
	App.prototype.showOnBoard = function (noteId) {
		this.closePanel();
		this.tab = 'board';
		try { localStorage.setItem(TAB_KEY, 'board'); } catch (e) { /* niet erg */ }
		this.render();
		this.openPanel(noteId);
		var el = this.grid && this.grid.querySelector('[data-id="' + noteId + '"]');
		if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	};

	// Van het storyboard naar de wand: het briefje in het midden zetten en laten oplichten.
	App.prototype.showOnWall = function (itemId) {
		var it = this.wallItem(itemId);
		if (!it) return;
		this.closePanel();
		this.tab = 'wall';
		try { localStorage.setItem(TAB_KEY, 'wall'); } catch (e) { /* niet erg */ }
		this.render();
		var v = this.project.wall.view;
		v.x = Math.round(this.wallEl.clientWidth / 2 - (it.x + WALL_W / 2) * v.z);
		v.y = Math.round(this.wallEl.clientHeight / 2 - (it.y + 60) * v.z);
		this.applyView();
		this.saveView();
		var el = this.wallItems.querySelector('[data-id="' + itemId + '"]');
		if (el) { el.classList.add('is-flash'); el.focus({ preventScroll: true }); }
	};

	/* ---------- Onderliggende briefjes: crazywall-briefjes onder een plakbriefje ---------- */

	App.prototype.toggleRef = function (note, id) {
		var it = this.wallItem(id);
		var i = note.refs.indexOf(id);
		if (i >= 0) note.refs.splice(i, 1); else note.refs.push(id);
		this.persist();
		toast(t(i >= 0 ? 'kid_removed' : 'kid_added', { name: note.title || t('untitled') }) + (it && i < 0 ? ': ' + (it.title || t('untitled')) : ''));
		if (this.tab === 'board' && this.grid) this.drawGrid();
		if (this.panelMode === 'note' && this.selectedId === note.id && this.kidList) this.drawKids(note);
	};

	// Keuzemenu met de briefjes van de crazywall (rechtermuisknop op een plakbriefje).
	App.prototype.openWallPicker = function (note, x, y, returnFocus) {
		var self = this;
		if (this.picker) this.picker.close(false);
		var items = this.project.wall.items;
		var box = h('div', { class: 'vb-picker vb-scope', role: 'dialog', 'aria-label': t('picker_title'), lang: LANG });
		var list = h('div', { class: 'vb-picker-list', role: 'menu', 'aria-label': t('picker_title') });
		var search = items.length > 5 ? h('input', { type: 'search', class: 'vb-input vb-picker-search', placeholder: t('picker_search'), 'aria-label': t('picker_search') }) : null;

		function fill() {
			list.innerHTML = '';
			var q = search ? search.value.trim().toLowerCase() : '';
			var shown = items.filter(function (it) { return !q || (it.title + ' ' + it.text + ' ' + kindLabel(it.kind)).toLowerCase().indexOf(q) >= 0; });
			if (!shown.length) list.appendChild(h('p', { class: 'vb-picker-none' }, t('picker_none')));
			shown.forEach(function (it) {
				var on = note.refs.indexOf(it.id) >= 0;
				list.appendChild(h('button', {
					type: 'button', class: 'vb-picker-item' + (on ? ' is-on' : ''), role: 'menuitemcheckbox', 'aria-checked': on ? 'true' : 'false',
					onclick: function () { close(true); self.toggleRef(note, it.id); }
				},
					h('span', { class: 'vb-picker-dot', style: 'background:' + it.color, 'aria-hidden': 'true' }, it.kind ? kindIcon(it.kind) : null),
					h('span', { class: 'vb-picker-name' }, it.title || t('untitled'), it.kind ? h('span', { class: 'vb-picker-kind' }, kindLabel(it.kind)) : null),
					h('span', { class: 'vb-picker-files' }, filesIn(it.text).slice(0, 3).map(fileIcon)),
					h('span', { class: 'vb-picker-check', 'aria-hidden': 'true' }, on ? '✓' : '')
				));
			});
		}

		box.appendChild(h('div', { class: 'vb-picker-head' }, t('picker_title')));
		box.appendChild(h('div', { class: 'vb-picker-sub' }, t('picker_under', { name: note.title || t('untitled') })));
		if (!items.length) {
			box.appendChild(h('p', { class: 'vb-picker-none' }, t('picker_empty')));
			box.appendChild(h('div', { class: 'vb-picker-foot' },
				h('button', { type: 'button', class: 'vb-btn vb-btn-small vb-btn-primary', onclick: function () { close(false); self.setTab('wall'); } }, t('go_to_wall'))));
		} else {
			if (search) { box.appendChild(search); search.addEventListener('input', fill); }
			box.appendChild(list);
			fill();
		}

		function entries() { return Array.prototype.slice.call(box.querySelectorAll('.vb-picker-search, .vb-picker-item, .vb-picker-foot .vb-btn')); }
		function onKey(e) {
			if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
			if (e.key === 'Tab') { e.preventDefault(); }
			var all = entries(), i = all.indexOf(document.activeElement);
			if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); all[(i + 1) % all.length].focus(); }
			else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); all[(i - 1 + all.length) % all.length].focus(); }
		}
		function onDoc(e) { if (!box.contains(e.target)) close(false); }
		function close(focusBack) {
			if (!box.parentNode) return;
			box.remove();
			document.removeEventListener('mousedown', onDoc, true);
			document.removeEventListener('touchstart', onDoc, true);
			window.removeEventListener('resize', onResize);
			self.picker = null;
			if (focusBack && returnFocus && document.body.contains(returnFocus)) returnFocus.focus();
		}
		function onResize() { close(false); }
		box.addEventListener('keydown', onKey);
		box.addEventListener('contextmenu', function (e) { e.preventDefault(); });
		document.body.appendChild(box);
		var w = box.offsetWidth, hgt = box.offsetHeight;
		box.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
		box.style.top = Math.max(8, Math.min(y, window.innerHeight - hgt - 8)) + 'px';
		setTimeout(function () {
			document.addEventListener('mousedown', onDoc, true);
			document.addEventListener('touchstart', onDoc, true);
			window.addEventListener('resize', onResize);
		}, 0);
		var first = entries()[0];
		if (first) first.focus();
		this.picker = { close: close };
	};

	App.prototype.drawKids = function (note) {
		var self = this, list = this.kidList;
		list.innerHTML = '';
		var kids = kidsOf(this.project, note);
		if (!kids.length) { list.appendChild(h('li', { class: 'vb-source-empty' }, t('kids_none'))); return; }
		kids.forEach(function (k) {
			list.appendChild(h('li', { class: 'vb-source vb-kid-row' },
				h('span', { class: 'vb-picker-dot', style: 'background:' + k.color, 'aria-hidden': 'true' }, k.kind ? kindIcon(k.kind) : null),
				h('span', { class: 'vb-kid-title' }, k.title || t('untitled'), k.kind ? h('span', { class: 'vb-visually-hidden' }, ' (' + kindLabel(k.kind) + ')') : null, filesIn(k.text).slice(0, 3).map(fileIcon)),
				h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { self.showOnWall(k.id); } }, t('show_on_wall')),
				h('button', { type: 'button', class: 'vb-icon-btn', title: t('kid_remove'), 'aria-label': t('kid_remove') + ': ' + (k.title || t('untitled')), onclick: function () { self.toggleRef(note, k.id); } }, '×')
			));
		});
	};

	/* ---------- Taalkeuze ---------- */

	App.prototype.languageSelect = function () {
		if (I18N.languages.length < 2) return null;
		var id = 'vb-lang-' + uid();
		var select = h('select', { class: 'vb-select', id: id, title: t('language') },
			I18N.languages.map(function (l) {
				return h('option', { value: l.code, selected: l.code === LANG }, l.name);
			})
		);
		var self = this;
		select.addEventListener('change', function () { setLanguage(select.value, self); });
		return h('span', { class: 'vb-lang' },
			h('label', { class: 'vb-visually-hidden', for: id }, t('language')),
			select
		);
	};

	// Alles opnieuw opbouwen in de nieuwe taal. Een open bewerkpaneel blijft open.
	App.prototype.relabel = function (refocus) {
		this.root.setAttribute('lang', LANG);
		this.panel.setAttribute('aria-label', t('edit_note_label'));
		var open = this.selectedId && !this.panel.hidden ? this.selectedId : null;
		var openWall = this.selectedWallId && !this.panel.hidden ? this.selectedWallId : null;
		if (this.picker) this.picker.close(false);
		this.render();
		if (open) this.openPanel(open);
		else if (openWall && this.wallItems) this.openWallPanel(openWall);
		open = open || openWall;
		var select = this.top.querySelector('.vb-select');
		if (select && refocus && !open) select.focus();
	};

	/* ---------- Menu Meer: afdrukken en PDF ---------- */

	App.prototype.moreMenu = function () {
		var self = this;
		var id = 'vb-more-' + uid();
		var button = h('button', { type: 'button', class: 'vb-btn vb-more-btn', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': id }, t('more'), h('span', { class: 'vb-caret', 'aria-hidden': 'true' }, '▾'));
		var items = [
			{ label: t('print'), run: function () { self.printProject(); } },
			{ label: t('export_pdf'), run: function () { self.exportPdf(); } }
		];
		var menu = h('div', { class: 'vb-menu', id: id, role: 'menu', hidden: true },
			items.map(function (it) {
				return h('button', { type: 'button', class: 'vb-menu-item', role: 'menuitem', tabindex: '-1', onclick: function () { close(true); it.run(); } }, it.label);
			})
		);
		var wrap = h('div', { class: 'vb-more' }, button, menu);

		function buttons() { return Array.prototype.slice.call(menu.querySelectorAll('.vb-menu-item')); }
		function onDoc(e) { if (!wrap.contains(e.target)) close(false); }
		function onKey(e) {
			var list = buttons(), i = list.indexOf(document.activeElement);
			if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
			else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
			else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
			else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
			else if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
			else if (e.key === 'Tab') close(false);
		}
		function open() {
			menu.hidden = false;
			button.setAttribute('aria-expanded', 'true');
			document.addEventListener('mousedown', onDoc);
			document.addEventListener('touchstart', onDoc);
			menu.addEventListener('keydown', onKey);
			buttons()[0].focus();
		}
		function close(focusButton) {
			if (menu.hidden) return;
			menu.hidden = true;
			button.setAttribute('aria-expanded', 'false');
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('touchstart', onDoc);
			menu.removeEventListener('keydown', onKey);
			if (focusButton) button.focus();
		}
		button.addEventListener('click', function () { if (menu.hidden) open(); else close(true); });
		button.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' && menu.hidden) { e.preventDefault(); open(); } });
		return wrap;
	};

	// Rijen en kolommen die echt gebruikt worden, voor afdrukken en PDF.
	function boardSize(project) {
		var maxRow = -1, maxCol = 0;
		project.notes.forEach(function (n) { if (n.row > maxRow) maxRow = n.row; if (n.col > maxCol) maxCol = n.col; });
		return { rows: maxRow + 1, cols: Math.max(2, maxCol + 1) };
	}

	function sourceLabel(s) {
		return s.type === 'link' ? (s.label ? s.label + ' (' + s.url + ')' : s.url) : (s.label || t('document'));
	}

	/* ---------- Afdrukken op A4 liggend ---------- */

	App.prototype.printProject = function () {
		var p = this.project;
		if (this.textTimer) { clearTimeout(this.textTimer); this.textTimer = null; this.persist(); }
		cleanupPrint();
		var size = boardSize(p);
		var grid = h('div', {
			class: 'vb-print-grid vb-print-cols-' + Math.min(size.cols, 8),
			style: 'grid-template-columns: 7mm 1.25fr repeat(' + (size.cols - 1) + ', 1fr);'
		});
		grid.appendChild(h('div', { class: 'vb-print-head' }));
		grid.appendChild(h('div', { class: 'vb-print-head' }, t('spine')));
		for (var c = 1; c < size.cols; c++) grid.appendChild(h('div', { class: 'vb-print-head' }, c === 1 ? t('details') : ''));
		for (var r = 0; r < size.rows; r++) {
			grid.appendChild(h('div', { class: 'vb-print-rownum' }, String(r + 1)));
			for (var col = 0; col < size.cols; col++) {
				var n = this.noteAt(r, col);
				grid.appendChild(n ? h('div', { class: 'vb-print-note' + (col === 0 ? ' is-spine' : ''), style: 'background:' + n.color },
					h('div', { class: 'vb-print-note-title' }, n.title || t('untitled')),
					n.text ? h('div', { class: 'vb-print-note-text' }, n.text) : null,
					kidsOf(p, n).length ? h('ul', { class: 'vb-print-kids' }, kidsOf(p, n).map(function (k) {
						return h('li', { style: 'border-left-color:' + k.color }, '\u21b3 ' + (k.kind ? kindLabel(k.kind) + ': ' : '') + (k.title || t('untitled')));
					})) : null,
					n.sources.length ? h('ul', { class: 'vb-print-sources' }, n.sources.map(function (s) { return h('li', null, sourceLabel(s)); })) : null
				) : h('div', { class: 'vb-print-empty' + (col === 0 ? ' is-spine' : '') }));
			}
		}
		var sheet = h('div', { class: 'vb-print-root vb-scope', lang: LANG },
			h('h1', { class: 'vb-print-title' }, p.name),
			h('p', { class: 'vb-print-meta' }, t('made_with', { date: formatDate(Date.now()) })),
			grid
		);
		// A4 liggend geldt alleen zolang we dit bord afdrukken.
		var page = h('style', { class: 'vb-print-page' }, '@page { size: A4 landscape; margin: 10mm; }');
		document.head.appendChild(page);
		document.body.appendChild(sheet);
		document.documentElement.classList.add('vb-printing');
		var prevTitle = document.title;
		document.title = p.name;
		var done = false;
		function finish() {
			if (done) return;
			done = true;
			document.title = prevTitle;
			window.removeEventListener('afterprint', finish);
			cleanupPrint();
		}
		window.addEventListener('afterprint', finish);
		window.print();
	};

	function cleanupPrint() {
		document.documentElement.classList.remove('vb-printing');
		Array.prototype.forEach.call(document.querySelectorAll('.vb-print-root, style.vb-print-page'), function (el) { el.remove(); });
	}

	/* ---------- Exporteren als PDF (A4 liggend), helemaal in de browser ---------- */

	App.prototype.exportPdf = function () {
		if (this.textTimer) { clearTimeout(this.textTimer); this.textTimer = null; this.persist(); }
		try {
			var bytes = Pdf.board(this.project);
			download(slugify(this.project.name) + '.pdf', new Blob([bytes], { type: 'application/pdf' }));
		} catch (e) {
			toast(t('pdf_failed'), true);
		}
	};

	var Pdf = (function () {
		// Breedtes van de standaardletters Helvetica en Helvetica-Bold (tekens 32 t/m 126), in duizendsten.
		var W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
		var W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
		// Tekens uit Windows-1252 die niet op dezelfde plek staan als in Unicode.
		var CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
		var SPECIAL_W = { 0x80: 556, 0x82: 222, 0x84: 333, 0x85: 1000, 0x86: 556, 0x87: 556, 0x89: 1000, 0x8B: 333, 0x8C: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x99: 1000, 0x9B: 333, 0x9C: 944, 0xA0: 278, 0xAB: 556, 0xBB: 556, 0xB0: 400, 0xB7: 278, 0xC6: 1000, 0xD7: 584, 0xDF: 611, 0xE6: 889, 0xF7: 584, 0xD8: 778, 0xF8: 611 };

		function byteOf(ch) {
			var c = ch.codePointAt(0);
			if (c >= 32 && c < 127) return c;
			if (c >= 0xA0 && c <= 0xFF) return c;
			if (CP1252[c]) return CP1252[c];
			return -1;
		}
		function toBytes(str) {
			var out = [];
			Array.from(String(str).replace(/[\t\r]/g, ' ')).forEach(function (ch) {
				var b = byteOf(ch);
				if (b < 0) {
					var base = ch.normalize('NFD').charAt(0);
					b = base !== ch ? byteOf(base) : -1;
				}
				out.push(b < 0 ? 63 : b);
			});
			return out;
		}
		function widthOf(b, bold) {
			if (b >= 32 && b < 127) return (bold ? W_BOLD : W_REG)[b - 32];
			if (SPECIAL_W[b]) return SPECIAL_W[b];
			var base = String.fromCharCode(b).normalize('NFD').charCodeAt(0);
			if (base >= 32 && base < 127) return (bold ? W_BOLD : W_REG)[base - 32];
			return 556;
		}
		function measure(bytes, size, bold) {
			var w = 0;
			for (var i = 0; i < bytes.length; i++) w += widthOf(bytes[i], bold);
			return w * size / 1000;
		}
		// Breekt tekst af op woorden zodat elke regel binnen maxW past. Geeft regels als bytes.
		function wrap(text, size, bold, maxW) {
			var lines = [];
			String(text || '').split('\n').forEach(function (para) {
				var words = para.split(/ +/), line = [];
				words.forEach(function (word) {
					var wb = toBytes(word);
					var tryLine = line.length ? line.concat([32], wb) : wb;
					if (measure(tryLine, size, bold) <= maxW) { line = tryLine; return; }
					if (line.length) lines.push(line);
					// Een woord dat langer is dan de regel: in stukken hakken.
					line = [];
					wb.forEach(function (b) {
						if (line.length && measure(line.concat([b]), size, bold) > maxW) { lines.push(line); line = []; }
						line.push(b);
					});
				});
				lines.push(line);
			});
			return lines;
		}
		function hex(bytes) {
			var s = '';
			for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
			return '<' + s + '>';
		}
		function utf16hex(str) {
			var s = 'FEFF';
			for (var i = 0; i < str.length; i++) s += ('000' + str.charCodeAt(i).toString(16)).slice(-4);
			return '<' + s + '>';
		}
		function num(n) { return (Math.round(n * 100) / 100).toString(); }
		function rgb(hexColor) {
			var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hexColor || '') || [0, 'ff', 'ff', 'ff'];
			return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255].map(function (v) { return num(v); }).join(' ');
		}

		// Tekenopdrachten voor één pagina. y loopt van boven naar beneden; PDF rekent van onder.
		function Page(height) { this.ops = []; this.H = height; }
		Page.prototype.fill = function (color) { this.ops.push(color + ' rg'); return this; };
		Page.prototype.stroke = function (color, width) { this.ops.push(color + ' RG ' + num(width) + ' w'); return this; };
		Page.prototype.rect = function (x, y, w, hgt, r, mode) {
			var b = this.H - y - hgt, k = 0.5523 * r;
			if (!r) { this.ops.push([num(x), num(b), num(w), num(hgt), 're', mode].join(' ')); return this; }
			this.ops.push([
				num(x + r) + ' ' + num(b) + ' m',
				num(x + w - r) + ' ' + num(b) + ' l',
				num(x + w - r + k) + ' ' + num(b) + ' ' + num(x + w) + ' ' + num(b + r - k) + ' ' + num(x + w) + ' ' + num(b + r) + ' c',
				num(x + w) + ' ' + num(b + hgt - r) + ' l',
				num(x + w) + ' ' + num(b + hgt - r + k) + ' ' + num(x + w - r + k) + ' ' + num(b + hgt) + ' ' + num(x + w - r) + ' ' + num(b + hgt) + ' c',
				num(x + r) + ' ' + num(b + hgt) + ' l',
				num(x + r - k) + ' ' + num(b + hgt) + ' ' + num(x) + ' ' + num(b + hgt - r + k) + ' ' + num(x) + ' ' + num(b + hgt - r) + ' c',
				num(x) + ' ' + num(b + r) + ' l',
				num(x) + ' ' + num(b + r - k) + ' ' + num(x + r - k) + ' ' + num(b) + ' ' + num(x + r) + ' ' + num(b) + ' c',
				'h ' + mode
			].join('\n'));
			return this;
		};
		// x en y: linksboven van de regel; de basislijn ligt op ongeveer 80% van de lettergrootte.
		Page.prototype.text = function (bytes, x, y, size, font, color) {
			this.ops.push('BT ' + color + ' rg /' + font + ' ' + num(size) + ' Tf ' + num(x) + ' ' + num(this.H - y - size * 0.8) + ' Td ' + hex(bytes) + ' Tj ET');
			return this;
		};

		function build(pages, title, W, H) {
			var objs = [
				'<< /Type /Catalog /Pages 2 0 R >>',
				'',
				'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
				'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
				'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
				null
			];
			var d = new Date();
			function two(n) { return (n < 10 ? '0' : '') + n; }
			var stamp = 'D:' + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
			objs[5] = '<< /Title ' + utf16hex(title) + ' /Producer (Nutgraph) /Creator (Nutgraph) /CreationDate (' + stamp + ') >>';
			var kids = [];
			pages.forEach(function (pg) {
				var content = pg.ops.join('\n');
				objs.push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
				var contentRef = objs.length;
				objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ' + contentRef + ' 0 R >>');
				kids.push(objs.length + ' 0 R');
			});
			objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
			// Alles hierboven is gewone ASCII-tekst: één teken is één byte.
			var out = '%PDF-1.4\n', offsets = [];
			objs.forEach(function (o, i) {
				offsets.push(out.length);
				out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n';
			});
			var xref = out.length;
			out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
			offsets.forEach(function (off) { out += ('000000000' + off).slice(-10) + ' 00000 n \n'; });
			out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
			var bytes = new Uint8Array(out.length);
			for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
			return bytes;
		}

		function board(project) {
			var W = 842, H = 595, M = 28; // A4 liggend in punten, marge 10 mm
			var INK = '0.114 0.153 0.2', MUTED = '0.337 0.388 0.435', LINE = '0.79 0.83 0.86';
			var size = boardSize(project);
			var cols = size.cols;
			var scale = cols <= 3 ? 1 : cols <= 5 ? 0.9 : cols <= 7 ? 0.8 : 0.7;
			var gap = 6, rowHeadW = 16;
			var unit = (W - 2 * M - rowHeadW - gap * (cols - 1)) / (cols + 0.25);
			var colX = [], colW = [];
			for (var c = 0, x = M + rowHeadW; c < cols; c++) {
				colX.push(x);
				colW.push(c === 0 ? unit * 1.25 : unit);
				x += colW[c] + gap;
			}
			var fsTitle = 9.5 * scale, fsText = 8 * scale, fsSrc = 6.5 * scale, pad = 6 * scale;
			var leadTitle = fsTitle * 1.22, leadText = fsText * 1.3, leadSrc = fsSrc * 1.3;
			var bottom = H - M - 14;

			var pages = [], page, y, contentTop;
			function newPage() {
				page = new Page(H);
				pages.push(page);
				y = M;
				var first = pages.length === 1;
				if (first) {
					wrap(project.name, 18, true, W - 2 * M).slice(0, 2).forEach(function (line) {
						page.text(line, M, y, 18, 'F2', INK);
						y += 18 * 1.2;
					});
					page.text(toBytes(t('made_with', { date: formatDate(Date.now()) })), M, y + 2, 8, 'F1', MUTED);
					y += 20;
				} else {
					page.text(toBytes(project.name), M, y, 9, 'F2', MUTED);
					y += 16;
				}
				// Kolomkoppen.
				page.text(toBytes(t('spine').toUpperCase()), colX[0], y, 7.5, 'F2', INK);
				if (cols > 1) page.text(toBytes(t('details').toUpperCase()), colX[1], y, 7.5, 'F2', MUTED);
				y += 12;
				page.stroke(LINE, 0.6).ops.push(num(M) + ' ' + num(H - y) + ' m ' + num(W - M) + ' ' + num(H - y) + ' l S');
				y += 6;
				contentTop = y;
				page.top = y;
				page.bandAt = page.ops.length; // hier komt straks de band achter de ruggengraat
			}

			function layoutNote(n, w) {
				var inner = w - 2 * pad;
				var titleLines = wrap(n.title || t('untitled'), fsTitle, true, inner);
				var textLines = n.text ? wrap(n.text, fsText, false, inner) : [];
				var kidLinesPdf = [];
				kidsOf(project, n).forEach(function (k) {
					wrap('\u00bb ' + (k.kind ? kindLabel(k.kind) + ': ' : '') + (k.title || t('untitled')), fsSrc + 0.5, true, inner).forEach(function (l) { kidLinesPdf.push(l); });
				});
				var srcLines = [];
				n.sources.forEach(function (s) {
					wrap('• ' + sourceLabel(s), fsSrc, false, inner).forEach(function (l) { srcLines.push(l); });
				});
				var hgt = pad + titleLines.length * leadTitle + (textLines.length ? 3 + textLines.length * leadText : 0) + (kidLinesPdf.length ? 4 + kidLinesPdf.length * leadSrc : 0) + (srcLines.length ? 4 + srcLines.length * leadSrc : 0) + pad;
				return { title: titleLines, text: textLines, kids: kidLinesPdf, src: srcLines, h: hgt };
			}
			function fitNote(l, maxH) {
				// Te lang voor één pagina: regels weglaten en eindigen met een beletselteken.
				var ell = [0x85];
				while (l.h > maxH && (l.src.length || l.kids.length || l.text.length || l.title.length > 1)) {
					var list = l.src.length ? l.src : l.text.length ? l.text : l.kids.length ? l.kids : l.title;
					var lead = list === l.src || list === l.kids ? leadSrc : list === l.text ? leadText : leadTitle;
					list.pop();
					l.h -= lead;
					if (list.length) list[list.length - 1] = list[list.length - 1].concat(ell);
					else if (list === l.src || list === l.kids) l.h -= 4;
					else if (list === l.text) l.h -= 3;
				}
				return l;
			}
			function drawNote(n, l, x, top, w) {
				page.fill('0.82 0.85 0.88').rect(x + 1, top + 1.5, w, l.h, 3, 'f');
				page.fill(rgb(n.color)).stroke('0.7 0.74 0.78', 0.4).rect(x, top, w, l.h, 3, 'B');
				var ty = top + pad;
				l.title.forEach(function (line) { page.text(line, x + pad, ty, fsTitle, 'F2', INK); ty += leadTitle; });
				if (l.text.length) {
					ty += 3;
					l.text.forEach(function (line) { page.text(line, x + pad, ty, fsText, 'F1', INK); ty += leadText; });
				}
				if (l.kids.length) {
					ty += 4;
					l.kids.forEach(function (line) { page.text(line, x + pad, ty, fsSrc + 0.5, 'F2', INK); ty += leadSrc; });
				}
				if (l.src.length) {
					ty += 4;
					l.src.forEach(function (line) { page.text(line, x + pad, ty, fsSrc, 'F3', MUTED); ty += leadSrc; });
				}
			}

			newPage();
			for (var r = 0; r < size.rows; r++) {
				var cells = [], rowH = 12;
				for (var cc = 0; cc < cols; cc++) {
					var n = null;
					for (var i = 0; i < project.notes.length; i++) if (project.notes[i].row === r && project.notes[i].col === cc) { n = project.notes[i]; break; }
					if (!n) continue;
					var l = fitNote(layoutNote(n, colW[cc]), bottom - (M + 60));
					cells.push({ n: n, l: l, c: cc });
					rowH = Math.max(rowH, l.h);
				}
				if (y + rowH > bottom && y > contentTop) newPage();
				page.text(toBytes(String(r + 1)), M, y + 2, 7, 'F2', MUTED);
				cells.forEach(function (cell) { drawNote(cell.n, cell.l, colX[cell.c], y, colW[cell.c]); });
				y += rowH + gap;
				page.end = y - gap;
			}

			pages.forEach(function (pg, idx) {
				// Lichte band achter de ruggengraat, zo hoog als de briefjes op deze pagina.
				var band = new Page(H).fill('0.953 0.965 0.976').rect(colX[0] - 3, pg.top - 3, colW[0] + 6, Math.max(12, (pg.end || pg.top) - pg.top) + 6, 4, 'f');
				Array.prototype.splice.apply(pg.ops, [pg.bandAt, 0].concat(band.ops));
				var label = toBytes(t('page_n', { n: idx + 1, total: pages.length }));
				pg.text(label, W - M - measure(label, 7, false), H - M - 4, 7, 'F1', MUTED);
			});
			return build(pages, project.name, W, H);
		}

		return { board: board };
	})();

	/* ---------- Deellink maken ---------- */

	App.prototype.share = function () {
		var p = this.project;
		var hasFiles = projectFileIds(p).length > 0;
		encodeShare(p).then(function (code) {
			var link = shareBaseUrl() + '#vb=' + code;
			var field = h('textarea', { class: 'vb-input vb-share-field', readonly: true, rows: '4', 'aria-label': t('share_link') });
			field.value = link;
			var notes = [
				h('p', null, t('share_text', { name: p.name })),
				field
			];
			if (hasFiles) notes.push(h('p', { class: 'vb-note-hint' }, t('share_no_docs')));
			if (link.length > 8000) notes.push(h('p', { class: 'vb-note-hint' }, t('share_long', { n: link.length })));
			modal(t('share_title'), notes, [
				{ label: t('close') },
				{ label: t('copy_link'), primary: true, onClick: function () {
					var done = function () { toast(t('link_copied')); };
					if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { field.select(); document.execCommand('copy'); done(); });
					else { field.select(); document.execCommand('copy'); done(); }
				} }
			]);
			field.focus();
			field.select();
		});
	};

	/* ------------------------------------------------------------------ *
	 * Start
	 * ------------------------------------------------------------------ */

	function boot() {
		var roots = document.querySelectorAll('.vb-root[data-nutgraph]');
		Array.prototype.forEach.call(roots, function (root) {
			if (root._nutgraph) return;
			root._nutgraph = new App(root);
			apps.push(root._nutgraph);
		});
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})();
