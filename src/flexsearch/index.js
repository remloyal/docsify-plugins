import FlexSearch from "flexsearch";
import {
  getAndRemoveConfig,
  getAndRemoveDocsifyIgnoreConfig,
  removeAtag,
} from "../utils/utils.js";
import { markdownToTxt } from "./markdown-to-txt.js";

/**
 * FlexSearch based search plugin for Docsify.
 *
 * - Fetches docs content (same source as built-in search plugin)
 * - Builds a persistent FlexSearch Document index
 * - Persists index in browser IndexedDB using FlexSearch built-in storage
 */

/** @type {ReturnType<typeof createState>} */
let STATE = createState();

/**
 * @type {{
 *   placeholder: string | Record<string, string>;
 *   noData: string | Record<string, string>;
 *   paths: string[] | 'auto';
 *   depth: number;
 *   maxAge: number;
 *   namespace?: string;
 *   pathNamespaces?: RegExp | string[];
 *   keyBindings: string[];
 *   insertAfter?: string;
 *   insertBefore?: string;
 *   limit?: number;
 *   mode?: 'sidebar' | 'modal';
 * }}
 */
const CONFIG = {
  placeholder: "Type to search",
  noData: "No Results!",
  paths: "auto",
  depth: 2,
  maxAge: 86400000, // 1 day
  namespace: undefined,
  pathNamespaces: undefined,
  keyBindings: ["/", "meta+k", "ctrl+k"],
  insertAfter: undefined, // CSS selector
  insertBefore: undefined, // CSS selector
  limit: 30,
  mode: "sidebar",
};

const CSS_TEXT = /* css */ `
/* prettier-ignore */
:root {
	--plugin-flexsearch-input-bg           : var(--form-element-bg);
	--plugin-flexsearch-input-border-color : var(--sidebar-border-color);
	--plugin-flexsearch-input-border-radius: var(--form-element-border-radius);
	--plugin-flexsearch-input-color        : var(--form-element-color);
	--plugin-flexsearch-kbd-bg             : var(--color-bg);
	--plugin-flexsearch-kbd-border         : 1px solid var(--color-mono-3);
	--plugin-flexsearch-kbd-border-radius  : 4px;
	--plugin-flexsearch-kbd-color          : var(--color-mono-5);
	--plugin-flexsearch-margin             : 10px;
	--plugin-flexsearch-reset-bg           : var(--theme-color);
	--plugin-flexsearch-reset-border       : transparent;
	--plugin-flexsearch-reset-border-radius: var(--border-radius);
	--plugin-flexsearch-reset-color        : #fff;
}

.flexsearch-search {
	margin: var(--plugin-flexsearch-margin);
}

.flexsearch-search .input-wrap {
	position: relative;
}

.flexsearch-search input {
	width: 100%;
	padding-inline-end: 36px;
	border: 1px solid var(--plugin-flexsearch-input-border-color);
	border-radius: var(--plugin-flexsearch-input-border-radius);
	background: var(--plugin-flexsearch-input-bg);
	color: var(--plugin-flexsearch-input-color);
}

.flexsearch-search input::-webkit-search-decoration,
.flexsearch-search input::-webkit-search-cancel-button {
	appearance: none;
}

.flexsearch-search .clear-button,
.flexsearch-search .kbd-group {
	visibility: hidden;
	display: flex;
	gap: 0.15em;
	position: absolute;
	right: 7px;
	top: 50%;
	opacity: 0;
	translate: 0 -50%;
	transition-property: opacity, visibility;
	transition-duration: var(--duration-medium);
}

.flexsearch-search input:valid ~ .clear-button,
.flexsearch-search input:invalid:where(:focus, :hover) ~ .kbd-group,
.flexsearch-search .kbd-group:hover {
	visibility: visible;
	opacity: 1;
}

.flexsearch-search .clear-button {
	--_button-size: 20px;
	--_content-size: 12px;

	display: flex;
	align-items: center;
	justify-content: center;
	height: var(--_button-size);
	width: var(--_button-size);
	border: var(--plugin-flexsearch-reset-border);
	border-radius: var(--plugin-flexsearch-reset-border-radius);
	background: var(--plugin-flexsearch-reset-bg);
	cursor: pointer;
}

.flexsearch-search .clear-button::before,
.flexsearch-search .clear-button::after {
	content: '';
	position: absolute;
	height: 2px;
	width: var(--_content-size);
	color: var(--plugin-flexsearch-reset-color);
	background: var(--plugin-flexsearch-reset-color);
}

.flexsearch-search .clear-button::before {
	rotate: 45deg;
}

.flexsearch-search .clear-button::after {
	rotate: -45deg;
}

.flexsearch-search kbd {
	border: var(--plugin-flexsearch-kbd-border);
	border-radius: var(--plugin-flexsearch-kbd-border-radius);
	background: var(--plugin-flexsearch-kbd-bg);
	color: var(--plugin-flexsearch-kbd-color);
	font-size: var(--font-size-s);
}

.flexsearch-search a:hover {
	color: var(--theme-color);
}

.flexsearch-search .results-panel:empty {
	display: none;
}

.flexsearch-search:has(.results-panel:not(:empty)) ~ * {
	display: none;
}

.flexsearch-search:where(:has(input:valid:focus), :has(.results-panel::empty)) ~ * {
	opacity: 0.2;
}

.flexsearch-search .matching-post {
	overflow: hidden;
	padding: 1em 0 1.2em 0;
	border-bottom: 1px solid var(--color-mono-2);
}

.flexsearch-search .matching-post:hover a {
	text-decoration-color: transparent;
}

.flexsearch-search .matching-post:hover .title {
	text-decoration: inherit;
	text-decoration-color: var(--link-underline-color-hover);
}

.flexsearch-search .matching-post .title {
	margin: 0 0 0.5em 0;
	line-height: 1.4;
}

.flexsearch-search .matching-post .content {
	margin: 0;
	color: var(--color-mono-6);
	font-size: var(--font-size-s);
}

.flexsearch-search .results-status {
	margin-bottom: 0;
	color: var(--color-mono-6);
	font-size: var(--font-size-s);
}

.flexsearch-search .results-status:empty {
	display: none;
}

/* Modal */
/* ================================== */
.flexsearch-modal {
  position: fixed;
  inset: 0;
  display: none;
  z-index: 9999;
}

.flexsearch-modal.is-open {
  display: block;
}

.flexsearch-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.flexsearch-modal__dialog {
  position: relative;
  margin: 8vh auto 0 auto;
  max-width: min(720px, calc(100vw - 24px));
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-background, var(--color-bg));
  border: 1px solid var(--sidebar-border-color, var(--color-mono-2));
  border-radius: 10px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
}

.flexsearch-modal__dialog .flexsearch-search {
  margin: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}

.flexsearch-modal__dialog .flexsearch-search .results-panel {
  overflow: auto;
  min-height: 0;
  flex: 1 1 auto;
}

/* Modal trigger (sidebar) */
/* ================================== */
.flexsearch-trigger {
  margin: var(--plugin-flexsearch-margin);
}

.flexsearch-trigger .input-wrap {
  position: relative;
}

.flexsearch-trigger input {
  width: 100%;
  padding-inline-end: 36px;
  border: 1px solid var(--plugin-flexsearch-input-border-color);
  border-radius: var(--plugin-flexsearch-input-border-radius);
  background: var(--plugin-flexsearch-input-bg);
  color: var(--plugin-flexsearch-input-color);
  cursor: pointer;
}

.flexsearch-trigger .kbd-group {
  visibility: hidden;
  display: flex;
  gap: 0.15em;
  position: absolute;
  right: 7px;
  top: 50%;
  opacity: 0;
  translate: 0 -50%;
  transition-property: opacity, visibility;
  transition-duration: var(--duration-medium);
}

.flexsearch-trigger input:where(:focus, :hover) ~ .kbd-group,
.flexsearch-trigger .kbd-group:hover {
  visibility: visible;
  opacity: 1;
}

.flexsearch-trigger kbd {
  border: var(--plugin-flexsearch-kbd-border);
  border-radius: var(--plugin-flexsearch-kbd-border-radius);
  background: var(--plugin-flexsearch-kbd-bg);
  color: var(--plugin-flexsearch-kbd-color);
  font-size: var(--font-size-s);
}
`;

function createState() {
  return {
    /** @type {string | null} */
    key: null,
    /** @type {import('flexsearch').Document<any, false, any> | null} */
    index: null,
    /** @type {Promise<void> | null} */
    mounted: null,
    /** @type {Promise<void> | null} */
    building: null,
    /** @type {boolean} */
    uiReady: false,
    /** @type {string} */
    noDataText: "",
  };
}

function escapeHtml(string) {
  const entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(string).replace(/[&<>"']/g, (s) => entityMap[s]);
}

function stripDiacritics(text) {
  if (text && text.normalize) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return text || "";
}

function escapeRegExp(string) {
  return String(string).replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function keywordList(query) {
  const q = (query || "").trim();
  if (!q) {
    return [];
  }
  let keywords = q.split(/[\s\-，\\/]+/).filter(Boolean);
  if (keywords.length !== 1) {
    keywords = [q, ...keywords];
  }
  return keywords;
}

function highlightSnippet(text, query, maxLen = 120) {
  const content = stripDiacritics(text || "");
  const keys = keywordList(query).map((k) => stripDiacritics(k));
  const key = keys.find(
    (k) => k && content.toLowerCase().includes(k.toLowerCase()),
  );
  if (!key) {
    const clipped = content.slice(0, maxLen);
    return escapeHtml(clipped);
  }

  const idx = content.toLowerCase().indexOf(key.toLowerCase());
  const start = Math.max(0, idx - 30);
  const end = Math.min(content.length, idx + key.length + 80);
  const slice = content.slice(start, end);

  // Escape the entire slice first
  const escapedSlice = escapeHtml(slice);
  // Escape the key for HTML, then escape for regex
  const escapedKey = escapeHtml(key);
  const reg = new RegExp(escapeRegExp(escapedKey), "ig");
  const marked = escapedSlice.replace(
    reg,
    (word) => /* html */ `<mark>${word}</mark>`,
  );
  return (start > 0 ? "…" : "") + marked + (end < content.length ? "…" : "");
}

function getAllPaths(router) {
  const paths = [];

  Docsify.dom
    .findAll(".sidebar-nav a:not(.section-link):not([data-nosearch])")
    .forEach((node) => {
      const href = /** @type {HTMLAnchorElement} */ (node).href;
      const originHref = /** @type {HTMLAnchorElement} */ (node).getAttribute(
        "href",
      );
      const parsed = router.parse(href);
      const path = parsed.path;

      if (
        path &&
        paths.indexOf(path) === -1 &&
        !Docsify.util.isAbsolutePath(originHref)
      ) {
        paths.push(path);
      }
    });

  return paths;
}

function getTableData(token) {
  if (!token.text && token.type === "table") {
    token.rows.unshift(token.header);
    token.text = token.rows
      .map((columns) => columns.map((r) => r.text).join(" | "))
      .join(" |\n ");
  }
  return token.text;
}

function getListData(token) {
  if (!token.text && token.type === "list") {
    token.text = token.raw;
  }
  return token.text;
}

function genIndex(path, content = "", router, depth) {
  const tokens = window.marked.lexer(content);
  const slugify = window.Docsify.slugify;
  /** @type {Record<string, {id: string, slug: string, title: string, body: string, path: string}>} */
  const index = {};
  let slug;
  let title = "";

  tokens.forEach((token, tokenIndex) => {
    if (token.type === "heading" && token.depth <= depth) {
      const { str, config } = getAndRemoveConfig(token.text);
      slug = router.toURL(path, { id: slugify(config.id || token.text) });

      if (str) {
        title = getAndRemoveDocsifyIgnoreConfig(str).content;
        title = removeAtag(title.trim());
      }

      index[slug] = {
        id: slug,
        slug,
        title,
        body: "",
        path,
      };
    } else {
      if (tokenIndex === 0) {
        slug = router.toURL(path);
        index[slug] = {
          id: slug,
          slug,
          title: path !== "/" ? path.slice(1) : "Home Page",
          body: markdownToTxt(/** @type {any} */ (token).text || ""),
          path,
        };
      }

      if (!slug) {
        return;
      }

      if (!index[slug]) {
        index[slug] = { id: slug, slug, title: "", body: "", path };
      }

      // @ts-expect-error
      token.text = getTableData(token);
      // @ts-expect-error
      token.text = getListData(token);

      const txt = markdownToTxt(/** @type {any} */ (token).text || "");
      if (!txt) {
        return;
      }

      if (index[slug].body) {
        index[slug].body += "\n" + txt;
      } else {
        index[slug].body = txt;
      }
    }
  });

  slugify.clear();
  return index;
}

function resolveNamespaceSuffix(paths, config) {
  let namespaceSuffix = "";

  // only in auto mode
  if (paths.length && config.paths === "auto" && config.pathNamespaces) {
    const first = paths[0];
    if (Array.isArray(config.pathNamespaces)) {
      namespaceSuffix =
        config.pathNamespaces.filter(
          (prefix) => first.slice(0, prefix.length) === prefix,
        )[0] || namespaceSuffix;
    } else if (config.pathNamespaces instanceof RegExp) {
      const matches = first.match(config.pathNamespaces);
      if (matches) {
        namespaceSuffix = matches[0];
      }
    }

    const isExistHome = paths.indexOf(namespaceSuffix + "/") === -1;
    const isExistReadme = paths.indexOf(namespaceSuffix + "/README") === -1;
    if (isExistHome && isExistReadme) {
      paths.unshift(namespaceSuffix + "/");
    }
  } else if (paths.indexOf("/") === -1 && paths.indexOf("/README") === -1) {
    paths.unshift("/");
  }

  return namespaceSuffix;
}

function storageKey(namespace, suffix) {
  const ns = namespace ? String(namespace) : "";
  const sfx = suffix ? String(suffix) : "";
  return `docsify.flexsearch/${ns}/${sfx}`.replace(/\/+$/, "");
}

function safeDbName(key) {
  return key.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function configHash(config, paths, suffix) {
  // Small & stable hash input: paths + depth + suffix
  // (no crypto, just enough to detect config changes)
  return JSON.stringify({
    paths,
    depth: config.depth,
    suffix,
  });
}

function tpl(vm, defaultValue = "") {
  const html = /* html */ `
		<div class="input-wrap">
			<input type="search" value="${defaultValue}" required aria-keyshortcuts="/ control+k meta+k" />
			<button class="clear-button" title="Clear search">
				<span class="visually-hidden">Clear search</span>
			</button>
			<div class="kbd-group">
				<kbd title="Press / to search">/</kbd>
				<kbd title="Press Control+K to search">⌃K</kbd>
			</div>
		</div>
		<p class="results-status" aria-live="polite"></p>
		<div class="results-panel"></div>
	`;
  const root = Docsify.dom.create("section", html);
  root.classList.add("flexsearch-search");
  root.setAttribute("role", "search");

  return root;
}

function mountSidebar(vm, defaultValue) {
  const sidebarElm = Docsify.dom.find(".sidebar");
  if (!sidebarElm) {
    return;
  }

  const { insertAfter, insertBefore } = vm.config?.search || {};
  const root = tpl(vm, defaultValue);
  const insertElm = /** @type {HTMLElement} */ (
    sidebarElm.querySelector(
      `:scope ${insertAfter || insertBefore || "> :first-child"}`,
    )
  );

  sidebarElm.insertBefore(
    root,
    insertAfter ? insertElm.nextSibling : insertElm,
  );

  bindEvents(vm);
}

function mountModalTrigger(vm, defaultValue) {
  const sidebarElm = Docsify.dom.find(".sidebar");
  if (!sidebarElm) {
    return;
  }

  if (Docsify.dom.getNode(".flexsearch-trigger")) {
    return;
  }

  const { insertAfter, insertBefore } = vm.config?.search || {};
  const html = /* html */ `
		<div class="input-wrap">
			<input type="search" value="${defaultValue}" readonly aria-haspopup="dialog" aria-keyshortcuts="/ control+k meta+k" />
			<div class="kbd-group">
				<kbd title="Press / to search">/</kbd>
				<kbd title="Press Control+K to search">⌃K</kbd>
			</div>
		</div>
	`;
  const root = Docsify.dom.create("section", html);
  root.classList.add("flexsearch-trigger");

  const insertElm = /** @type {HTMLElement} */ (
    sidebarElm.querySelector(
      `:scope ${insertAfter || insertBefore || "> :first-child"}`,
    )
  );

  sidebarElm.insertBefore(
    root,
    insertAfter ? insertElm.nextSibling : insertElm,
  );

  const input = /** @type {HTMLInputElement | null} */ (
    root.querySelector('input[type="search"]')
  );

  // Prevent to Fold sidebar (same behavior as built-in search)
  Docsify.dom.on(root, "click", (e) => e.stopPropagation());

  const open = () => {
    ensureUI(vm);
    openModal();
  };

  Docsify.dom.on(input, "focus", open);
  Docsify.dom.on(input, "click", open);
}

function mountModal(vm, defaultValue) {
  if (Docsify.dom.getNode(".flexsearch-modal")) {
    return;
  }

  const modal = document.createElement("div");
  modal.className = "flexsearch-modal";
  modal.innerHTML = /* html */ `
		<div class="flexsearch-modal__backdrop" aria-hidden="true"></div>
		<div class="flexsearch-modal__dialog" role="dialog" aria-modal="true"></div>
	`;

  const dialog = /** @type {HTMLElement} */ (
    modal.querySelector(".flexsearch-modal__dialog")
  );
  dialog.appendChild(tpl(vm, defaultValue));
  document.body.appendChild(modal);

  Docsify.dom.on(
    /** @type {HTMLElement} */ (
      modal.querySelector(".flexsearch-modal__backdrop")
    ),
    "click",
    () => closeModal(),
  );

  Docsify.dom.on(modal, "keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
  });

  bindEvents(vm);
}

function openModal() {
  const modal = /** @type {HTMLElement | null} */ (
    Docsify.dom.getNode(".flexsearch-modal")
  );
  if (!modal) {
    return;
  }
  modal.classList.add("is-open");

  const input = /** @type {HTMLInputElement | null} */ (
    modal.querySelector('.flexsearch-search input[type="search"]')
  );
  setTimeout(() => input?.focus(), 0);
}

function closeModal() {
  const modal = /** @type {HTMLElement | null} */ (
    Docsify.dom.getNode(".flexsearch-modal")
  );
  if (!modal) {
    return;
  }
  modal.classList.remove("is-open");
}

function updatePlaceholder(text, path) {
  const placeholder =
    typeof text === "string"
      ? text
      : text[Object.keys(text).filter((key) => path.indexOf(key) > -1)[0]];

  const searchInput = /** @type {HTMLInputElement | null} */ (
    Docsify.dom.getNode('.flexsearch-search input[type="search"]')
  );
  if (searchInput) {
    searchInput.placeholder = placeholder;
  }

  const triggerInput = /** @type {HTMLInputElement | null} */ (
    Docsify.dom.getNode('.flexsearch-trigger input[type="search"]')
  );
  if (triggerInput) {
    triggerInput.placeholder = placeholder;
  }
}

function updateNoData(text, path) {
  if (typeof text === "string") {
    STATE.noDataText = text;
  } else {
    const match = Object.keys(text).filter((key) => path.indexOf(key) > -1)[0];
    STATE.noDataText = text[match];
  }
}

function ensureUI(vm) {
  if (STATE.uiReady) {
    return;
  }

  if (Docsify.dom.getNode(".flexsearch-search")) {
    STATE.uiReady = true;
    return;
  }

  const keywords = vm.router.parse().query.s || "";
  Docsify.dom.style(CSS_TEXT);

  if (CONFIG.mode === "modal") {
    mountModal(vm, escapeHtml(keywords));
    mountModalTrigger(vm, "");
  } else {
    mountSidebar(vm, escapeHtml(keywords));
  }

  STATE.uiReady = true;

  if (keywords) {
    setTimeout(() => {
      if (CONFIG.mode === "modal") {
        openModal();
      }
      void doSearch(vm, keywords);
    }, 500);
  }
}

function bindEvents(vm) {
  const $root = Docsify.dom.find(".flexsearch-search");
  const $input = /** @type {HTMLInputElement} */ (
    Docsify.dom.find($root, "input")
  );
  const $clear = Docsify.dom.find($root, ".clear-button");

  let timeId;

  Docsify.dom.on(
    $root,
    "click",
    (e) =>
      ["A", "H2", "P", "EM"].indexOf(e.target.tagName) === -1 &&
      e.stopPropagation(),
  );

  Docsify.dom.on($input, "input", (e) => {
    clearTimeout(timeId);
    timeId = setTimeout(() => {
      const value = /** @type {HTMLInputElement} */ (e.target).value.trim();
      void doSearch(vm, value);
    }, 120);
  });

  Docsify.dom.on($clear, "click", () => {
    $input.value = "";
    void doSearch(vm, "");
  });

  Docsify.dom.on($root, "click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const link = target?.closest?.("a");
    if (link && CONFIG.mode === "modal") {
      closeModal();
    }
  });
}

function setStatus(text) {
  const $status = Docsify.dom.find(".flexsearch-search .results-status");
  if ($status) {
    $status.textContent = text || "";
  }
}

function setResultsHTML(html) {
  const $root = Docsify.dom.find(".flexsearch-search");
  const $panel = Docsify.dom.find($root, ".results-panel");
  $panel.innerHTML = html || "";
}

async function computePaths(config, vm) {
  const isAuto = config.paths === "auto";
  const paths = isAuto ? getAllPaths(vm.router) : [...config.paths];
  const suffix = resolveNamespaceSuffix(paths, config);
  return { paths, suffix, isAuto };
}

async function ensureIndex(config, vm) {
  const { paths, suffix } = await computePaths(config, vm);
  const key = storageKey(config.namespace, suffix);

  const expiresKey = `${key}/expires`;
  const hashKey = `${key}/hash`;
  const now = Date.now();
  const expiresAt = Number(localStorage.getItem(expiresKey) || 0);
  const hash = configHash(config, paths, suffix);
  const prevHash = localStorage.getItem(hashKey) || "";
  const expired = expiresAt < now;
  const changed = prevHash !== hash;

  if (STATE.key !== key) {
    // New namespace/suffix: reset in-memory state, but keep persisted index in IDB.
    STATE = createState();
    STATE.key = key;
  }

  if (!STATE.index) {
    STATE.index = new FlexSearch.Document({
      tokenize: "forward",
      cache: 100,
      document: {
        id: "id",
        index: ["title", "body"],
        store: ["id", "slug", "title", "body", "path"],
      },
    });
  }

  if (!STATE.mounted) {
    STATE.mounted = (async () => {
      const idx =
        /** @type {import('flexsearch').Document<any, false, any>} */ (
          STATE.index
        );
      // Mount persistent storage
      const db = new FlexSearch.IndexedDB({
        name: safeDbName(key),
        type: "varchar",
      });
      await idx.mount(db);
    })();
  }

  await STATE.mounted;

  if (!STATE.building && (expired || changed)) {
    STATE.building = (async () => {
      setStatus("Building search index…");

      const idx =
        /** @type {import('flexsearch').Document<any, false, any>} */ (
          STATE.index
        );

      // Drop persisted data when expired or config changed
      try {
        await idx.destroy();
      } catch (e) {
        // ignore
        console.log(e);
      }

      // Recreate & remount (destroy() clears internal refs)
      STATE.index = new FlexSearch.Document({
        tokenize: "forward",
        cache: 100,
        document: {
          id: "id",
          index: ["title", "body"],
          store: ["id", "slug", "title", "body", "path"],
        },
      });

      const db = new FlexSearch.IndexedDB({
        name: safeDbName(key),
        type: "varchar",
      });
      const newIdx =
        /** @type {import('flexsearch').Document<any, false, any>} */ (
          STATE.index
        );
      await newIdx.mount(db);

      // Fetch and index docs
      let count = 0;
      const total = paths.length;

      await Promise.all(
        paths.map(async (path) => {
          const file = vm.router.getFile(path);
          const content = await Docsify.get(
            file,
            false,
            vm.config.requestHeaders,
          );
          const parts = genIndex(path, content, vm.router, config.depth);
          Object.values(parts).forEach((doc) => {
            newIdx.add(doc);
          });
          count++;
          if (count === 1 || count === total || count % 10 === 0) {
            setStatus(`Building search index… (${count}/${total})`);
          }
        }),
      );

      await newIdx.commit();

      localStorage.setItem(expiresKey, String(now + config.maxAge));
      localStorage.setItem(hashKey, hash);
      setStatus("");
    })().finally(() => {
      STATE.building = null;
    });
  }

  if (STATE.building) {
    await STATE.building;
  }
}

async function doSearch(vm, value) {
  const query = (value || "").trim();

  if (!query) {
    setResultsHTML("");
    setStatus("");
    return;
  }

  // Ensure index exists (mounted and built if needed)
  await ensureIndex(CONFIG, vm);
  const idx = /** @type {import('flexsearch').Document<any, false, any>} */ (
    STATE.index
  );

  let results;
  try {
    results = await idx.search(query, {
      limit: CONFIG.limit,
      enrich: true,
      merge: true,
    });
  } catch (e) {
    console.log(e);
    // In case persistent mount isn't supported in the environment
    results = await idx.search(query, {
      limit: CONFIG.limit,
      enrich: true,
      merge: true,
    });
  }

  const list = Array.isArray(results) ? results : [];
  const items = list
    .map((r) => r && r.doc)
    .filter(Boolean)
    .slice(0, CONFIG.limit);

  let html = "";
  items.forEach((doc, i) => {
    const titlePlain = (doc.title || "").replace(/<[^>]+>/g, "");
    const title = stripDiacritics(doc.title || "");
    const content = doc.body ? highlightSnippet(doc.body, query) : "";
    html += /* html */ `
			<div class="matching-post" aria-label="search result ${i + 1}">
				<a href="${doc.slug}" title="${escapeHtml(titlePlain)}">
          <p class="title clamp-1">${highlightSnippet(title, query, 80)}</p>
					<p class="content clamp-2">${content ? `...${content}...` : ""}</p>
				</a>
			</div>
		`;
  });

  setResultsHTML(html);
  setStatus(items.length ? `Found ${items.length} results` : STATE.noDataText);
}

function applyUserConfig(vm) {
  const { util } = Docsify;
  const opts = vm.config.search || CONFIG;

  if (Array.isArray(opts)) {
    CONFIG.paths = opts;
  } else if (typeof opts === "object") {
    CONFIG.paths = Array.isArray(opts.paths) ? opts.paths : "auto";
    CONFIG.maxAge = util.isPrimitive(opts.maxAge) ? opts.maxAge : CONFIG.maxAge;
    CONFIG.placeholder = opts.placeholder || CONFIG.placeholder;
    CONFIG.noData = opts.noData || CONFIG.noData;
    CONFIG.depth = opts.depth || CONFIG.depth;
    CONFIG.namespace = opts.namespace || CONFIG.namespace;
    CONFIG.pathNamespaces = opts.pathNamespaces || CONFIG.pathNamespaces;
    CONFIG.keyBindings = opts.keyBindings || CONFIG.keyBindings;
    CONFIG.insertAfter = opts.insertAfter || CONFIG.insertAfter;
    CONFIG.insertBefore = opts.insertBefore || CONFIG.insertBefore;
    CONFIG.limit = opts.limit || CONFIG.limit;
    CONFIG.mode = opts.mode || CONFIG.mode;
  }
}

const install = function (hook, vm) {
  applyUserConfig(vm);

  hook.init(() => {
    const { keyBindings } = vm.config;

    // Add key bindings
    if (keyBindings && keyBindings.constructor === Object) {
      keyBindings.focusFlexSearch = {
        bindings: CONFIG.keyBindings,
        callback() {
          ensureUI(vm);
          if (CONFIG.mode === "modal") {
            openModal();
            return;
          }

          const sidebarElm = document.querySelector(".sidebar");
          const sidebarToggleElm = /** @type {HTMLElement} */ (
            document.querySelector(".sidebar-toggle")
          );
          const searchElm = /** @type {HTMLInputElement | null} */ (
            sidebarElm?.querySelector('.flexsearch-search input[type="search"]')
          );
          const isSidebarHidden =
            (sidebarElm?.getBoundingClientRect().x ?? 0) < 0;

          isSidebarHidden && sidebarToggleElm?.click();
          setTimeout(() => searchElm?.focus(), isSidebarHidden ? 250 : 0);
        },
      };
    }
  });

  hook.mounted(() => {
    ensureUI(vm);
    updatePlaceholder(CONFIG.placeholder, vm.route.path);
    updateNoData(CONFIG.noData, vm.route.path);
    void ensureIndex(CONFIG, vm);
  });

  hook.doneEach(() => {
    ensureUI(vm);
    updatePlaceholder(CONFIG.placeholder, vm.route.path);
    updateNoData(CONFIG.noData, vm.route.path);

    // Auto mode: sidebar links may change after navigation
    if (CONFIG.paths === "auto") {
      void ensureIndex(CONFIG, vm);
    }
  });
};

window.$docsify = window.$docsify || {};
window.$docsify.plugins = [install, ...(window.$docsify.plugins || [])];
