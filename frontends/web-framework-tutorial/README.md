# Web Framework Tutorial — Frontend

React UI that pairs with the [web-framework-tutorial backend](../../backends/learning/web-framework-tutorial/tutorial/).

A sidebar-driven reference app: browse Express topics on the left, see details and examples on the right.

## Stack

React + Vite (JSX, no TypeScript)

## Structure

```
src/
  App.tsx           — sidebar + topic panel layout
  main.tsx          — React entry point
  topics.ts         — topic data (titles, descriptions, code examples)
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

App runs at http://localhost:5173. Start the backend (`node tutorial/server.js`, http://localhost:8000) so the playground has an API to call.
