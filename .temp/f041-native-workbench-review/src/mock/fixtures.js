const sketchPages = [
  { id: "page-brief", name: "Launch brief", elements: [] },
  { id: "page-flow", name: "Customer flow", elements: [] },
  { id: "page-risks", name: "Risk map", elements: [] },
];

const cameras = [
  { id: "camera-overview", name: "Overview", pageId: "page-brief", x: 0, y: 0, zoom: 1 },
  { id: "camera-flow", name: "Flow detail", pageId: "page-flow", x: 120, y: 80, zoom: 1.2 },
];

export const baselineFixtures = {
  workspaces: [
    {
      id: "ws-product",
      name: "Product Studio",
      path: "/Mock/Workspaces/Product Studio",
      expanded: true,
      entries: [
        {
          id: "dir-planning",
          kind: "directory",
          name: "Planning",
          path: "Planning",
          children: [
            {
              id: "file-launch",
              kind: "file",
              name: "launch-plan.is",
              path: "Planning/launch-plan.is",
              type: "ideasketch",
              content: { pages: sketchPages, cameras, activePageId: "page-brief" },
            },
            {
              id: "file-brief",
              kind: "file",
              name: "product-brief.md",
              path: "Planning/product-brief.md",
              type: "markdown",
              content: "# Product brief\n\n## Goal\nBuild a calm workspace for structured thinking.\n\n## Current decisions\n- Workspace stays left\n- The editor owns the center\n- Agent stays independent on the right\n\n## Review questions\n1. Is the document status visible enough?\n2. Does Agent feel attached without taking over?\n",
            },
          ],
        },
        {
          id: "dir-research",
          kind: "directory",
          name: "Research",
          path: "Research",
          children: [
            {
              id: "file-notes",
              kind: "file",
              name: "field-notes.md",
              path: "Research/field-notes.md",
              type: "markdown",
              lineEnding: "mixed",
              content: "# Field notes\r\n\r\n## Workspace observation\nThe outer frame should disappear when attention moves into the document.\n\n## Agent observation\nShow public activity and tool results, not hidden reasoning.\r\n",
            },
          ],
        },
        {
          id: "dir-archive",
          kind: "directory",
          name: "Archive",
          path: "Archive",
          children: [],
        },
        {
          id: "dir-hidden",
          kind: "directory",
          name: ".ideanote",
          path: ".ideanote",
          hidden: true,
          children: [],
        },
        {
          id: "file-unsupported",
          kind: "file",
          name: "source-data.csv",
          path: "source-data.csv",
          type: "unsupported",
          hidden: true,
          content: "name,status\nAtlas,active",
        },
      ],
    },
    {
      id: "ws-research",
      name: "Research Library",
      path: "/Mock/Workspaces/Research Library",
      expanded: false,
      entries: [
        {
          id: "file-synthesis",
          kind: "file",
          name: "synthesis.md",
          path: "synthesis.md",
          type: "markdown",
          content: "# Research synthesis\n\nA workspace shell should feel structural, not branded.\n",
        },
      ],
    },
    {
      id: "ws-operations",
      name: "Operations Hub",
      path: "/Mock/Workspaces/Operations Hub",
      expanded: false,
      entries: [
        {
          id: "file-runbook",
          kind: "file",
          name: "launch-runbook.md",
          path: "launch-runbook.md",
          type: "markdown",
          content: "# Launch runbook\n\nCoordinate release operations from one shared workspace.\n",
        },
      ],
    },
  ],
  standalone: [
    {
      id: "standalone-notes",
      name: "personal-notes.md",
      path: "/Mock/Documents/personal-notes.md",
      type: "markdown",
      content: "# Personal notes\n\nStandalone files share the same editor and save lifecycle.\n",
    },
    {
      id: "standalone-unsupported",
      name: "dataset.csv",
      path: "/Mock/Documents/dataset.csv",
      type: "unsupported",
      content: "id,value\n1,42",
    },
  ],
  recents: [
    { id: "recent-personal", kind: "standalone", standaloneId: "standalone-notes", label: "personal-notes.md", detail: "Single File · yesterday" },
    { id: "recent-dataset", kind: "standalone", standaloneId: "standalone-unsupported", label: "dataset.csv", detail: "Single File · Monday" },
  ],
  recovery: {},
};

export function cloneFixtures() {
  return structuredClone(baselineFixtures);
}
