import ApiPlayground from './ApiPlayground.tsx'
import type { Topic } from '../topics.ts'

interface TopicPanelProps {
  topic: Topic | null
}

export default function TopicPanel({ topic }: TopicPanelProps) {
  if (!topic) {
    return (
      <main className="main-panel">
        <div className="empty-state">
          <div className="empty-logo">⚡</div>
          <div className="empty-title">Express Tutorial Playground</div>
          <div className="empty-subtitle">
            Select a topic from the sidebar to start exploring the Express tutorial concepts interactively.
          </div>
        </div>
      </main>
    )
  }

  const docUrl = topic.docPath

  return (
    <main className="main-panel">
      <div className="topic-header">
        <div className="topic-number">Chapter {topic.number}</div>
        <h1 className="topic-title">{topic.title}</h1>
        <p className="topic-description">{topic.description}</p>
        <a
          className="topic-doc-link"
          href={docUrl}
          target="_blank"
          rel="noreferrer"
        >
          📖 Official docs ↗
        </a>
      </div>

      {topic.externalLinks && (
        <div className="info-card">
          <strong>Quick links:</strong>
          <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {topic.externalLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent)', fontSize: 13 }}
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {topic.endpoints.map((endpoint, i) => (
        <ApiPlayground key={i} endpoint={endpoint} />
      ))}
    </main>
  )
}
