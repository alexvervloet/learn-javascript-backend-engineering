# Web Framework Advanced — Frontend

React UI that pairs with the [advanced Express backend](../../backends/learning/web-framework-tutorial/advanced/).

Same sidebar-driven reference layout as `web-framework-tutorial`, focused on advanced Express patterns (streaming, SSE, custom responses, basic auth, sub-apps, WebSockets, settings, pagination).

## Stack

React + Vite (JSX, no TypeScript)

## Structure

```
src/
  App.tsx           — sidebar + topic panel layout
  main.tsx          — React entry point
  topics.ts         — advanced topic data
  groups.json       — sidebar grouping/ordering
  components/
    Sidebar.jsx     — topic navigation list
    TopicPanel.jsx  — detail view for the selected topic
```

## Setup

```bash
npm install
npm run dev
```

App runs at http://localhost:5173. Start the backend (`node advanced/server.js`, http://localhost:8001) so the playground has an API to call.
