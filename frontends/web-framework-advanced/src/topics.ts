import GROUPS from './groups.json' with { type: 'json' }

// The shape of groups.json, written out once and shared by every component.
//
// TypeScript can infer a type from an imported JSON file, but the inference is
// structural and very literal: `method` would come out as the exact strings in
// the file rather than as the HTTP-method union, and an optional field missing
// from the first entry would be missing from the type. Declaring the shape says
// what the data means, and the cast below is where that claim is made.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type FieldType = 'text' | 'number' | 'json' | 'select' | 'file'

export interface EndpointField {
  name: string
  type: FieldType
  in?: string
  options?: string[]
  placeholder?: string
  required?: boolean
}

export interface Endpoint {
  label: string
  // A WebSocket endpoint has no HTTP method, which is why this is optional
  // here but required in the tutorial app's copy of this file.
  method?: HttpMethod
  path: string
  ws?: boolean
  // false on /ws/counter, which streams without accepting input. Absent
  // elsewhere, so the send box shows unless a topic opts out.
  sendMessages?: boolean
  fields?: EndpointField[]
  note?: string
  streaming?: boolean
}

export interface ExternalLink {
  label: string
  href: string
}

export interface Topic {
  id: string
  number: string
  title: string
  description: string
  docPath: string
  endpoints: Endpoint[]
  externalLinks?: ExternalLink[]
  note?: string
}

export interface Group {
  id: string
  label: string
  topics: Topic[]
}

// This pattern is to allow hot reloading of the groups.json file, which is useful during development.
// In production, this will be optimized by the bundler.
const TYPED_GROUPS = GROUPS as unknown as Group[]

export { TYPED_GROUPS as GROUPS }
export const BASE_URL = 'http://localhost:8001'
export const WS_BASE_URL = 'ws://localhost:8001'
export const ALL_TOPICS: Topic[] = TYPED_GROUPS.flatMap((g) => g.topics)
