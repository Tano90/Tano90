/* GLB AI Suite – accessible names for form fields (website revision, Oct 2026).
   Many v0.4–v0.8 views place a visible caption next to a field without linking the two. After every render
   this links them: the caption a sighted user reads becomes the field's name for screen readers.
   Order: caption in the same .field / form row, table column header + row name, placeholder, title.
   Fields that already have a name are never touched. */
(() => {
  "use strict";
  // text as written in the markup (innerText would apply CSS uppercase); separate elements stay separate words
  const text = (el) => {
    if (!el) return "";
    const parts = [],
      walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) parts.push(walk.currentNode.nodeValue);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  };
  // the first visible line of a cell is the row's name (later lines are details such as units)
  const firstLine = (el) => {
    const walk = el && document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk?.nextNode()) if (walk.currentNode.nodeValue.trim()) return walk.currentNode.nodeValue.trim();
    return "";
  };
  const hasName = (el) => el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.closest("label");

  function caption(el) {
    // 1. a visible caption element in the same small container
    let box = el.parentElement;
    for (let depth = 0; box && depth < 2; depth++, box = box.parentElement) {
      if (box.matches("main, section, .panel, form, table, tbody, tr, #modal-layer")) break;
      const fields = box.querySelectorAll("input, select, textarea");
      if (fields.length > 1) break;
      const cap = box.querySelector(":scope > label, :scope > .field-label, :scope > strong, :scope > b, :scope > span:not(.micro)");
      if (cap && !cap.contains(el) && text(cap)) return text(cap);
    }
    // 2. inside a table: column header plus the name in the first cell of the row
    const cell = el.closest("td, th");
    if (cell) {
      const row = cell.parentElement,
        table = cell.closest("table"),
        index = [...row.children].indexOf(cell),
        head = table?.querySelector("thead tr")?.children[index],
        rowName = row.children[0] !== cell ? firstLine(row.children[0]) : "";
      const parts = [text(head), rowName].filter(Boolean);
      if (parts.length) return parts.join(" · ");
    }
    // 3. what the field itself shows
    return el.getAttribute("placeholder") || el.getAttribute("title") || "";
  }

  function label(root) {
    for (const el of root.querySelectorAll("input:not([type=hidden]), select, textarea")) {
      if (el.hidden || el.type === "file" || hasName(el)) continue;
      const name = caption(el);
      if (name) el.setAttribute("aria-label", name.slice(0, 120));
    }
    // scroll boxes with tables must be reachable by keyboard to scroll sideways
    for (const box of root.querySelectorAll(".table-scroll, .table-wrap, .v4-list, .glbm-scroll")) {
      if (box.scrollWidth > box.clientWidth + 2 || box.scrollHeight > box.clientHeight + 2) {
        if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "0");
        if (!box.getAttribute("aria-label")) {
          const title = text(box.closest(".panel, section")?.querySelector("h2, h3, .panel-title"));
          box.setAttribute("role", "region");
          box.setAttribute("aria-label", title ? `${title} (scrollbar)` : "Tabelle (scrollbar)");
        }
      }
    }
  }
  let queued = false;
  const run = () => {
    queued = false;
    for (const sel of ["#main", "#modal-layer", ".topbar"]) {
      const root = document.querySelector(sel);
      if (root) label(root);
    }
  };
  new MutationObserver(() => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  }).observe(document.body, { childList: true, subtree: true });
  run();
})();
