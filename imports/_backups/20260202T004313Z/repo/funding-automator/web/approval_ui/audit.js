<<<<<<< REPO
<<<<<<< REPO
(async function () {
  const el = document.querySelector('#audit')
  const exportBtn = document.querySelector('#export')
  function toCSV(rows) {
    if (!rows || !rows.length) return ''
    const keys = Object.keys(rows[0])
    const lines = [keys.join(',')]
    for (const r of rows) {
      lines.push(keys.map(k => ('' + (r[k] || '')).replace(/"/g, '""')).map(v => `"${v.replace(/\"/g, '""')}"`).join(','))
    }
    return lines.join('\n')
  }

  let page = 1
  let pageSize = 50
  let filterRecipient = ''

  async function load() {
    el.textContent = 'loading…'
    try {
      const r = await fetch(`/suppressions/audit?page=${page}&pageSize=${pageSize}${filterRecipient ? '&recipient=' + encodeURIComponent(filterRecipient) : ''}`)
      const data = await r.json()
      if (!data.entries || !data.entries.length) { el.innerHTML = '<div class="muted">No audit entries</div>'; return }
      const rows = data.entries.map(d => `<tr><td>${d.ts}</td><td>${d.action}</td><td>${d.recipient}</td><td>${d.reason || ''}</td><td>${d.source || ''}</td></tr>`).join('')
      el.innerHTML = `<table style="width:100%"><thead><tr><th>Time</th><th>Action</th><th>Recipient</th><th>Reason</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>`
      document.querySelector('#page-num').textContent = data.page || page
      const total = data.total || 0
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      document.querySelector('#page-total').textContent = totalPages
      document.querySelector('#prev').disabled = page <= 1
      document.querySelector('#next').disabled = page >= totalPages
      // render numeric page buttons in #pages
      const pagesEl = document.querySelector('#pages')
      pagesEl.innerHTML = ''
      const maxButtons = 9
      const half = Math.floor(maxButtons / 2)
      let start = Math.max(1, page - half)
      let end = Math.min(totalPages, start + maxButtons - 1)
      if ((end - start) < (maxButtons - 1)) start = Math.max(1, end - maxButtons + 1)
      for (let p = start; p <= end; p++) {
        const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = p; b.style.padding = '6px';
        if (p === (data.page || page)) { b.classList.add('active'); b.style.background = 'rgba(0,230,255,0.04)'; }
        b.addEventListener('click', () => { page = p; load() })
        pagesEl.appendChild(b)
      }
      // export will use server-side streaming CSV with compression hint
      exportBtn.onclick = () => { window.location.href = `/suppressions/audit.csv?compress=true&recipient=${encodeURIComponent(filterRecipient)}` }
    } catch (e) { el.textContent = 'Failed to load audit: ' + e.message }
  }

  // controls
  const pageSizeEl = document.querySelector('#page-size')
  const prevBtn = document.querySelector('#prev')
  const nextBtn = document.querySelector('#next')
  const filterEl = document.querySelector('#filter-recipient')

  pageSizeEl.addEventListener('change', () => { pageSize = Number(pageSizeEl.value); page = 1; load() })
  prevBtn.addEventListener('click', () => { if (page > 1) { page--; load() } })
  nextBtn.addEventListener('click', () => { page++; load() })
  const jumpEl = document.querySelector('#jump-to')
  const goBtn = document.querySelector('#go')
  goBtn.addEventListener('click', () => { const n = Number(jumpEl.value); if (n && n > 0) { page = n; load() } })
  filterEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') { filterRecipient = filterEl.value; page = 1; load() } })

  load()
})()

=======
(async function () {
  const el = document.querySelector('#audit')
  const exportBtn = document.querySelector('#export')
  function toCSV(rows) {
    if (!rows || !rows.length) return ''
    const keys = Object.keys(rows[0])
    const lines = [keys.join(',')]
    for (const r of rows) {
      lines.push(keys.map(k => ('' + (r[k] || '')).replace(/"/g, '""')).map(v => `"${v.replace(/\"/g, '""')}"`).join(','))
    }
    return lines.join('\n')
  }

  let page = 1
  let pageSize = 50
  let filterRecipient = ''

  async function load() {
    el.textContent = 'loading…'
    try {
      const r = await fetch(`/suppressions/audit?page=${page}&pageSize=${pageSize}${filterRecipient ? '&recipient=' + encodeURIComponent(filterRecipient) : ''}`)
      const data = await r.json()
      if (!data.entries || !data.entries.length) { el.innerHTML = '<div class="muted">No audit entries</div>'; return }
      const rows = data.entries.map(d => `<tr><td>${d.ts}</td><td>${d.action}</td><td>${d.recipient}</td><td>${d.reason || ''}</td><td>${d.source || ''}</td></tr>`).join('')
      el.innerHTML = `<table style="width:100%"><thead><tr><th>Time</th><th>Action</th><th>Recipient</th><th>Reason</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>`
      document.querySelector('#page-num').textContent = data.page || page
      const total = data.total || 0
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      document.querySelector('#page-total').textContent = totalPages
      document.querySelector('#prev').disabled = page <= 1
      document.querySelector('#next').disabled = page >= totalPages
      // render numeric page buttons in #pages
      const pagesEl = document.querySelector('#pages')
      pagesEl.innerHTML = ''
      const maxButtons = 9
      const half = Math.floor(maxButtons / 2)
      let start = Math.max(1, page - half)
      let end = Math.min(totalPages, start + maxButtons - 1)
      if ((end - start) < (maxButtons - 1)) start = Math.max(1, end - maxButtons + 1)
      for (let p = start; p <= end; p++) {
        const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = p; b.style.padding = '6px';
        if (p === (data.page || page)) { b.classList.add('active'); b.style.background = 'rgba(0,230,255,0.04)'; }
        b.addEventListener('click', () => { page = p; load() })
        pagesEl.appendChild(b)
      }
      // export will use server-side streaming CSV with compression hint
      exportBtn.onclick = () => { window.location.href = `/suppressions/audit.csv?compress=true&recipient=${encodeURIComponent(filterRecipient)}` }
    } catch (e) { el.textContent = 'Failed to load audit: ' + e.message }
  }

  // controls
  const pageSizeEl = document.querySelector('#page-size')
  const prevBtn = document.querySelector('#prev')
  const nextBtn = document.querySelector('#next')
  const filterEl = document.querySelector('#filter-recipient')

  pageSizeEl.addEventListener('change', () => { pageSize = Number(pageSizeEl.value); page = 1; load() })
  prevBtn.addEventListener('click', () => { if (page > 1) { page--; load() } })
  nextBtn.addEventListener('click', () => { page++; load() })
  const jumpEl = document.querySelector('#jump-to')
  const goBtn = document.querySelector('#go')
  goBtn.addEventListener('click', () => { const n = Number(jumpEl.value); if (n && n > 0) { page = n; load() } })
  filterEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') { filterRecipient = filterEl.value; page = 1; load() } })

  load()
})()

>>>>>>> IMPORT (TEXT)

=======
(async function () {
  const el = document.querySelector('#audit')
  const exportBtn = document.querySelector('#export')
  function toCSV(rows) {
    if (!rows || !rows.length) return ''
    const keys = Object.keys(rows[0])
    const lines = [keys.join(',')]
    for (const r of rows) {
      lines.push(keys.map(k => ('' + (r[k] || '')).replace(/"/g, '""')).map(v => `"${v.replace(/\"/g, '""')}"`).join(','))
    }
    return lines.join('\n')
  }

  let page = 1
  let pageSize = 50
  let filterRecipient = ''

  async function load() {
    el.textContent = 'loading…'
    try {
      const r = await fetch(`/suppressions/audit?page=${page}&pageSize=${pageSize}${filterRecipient ? '&recipient=' + encodeURIComponent(filterRecipient) : ''}`)
      const data = await r.json()
      if (!data.entries || !data.entries.length) { el.innerHTML = '<div class="muted">No audit entries</div>'; return }
      const rows = data.entries.map(d => `<tr><td>${d.ts}</td><td>${d.action}</td><td>${d.recipient}</td><td>${d.reason || ''}</td><td>${d.source || ''}</td></tr>`).join('')
      el.innerHTML = `<table style="width:100%"><thead><tr><th>Time</th><th>Action</th><th>Recipient</th><th>Reason</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>`
      document.querySelector('#page-num').textContent = data.page || page
      const total = data.total || 0
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      document.querySelector('#page-total').textContent = totalPages
      document.querySelector('#prev').disabled = page <= 1
      document.querySelector('#next').disabled = page >= totalPages
      // render numeric page buttons in #pages
      const pagesEl = document.querySelector('#pages')
      pagesEl.innerHTML = ''
      const maxButtons = 9
      const half = Math.floor(maxButtons / 2)
      let start = Math.max(1, page - half)
      let end = Math.min(totalPages, start + maxButtons - 1)
      if ((end - start) < (maxButtons - 1)) start = Math.max(1, end - maxButtons + 1)
      for (let p = start; p <= end; p++) {
        const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = p; b.style.padding = '6px';
        if (p === (data.page || page)) { b.classList.add('active'); b.style.background = 'rgba(0,230,255,0.04)'; }
        b.addEventListener('click', () => { page = p; load() })
        pagesEl.appendChild(b)
      }
      // export will use server-side streaming CSV with compression hint
      exportBtn.onclick = () => { window.location.href = `/suppressions/audit.csv?compress=true&recipient=${encodeURIComponent(filterRecipient)}` }
    } catch (e) { el.textContent = 'Failed to load audit: ' + e.message }
  }

  // controls
  const pageSizeEl = document.querySelector('#page-size')
  const prevBtn = document.querySelector('#prev')
  const nextBtn = document.querySelector('#next')
  const filterEl = document.querySelector('#filter-recipient')

  pageSizeEl.addEventListener('change', () => { pageSize = Number(pageSizeEl.value); page = 1; load() })
  prevBtn.addEventListener('click', () => { if (page > 1) { page--; load() } })
  nextBtn.addEventListener('click', () => { page++; load() })
  const jumpEl = document.querySelector('#jump-to')
  const goBtn = document.querySelector('#go')
  goBtn.addEventListener('click', () => { const n = Number(jumpEl.value); if (n && n > 0) { page = n; load() } })
  filterEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') { filterRecipient = filterEl.value; page = 1; load() } })

  load()
})()

>>>>>>> IMPORT (TEXT)
