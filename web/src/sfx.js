/* sfx: the interface tones, from the shared kit (ASOC.sfx), with this page's store */
(function () {
  'use strict';
  var T = window.T, s = ASOC.sfx.create({ store: T.store });
  T.sfx = s.play; T.sfxOn = s.on; T.setSfx = s.setOn; T.sfxVol = s.vol; T.setSfxVol = s.setVol; T.sfxSynth = s;
  // the room's sound: rain, a storm, a fire, wind, a forest, the sea — synthesised here, never fetched; and the muse,
  // music made from a prompt by rule (a model that writes music is the routing engine's, later, with your own key)
  T.ambience = ASOC.ambience.create({ store: T.store });
  T.muse = ASOC.muse.create({ store: T.store });
  // browsers only let sound start on a gesture: the room resumes on the first one
  var once = function () { T.ambience.resume(); window.removeEventListener('pointerdown', once); window.removeEventListener('keydown', once); };
  window.addEventListener('pointerdown', once); window.addEventListener('keydown', once);
})();
