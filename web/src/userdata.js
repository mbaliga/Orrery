/* Your workspace, loaded before the page reads its data. If you have loaded your own scan (and, optionally, your own content)
   under Settings > Data, or from the first-run sheet, it is kept in this browser (localStorage) and used in place of what the
   page was built with. Nothing is sent anywhere; "Back to the built-in data" removes it. The page only ever parses JSON from
   a file you load; it does not run it. */
(function () {
  'use strict';
  try {
    var raw = localStorage.getItem('tracker.userdata');
    if (!raw) return;
    var u = JSON.parse(raw);
    if (u && u.graph && Array.isArray(u.graph.projects) && Array.isArray(u.graph.clusters)) {
      window.TRACKER_GRAPH = u.graph;
      if (u.seed && typeof u.seed === 'object') window.TRACKER_SEED = u.seed;
      window.ORRERY_USER = { at: u.at || '', files: u.files || [] };
    }
  } catch (e) { /* storage can be blocked; the built-in data stands */ }
})();
