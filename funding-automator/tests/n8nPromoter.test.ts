import { N8nPromoter } from '../src/promoters/n8nPromoter'
import { renderTemplate } from '../src/templates/template'

describe('N8nPromoter', () => {
  test('buildPayload contains project and prospect info', () => {
    const p = new N8nPromoter({ project: 'Dual-blockchain SVM/EVM' })
    const payload = p.buildPayload({ name: 'Test Fund', description: 'Grants' })
    expect(payload.project).toBe('Dual-blockchain SVM/EVM')
    expect(payload.prospect.name).toBe('Test Fund')
    expect(payload.trigger).toBe('promote')
  })

  test('renderTemplate replaces variables', () => {
    const out = renderTemplate('intro', { project: 'MyProject' })
    expect(out).toContain('MyProject')
  })
})
