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
				if (lib && Array.isArray(lib.projects)) return lib;
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
		return { id: uid(), name: name || t('new_story'), created: now, updated: now, notes: [] };
	}

	function newNote(row, col) {
		return { id: uid(), row: row, col: col, title: '', text: '', color: col === 0 ? SPINE_COLOR : DETAIL_COLOR, sources: [] };
	}

	// Maakt geïmporteerde of gedeelde gegevens veilig en volledig.
	function normalizeProject(p) {
		var out = {
			id: typeof p.id === 'string' ? p.id : uid(),
			name: String(p.name || t('imported_story')).slice(0, 200),
			created: Number(p.created) || Date.now(),
			updated: Number(p.updated) || Date.now(),
			notes: []
		};
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
	function packForShare(project) {
		return {
			n: project.name,
			t: project.notes.map(function (n) {
				return [n.row, n.col, n.color, n.title, n.text, n.sources.map(function (s) {
					return s.type === 'link' ? [s.label, s.url] : [s.label || t('document'), ''];
				})];
			})
		};
	}
	function unpackShare(d) {
		return normalizeProject({
			name: d.n,
			notes: (d.t || []).map(function (a) {
				return {
					row: a[0], col: a[1], color: a[2], title: a[3], text: a[4],
					sources: (a[5] || []).map(function (s) {
						return s[1] ? { type: 'link', label: s[0], url: s[1] } : { type: 'missing', label: s[0] };
					})
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
				if (spine.sources.length) lines.push('');
				sourceLines(spine).forEach(function (l) { lines.push(l); });
			}
			notes.forEach(function (n) {
				lines.push('', '- **' + (n.title || t('detail')) + '**' + (n.text ? ': ' + n.text.replace(/\n+/g, ' ') : ''));
				sourceLines(n).forEach(function (l) { lines.push('  ' + l); });
			});
			lines.push('');
		});
		return lines.join('\n');
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
		this.textTimer = null;

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
				h('button', { type: 'button', class: 'vb-btn vb-btn-primary vb-btn-add', onclick: function () { self.addNote(); } }, t('add_note_btn')),
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
		this.top.appendChild(h('div', { class: 'vb-substatus' }, this.status,
			h('span', { class: 'vb-help' }, t('help'))));

		this.boardWrap = h('div', { class: 'vb-board-wrap' });
		this.main.appendChild(this.boardWrap);
		this.drawGrid();
	};

	App.prototype.drawGrid = function () {
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
		var el = h('div', {
			class: 'vb-note' + (note.id === this.selectedId ? ' is-selected' : '') + (note.col === 0 ? ' is-spine' : ''),
			style: 'background:' + note.color + ';--vb-tilt:' + tilt(note.id) + 'deg',
			tabindex: '0',
			role: 'button',
			'aria-label': t(note.col === 0 ? 'note_label_spine' : 'note_label_detail', { title: note.title || t('untitled'), row: note.row + 1 }),
			'data-id': note.id
		},
			h('span', { class: 'vb-note-title' + (note.title ? '' : ' is-empty') }, note.title || t('untitled')),
			note.text ? h('span', { class: 'vb-note-text' }, note.text) : null,
			srcCount ? h('span', { class: 'vb-note-badge' }, plural(srcCount, 'sources_one', 'sources_many')) : null
		);
		this.makeDraggable(el, note);
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
		this.selectedId = id;
		this.panel.hidden = false;
		this.panel.innerHTML = '';
		this.root.classList.add('has-panel');
		this.markSelected();

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
			if (e.key === 'Escape' && !document.querySelector('.vb-overlay')) self.closePanel();
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
		var id = this.selectedId;
		this.selectedId = null;
		this.panel.hidden = true;
		this.panel.innerHTML = '';
		this.positionLabel = null;
		this.root.classList.remove('has-panel');
		if (this.escHandler) document.removeEventListener('keydown', this.escHandler);
		if (this.view === 'board' && this.grid) {
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
		this.render();
		if (open) this.openPanel(open);
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
				var srcLines = [];
				n.sources.forEach(function (s) {
					wrap('• ' + sourceLabel(s), fsSrc, false, inner).forEach(function (l) { srcLines.push(l); });
				});
				var hgt = pad + titleLines.length * leadTitle + (textLines.length ? 3 + textLines.length * leadText : 0) + (srcLines.length ? 4 + srcLines.length * leadSrc : 0) + pad;
				return { title: titleLines, text: textLines, src: srcLines, h: hgt };
			}
			function fitNote(l, maxH) {
				// Te lang voor één pagina: regels weglaten en eindigen met een beletselteken.
				var ell = [0x85];
				while (l.h > maxH && (l.src.length || l.text.length || l.title.length > 1)) {
					var list = l.src.length ? l.src : l.text.length ? l.text : l.title;
					var lead = list === l.src ? leadSrc : list === l.text ? leadText : leadTitle;
					list.pop();
					l.h -= lead;
					if (list.length) list[list.length - 1] = list[list.length - 1].concat(ell);
					else if (list === l.src) l.h -= 4;
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
