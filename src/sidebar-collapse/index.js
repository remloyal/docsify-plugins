import "./style.css";

const isFirstLoad = () =>
  window.$docsify?.sidebarInterlock !== undefined
    ? window.$docsify?.sidebarInterlock
    : true;

// 全局侧边栏折叠状态对象
const sidebarCollapseState = {};
const sidebarOuterHTMLMap = new Map();
let isClickMenu = false;

function sidebarCollapsePlugin(hook, vm) {
  hook.doneEach(function (html, next) {
    const activeNode = getActiveNode();
    // 处理文件头部
    handFileTitle();
    // 自动展开当前激活项的根层级
    openActiveToRoot(activeNode);

    addFolderFileClass();
    if (!isClickMenu) {
      addLevelClass();
    }
    syncScrollTop(activeNode);
    restoreCollapseState();
    isClickMenu = false;
    next(html);
  });

  hook.ready(function () {
    document
      .querySelector(".sidebar-nav")
      .addEventListener("click", handleMenuClick);
    setTimeout(() => {
      restoreCollapseState();
    });

    const sidebar = document.querySelector("#__sidebar");
    sidebar.addEventListener("scroll", function (e) {
      scrollTop = e.target.scrollTop;
    });
  });
}

//生成唯一标识
const UUIDGeneratorBrowser = () =>
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16),
  );

let lastTop;
let scrollTop = 0;
function syncScrollTop() {
  const sidebar = document.querySelector("#__sidebar");
  if (lastTop != undefined && sidebar) {
    setTimeout(() => {
      // sidebar.scrollBy(0, lastTop)
      sidebar.scrollTop = lastTop;
    });
  }
}

function scrollSyncMenuStatus() {
  requestAnimationFrame(() => {
    let el = document.querySelector(".app-sub-sidebar > .active");
    if (el) {
      el.parentNode.parentNode
        .querySelectorAll(".app-sub-sidebar")
        .forEach((dom) => dom.classList.remove("sidebar-open"));
      while (el.parentNode.classList.contains("app-sub-sidebar")) {
        if (el.parentNode.classList.contains("sidebar-open")) {
          break;
        } else {
          el.parentNode.classList.add("sidebar-open");
          el = el.parentNode;
        }
      }
    }
  });
}

function handFileTitle() {
  const groupItems = document.querySelectorAll(".sidebar-nav li.group");
  groupItems.forEach((item) => {
    const hasDirectUl = Array.from(item.childNodes).some(
      (node) => node.nodeType === 1 && node.nodeName === "UL",
    );
    if (!hasDirectUl) return; // 无直接ul，直接跳过
    const titleTagNode = item.childNodes[0];

    // 匹配直接子元素p/a
    if (titleTagNode.nodeName == "P" || titleTagNode.nodeName == "A") {
      // 防重复：未添加过sidebar-group类，才追加
      if (!titleTagNode.classList.contains("sidebar-group")) {
        titleTagNode.classList.add("sidebar-group");
        if (sidebarOuterHTMLMap.has(titleTagNode.outerHTML)) {
          titleTagNode.dataset.id = sidebarOuterHTMLMap.get(
            titleTagNode.outerHTML,
          );
        } else {
          const id = UUIDGeneratorBrowser();
          sidebarOuterHTMLMap.set(titleTagNode.outerHTML, id);
          titleTagNode.dataset.id = id;
        }
      }
      return;
    }

    // 未生成过span.sidebar-group，才执行包裹
    if (!item.querySelector("span.sidebar-group")) {
      const children = Array.from(item.children);
      const pureText = Array.from(item.childNodes)
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent.trim())
        .join("")
        .trim();

      if (pureText) {
        const pureHtml = `<span class="sidebar-group">${pureText}</span>`;
        if (sidebarOuterHTMLMap.has(pureHtml)) {
          const id = sidebarOuterHTMLMap.get(pureHtml);
          item.innerHTML = `<span class="sidebar-group" data-id="${id}">${pureText}</span>`;
        } else {
          const id = UUIDGeneratorBrowser();
          sidebarOuterHTMLMap.set(pureHtml, id);
          item.innerHTML = `<span class="sidebar-group" data-id="${id}">${pureText}</span>`;
        }
        children.forEach((child) => item.appendChild(child)); // 插回暂存的ul
      }
    }
  });
}

function handleMenuClick(e) {
  lastTop = scrollTop;
  isClickMenu = true;
  // 兼容点击<a>标签或父级LI的情况，找到实际的LI节点
  const targetNode = e.target.tagName === "A" ? e.target.parentNode : e.target;
  const newActiveNode = findTagParent(targetNode, "LI", 2);
  if (!newActiveNode) return;
  let nodeId = "";
  // console.log("nodeHref", { newActiveNode, nodeHref });
  const foldLabel =
    newActiveNode instanceof Array
      ? newActiveNode[0]
      : newActiveNode?.childNodes[0];
  if (
    foldLabel.nodeName == "P" ||
    foldLabel.nodeName == "A" ||
    foldLabel.nodeName == "SPAN"
  ) {
    nodeId = foldLabel.dataset.id;
  }

  if (!nodeId) return;

  if (newActiveNode.classList.contains("sidebar-open")) {
    // 手动折叠：移除open，添加collapse
    newActiveNode.classList.remove("sidebar-open");
    setTimeout(() => {
      newActiveNode.classList.add("sidebar-collapse");
    }, 0);
    sidebarCollapseState[nodeId] = "sidebar-collapse";
  } else {
    removeOpenToRoot(getActiveNode());
    openActiveToRoot(newActiveNode);
    setTimeout(() => {
      newActiveNode.classList.remove("sidebar-collapse");
    }, 0);
    sidebarCollapseState[nodeId] = "sidebar-open";
  }
  syncScrollTop();
}

function getActiveNode() {
  let node = document.querySelector(".sidebar-nav .active");

  if (!node) {
    const curHref = decodeURIComponent(location.hash).replace(/ /gi, "%20");
    const curLink = document.querySelector(`.sidebar-nav a[href="${curHref}"]`);
    node = findTagParent(curLink, "LI", 2);
    if (node) {
      node.classList.add("active");
      // console.log("node", { node });
      // // 初始化激活项状态：默认展开
      // const nodeHref = node.querySelector("a")?.getAttribute("href");
      // nodeHref && (sidebarCollapseState[nodeHref] = "sidebar-open");
    }
  }
  return node;
}

function openActiveToRoot(node) {
  if (node) {
    node.classList.add("sidebar-open", "active");
    while (node && node.className !== "sidebar-nav" && node.parentNode) {
      if (
        node.parentNode.tagName === "LI" ||
        node.parentNode.className === "app-sub-sidebar"
      ) {
        node.parentNode.classList.add("sidebar-open");
      }
      node = node.parentNode;
    }
  }
}

function removeOpenToRoot(node) {
  if (node) {
    node.classList.remove("sidebar-open", "active");
    while (node && node.className !== "sidebar-nav" && node.parentNode) {
      if (
        node.parentNode.tagName === "LI" ||
        node.parentNode.className === "app-sub-sidebar"
      ) {
        node.parentNode.classList.remove("sidebar-open");
      }
      node = node.parentNode;
    }
  }
}

function findTagParent(curNode, tagName, level) {
  if (curNode && curNode.tagName === tagName) return curNode;
  let l = 0;
  while (curNode) {
    l++;
    if (l > level) return;
    if (curNode.parentNode.tagName === tagName) {
      return curNode.parentNode;
    }
    curNode = curNode.parentNode;
  }
}

function addFolderFileClass() {
  document.querySelectorAll(".sidebar-nav li").forEach((li) => {
    if (li.querySelector("ul:not(.app-sub-sidebar)")) {
      li.classList.add("folder");
    } else {
      li.classList.add("file");
    }
  });
}

function addLevelClass() {
  function find(root, level) {
    root &&
      root.childNodes &&
      root.childNodes.forEach((child) => {
        if (child.classList && child.classList.contains("folder")) {
          child.classList.add(`level-${level}`);
          if (
            window.$docsify &&
            window.$docsify.sidebarDisplayLevel &&
            typeof window.$docsify.sidebarDisplayLevel === "number" &&
            level <= window.$docsify.sidebarDisplayLevel
          ) {
            child.classList.add("sidebar-open");
            const foldLabel = child?.childNodes[0];
            if (
              foldLabel.nodeName == "P" ||
              foldLabel.nodeName == "A" ||
              foldLabel.nodeName == "SPAN"
            ) {
              const nodeId = foldLabel.dataset.id;
              sidebarCollapseState[nodeId] = "sidebar-open";
            }
          }
          if (child && child.childNodes.length > 1) {
            find(child.childNodes[1], level + 1);
          }
        }
      });
  }
  find(document.querySelector(".sidebar-nav > ul"), 1);
}

function restoreCollapseState() {
  document.querySelectorAll(".sidebar-nav .sidebar-group").forEach((li) => {
    const nodeId = li.dataset.id;
    const saveState = sidebarCollapseState[nodeId];
    if (saveState) {
      if (
        li.parentNode.tagName === "LI" &&
        li.parentNode.classList.contains("group")
      ) {
        li.parentNode.classList.remove(
          saveState === "sidebar-open" ? "sidebar-collapse" : "sidebar-open",
        );
        li.parentNode.classList.add(saveState);
      }
    }
  });
}

function install(...plugins) {
  if (!window.$docsify) {
    console.error("这是一个docsify插件，请先引用docsify库！");
  } else {
    $docsify.plugins = plugins.concat($docsify.plugins || []);
  }
}

install(sidebarCollapsePlugin);
