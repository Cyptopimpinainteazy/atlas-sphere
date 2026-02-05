export type Prospect = {
  name: string
  description?: string
  contact?: string
}

export class N8nPromoter {
  project: string

  constructor (opts: { project: string }) {
    this.project = opts.project
  }

  buildPayload (prospect: Prospect) {
    return {
      trigger: 'promote',
      project: this.project,
      prospect: {
        name: prospect.name,
        description: prospect.description ?? null,
        contact: prospect.contact ?? null
      },
      createdAt: new Date().toISOString()
    }
  }

  // small helper to map an array of prospects into webhook payloads
  buildBatch (prospects: Prospect[]) {
    return prospects.map((p) => this.buildPayload(p))
  }
}
