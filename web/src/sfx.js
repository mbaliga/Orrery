/* sfx: the interface tones, from the shared kit (ASOC.sfx), with this page's store */
(function () {
  'use strict';
  var T = window.T, s = ASOC.sfx.create({ store: T.store });
  T.sfx = s.play; T.sfxOn = s.on; T.setSfx = s.setOn; T.sfxVol = s.vol; T.setSfxVol = s.setVol; T.sfxSynth = s;
})();
