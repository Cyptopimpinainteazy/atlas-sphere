import { personalizeMessage } from '../src/personalize/personalize'

test('personalizeMessage returns local fallback text when no API key', async () => {
  const out = await personalizeMessage('Hello {{name}}, we build {{project}}', { name: 'Ally', role: 'Investor' })
  expect(out).toMatch(/PERSONALIZED \(local\):/)
})
