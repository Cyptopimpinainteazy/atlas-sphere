<<<<<<< REPO
<<<<<<< REPO
const axios = require('axios')
// require cheerio lazily in functions to avoid runtime environment issues

// extract emails from text (simple but reasonable regex)
function findEmailsInText(text) {
  if (!text || typeof text !== 'string') return []
  // permissive email regex (avoid matching protocol strings)
  const re = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const found = new Set()
  let m
  while ((m = re.exec(text)) !== null) {
    // basic filter for likely false positives
    const email = m[1]
    if (email.length > 3 && email.split('@')[1].includes('.')) found.add(email.toLowerCase())
  }
  return Array.from(found)
}

async function fetchDuckDuckGoSearch(query, limit = 10, http = axios) {
  // Use ddg HTML endpoint which is more friendly to scraping than Google
  const url = 'https://html.duckduckgo.com/html/'
  const params = { q: query }
  const out = []
  try {
    const res = await http.post(url, new URLSearchParams(params).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 })
    if (typeof global.File === 'undefined') global.File = function () { }
    const cheerio = require('cheerio')
    const $ = cheerio.load(res.data || '')
    // results are in .result__a anchors
    $('a.result__a').each((i, el) => { if (out.length < limit) out.push($(el).attr('href')) })
  } catch (e) { /* network or parse error */ }
  return out
}

async function crawlUrlsForEmails(urls = [], { depth = 0, http = axios, maxPerSite = 5 } = {}) {
  const found = new Set()
  for (const u of urls.slice(0, 50)) {
    try {
      const r = await http.get(u, { timeout: 8000, headers: { 'User-Agent': 'email-spider/1.0' } })
      const text = (r.data || '')
      const emails = findEmailsInText(text)
      for (const e of emails.slice(0, maxPerSite)) found.add(e)
      // don't follow links for now unless depth > 0
      if (depth > 0) {
        if (typeof global.File === 'undefined') global.File = function () { }
        const cheerio = require('cheerio')
        const $ = cheerio.load(text)
        const links = []
        $('a[href]').each((i, el) => { if (links.length < 10) links.push($(el).attr('href')) })
        const resolved = links.map(h => (h && h.startsWith('http')) ? h : null).filter(Boolean)
        if (resolved.length) {
          const emails2 = await crawlUrlsForEmails(resolved.slice(0, 5), { depth: depth - 1, http, maxPerSite })
          emails2.forEach(e => found.add(e))
        }
      }
    } catch (e) { /* ignore fetch errors */ }
  }
  return Array.from(found)
}

// main helper: search term -> find emails by searching and crawling
async function searchEmails(query, opts = {}) {
  const { limit = 10, depth = 0, http = axios } = opts
  // if SERPAPI_KEY set in opts.httpConfig, could use real API here
  // fallback: DuckDuckGo HTML endpoints
  const urls = await fetchDuckDuckGoSearch(query, limit, http)
  const emails = await crawlUrlsForEmails(urls, { depth, http })
  return { query, urls, emails }
}

exports.findEmailsInText = findEmailsInText
exports.fetchDuckDuckGoSearch = fetchDuckDuckGoSearch
exports.crawlUrlsForEmails = crawlUrlsForEmails
exports.searchEmails = searchEmails

=======
const axios = require('axios')
// require cheerio lazily in functions to avoid runtime environment issues

// extract emails from text (simple but reasonable regex)
function findEmailsInText(text) {
  if (!text || typeof text !== 'string') return []
  // permissive email regex (avoid matching protocol strings)
  const re = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const found = new Set()
  let m
  while ((m = re.exec(text)) !== null) {
    // basic filter for likely false positives
    const email = m[1]
    if (email.length > 3 && email.split('@')[1].includes('.')) found.add(email.toLowerCase())
  }
  return Array.from(found)
}

async function fetchDuckDuckGoSearch(query, limit = 10, http = axios) {
  // Use ddg HTML endpoint which is more friendly to scraping than Google
  const url = 'https://html.duckduckgo.com/html/'
  const params = { q: query }
  const out = []
  try {
    const res = await http.post(url, new URLSearchParams(params).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 })
    if (typeof global.File === 'undefined') global.File = function () { }
    const cheerio = require('cheerio')
    const $ = cheerio.load(res.data || '')
    // results are in .result__a anchors
    $('a.result__a').each((i, el) => { if (out.length < limit) out.push($(el).attr('href')) })
  } catch (e) { /* network or parse error */ }
  return out
}

async function crawlUrlsForEmails(urls = [], { depth = 0, http = axios, maxPerSite = 5 } = {}) {
  const found = new Set()
  for (const u of urls.slice(0, 50)) {
    try {
      const r = await http.get(u, { timeout: 8000, headers: { 'User-Agent': 'email-spider/1.0' } })
      const text = (r.data || '')
      const emails = findEmailsInText(text)
      for (const e of emails.slice(0, maxPerSite)) found.add(e)
      // don't follow links for now unless depth > 0
      if (depth > 0) {
        if (typeof global.File === 'undefined') global.File = function () { }
        const cheerio = require('cheerio')
        const $ = cheerio.load(text)
        const links = []
        $('a[href]').each((i, el) => { if (links.length < 10) links.push($(el).attr('href')) })
        const resolved = links.map(h => (h && h.startsWith('http')) ? h : null).filter(Boolean)
        if (resolved.length) {
          const emails2 = await crawlUrlsForEmails(resolved.slice(0, 5), { depth: depth - 1, http, maxPerSite })
          emails2.forEach(e => found.add(e))
        }
      }
    } catch (e) { /* ignore fetch errors */ }
  }
  return Array.from(found)
}

// main helper: search term -> find emails by searching and crawling
async function searchEmails(query, opts = {}) {
  const { limit = 10, depth = 0, http = axios } = opts
  // if SERPAPI_KEY set in opts.httpConfig, could use real API here
  // fallback: DuckDuckGo HTML endpoints
  const urls = await fetchDuckDuckGoSearch(query, limit, http)
  const emails = await crawlUrlsForEmails(urls, { depth, http })
  return { query, urls, emails }
}

exports.findEmailsInText = findEmailsInText
exports.fetchDuckDuckGoSearch = fetchDuckDuckGoSearch
exports.crawlUrlsForEmails = crawlUrlsForEmails
exports.searchEmails = searchEmails

>>>>>>> IMPORT (TEXT)

=======
const axios = require('axios')
// require cheerio lazily in functions to avoid runtime environment issues

// extract emails from text (simple but reasonable regex)
function findEmailsInText(text) {
  if (!text || typeof text !== 'string') return []
  // permissive email regex (avoid matching protocol strings)
  const re = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const found = new Set()
  let m
  while ((m = re.exec(text)) !== null) {
    // basic filter for likely false positives
    const email = m[1]
    if (email.length > 3 && email.split('@')[1].includes('.')) found.add(email.toLowerCase())
  }
  return Array.from(found)
}

async function fetchDuckDuckGoSearch(query, limit = 10, http = axios) {
  // Use ddg HTML endpoint which is more friendly to scraping than Google
  const url = 'https://html.duckduckgo.com/html/'
  const params = { q: query }
  const out = []
  try {
    const res = await http.post(url, new URLSearchParams(params).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 })
    if (typeof global.File === 'undefined') global.File = function () { }
    const cheerio = require('cheerio')
    const $ = cheerio.load(res.data || '')
    // results are in .result__a anchors
    $('a.result__a').each((i, el) => { if (out.length < limit) out.push($(el).attr('href')) })
  } catch (e) { /* network or parse error */ }
  return out
}

async function crawlUrlsForEmails(urls = [], { depth = 0, http = axios, maxPerSite = 5 } = {}) {
  const found = new Set()
  for (const u of urls.slice(0, 50)) {
    try {
      const r = await http.get(u, { timeout: 8000, headers: { 'User-Agent': 'email-spider/1.0' } })
      const text = (r.data || '')
      const emails = findEmailsInText(text)
      for (const e of emails.slice(0, maxPerSite)) found.add(e)
      // don't follow links for now unless depth > 0
      if (depth > 0) {
        if (typeof global.File === 'undefined') global.File = function () { }
        const cheerio = require('cheerio')
        const $ = cheerio.load(text)
        const links = []
        $('a[href]').each((i, el) => { if (links.length < 10) links.push($(el).attr('href')) })
        const resolved = links.map(h => (h && h.startsWith('http')) ? h : null).filter(Boolean)
        if (resolved.length) {
          const emails2 = await crawlUrlsForEmails(resolved.slice(0, 5), { depth: depth - 1, http, maxPerSite })
          emails2.forEach(e => found.add(e))
        }
      }
    } catch (e) { /* ignore fetch errors */ }
  }
  return Array.from(found)
}

// main helper: search term -> find emails by searching and crawling
async function searchEmails(query, opts = {}) {
  const { limit = 10, depth = 0, http = axios } = opts
  // if SERPAPI_KEY set in opts.httpConfig, could use real API here
  // fallback: DuckDuckGo HTML endpoints
  const urls = await fetchDuckDuckGoSearch(query, limit, http)
  const emails = await crawlUrlsForEmails(urls, { depth, http })
  return { query, urls, emails }
}

exports.findEmailsInText = findEmailsInText
exports.fetchDuckDuckGoSearch = fetchDuckDuckGoSearch
exports.crawlUrlsForEmails = crawlUrlsForEmails
exports.searchEmails = searchEmails

>>>>>>> IMPORT (TEXT)
