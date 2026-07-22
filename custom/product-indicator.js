// Shows the currently selected product next to the "Products" navbar tab.
// Mintlify's menu tab has no native selected-item indicator, so this appends
// e.g. "Products · Ephemeral SPL Token" based on the current route.
(function () {
  var PRODUCT_BY_PREFIX = [
    ["/pages/ephemeral-rollups-ers/", "Ephemeral Rollup"],
    ["/pages/tools/crank/", "Ephemeral Rollup"],
    ["/pages/private-ephemeral-rollups-pers/", "Private Ephemeral Rollup"],
    ["/pages/ephemeral-spl-token/", "Ephemeral SPL Token"],
    ["/pages/verifiable-randomness-functions-vrfs/", "Solana VRF"],
    ["/pages/tools/oracle/", "Price Oracle"],
  ];

  var style = document.createElement("style");
  style.textContent =
    ".mb-active-product{margin-left:0.125rem;font-weight:600;white-space:nowrap;color:#aa00ff}" +
    "html.dark .mb-active-product{color:#c266ff}";
  document.head.appendChild(style);

  function currentProduct() {
    var path = window.location.pathname;
    for (var i = 0; i < PRODUCT_BY_PREFIX.length; i++) {
      if (path.indexOf(PRODUCT_BY_PREFIX[i][0]) === 0) return PRODUCT_BY_PREFIX[i][1];
    }
    return null;
  }

  function findProductsTextNode(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() === "Products") return node;
    }
    return null;
  }

  function apply() {
    var product = currentProduct();
    document.querySelectorAll(".nav-tabs-item").forEach(function (tab) {
      var badge = tab.querySelector(".mb-active-product");
      var textNode = findProductsTextNode(tab);
      if (!textNode && !badge) return;
      if (!product) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        if (!textNode) return;
        badge = document.createElement("span");
        badge.className = "mb-active-product";
        textNode.parentNode.insertBefore(badge, textNode.nextSibling);
      }
      var label = "· " + product;
      if (badge.textContent !== label) badge.textContent = label;
    });
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      apply();
    });
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", schedule);
  var push = history.pushState;
  history.pushState = function () {
    push.apply(this, arguments);
    schedule();
  };
  apply();
})();
