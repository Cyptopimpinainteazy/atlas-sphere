export function buildDorkQueries (projectName: string) {
  // Safe helper that returns a set of possible queries to find grants,
  // accelerators and investor profiles. Use with a compliant search API.
  const qbase = projectName.replace(/\s+/g, '+')
  return [
    `${qbase}+venture+funding+grant+blockchain`,
    `${qbase}+crypto+grant+program`,
    `${qbase}+accelerator+blockchain+grant`,
    `${qbase}+angel+investor+blockchain+venture`
  ]
}
