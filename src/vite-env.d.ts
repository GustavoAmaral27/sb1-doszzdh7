/// <reference types="vite/client" />

// Ponte do claude.ai quando o app roda publicado como Artifact (ausente em outros hosts).
interface ClaudeDocSnap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
}
interface ClaudeDocRef {
  set(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  onSnapshot(next: (snap: ClaudeDocSnap) => void, error?: (e: { code: string }) => void): () => void
}
interface ClaudeCollectionRef {
  doc(id: string): ClaudeDocRef
  onSnapshot(next: (snap: { docs: ClaudeDocSnap[] }) => void, error?: (e: { code: string }) => void): () => void
}
interface ClaudeDb {
  doc(path: string): ClaudeDocRef
  collection(path: string): ClaudeCollectionRef
}
interface ClaudeDownloads {
  save(req: { filename: string; data: string }): Promise<{ status: string }>
}
interface Window {
  claude?: {
    use(name: 'db'): Promise<ClaudeDb | null>
    use(name: 'downloads'): Promise<ClaudeDownloads | null>
  }
}
