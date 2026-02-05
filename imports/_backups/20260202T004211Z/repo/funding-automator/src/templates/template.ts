<<<<<<< REPO
const TEMPLATES: Record<string, string> = {
  intro: `Hi —\n\nI'm building a project called {{project}} that connects SVM and EVM chains to simplify cross-chain compatibility. We're exploring funding and partnership opportunities and would love to share a one-pager or set up a short call.\n\nBest,\nFounding team`,
  short: `{{name}} — quick note about {{project}}. Can we schedule 15 minutes?`
}

export function renderTemplate (id: string, vars: Record<string, string>) {
  const tpl = TEMPLATES[id]
  if (!tpl) throw new Error('Unknown template: ' + id)
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp('{{' + k + '}}', 'g'), v), tpl)
}

=======
const TEMPLATES: Record<string, string> = {
  intro: `Hi —\n\nI'm building a project called {{project}} that connects SVM and EVM chains to simplify cross-chain compatibility. We're exploring funding and partnership opportunities and would love to share a one-pager or set up a short call.\n\nBest,\nFounding team`,
  short: `{{name}} — quick note about {{project}}. Can we schedule 15 minutes?`
}

export function renderTemplate (id: string, vars: Record<string, string>) {
  const tpl = TEMPLATES[id]
  if (!tpl) throw new Error('Unknown template: ' + id)
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp('{{' + k + '}}', 'g'), v), tpl)
}

>>>>>>> IMPORT (TEXT)
