import { useState } from 'react'
import { GROUPS } from '../topics.ts'
import type { HttpMethod, Topic } from '../topics.ts'

// Record<HttpMethod, string> ties the palette to the method union: add a
// method to the union and this stops compiling until it has a colour.
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#3fb950', POST: '#58a6ff', PUT: '#d29922',
  PATCH: '#bc8cff', DELETE: '#f85149',
}

interface SidebarProps {
  activeTopic: Topic | null
  onSelect: (topic: Topic) => void
}

export default function Sidebar({ activeTopic, onSelect }: SidebarProps) {
  // Keyed by group id; an empty object infers as {} and cannot be indexed.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggle(id: string) {
    setCollapsed(c => ({ ...c, [id]: !c[id] }))
  }

  return (
    <nav className="sidebar">
      {GROUPS.map(group => {
        const isOpen = !collapsed[group.id]
        return (
          <div key={group.id} className="sidebar-group">
            <div
              className="sidebar-group-header"
              onClick={() => toggle(group.id)}
            >
              {group.label}
              <span className={`sidebar-chevron ${isOpen ? 'open' : ''}`}>▶</span>
            </div>
            {isOpen && (
              <div className="sidebar-items">
                {group.topics.map(topic => {
                  const firstMethod = topic.endpoints[0]?.method ?? 'GET'
                  return (
                    <div
                      key={topic.id}
                      className={`sidebar-item ${activeTopic?.id === topic.id ? 'active' : ''}`}
                      onClick={() => onSelect(topic)}
                    >
                      <span
                        className="method-badge"
                        style={{
                          background: `${METHOD_COLORS[firstMethod]}22`,
                          color: METHOD_COLORS[firstMethod],
                        }}
                      >
                        {firstMethod}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {topic.number}. {topic.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
