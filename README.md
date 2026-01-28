# docsify-plugins

Firstly, make sure that the [loadSidebar](https://docsify.js.org/#/configuration?id=loadsidebar) config is enabled，and the Markdown file `_sidebar.md` is provided in the root directory.

Then insert script into document just like the [official plugins](https://docsify.js.org/#/plugins)'s usage

## docsify-flexsearch

reference [docsify-search](https://github.com/docsifyjs/docsify/blob/develop/src/plugins/search/index.js)

### Usage

```html
<script>
  window.$docsify = {
    // Complete configuration parameters
    search: {
      // Location in sidebar (default: prepended as first child)
      // Optionally specify insertAfter or insertBefore (not both)
      insertAfter: ".app-name", // CSS selector in .sidebar scope
      insertBefore: ".sidebar-nav", // CSS selector in .sidebar scope

      maxAge: 86400000, // Expiration time, the default one day
      paths: [], // or 'auto'
      placeholder: "Type to search",

      // Localization
      placeholder: {
        "/zh-cn/": "搜索",
        "/": "Type to search",
      },

      noData: "No Results!",

      // Localization
      noData: {
        "/zh-cn/": "找不到结果",
        "/": "No Results",
      },

      // Headline depth, 1 - 6
      depth: 2,

      hideOtherSidebarContent: true, // Deprecated as of v5

      // To avoid search index collision
      // between multiple websites under the same domain
      namespace: "website-1",

      // Use different indexes for path prefixes (namespaces).
      // NOTE: Only works in 'auto' mode.
      //
      // When initialiazing an index, we look for the first path from the sidebar.
      // If it matches the prefix from the list, we switch to the corresponding index.
      pathNamespaces: ["/zh-cn", "/ru-ru", "/ru-ru/v1"],

      // You can provide a regexp to match prefixes. In this case,
      // the matching substring will be used to identify the index
      pathNamespaces: /^(\/(zh-cn|ru-ru))?(\/(v1|v2))?/,
      // 'sidebar' | 'modal', Default is sidebar, modalModal will use pop-up mode
      mode: "sidebar",
    },
  };
</script>
<script src="//cdn.jsdelivr.net/npm/docsify/lib/docsify.min.js"></script>

<!-- plugins -->
<script src="https://unpkg.com/@remloyal/docsify-plugins@latest/dist/flexsearch/docsify-flexsearch.min.js"></script>
<link
  rel="stylesheet"
  href="https://unpkg.com/@remloyal/docsify-plugins@latest/dist/flexsearch/docsify-flexsearch.min.css"
/>
```

## docsify-sidebar-collapse

reference [docsify-sidebar-collapse](https://github.com/iPeng6/docsify-sidebar-collapse)

### Usage

```html
<script>
  window.$docsify = {
    loadSidebar: true,
    alias: {
      '/.*/_sidebar.md': '/_sidebar.md',
    },
    subMaxLevel: 3,
    ...
    sidebarDisplayLevel: 1, // set sidebar display level
  }
</script>
<script src="//cdn.jsdelivr.net/npm/docsify/lib/docsify.min.js"></script>

<!-- plugins -->
<script src="https://unpkg.com/@remloyal/docsify-plugins@latest/dist/sidebar-collapse/docsify-sidebar-collapse.min.js"></script>

```