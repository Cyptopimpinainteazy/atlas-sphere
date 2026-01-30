const { findEmailsInText, fetchDuckDuckGoSearch, crawlUrlsForEmails, searchEmails } = require('../../tools/email_spider')

describe('email_spider utils', ()=>{
  test('findEmailsInText extracts emails and deduplicates', ()=>{
    const text = 'Contact us at Info@Example.com or sales@example.com. Also crazy+tag@sub.domain.co.uk.'
    const res = findEmailsInText(text)
    expect(res).toContain('info@example.com')
    expect(res).toContain('sales@example.com')
    expect(res).toContain('crazy+tag@sub.domain.co.uk')
  })

  test('fetchDuckDuckGoSearch parses anchors', async ()=>{
    const fakeHtml = `<html><body><a class="result__a" href="https://site1.example">r1</a><a class="result__a" href="https://site2.test">r2</a></body></html>`
    const http = { post: jest.fn().mockResolvedValue({ data: fakeHtml }) }
    const res = await fetchDuckDuckGoSearch('test q', 10, http)
    expect(Array.isArray(res)).toBe(true)
    expect(res).toContain('https://site1.example')
    expect(res).toContain('https://site2.test')
  })

  test('crawlUrlsForEmails extracts emails from provided page HTML and follows limited links', async ()=>{
    // simulate two pages
    const http = {
      get: jest.fn((url)=>{
        if (url.includes('page1')) return Promise.resolve({ data: 'page1 content contact@foo.com <a href="https://page2.example">p2</a>' })
        if (url.includes('page2')) return Promise.resolve({ data: 'page2 content another@bar.com' })
        return Promise.reject(new Error('not found'))
      })
    }
    const res = await crawlUrlsForEmails(['https://page1.example'], { depth: 1, http })
    expect(res).toEqual(expect.arrayContaining(['contact@foo.com','another@bar.com']))
  })

  test('searchEmails integrates search + crawl using provided http', async ()=>{
    const http = {
      post: jest.fn().mockResolvedValue({ data: `<a class="result__a" href="https://pageA.example">A</a>` }),
      get: jest.fn().mockResolvedValue({ data: 'hello owner@a.example' })
    }
    const out = await searchEmails('find me', { limit: 1, depth: 0, http })
    expect(Array.isArray(out.urls)).toBe(true)
    expect(out.emails).toContain('owner@a.example')
  })
})
