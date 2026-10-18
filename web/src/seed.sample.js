// Sample content, derived from a real workspace with every name replaced (scan/sample.js).
window.TRACKER_SEED = {
 "tracks": [
  [
   "build",
   "Build"
  ],
  [
   "design",
   "Design"
  ],
  [
   "research",
   "Research"
  ],
  [
   "release",
   "Release"
  ],
  [
   "publish",
   "Publish"
  ],
  [
   "admin",
   "Admin and IP"
  ]
 ],
 "tasks": [
  {
   "id": "g-spec",
   "kind": "gate",
   "title": "Fix the build for Alder",
   "p": "p1",
   "lane": "release",
   "status": "ready",
   "agent": "you",
   "owner": "you",
   "plan": true
  },
  {
   "id": "g-porting",
   "kind": "gate",
   "title": "Review the draft for Elder 2",
   "p": "p33",
   "lane": "admin",
   "status": "ready",
   "agent": "you",
   "owner": "you",
   "real": true,
   "also": [
    "p1",
    "p8",
    "p9",
    "p14",
    "p3",
    "p31"
   ]
  },
  {
   "id": "g-crash",
   "kind": "gate",
   "title": "Ship the beta for Elder 2",
   "p": "p33",
   "lane": "release",
   "status": "ready",
   "agent": "you",
   "owner": "you",
   "real": true,
   "stalled": "13 wk",
   "also": [
    "p12",
    "p10"
   ]
  },
  {
   "id": "g-privacy",
   "kind": "gate",
   "title": "Measure the baseline for Juniper",
   "p": "p10",
   "lane": "admin",
   "status": "ready",
   "agent": "you",
   "owner": "you",
   "plan": true
  },
  {
   "id": "g-endorse",
   "kind": "gate",
   "title": "Answer the reviewers for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "ready",
   "agent": "you",
   "owner": "you",
   "plan": true
  },
  {
   "id": "g-a1",
   "kind": "gate",
   "title": "Record the demo for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "doing",
   "agent": "you",
   "owner": "you",
   "real": true
  },
  {
   "id": "g-wear",
   "kind": "gate",
   "title": "Carve out the module for Aspen",
   "p": "p26",
   "lane": "release",
   "status": "doing",
   "agent": "you",
   "owner": "testers",
   "plan": true
  },
  {
   "id": "g-glyphs",
   "kind": "gate",
   "title": "Port the screen for Damson 2",
   "p": "p32",
   "lane": "design",
   "status": "doing",
   "agent": "you",
   "owner": "you",
   "real": true
  },
  {
   "id": "g-refs",
   "kind": "gate",
   "title": "Tune the model for Birch 2",
   "p": "p30",
   "lane": "admin",
   "status": "ready",
   "agent": "you",
   "owner": "you"
  },
  {
   "id": "g-pay",
   "kind": "gate",
   "title": "Write the brief for Birch",
   "p": "p2",
   "lane": "admin",
   "status": "backlog",
   "agent": "you",
   "owner": "you"
  },
  {
   "id": "g-aarso",
   "kind": "gate",
   "title": "Fix the build for Ginkgo",
   "p": "p7",
   "lane": "research",
   "status": "backlog",
   "agent": "you",
   "owner": "you",
   "stalled": "11 wk",
   "real": true
  },
  {
   "id": "g-mw75",
   "kind": "gate",
   "title": "Review the draft for Tamarind",
   "p": "p20",
   "lane": "build",
   "status": "backlog",
   "agent": "you",
   "owner": "you",
   "real": true
  },
  {
   "id": "t-ci",
   "title": "Ship the beta for Alder",
   "p": "p1",
   "lane": "build",
   "status": "review",
   "agent": "claude-fable",
   "real": true,
   "also": [
    "p8",
    "p33",
    "p31"
   ]
  },
  {
   "id": "t-merge",
   "title": "Measure the baseline for Alder",
   "p": "p1",
   "lane": "build",
   "status": "backlog",
   "agent": "claude-opus",
   "by": [
    "t-ci"
   ]
  },
  {
   "id": "t-reveal",
   "title": "Answer the reviewers for Alder",
   "p": "p1",
   "lane": "publish",
   "status": "ready",
   "agent": "you",
   "plan": true
  },
  {
   "id": "t-fapp",
   "title": "Record the demo for Hazel 2",
   "p": "p36",
   "lane": "publish",
   "status": "ready",
   "agent": "claude-sonnet",
   "plan": true
  },
  {
   "id": "t-fdev",
   "title": "Carve out the module for Hazel 2",
   "p": "p36",
   "lane": "publish",
   "status": "backlog",
   "agent": "claude-sonnet",
   "plan": true,
   "by": [
    "g-spec"
   ]
  },
  {
   "id": "t-asocdev",
   "title": "Port the screen for Hazel 2",
   "p": "p36",
   "lane": "publish",
   "status": "backlog",
   "agent": "claude-sonnet",
   "plan": true
  },
  {
   "id": "t-smoke",
   "title": "Tune the model for Alder",
   "p": "p1",
   "lane": "release",
   "status": "backlog",
   "agent": "you",
   "by": [
    "t-merge"
   ]
  },
  {
   "id": "t-carve",
   "title": "Write the brief for Birch",
   "p": "p2",
   "lane": "build",
   "status": "backlog",
   "agent": "claude-opus",
   "by": [
    "t-merge"
   ],
   "stalled": "9 wk"
  },
  {
   "id": "t-unlock",
   "title": "Fix the build for Birch",
   "p": "p2",
   "lane": "release",
   "status": "backlog",
   "agent": "claude-sonnet",
   "by": [
    "g-pay",
    "t-carve"
   ]
  },
  {
   "id": "t-inrts",
   "title": "Review the draft for Zelkova",
   "p": "p25",
   "lane": "build",
   "status": "backlog",
   "agent": "codex",
   "by": [
    "t-smoke"
   ]
  },
  {
   "id": "t-fylz-qml",
   "title": "Ship the beta for Hazel",
   "p": "p8",
   "lane": "build",
   "status": "doing",
   "agent": "claude-sonnet",
   "real": true
  },
  {
   "id": "t-fotoz-ut",
   "title": "Measure the baseline for Ilex",
   "p": "p9",
   "lane": "build",
   "status": "doing",
   "agent": "claude-sonnet",
   "real": true
  },
  {
   "id": "t-alloy",
   "title": "Answer the reviewers for Nutmeg",
   "p": "p14",
   "lane": "build",
   "status": "doing",
   "agent": "codex",
   "real": true
  },
  {
   "id": "t-asom",
   "title": "Record the demo for Cedar",
   "p": "p3",
   "lane": "build",
   "status": "doing",
   "agent": "claude-sonnet",
   "real": true
  },
  {
   "id": "t-devpass",
   "title": "Carve out the module for Hazel",
   "p": "p8",
   "lane": "release",
   "status": "backlog",
   "agent": "you",
   "by": [
    "t-fylz-qml",
    "t-fotoz-ut"
   ],
   "also": [
    "p9"
   ]
  },
  {
   "id": "t-tw-p12",
   "title": "Port the screen for Olive",
   "p": "p15",
   "lane": "build",
   "status": "ready",
   "agent": "claude-sonnet"
  },
  {
   "id": "t-ebbflow",
   "title": "Tune the model for Sorbus",
   "p": "p19",
   "lane": "build",
   "status": "backlog",
   "agent": "claude-opus",
   "by": [
    "g-mw75"
   ]
  },
  {
   "id": "t-signal",
   "title": "Write the brief for Ginkgo 2",
   "p": "p35",
   "lane": "build",
   "status": "backlog",
   "agent": "claude-sonnet",
   "by": [
    "g-mw75"
   ]
  },
  {
   "id": "t-eegpath",
   "title": "Fix the build for Rowan",
   "p": "p18",
   "lane": "research",
   "status": "ready",
   "agent": "you",
   "stalled": "5 wk",
   "real": true
  },
  {
   "id": "t-index",
   "title": "Review the draft for Ginkgo 2",
   "p": "p35",
   "lane": "build",
   "status": "doing",
   "agent": "claude-opus"
  },
  {
   "id": "t-projects",
   "title": "Ship the beta for Ginkgo 2",
   "p": "p35",
   "lane": "build",
   "status": "ready",
   "agent": "claude-sonnet"
  },
  {
   "id": "t-nudge",
   "title": "Measure the baseline for Ginkgo 2",
   "p": "p35",
   "lane": "build",
   "status": "backlog",
   "agent": "claude-sonnet",
   "by": [
    "t-projects"
   ]
  },
  {
   "id": "t-chakra",
   "title": "Answer the reviewers for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "backlog",
   "agent": "you",
   "by": [
    "g-a1"
   ],
   "slipped": "from August",
   "real": true
  },
  {
   "id": "t-preprint",
   "title": "Record the demo for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "backlog",
   "agent": "you",
   "by": [
    "t-chakra",
    "g-endorse"
   ],
   "plan": true
  },
  {
   "id": "t-noema",
   "title": "Carve out the module for Birch 2",
   "p": "p30",
   "lane": "publish",
   "status": "backlog",
   "agent": "you",
   "by": [
    "g-a1"
   ],
   "plan": true
  },
  {
   "id": "t-pudding",
   "title": "Port the screen for Birch 2",
   "p": "p30",
   "lane": "publish",
   "status": "backlog",
   "agent": "you",
   "plan": true
  },
  {
   "id": "t-oii-prop",
   "title": "Tune the model for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "ready",
   "agent": "you"
  },
  {
   "id": "t-oii-ps",
   "title": "Write the brief for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "backlog",
   "agent": "you"
  },
  {
   "id": "t-oii-work",
   "title": "Fix the build for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "backlog",
   "agent": "you"
  },
  {
   "id": "t-dis",
   "title": "Review the draft for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "backlog",
   "agent": "you",
   "plan": true
  },
  {
   "id": "t-chi",
   "title": "Ship the beta for Birch 2",
   "p": "p30",
   "lane": "research",
   "status": "backlog",
   "agent": "you",
   "by": [
    "t-preprint"
   ],
   "plan": true
  },
  {
   "id": "t-so1",
   "title": "Measure the baseline for Walnut",
   "p": "p23",
   "lane": "publish",
   "status": "review",
   "agent": "you",
   "plan": true
  },
  {
   "id": "t-m1",
   "title": "Answer the reviewers for Walnut",
   "p": "p23",
   "lane": "publish",
   "status": "ready",
   "agent": "you",
   "plan": true
  },
  {
   "id": "t-deco",
   "title": "Record the demo for Damson 2",
   "p": "p32",
   "lane": "release",
   "status": "backlog",
   "agent": "you",
   "by": [
    "g-glyphs"
   ]
  },
  {
   "id": "t-watch-prod",
   "title": "Carve out the module for Aspen",
   "p": "p26",
   "lane": "release",
   "status": "backlog",
   "agent": "you",
   "by": [
    "g-wear"
   ],
   "plan": true
  },
  {
   "id": "d-asoc",
   "title": "Port the screen for Hazel 2",
   "p": "p36",
   "lane": "publish",
   "status": "done",
   "agent": "you",
   "real": true,
   "at": "2026-09-29"
  },
  {
   "id": "d-tw",
   "title": "Tune the model for Olive",
   "p": "p15",
   "lane": "build",
   "status": "done",
   "agent": "you",
   "real": true,
   "at": "2026-09-26"
  },
  {
   "id": "d-fotoz",
   "title": "Write the brief for Ilex",
   "p": "p9",
   "lane": "build",
   "status": "done",
   "agent": "you",
   "real": true,
   "at": "2026-09-24"
  },
  {
   "id": "d-fylz-ops",
   "title": "Fix the build for Hazel",
   "p": "p8",
   "lane": "build",
   "status": "done",
   "agent": "claude-sonnet",
   "real": true,
   "at": "2026-09-30"
  },
  {
   "id": "d-fotoz-c",
   "title": "Review the draft for Ilex",
   "p": "p9",
   "lane": "build",
   "status": "done",
   "agent": "claude-sonnet",
   "real": true,
   "at": "2026-09-30"
  },
  {
   "id": "d-launch",
   "title": "Ship the beta for Walnut",
   "p": "p23",
   "lane": "release",
   "status": "done",
   "agent": "you",
   "real": true,
   "at": "2026-10-05",
   "also": [
    "p10",
    "p11"
   ]
  }
 ],
 "schedule": [
  {
   "id": "s-oii",
   "title": "Deadline 1",
   "lane": "research",
   "at": "2027-01-07T12:00:00Z",
   "hard": true,
   "committed": true,
   "p": "p30",
   "where": "Somewhere",
   "ladder": [
    42,
    28,
    14,
    7,
    3,
    2,
    1
   ],
   "early": 2,
   "plan": true,
   "send": [
    [
     "Research proposal, 2,500 words",
     "t-oii-prop"
    ],
    [
     "Personal statement, 500 words",
     "t-oii-ps"
    ],
    [
     "Written work, 2,000 words",
     "t-oii-work"
    ],
    [
     "Three referees confirmed",
     "g-refs"
    ],
    [
     "Official transcripts",
     null
    ],
    [
     "Fee, £20",
     null
    ]
   ],
   "by": [
    "t-oii-prop",
    "t-oii-ps",
    "t-oii-work",
    "g-refs"
   ],
   "note": "What this date is for."
  },
  {
   "id": "s-dis-a",
   "title": "Deadline 2",
   "lane": "research",
   "at": "2027-01-12T11:59:00Z",
   "hard": true,
   "committed": true,
   "p": "p30",
   "where": "Somewhere",
   "ladder": [
    21,
    7,
    2
   ],
   "plan": true,
   "send": [
    [
     "Title and abstract",
     "t-dis"
    ]
   ],
   "by": [
    "t-dis"
   ]
  },
  {
   "id": "s-dis-f",
   "title": "Deadline 3",
   "lane": "research",
   "at": "2027-01-19T11:59:00Z",
   "hard": true,
   "committed": true,
   "p": "p30",
   "where": "Somewhere",
   "ladder": [
    7,
    2
   ],
   "plan": true,
   "send": [
    [
     "Pictorial, 12 pages at most",
     "t-dis"
    ]
   ],
   "by": [
    "s-dis-a"
   ]
  },
  {
   "id": "s-chi",
   "title": "Deadline 4",
   "lane": "research",
   "at": "2027-01-22T11:59:00Z",
   "hard": true,
   "committed": true,
   "p": "p30",
   "where": "Somewhere",
   "ladder": [
    14,
    7,
    2
   ],
   "plan": true,
   "send": [
    [
     "Poster paper, 4 pages",
     "t-chi"
    ]
   ],
   "by": [
    "t-chi"
   ]
  },
  {
   "id": "s-iui",
   "title": "Deadline 5",
   "lane": "research",
   "at": "2026-11-10T11:59:00Z",
   "hard": true,
   "committed": false,
   "p": "p1",
   "where": "Somewhere",
   "ladder": [
    7
   ],
   "plan": true
  },
  {
   "id": "s-chakra",
   "title": "Milestone 6",
   "lane": "research",
   "at": "2026-10-23T12:30:00Z",
   "p": "p30",
   "ladder": [
    7,
    2
   ],
   "plan": true,
   "by": [
    "t-chakra"
   ]
  },
  {
   "id": "s-preprint",
   "title": "Milestone 7",
   "lane": "research",
   "at": "2026-11-19T12:30:00Z",
   "p": "p30",
   "ladder": [
    7,
    2
   ],
   "plan": true,
   "by": [
    "t-preprint"
   ],
   "note": "What this date is for."
  },
  {
   "id": "s-reveal",
   "title": "Milestone 8",
   "lane": "publish",
   "at": "2026-10-12T02:30:00Z",
   "p": "p1",
   "ladder": [
    2,
    1
   ],
   "plan": true,
   "send": [
    [
     "Code and spec public and findable",
     "g-spec"
    ],
    [
     "The post, link in the first comment",
     "t-reveal"
    ]
   ],
   "by": [
    "g-spec",
    "t-reveal"
   ]
  },
  {
   "id": "s-noema",
   "title": "Milestone 9",
   "lane": "publish",
   "at": "2026-11-30T04:30:00Z",
   "p": "p30",
   "ladder": [
    14,
    7,
    2
   ],
   "plan": true,
   "where": "Somewhere",
   "send": [
    [
     "Full draft, about 3,500 words",
     "t-noema"
    ]
   ],
   "by": [
    "t-noema"
   ]
  },
  {
   "id": "s-pudding",
   "title": "Milestone 10",
   "lane": "publish",
   "at": "2026-10-30T04:30:00Z",
   "p": "p30",
   "ladder": [
    2
   ],
   "plan": true,
   "by": [
    "t-pudding"
   ]
  },
  {
   "id": "r-so1",
   "title": "Milestone 11",
   "lane": "publish",
   "at": "2026-10-08T04:30:00Z",
   "p": "p23",
   "minor": "S",
   "plan": true,
   "by": [
    "t-so1"
   ],
   "ladder": [
    1
   ]
  },
  {
   "id": "r-m1",
   "title": "Milestone 12",
   "lane": "publish",
   "at": "2026-10-13T04:30:00Z",
   "p": "p23",
   "minor": "M",
   "plan": true,
   "by": [
    "t-m1"
   ],
   "ladder": [
    1
   ]
  },
  {
   "id": "r-so2",
   "title": "Milestone 13",
   "lane": "publish",
   "at": "2026-10-22T04:30:00Z",
   "p": "p1",
   "minor": "S",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-m2",
   "title": "Milestone 14",
   "lane": "publish",
   "at": "2026-10-27T04:30:00Z",
   "p": "p2",
   "minor": "M",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-n1",
   "title": "Milestone 15",
   "lane": "publish",
   "at": "2026-10-29T02:30:00Z",
   "p": "p30",
   "minor": "N",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-so3",
   "title": "Milestone 16",
   "lane": "publish",
   "at": "2026-11-05T04:30:00Z",
   "p": "p10",
   "minor": "S",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-m3",
   "title": "Milestone 17",
   "lane": "publish",
   "at": "2026-11-10T04:30:00Z",
   "p": "p32",
   "minor": "M",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-so4",
   "title": "Milestone 18",
   "lane": "publish",
   "at": "2026-11-19T04:30:00Z",
   "p": "p1",
   "minor": "S",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-m4",
   "title": "Milestone 19",
   "lane": "publish",
   "at": "2026-11-24T04:30:00Z",
   "p": "p1",
   "minor": "M",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-n2",
   "title": "Milestone 20",
   "lane": "publish",
   "at": "2026-11-26T02:30:00Z",
   "p": "p8",
   "minor": "N",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-so5",
   "title": "Milestone 21",
   "lane": "publish",
   "at": "2026-12-03T04:30:00Z",
   "p": "p3",
   "minor": "S",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-m5",
   "title": "Milestone 22",
   "lane": "publish",
   "at": "2026-12-08T04:30:00Z",
   "p": "p23",
   "minor": "M",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-so6",
   "title": "Milestone 23",
   "lane": "publish",
   "at": "2026-12-17T04:30:00Z",
   "p": "p35",
   "minor": "S",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-n3",
   "title": "Milestone 24",
   "lane": "publish",
   "at": "2026-12-17T02:30:00Z",
   "p": "p35",
   "minor": "N",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "r-m6",
   "title": "Milestone 25",
   "lane": "publish",
   "at": "2026-12-22T04:30:00Z",
   "p": "p35",
   "minor": "M",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "s-featuring",
   "title": "Milestone 26",
   "lane": "release",
   "at": "2026-10-09T06:30:00Z",
   "p": "p23",
   "plan": true,
   "ladder": [
    1
   ]
  },
  {
   "id": "s-fapp",
   "title": "Milestone 27",
   "lane": "release",
   "at": "2026-10-16T12:30:00Z",
   "p": "p36",
   "plan": true,
   "ladder": [
    3
   ],
   "by": [
    "t-fapp"
   ]
  },
  {
   "id": "s-wear-track",
   "title": "Milestone 28",
   "lane": "release",
   "at": "2026-10-15T06:30:00Z",
   "p": "p26",
   "plan": true,
   "ladder": [
    2
   ],
   "by": [
    "g-wear"
   ]
  },
  {
   "id": "s-fdev",
   "title": "Milestone 29",
   "lane": "release",
   "at": "2026-10-23T12:30:00Z",
   "p": "p36",
   "plan": true,
   "ladder": [
    3
   ],
   "by": [
    "t-fdev"
   ]
  },
  {
   "id": "s-wear-prod",
   "title": "Milestone 30",
   "lane": "release",
   "at": "2026-10-30T06:30:00Z",
   "p": "p26",
   "plan": true,
   "ladder": [
    7,
    1
   ],
   "note": "What this date is for.",
   "by": [
    "s-wear-track",
    "t-watch-prod"
   ]
  },
  {
   "id": "s-asocdev",
   "title": "Milestone 31",
   "lane": "release",
   "at": "2026-10-30T12:30:00Z",
   "p": "p36",
   "plan": true,
   "ladder": [
    3
   ],
   "by": [
    "t-asocdev"
   ]
  },
  {
   "id": "s-deco",
   "title": "Milestone 32",
   "lane": "release",
   "at": "2026-12-15T12:30:00Z",
   "p": "p32",
   "ladder": [
    7
   ],
   "by": [
    "t-deco"
   ]
  }
 ],
 "pulse": {
  "days": [
   1,
   3,
   5
  ],
  "hourIst": 8,
  "from": "2026-10-07",
  "to": "2026-12-21",
  "off": [
   "2026-11-06"
  ],
  "lightFrom": "2026-12-21"
 },
 "undated": [
  [
   "A launch on its own clock",
   "Undated on purpose.",
   "p1"
  ]
 ],
 "sprint": {
  "from": "2026-10-06",
  "to": "2026-12-31",
  "label": "A sprint, about twelve hours a week"
 },
 "pages": {},
 "repoOwner": "mbaliga",
 "aliases": {},
 "ambitions": {
  "p1": "What Alder is for, in a sentence or two, as the owner wrote it.",
  "p2": "What Birch is for, in a sentence or two, as the owner wrote it.",
  "p3": "What Cedar is for, in a sentence or two, as the owner wrote it.",
  "p4": "What Damson is for, in a sentence or two, as the owner wrote it.",
  "p5": "What Elder is for, in a sentence or two, as the owner wrote it.",
  "p6": "What Fig is for, in a sentence or two, as the owner wrote it.",
  "p8": "What Hazel is for, in a sentence or two, as the owner wrote it.",
  "p9": "What Ilex is for, in a sentence or two, as the owner wrote it.",
  "p10": "What Juniper is for, in a sentence or two, as the owner wrote it.",
  "p11": "What Katsura is for, in a sentence or two, as the owner wrote it.",
  "p12": "What Larch is for, in a sentence or two, as the owner wrote it.",
  "p14": "What Nutmeg is for, in a sentence or two, as the owner wrote it.",
  "p15": "What Olive is for, in a sentence or two, as the owner wrote it.",
  "p16": "What Pine is for, in a sentence or two, as the owner wrote it.",
  "p17": "What Quince is for, in a sentence or two, as the owner wrote it.",
  "p18": "What Rowan is for, in a sentence or two, as the owner wrote it.",
  "p19": "What Sorbus is for, in a sentence or two, as the owner wrote it.",
  "p20": "What Tamarind is for, in a sentence or two, as the owner wrote it.",
  "p21": "What Umbrella is for, in a sentence or two, as the owner wrote it.",
  "p22": "What Vine is for, in a sentence or two, as the owner wrote it.",
  "p23": "What Walnut is for, in a sentence or two, as the owner wrote it.",
  "p24": "What Yew is for, in a sentence or two, as the owner wrote it.",
  "p26": "What Aspen is for, in a sentence or two, as the owner wrote it.",
  "p27": "What Beech is for, in a sentence or two, as the owner wrote it.",
  "p28": "What Cypress is for, in a sentence or two, as the owner wrote it.",
  "p30": "What Birch 2 is for, in a sentence or two, as the owner wrote it.",
  "p31": "What Cedar 2 is for, in a sentence or two, as the owner wrote it.",
  "p32": "What Damson 2 is for, in a sentence or two, as the owner wrote it.",
  "p33": "What Elder 2 is for, in a sentence or two, as the owner wrote it.",
  "p35": "What Ginkgo 2 is for, in a sentence or two, as the owner wrote it.",
  "p36": "What Hazel 2 is for, in a sentence or two, as the owner wrote it.",
  "p37": "What Ilex 2 is for, in a sentence or two, as the owner wrote it.",
  "p7": "What Ginkgo is for, in a sentence or two, as the owner wrote it."
 },
 "earlier": "Three apps went live earlier this year",
 "chains": [
  "s-reveal",
  "s-oii",
  "s-chi",
  "s-wear-prod",
  "t-unlock",
  "t-inrts",
  "t-signal",
  "s-deco",
  "t-ebbflow",
  "t-preprint"
 ],
 "notes": [
  {
   "id": "n1",
   "text": "A thought about , kept at the hour it came.",
   "tag": "protocol",
   "pin": true,
   "at": "2026-09-28"
  },
  {
   "id": "n2",
   "text": "A thought about , kept at the hour it came.",
   "tag": "hyle",
   "pin": true,
   "at": "2026-10-05"
  },
  {
   "id": "n3",
   "text": "A thought about , kept at the hour it came.",
   "tag": "camera",
   "pin": true,
   "at": "2026-09-24"
  },
  {
   "id": "n4",
   "text": "A thought about , kept at the hour it came.",
   "tag": "hyle",
   "at": "2026-10-06"
  },
  {
   "id": "n5",
   "text": "A thought about , kept at the hour it came.",
   "tag": "idea",
   "at": "2026-09-21"
  },
  {
   "id": "n6",
   "text": "A thought about , kept at the hour it came.",
   "tag": "car",
   "at": "2026-09-27"
  },
  {
   "id": "n7",
   "text": "A thought about , kept at the hour it came.",
   "tag": "runout",
   "at": "2026-08-09"
  },
  {
   "id": "n8",
   "text": "A thought about , kept at the hour it came.",
   "tag": "wallpapers",
   "at": "2026-09-06"
  },
  {
   "id": "n9",
   "text": "A thought about , kept at the hour it came.",
   "tag": "idea",
   "at": "2026-07-02"
  }
 ],
 "completion": [
  {
   "p": "p1",
   "label": "Launch checklist",
   "v": 0.74
  },
  {
   "p": "p15",
   "label": "Phase 11 of 16",
   "v": 0.69
  },
  {
   "p": "p8",
   "label": "Milestone 13 of 19",
   "v": 0.68
  },
  {
   "p": "p9",
   "label": "Work package 8 of 13",
   "v": 0.61
  },
  {
   "p": "p14",
   "label": "MVP",
   "v": 0.46
  },
  {
   "p": "p30",
   "label": "Sprint 4 of 9",
   "v": 0.44
  }
 ],
 "throughput": {
  "opened": [
   9,
   12,
   7,
   14,
   11,
   16,
   9,
   12
  ],
  "closed": [
   6,
   9,
   8,
   11,
   12,
   13,
   10,
   11
  ],
  "cycleDays": 3.4
 },
 "sounds": [
  {
   "id": "brown",
   "name": "A sound",
   "kind": "gen",
   "median": 41,
   "n": 9
  },
  {
   "id": "rain",
   "name": "A sound",
   "kind": "gen",
   "median": 36,
   "n": 6
  },
  {
   "id": "drone",
   "name": "A sound",
   "kind": "gen",
   "median": 33,
   "n": 5
  },
  {
   "id": "pink",
   "name": "A sound",
   "kind": "gen",
   "median": 30,
   "n": 4
  },
  {
   "id": "none",
   "name": "A sound",
   "kind": "none",
   "median": 27,
   "n": 8
  }
 ],
 "blocks": [
  [
   9.6,
   46
  ],
  [
   11.2,
   52
  ],
  [
   14.4,
   38
  ],
  [
   20.9,
   48
  ],
  [
   22,
   44
  ]
 ],
 "agentRoles": {
  "you": "design, decisions, device checks",
  "claude-sonnet": "builder",
  "claude-opus": "architect, builder",
  "claude-fable": "builder, reviewer",
  "claude-other": "builder",
  "codex": "builder",
  "named": "orch, builder, river build"
 }
};
