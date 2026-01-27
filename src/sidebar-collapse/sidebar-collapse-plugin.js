import "./style.css";

// 首次加载标记 - 控制层级仅首次展开
let isFirstLoad = true;
// 全局侧边栏折叠状态对象，持久化每个节点状态（键：href，值：open/collapse）
const sidebarCollapseState = {};

function sidebarCollapsePlugin(hook, vm) {
  hook.doneEach(function (html, next) {
    const activeNode = getActiveNode();
    // 自动展开当前激活项的根层级（核心体验保留）
    openActiveToRoot(activeNode);

    addFolderFileClass();
    // 仅首次加载执行层级类添加+初始展开
    isFirstLoad && addLevelClass();
    syncScrollTop(activeNode);

    // doneEach最后恢复折叠状态，避免自动逻辑覆盖
    restoreCollapseState(activeNode);

    next(html);
  });
  hook.ready(function () {
    // 1. 关键：hook.ready中先收集全量初始状态（DOM已完整，仅执行一次）
    collectInitialCollapseState();
    // 2. 再绑定点击事件，确保初始状态收集完成后再处理用户操作
    document
      .querySelector(".sidebar-nav")
      .addEventListener("click", handleMenuClick);
    setTimeout(() => {
      const activeNode = getActiveNode();
      restoreCollapseState(activeNode);
    });
  });
}

function init() {
  document.addEventListener("scroll", scrollSyncMenuStatus);
}

let lastTop; // 侧边栏滚动状态
function syncScrollTop(activeNode) {
  if (activeNode && lastTop != undefined) {
    const curTop = activeNode.getBoundingClientRect().top;
    document.querySelector(".sidebar").scrollBy(0, curTop - lastTop);
  }
}

function scrollSyncMenuStatus() {
  requestAnimationFrame(() => {
    let el = document.querySelector(".app-sub-sidebar > .active");
    if (el) {
      el.parentNode.parentNode
        .querySelectorAll(".app-sub-sidebar")
        .forEach((dom) => dom.classList.remove("open"));
      while (el.parentNode.classList.contains("app-sub-sidebar")) {
        if (el.parentNode.classList.contains("open")) {
          break;
        } else {
          el.parentNode.classList.add("open");
          el = el.parentNode;
        }
      }
    }
  });
}

function handleMenuClick(e) {
  lastTop = e.target.getBoundingClientRect().top;
  // 兼容点击<a>标签或父级LI的情况，找到实际的LI节点
  const targetNode = e.target.tagName === "A" ? e.target.parentNode : e.target;
  const newActiveNode = findTagParent(targetNode, "LI", 2);
  if (!newActiveNode) return;
  // 找到节点内的<a>标签，获取唯一标识href
  const nodeHref = newActiveNode.querySelector("a")?.getAttribute("href");
  if (!nodeHref) return;

  if (newActiveNode.classList.contains("open")) {
    // 手动折叠：移除open，添加collapse
    newActiveNode.classList.remove("open");
    setTimeout(() => {
      newActiveNode.classList.add("collapse");
    }, 0);
    // 收集状态：折叠状态存入对象
    sidebarCollapseState[nodeHref] = "collapse";
  } else {
    // 手动展开：先关闭其他激活项，再展开当前
    removeOpenToRoot(getActiveNode());
    openActiveToRoot(newActiveNode);
    setTimeout(() => {
      newActiveNode.classList.remove("collapse");
    }, 0);
    // 收集状态：展开状态存入对象
    sidebarCollapseState[nodeHref] = "open";
  }
  syncScrollTop(newActiveNode);
}

function getActiveNode() {
  let node = document.querySelector(".sidebar-nav .active");

  if (!node) {
    const curHref = decodeURIComponent(location.hash).replace(/ /gi, "%20");
    const curLink = document.querySelector(`.sidebar-nav a[href="${curHref}"]`);
    node = findTagParent(curLink, "LI", 2);
    if (node) {
      node.classList.add("active");
      // 初始化激活项状态：默认展开
      const nodeHref = node.querySelector("a")?.getAttribute("href");
      nodeHref && (sidebarCollapseState[nodeHref] = "open");
    }
  }
  return node;
}

function openActiveToRoot(node) {
  if (node) {
    node.classList.add("open", "active");
    while (node && node.className !== "sidebar-nav" && node.parentNode) {
      if (
        node.parentNode.tagName === "LI" ||
        node.parentNode.className === "app-sub-sidebar"
      ) {
        node.parentNode.classList.add("open");
      }
      node = node.parentNode;
    }
  }
}

function removeOpenToRoot(node) {
  if (node) {
    node.classList.remove("open", "active");
    while (node && node.className !== "sidebar-nav" && node.parentNode) {
      if (
        node.parentNode.tagName === "LI" ||
        node.parentNode.className === "app-sub-sidebar"
      ) {
        node.parentNode.classList.remove("open");
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
          // 优先读取专属配置，兼容原配置
          const firstOpenLevel =
            window.$docsify?.sidebarFirstOpenLevel ||
            window.$docsify?.sidebarDisplayLevel;
          if (
            firstOpenLevel &&
            typeof firstOpenLevel === "number" &&
            level <= firstOpenLevel
          ) {
            child.classList.add("open");
            // 初始化首次展开的节点状态：存入open
            const nodeHref = child.querySelector("a")?.getAttribute("href");
            nodeHref && (sidebarCollapseState[nodeHref] = "open");
          }
          if (child && child.childNodes.length > 1) {
            find(child.childNodes[1], level + 1);
          }
        }
      });
  }
  find(document.querySelector(".sidebar-nav > ul"), 1);
  // 首次执行后关闭标记
  isFirstLoad = false;
}

function restoreCollapseState(activeNode) {
  // 获取激活节点的href（用于排除，不覆盖其状态）
  const activeHref = activeNode?.querySelector("a")?.getAttribute("href");
  // 遍历所有菜单节点，根据状态对象恢复
  document
    .querySelectorAll(".sidebar-nav li.folder, .sidebar-nav li.file")
    .forEach((li) => {
      const nodeHref = li.querySelector("a")?.getAttribute("href");
      // 容错：无href的节点不处理，排除激活项
      if (!nodeHref || nodeHref === activeHref) return;
      // 从状态对象获取保存的状态
      const saveState = sidebarCollapseState[nodeHref];
      if (saveState) {
        // 恢复状态：移除相反类名，添加保存的类名
        li.classList.remove(saveState === "open" ? "collapse" : "open");
        li.classList.add(saveState);
      }
    });
}

// 2. 新增：hook.ready专用 - 收集侧边栏全量初始状态函数（仅执行一次）
function collectInitialCollapseState() {
  // 遍历所有侧边栏可交互节点（folder/file，此时addFolderFileClass已执行，类名存在）
  const allSidebarNodes = document.querySelectorAll(
    ".sidebar-nav li.folder, .sidebar-nav li.file",
  );
  allSidebarNodes.forEach((li) => {
    // 获取节点唯一标识：a标签的href（容错，无a/href则跳过）
    const aTag = li.querySelector("a");
    const nodeHref = aTag?.getAttribute("href");
    if (!nodeHref) return;

    // 核心：根据DOM真实类名判断初始状态，与实际展示严格一致
    let initialState = "collapse"; // 默认折叠（Docsify原生默认行为）
    if (li.classList.contains("open")) {
      initialState = "open"; // 有open类=展开状态
    } else if (li.classList.contains("collapse")) {
      initialState = "collapse"; // 有collapse类=折叠状态
    }

    // 将真实初始状态存入全局状态对象，完成初始化
    sidebarCollapseState[nodeHref] = initialState;
  });
  // 可选：调试用，查看收集的初始状态（开发完成后可删除）
  console.log("侧边栏初始状态收集完成：", sidebarCollapseState);
}

init();

export default sidebarCollapsePlugin;
