/* targets: what each place you ship to asks for. Stores, font libraries, venues and publications, as data, never code.
   Every target names when it was researched and where; a step the research did not cover is marked so, not guessed.
   A step's `evidence` says how it gets ticked: a task or date on the board, a fact read from a repo, a store's API
   once its connector is on, or your own mark. Prompts are the hand-off to Ask: one sentence that gets the work started. */
(function () {
  'use strict';
  var T = window.T;
  var PLAY_SRC = ['https://support.google.com/googleplay/android-developer/answer/9866151', 'https://support.google.com/googleplay/android-developer/answer/14151465', 'https://support.google.com/googleplay/android-developer/answer/11926878', 'https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks'];
  // the four bands the readiness meter counts, in the order they are met
  T.BANDS = [['account', 'Account'], ['fields', 'Listing'], ['assets', 'Assets'], ['gates', 'Gates'], ['build', 'Build']];

  var PLAY_STEPS = [
    { id: 'dev-account', band: 'account', label: 'Play developer account, verified', evidence: 'manual', link: 'https://play.google.com/console' },
    { id: 'app-created', band: 'account', label: 'App created in the Console, enrolled in Play App Signing', evidence: 'api', hint: 'The API sees the app once it exists.' },
    { id: 'title', band: 'fields', label: 'Title, 30 characters', unit: 'chars', max: 30, evidence: 'api',
      prompt: 'Write the Play title for {project} in 30 characters or fewer: the name, and only if room is left, what it does.' },
    { id: 'short', band: 'fields', label: 'Short description, 80 characters', unit: 'chars', max: 80, evidence: 'api',
      prompt: 'Write the Play short description for {project} in 80 characters or fewer, no trailing period, from its README.' },
    { id: 'full', band: 'fields', label: 'Full description, 4,000 characters', unit: 'chars', max: 4000, evidence: 'api',
      prompt: 'Write the Play full description for {project} under 4,000 characters: what it is, what it never does with your data, and three highlights. Plain words, no superlatives.' },
    { id: 'category', band: 'fields', label: 'Category, contact email, privacy policy URL', evidence: 'api' },
    { id: 'icon', band: 'assets', label: 'Icon, 512 × 512 PNG, 32-bit, under 1 MB', evidence: 'api' },
    { id: 'feature', band: 'assets', label: 'Feature graphic, 1024 × 500, no alpha', evidence: 'api' },
    { id: 'shots', band: 'assets', label: 'Phone screenshots, 2 to 8, taken on the device', evidence: 'api',
      hint: 'JPEG or 24-bit PNG, 320 to 3,840 px, the long side at most twice the short. Four at 1080 px or more for featuring.' },
    { id: 'data-safety', band: 'gates', label: 'Data safety form', evidence: 'repo', fact: 'data-safety',
      prompt: 'Draft the Play Data safety answers for {project} from its dependency list and network calls. Say No to collection unless a dependency proves otherwise, and list every network call with who starts it.' },
    { id: 'rating', band: 'gates', label: 'Content rating questionnaire', evidence: 'repo', fact: 'content-rating',
      prompt: 'Draft the IARC content rating answers for {project}: what it generates, what users can import, and how output is flagged.' },
    { id: 'privacy', band: 'gates', label: 'Privacy policy page, live at a stable URL', evidence: 'repo', fact: 'privacy-policy',
      prompt: 'Write a one-page privacy policy for {project}: no collection, no telemetry, no backend, and the only network calls it makes, each with who starts it.' },
    { id: 'target-api', band: 'gates', label: 'Targets API 36 for new apps and updates from 31 August 2026', evidence: 'manual',
      hint: 'Wear OS and Automotive: API 35 from the same date. Extensions to 1 November 2026 can be requested.' },
    { id: 'closed-test', band: 'gates', label: 'Closed test: 12 testers opted in for 14 continuous days', evidence: 'task',
      hint: 'For personal accounts created after 13 November 2023. Then Apply for production; review usually takes seven days or less.',
      prompt: 'Write the tester invitation for {project}: what to try, how to opt in, and the fourteen-day ask, in under 120 words.' },
    { id: 'aab', band: 'build', label: 'Signed AAB from CI, version code bumped', evidence: 'manual',
      prompt: 'List the release steps for {project}: bump versionCode and versionName, run the JVM gate, build the Play bundle, upload to the right track.' },
    { id: 'track', band: 'build', label: 'Release on a track: internal, closed, open or production', evidence: 'api', hint: 'Release status from the API: draft, inProgress, halted or completed.' }
  ];

  T.TARGETS = [
    { id: 'play', name: 'Google Play', kind: 'store', api: 'play', platform: 'android', researchedAt: '2026-10-17', sources: PLAY_SRC,
      states: ['none', 'draft', 'closed testing', 'open testing', 'production'], steps: PLAY_STEPS },
    { id: 'play-wear', name: 'Google Play, Wear OS', kind: 'store', api: 'play', platform: 'wearos', researchedAt: '2026-10-17', sources: PLAY_SRC,
      states: ['none', 'draft', 'closed testing', 'open testing', 'production'],
      steps: PLAY_STEPS.filter(function (s) { return s.id !== 'shots'; }).concat([
        { id: 'wear-shot', band: 'assets', label: 'Wear OS screenshot, at least one, 1:1, 384 × 384 or larger', evidence: 'api' },
        { id: 'wear-track', band: 'build', label: 'Release on the wear:production track', evidence: 'api' }
      ]) },
    { id: 'f-droid', name: 'F-Droid', kind: 'store', api: 'gitlab', platform: 'android', researchedAt: '2026-10-17',
      sources: ['https://f-droid.org/docs/Inclusion_Policy/'], states: ['none', 'requested', 'in review', 'listed'],
      steps: [
        { id: 'floss', band: 'gates', label: 'Everything FLOSS: code, assets, fonts; no proprietary build tools', evidence: 'repo', fact: 'floss' },
        { id: 'no-tracking', band: 'gates', label: 'No Play Services, Firebase, analytics or ads', evidence: 'repo', fact: 'no-tracking' },
        { id: 'reproducible', band: 'build', label: 'Builds from public source on F-Droid’s own servers', evidence: 'manual',
          prompt: 'Write the fdroiddata build recipe for {project}: the repo, the tag pattern, the Gradle flavor and module, and any prebuilt dependency with its source.' },
        { id: 'anti-features', band: 'gates', label: 'Anti-features declared where they apply', evidence: 'manual' },
        { id: 'fastlane', band: 'fields', label: 'fastlane metadata: title, short description under 80, full description, changelogs', evidence: 'repo', fact: 'fastlane',
          prompt: 'Write the fastlane metadata for {project}: title under 50, short_description under 80 with no trailing period, full_description, and a changelog under 500 characters for the current versionCode.' },
        { id: 'rfp', band: 'account', label: 'Request for packaging, or a merge request to fdroiddata', evidence: 'api', hint: 'The GitLab API shows the request once it exists.' }
      ] },
    { id: 'google-fonts', name: 'Google Fonts', kind: 'library', api: 'github', platform: 'gfonts', researchedAt: '2026-10-17',
      sources: ['https://googlefonts.github.io/gf-guide/onboarding.html'], states: ['none', 'issue open', 'in review', 'rejected', 'live'],
      steps: [
        { id: 'issue', band: 'account', label: 'Submission issue on the Google Fonts tracker, with the new OFL font template', evidence: 'api' },
        { id: 'ofl', band: 'gates', label: 'Every style under the OFL 1.1, no Reserved Font Names, CLA signed by every copyright holder', evidence: 'repo', fact: 'ofl' },
        { id: 'name', band: 'fields', label: 'Family name: simple, unique, ASCII, no designer names', evidence: 'manual' },
        { id: 'sources', band: 'assets', label: 'Sources in a supported editor format, built with fontmake, TTFs available', evidence: 'repo', fact: 'font-sources' },
        { id: 'glyphs', band: 'assets', label: 'GF Latin Core glyph set and the outline quality guide', evidence: 'task' },
        { id: 'fontbakery', band: 'build', label: 'Passes FontBakery, googlefonts profile', evidence: 'manual',
          prompt: 'Run FontBakery with the googlefonts profile on {project} and list every FAIL with the fix, grouped by glyph, metadata and metrics.' },
        { id: 'description', band: 'fields', label: 'Description for the specimen page', evidence: 'manual',
          prompt: 'Write the DESCRIPTION.en_us.html for {project}: the family’s story, the designer credit, and what makes it distinct, in under 150 words.' }
      ] },
    { id: 'connectiq', name: 'Garmin Connect IQ', kind: 'store', api: null, platform: 'garmin', researchedAt: '2026-10-17', partial: true,
      sources: ['https://developer.garmin.com/connect-iq/submit-an-app/'], states: ['none', 'uploaded', 'in review', 'live'],
      steps: [
        { id: 'program', band: 'account', label: 'Connect IQ developer program', evidence: 'manual', undocumented: 'Garmin’s page does not state account requirements.' },
        { id: 'manifest', band: 'build', label: 'Manifest lists every device the app supports', evidence: 'repo', fact: 'ciq-manifest' },
        { id: 'iq', band: 'build', label: '.iq file exported with the Monkey C extension', evidence: 'manual' },
        { id: 'description', band: 'fields', label: 'Description, very specific, and screenshots', evidence: 'manual', undocumented: 'Sizes and counts are not on Garmin’s submission page.',
          prompt: 'Write the Connect IQ store description for {project}: what the face shows, which data fields, and which devices, very specifically.' },
        { id: 'review', band: 'gates', label: 'Garmin review, then the listing appears', evidence: 'manual', undocumented: 'No review time is published.' }
      ] },
    { id: 'figma-community', name: 'Figma Community', kind: 'store', api: null, platform: 'figma', researchedAt: null, research: 'required', states: ['none', 'submitted', 'live'], steps: [] },
    { id: 'app-store', name: 'App Store', kind: 'store', api: 'asc', platform: 'ios', researchedAt: null, research: 'required',
      sources: ['https://developer.apple.com/documentation/appstoreconnectapi/appstoreversionstate'],
      hint: 'Needs the paid Apple Developer Program. The App Store Connect API reports each version’s state once the connector is on.',
      states: ['none', 'prepare for submission', 'waiting for review', 'in review', 'ready for sale'], steps: [] },
    { id: 'github-releases', name: 'GitHub Releases', kind: 'channel', api: 'github', platform: 'desktop', researchedAt: '2026-10-17', sources: ['https://docs.github.com/en/rest/releases/releases'],
      states: ['none', 'draft', 'pre-release', 'released'],
      steps: [
        { id: 'tag', band: 'build', label: 'A tag and a release with the built artifacts attached', evidence: 'api' },
        { id: 'notes', band: 'fields', label: 'Release notes', evidence: 'api', prompt: 'Write the release notes for {project} from the commits since the last tag: what changed for someone using it, then what changed underneath.' },
        { id: 'license', band: 'gates', label: 'LICENSE file in the repo', evidence: 'repo', fact: 'license' }
      ] },
    { id: 'web', name: 'The web', kind: 'host', api: null, platform: 'web', researchedAt: '2026-10-17', sources: [],
      states: ['none', 'preview', 'live'],
      steps: [
        { id: 'domain', band: 'account', label: 'Domain and HTTPS', evidence: 'manual' },
        { id: 'privacy', band: 'gates', label: 'Privacy page: what the site keeps, which is nothing', evidence: 'manual' },
        { id: 'deploy', band: 'build', label: 'Deploys from main', evidence: 'manual' }
      ] },


    // venues, publications and anything else of your own come from your data (SEED.targets), in this same shape
  ];
  T.TARGETS = T.TARGETS.concat((window.TRACKER_SEED && window.TRACKER_SEED.targets) || []);
  T.targetById = function (id) { for (var i = 0; i < T.TARGETS.length; i++) if (T.TARGETS[i].id === id) return T.TARGETS[i]; return null; };

  // which store each platform ships through
  T.PLATFORM_TARGET = { android: 'play', wearos: 'play-wear', garmin: 'connectiq', gfonts: 'google-fonts', figma: 'figma-community', web: 'web', desktop: 'github-releases' };

  // facts read from the repos: yours, from your data (SEED.facts: { projectId: { stepFact: { ok, where } } }); the scanner writes these in the build
  T.FACTS = (window.TRACKER_SEED && window.TRACKER_SEED.facts) || {};
})();
