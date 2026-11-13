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
		{ hex: '#FFE873', name: 'Geel' },
		{ hex: '#FFB8CB', name: 'Roze' },
		{ hex: '#B9EBC1', name: 'Groen' },
		{ hex: '#AED9F5', name: 'Blauw' },
		{ hex: '#FFC98F', name: 'Oranje' },
		{ hex: '#D7C6F6', name: 'Lila' },
		{ hex: '#FFFFFF', name: 'Wit' }
	];
	var SPINE_COLOR = '#FFE873';
	var DETAIL_COLOR = '#AED9F5';

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
			return new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
				toast('Opslaan lukt niet: de opslag van deze browser is vol. Exporteer en verwijder oude verhalen.', true);
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
		return { id: uid(), name: name || 'Nieuw verhaal', created: now, updated: now, notes: [] };
	}

	function newNote(row, col) {
		return { id: uid(), row: row, col: col, title: '', text: '', color: col === 0 ? SPINE_COLOR : DETAIL_COLOR, sources: [] };
	}

	// Maakt geïmporteerde of gedeelde gegevens veilig en volledig.
	function normalizeProject(p) {
		var out = {
			id: typeof p.id === 'string' ? p.id : uid(),
			name: String(p.name || 'Geïmporteerd verhaal').slice(0, 200),
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
		else throw new Error('Dit is geen Nutgraph-bestand.');
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
					return s.type === 'link' ? [s.label, s.url] : [s.label || 'Document', ''];
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
			lines.push('## ' + (spine ? (spine.title || 'Zonder titel') : 'Rij ' + (r + 1)));
			if (spine) {
				if (spine.text) lines.push('', spine.text);
				if (spine.sources.length) lines.push('');
				sourceLines(spine).forEach(function (l) { lines.push(l); });
			}
			notes.forEach(function (n) {
				lines.push('', '- **' + (n.title || 'Detail') + '**' + (n.text ? ': ' + n.text.replace(/\n+/g, ' ') : ''));
				sourceLines(n).forEach(function (l) { lines.push('  ' + l); });
			});
			lines.push('');
		});
		return lines.join('\n');
	}
	function sourceLines(n) {
		return n.sources.map(function (s) {
			if (s.type === 'link') return '- Bron: [' + (s.label || s.url) + '](' + s.url + ')';
			return '- Bron (document): ' + (s.label || 'naamloos');
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
			h('div', { class: 'vb-modal-actions' }, (actions || [{ label: 'Sluiten' }]).map(function (a) {
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
			{ label: 'Annuleren' },
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
		this.panel = h('aside', { class: 'vb-panel', 'aria-label': 'Plakbriefje bewerken', hidden: true });
		root.appendChild(this.top);
		root.appendChild(this.main);
		root.appendChild(this.panel);

		var current = Store.getCurrent();
		this.project = this.find(current) || this.lib.projects[0] || null;
		if (!this.project) {
			this.project = newProject('Mijn eerste verhaal');
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
		if (this.status) this.status.textContent = ok ? 'Opgeslagen in deze browser' : 'Niet opgeslagen';
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
			h('h2', { class: 'vb-heading' }, 'Bibliotheek'),
			h('div', { class: 'vb-bar-group' },
				h('button', { type: 'button', class: 'vb-btn vb-btn-primary', onclick: function () { self.createProject(); } }, '+ Nieuw verhaal'),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { self.pickImport(); } }, 'Importeren'),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { exportLibrary(self.lib); } }, 'Alles exporteren')
			)
		));

		var projects = this.lib.projects.slice().sort(function (a, b) { return b.updated - a.updated; });
		if (!projects.length) {
			this.main.appendChild(h('p', { class: 'vb-empty' }, 'Je bibliotheek is leeg. Begin een nieuw verhaal of importeer een bestand.'));
			return;
		}
		var list = h('ul', { class: 'vb-library' });
		projects.forEach(function (p) {
			var spine = p.notes.filter(function (n) { return n.col === 0; }).sort(function (a, b) { return a.row - b.row; });
			list.appendChild(h('li', { class: 'vb-lib-item' + (self.project && p.id === self.project.id ? ' is-current' : '') },
				h('button', { type: 'button', class: 'vb-lib-open', onclick: function () { self.openProject(p.id); } },
					h('span', { class: 'vb-lib-name' }, p.name),
					h('span', { class: 'vb-lib-meta' }, p.notes.length + (p.notes.length === 1 ? ' briefje' : ' briefjes') + ', bewerkt ' + formatDate(p.updated)),
					h('span', { class: 'vb-lib-spine' }, spine.slice(0, 5).map(function (n) {
						return h('span', { class: 'vb-mini', style: 'background:' + n.color }, n.title || 'Zonder titel');
					}))
				),
				h('div', { class: 'vb-lib-actions' },
					h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { self.renameProject(p); } }, 'Naam wijzigen'),
					h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { self.duplicateProject(p); } }, 'Dupliceren'),
					h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: function () { exportProject(p); } }, 'Exporteren'),
					h('button', { type: 'button', class: 'vb-btn vb-btn-small vb-btn-danger', onclick: function () { self.deleteProject(p); } }, 'Verwijderen')
				)
			));
		});
		this.main.appendChild(list);
		this.main.appendChild(h('p', { class: 'vb-note-hint' }, 'Je verhalen staan alleen in deze browser op dit apparaat. Exporteer regelmatig een reservekopie.'));
	};

	App.prototype.createProject = function () {
		var self = this;
		var input = h('input', { type: 'text', class: 'vb-input', value: 'Nieuw verhaal', 'aria-label': 'Naam van het verhaal' });
		modal('Nieuw verhaal', input, [
			{ label: 'Annuleren' },
			{ label: 'Aanmaken', primary: true, onClick: function () {
				var p = newProject(input.value.trim() || 'Nieuw verhaal');
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
		var input = h('input', { type: 'text', class: 'vb-input', value: p.name, 'aria-label': 'Nieuwe naam' });
		modal('Naam wijzigen', input, [
			{ label: 'Annuleren' },
			{ label: 'Opslaan', primary: true, onClick: function () { p.name = input.value.trim() || p.name; self.persist(); self.render(); } }
		]);
		input.select();
	};

	App.prototype.duplicateProject = function (p) {
		var self = this;
		var copy = clone(p);
		copy.id = uid();
		copy.name = p.name + ' (kopie)';
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
			toast('Gedupliceerd: ' + copy.name);
		});
	};

	App.prototype.deleteProject = function (p) {
		var self = this;
		confirmBox('Verhaal verwijderen', '"' + p.name + '" en alle briefjes en documenten erin verdwijnen uit deze browser. Dit kun je niet ongedaan maken.', 'Verwijderen', function () {
			projectFileIds(p).forEach(function (fid) { Files.del(fid); });
			self.lib.projects = self.lib.projects.filter(function (x) { return x.id !== p.id; });
			if (self.project && self.project.id === p.id) {
				self.project = self.lib.projects[0] || null;
				if (!self.project) { self.project = newProject('Nieuw verhaal'); self.lib.projects.push(self.project); }
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
				toast(projects.length === 1 ? 'Geïmporteerd: ' + projects[0].name : projects.length + ' verhalen geïmporteerd');
				if (projects.length === 1) self.openProject(projects[0].id);
				else { self.view = 'library'; self.render(); }
			}).catch(function (err) {
				toast('Importeren mislukt. ' + (err && err.message ? err.message : 'Het bestand is onleesbaar.'), true);
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
			modal('Gedeeld verhaal ontvangen', h('p', null,
				'"' + p.name + '" met ' + p.notes.length + ' briefjes. Wil je het toevoegen aan je bibliotheek? Het wordt alleen in deze browser opgeslagen.'
			), [
				{ label: 'Niet toevoegen' },
				{ label: 'Toevoegen', primary: true, onClick: function () {
					p.id = uid();
					p.created = p.updated = Date.now();
					self.lib.projects.push(p);
					self.persist();
					self.openProject(p.id);
				} }
			]);
		}).catch(function () {
			toast('Deze deellink is beschadigd of onvolledig.', true);
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

		var nameInput = h('input', { type: 'text', class: 'vb-title-input', value: p.name, 'aria-label': 'Naam van het verhaal' });
		nameInput.addEventListener('change', function () { p.name = nameInput.value.trim() || p.name; self.persist(); });

		this.status = h('span', { class: 'vb-status' }, 'Opgeslagen in deze browser');

		this.top.appendChild(h('div', { class: 'vb-bar' },
			h('div', { class: 'vb-bar-group' },
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { self.closePanel(); self.view = 'library'; self.render(); } }, 'Bibliotheek'),
				nameInput
			),
			h('div', { class: 'vb-bar-group' },
				h('button', { type: 'button', class: 'vb-btn vb-btn-primary vb-btn-add', onclick: function () { self.addNote(); } }, '+ Plakbriefje'),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { self.share(); } }, 'Deellink'),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { exportProject(p); } }, 'Exporteren'),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () { self.pickImport(); } }, 'Importeren'),
				h('button', { type: 'button', class: 'vb-btn', onclick: function () {
					download(slugify(p.name) + '.md', toMarkdown(p), 'text/markdown');
				} }, 'Tekstoverzicht')
			)
		));
		this.top.appendChild(h('div', { class: 'vb-substatus' }, this.status,
			h('span', { class: 'vb-help' }, 'Sleep briefjes naar een vak. Klik om te bewerken. Alt + pijltjestoetsen verplaatst het geselecteerde briefje.')));

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
		grid.appendChild(h('div', { class: 'vb-colhead vb-colhead-spine' }, 'Ruggengraat'));
		for (var c = 1; c < cols; c++) grid.appendChild(h('div', { class: 'vb-colhead' }, c === 1 ? 'Details' : ''));

		for (var r = 0; r < rows; r++) {
			(function (row) {
				var rowNotes = notes.filter(function (n) { return n.row === row; }).length;
				grid.appendChild(h('div', { class: 'vb-rowhead' },
					h('span', { class: 'vb-rownum' }, String(row + 1)),
					h('button', { type: 'button', class: 'vb-icon-btn', title: 'Lege rij hierboven invoegen', 'aria-label': 'Lege rij invoegen boven rij ' + (row + 1), onclick: function () { self.insertRow(row); } }, '+'),
					rowNotes ? h('button', { type: 'button', class: 'vb-icon-btn', title: 'Rij verwijderen', 'aria-label': 'Rij ' + (row + 1) + ' verwijderen', onclick: function () { self.deleteRow(row); } }, '\u00d7') : null
				));
				for (var col = 0; col < cols; col++) {
					var note = self.noteAt(row, col);
					var cell = h('div', { class: 'vb-cell' + (col === 0 ? ' is-spine' : ''), 'data-row': row, 'data-col': col });
					if (note) cell.appendChild(self.noteElement(note));
					else {
						(function (rr, cc) {
							cell.appendChild(h('button', {
								type: 'button', class: 'vb-cell-add',
								'aria-label': 'Plakbriefje toevoegen in rij ' + (rr + 1) + (cc === 0 ? ', ruggengraat' : ', detailkolom ' + cc),
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
			'aria-label': (note.title || 'Zonder titel') + (note.col === 0 ? ', ruggengraat' : ', detail') + ', rij ' + (note.row + 1),
			'data-id': note.id
		},
			h('span', { class: 'vb-note-title' + (note.title ? '' : ' is-empty') }, note.title || 'Zonder titel'),
			note.text ? h('span', { class: 'vb-note-text' }, note.text) : null,
			srcCount ? h('span', { class: 'vb-note-badge' }, srcCount + (srcCount === 1 ? ' bron' : ' bronnen')) : null
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
		confirmBox('Rij ' + (row + 1) + ' verwijderen', 'De ' + inRow.length + (inRow.length === 1 ? ' briefje' : ' briefjes') + ' in deze rij verdwijnen. De rijen eronder schuiven op.', 'Verwijderen', function () {
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

		var titleInput = h('input', { type: 'text', class: 'vb-input', value: note.title, placeholder: 'Bijvoorbeeld: De opening', id: 'vb-title-' + id });
		titleInput.addEventListener('input', function () { note.title = titleInput.value; self.changedText(); });

		var textArea = h('textarea', { class: 'vb-input vb-textarea', rows: '7', placeholder: 'Wat gebeurt hier? Citaten, feiten, vragen…', id: 'vb-text-' + id });
		textArea.value = note.text;
		textArea.addEventListener('input', function () { note.text = textArea.value; self.changedText(); });

		var swatches = h('div', { class: 'vb-swatches', role: 'radiogroup', 'aria-label': 'Kleur' });
		function drawSwatches() {
			swatches.innerHTML = '';
			COLORS.forEach(function (c) {
				var active = note.color.toLowerCase() === c.hex.toLowerCase();
				swatches.appendChild(h('button', {
					type: 'button', class: 'vb-swatch' + (active ? ' is-active' : ''), role: 'radio',
					'aria-checked': active ? 'true' : 'false', 'aria-label': c.name, title: c.name,
					style: 'background:' + c.hex,
					onclick: function () { note.color = c.hex; self.persist(); self.drawGrid(); drawSwatches(); }
				}));
			});
			var custom = h('input', { type: 'color', class: 'vb-swatch-custom', value: note.color, title: 'Eigen kleur', 'aria-label': 'Eigen kleur kiezen' });
			custom.addEventListener('input', function () { note.color = custom.value; self.persist(); self.drawGrid(); });
			custom.addEventListener('change', drawSwatches);
			swatches.appendChild(custom);
		}
		drawSwatches();

		this.positionLabel = h('p', { class: 'vb-panel-pos' });
		this.sourceList = h('ul', { class: 'vb-sources' });
		this.drawSources(note);

		var linkLabel = h('input', { type: 'text', class: 'vb-input', placeholder: 'Omschrijving (optioneel)', 'aria-label': 'Omschrijving van de link' });
		var linkUrl = h('input', { type: 'url', class: 'vb-input', placeholder: 'https://…', 'aria-label': 'Webadres' });
		function addLink() {
			var url = safeUrl(linkUrl.value);
			if (!url) { toast('Vul een geldig webadres in, beginnend met http of https.', true); linkUrl.focus(); return; }
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
				if (file.size > 25 * 1048576) { toast(file.name + ' is groter dan 25 MB. Voeg liever een link toe.', true); return; }
				var fid = uid();
				Files.put(fid, file).then(function () {
					note.sources.push({ id: uid(), type: 'file', label: file.name, url: '', fileId: fid, mime: file.type, size: file.size });
					self.persist(); self.drawSources(note); self.drawGrid();
				}).catch(function () { toast('Het document ' + file.name + ' kon niet worden opgeslagen.', true); });
			});
		});

		this.panel.appendChild(h('div', { class: 'vb-panel-head' },
			h('h2', { class: 'vb-panel-title' }, 'Plakbriefje'),
			h('button', { type: 'button', class: 'vb-icon-btn vb-close', 'aria-label': 'Sluiten', onclick: function () { self.closePanel(); } }, '\u00d7')
		));
		this.panel.appendChild(h('div', { class: 'vb-panel-body' },
			this.positionLabel,
			h('label', { class: 'vb-label', for: 'vb-title-' + id }, 'Titel'), titleInput,
			h('span', { class: 'vb-label' }, 'Kleur'), swatches,
			h('label', { class: 'vb-label', for: 'vb-text-' + id }, 'Beschrijving'), textArea,
			h('span', { class: 'vb-label' }, 'Bronnen'), this.sourceList,
			h('div', { class: 'vb-addsource' },
				linkLabel, linkUrl,
				h('div', { class: 'vb-addsource-actions' },
					h('button', { type: 'button', class: 'vb-btn vb-btn-small', onclick: addLink }, 'Link toevoegen'),
					h('label', { class: 'vb-btn vb-btn-small', for: 'vb-file-' + id }, 'Document toevoegen'),
					fileInput
				)
			),
			h('p', { class: 'vb-note-hint' }, 'Documenten blijven in deze browser. Ze gaan mee in een export, niet in een deellink.')
		));
		this.panel.appendChild(h('div', { class: 'vb-panel-foot' },
			h('button', { type: 'button', class: 'vb-btn vb-btn-danger', onclick: function () { self.deleteNote(note); } }, 'Briefje verwijderen')
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
		this.positionLabel.textContent = (note.col === 0 ? 'Ruggengraat' : 'Detail, kolom ' + note.col) + ', rij ' + (note.row + 1);
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
			list.appendChild(h('li', { class: 'vb-source-empty' }, 'Nog geen bronnen.'));
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
				main = h('span', { class: 'vb-source-missing', title: 'Dit document zat niet in de deellink of het exportbestand' }, s.label + ' (document niet beschikbaar)');
			}
			list.appendChild(h('li', { class: 'vb-source vb-source-' + s.type },
				h('span', { class: 'vb-source-kind' }, s.type === 'link' ? 'Link' : 'Document'),
				main,
				h('button', {
					type: 'button', class: 'vb-icon-btn', 'aria-label': 'Bron verwijderen', title: 'Bron verwijderen',
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
			if (!blob) { if (win) win.close(); toast('Dit document is niet meer aanwezig in deze browser.', true); return; }
			var url = URL.createObjectURL(blob);
			if (win) win.location.href = url;
			else download(s.label || 'document', blob);
			setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
		});
	};

	App.prototype.deleteNote = function (note) {
		var self = this;
		confirmBox('Briefje verwijderen', '"' + (note.title || 'Zonder titel') + '" en de documenten erin verdwijnen.', 'Verwijderen', function () {
			note.sources.forEach(function (s) { if (s.type === 'file') Files.del(s.fileId); });
			self.project.notes = self.project.notes.filter(function (n) { return n.id !== note.id; });
			self.persist();
			self.closePanel();
		});
	};

	/* ---------- Deellink maken ---------- */

	App.prototype.share = function () {
		var p = this.project;
		var hasFiles = projectFileIds(p).length > 0;
		encodeShare(p).then(function (code) {
			var link = shareBaseUrl() + '#vb=' + code;
			var field = h('textarea', { class: 'vb-input vb-share-field', readonly: true, rows: '4', 'aria-label': 'Deellink' });
			field.value = link;
			var notes = [
				h('p', null, 'Wie deze link opent, krijgt een kopie van "' + p.name + '" in de eigen browser. De inhoud zit in de link zelf; er wordt niets op de server bewaard.'),
				field
			];
			if (hasFiles) notes.push(h('p', { class: 'vb-note-hint' }, 'Documenten gaan niet mee in een link. Gebruik Exporteren om ze mee te sturen.'));
			if (link.length > 8000) notes.push(h('p', { class: 'vb-note-hint' }, 'Deze link is erg lang (' + link.length + ' tekens). Sommige mail- en chatprogramma\'s knippen hem af. Stuur dan liever het exportbestand.'));
			modal('Delen via link', notes, [
				{ label: 'Sluiten' },
				{ label: 'Link kopiëren', primary: true, onClick: function () {
					var done = function () { toast('Link gekopieerd'); };
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
		});
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
})();
