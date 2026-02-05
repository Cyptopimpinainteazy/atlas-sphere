<<<<<<< REPO
(async function(){
  const $ = sel => document.querySelector(sel)
  const listEl = $('#list')
  const detailEl = $('#detail')
  const refreshBtn = $('#refresh')

  async function fetchApprovals(){
    listEl.textContent = 'loading…'
    try{
      const res = await fetch('/approvals')
      const data = await res.json()
      // also fetch suppressions to mark items
      let suppressed = {};
      try{ const s = await fetch('/suppressions'); suppressed = await s.json() }catch(e){}
      renderList(data)
      // annotate suppression markers in list
      document.querySelectorAll('#list .list-item').forEach(el=>{
        try{
          const id = el.querySelector('h3').textContent.split(' — ')[0]
          const match = data.find(i=>i.id===id)
          const recipient = match?.meta?.contact || match?.meta?.email
          if (recipient && suppressed[recipient]){
            const badge = document.createElement('span'); badge.className='badge muted'; badge.textContent='SUPPRESSED'; badge.title = suppressed[recipient].reason || '';
            el.appendChild(badge)
          }
        }catch(e){}
      })
    }catch(e){ listEl.textContent = 'Failed to load approvals.' }
  }

  function renderList(items){
    if (!items.length) { listEl.innerHTML = '<div class="muted">No items waiting for approval</div>'; return }
    listEl.innerHTML = ''
    items.forEach(it=>{
      const div = document.createElement('div'); div.className='list-item';
      div.innerHTML = `<h3>${it.id} — ${it.meta.org||'unknown'}</h3><div class='muted'>${it.meta.notes||''}</div>`
      div.addEventListener('click', ()=> loadDetail(it.id))
      listEl.appendChild(div)
    })
  }

  async function loadDetail(id){
    detailEl.classList.remove('empty')
    detailEl.dataset.id = id
    detailEl.innerHTML = 'loading…'
    try{
      const res = await fetch(`/approvals/${id}`)
      const html = await res.text()
      // extract server-rendered HTML and replace
      detailEl.innerHTML = html
      // transform forms inside detail to call our API with fetch and update UI
      // add suppression status + actions
      try{
        const pre = detailEl.querySelector('pre');
        if (pre){
          const meta = JSON.parse(pre.textContent||'{}');
          const recipient = meta.contact || meta.email || null;
          if (recipient){
            const sresp = await fetch('/suppressions');
            const suppressed = await sresp.json();
            const banner = document.createElement('div'); banner.className='suppression-banner';
            if (suppressed[recipient]){
              banner.innerHTML = `<strong>Suppressed:</strong> ${suppressed[recipient].reason || 'bounced'} `;
              const uns = document.createElement('button'); uns.textContent='Un-suppress'; uns.className='btn ghost';
              uns.onclick = async ()=>{
                const r = await fetch('/suppressions/un', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ recipient }) });
                const j = await r.json(); if (j.ok) { alert('Un-suppressed'); loadDetail(id); fetchApprovals(); } else alert('Failed to un-suppress')
              }
              banner.appendChild(uns)
            } else {
              banner.innerHTML = `<strong>Status:</strong> not suppressed `;
              const sup = document.createElement('button'); sup.textContent='Suppress'; sup.className='btn ghost';
              sup.onclick = async ()=>{
                const r = await fetch('/suppressions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ recipient, reason: 'manual suppression' }) });
                const j = await r.json(); if (j.ok) { alert('Suppressed'); loadDetail(id); fetchApprovals(); } else alert('Failed to suppress')
              }
              banner.appendChild(sup)
            }
            detailEl.insertBefore(banner, detailEl.firstChild)
          }
        }
      }catch(e){ /* ignore UI suppression failures */ }
      detailEl.querySelectorAll('form').forEach(f=>{
        f.addEventListener('submit', async (ev)=>{
          ev.preventDefault()
          const form = ev.currentTarget; const fd = new FormData(form)
          const body = new URLSearchParams(); for (const p of fd.entries()) body.append(p[0], p[1])
          const resp = await fetch(form.action, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body })
          const json = await resp.json()
            if (json.ok) {
            alert('Approved — forwarded to webhook')
            await fetchApprovals(); detailEl.innerHTML = '<div class="muted">Done — choose another lead</div>'
          } else alert('Failed to approve: ' + (json.error||'unknown'))
        })
      })
        // add send test buttons for variants if present
        detailEl.querySelectorAll('.variant').forEach((v, idx)=>{
          const send = document.createElement('button'); send.className='btn ghost'; send.textContent='Send test';
          send.onclick = async ()=>{
            const to = prompt('Send test email to (address)')
            if (!to) return
            // pull variant subject and body
            const subjectEl = v.querySelector('h4'); const bodyEl = v.querySelector('p');
            const subject = subjectEl ? subjectEl.textContent : `Test: ${idx+1}`
            const body = bodyEl ? bodyEl.textContent : ''
            const resp = await fetch('/email/send-test', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to, subject, body }) })
            const msg = await resp.json()
            alert(msg.ok ? 'Test email sent / logged' : 'Failed: '+(msg.error||''))
          }
          v.querySelector('.cta')?.appendChild(send)
          // Add production send button
          const sendProd = document.createElement('button'); sendProd.className='btn primary'; sendProd.textContent='Send';
          sendProd.onclick = async ()=>{
            if (!confirm('Send this pitch to the lead now?')) return
            const payload = { id: document.location.pathname.split('/').pop() || null, variantIndex: idx }
            // derive id from URL (alternatively a hidden field)
            const res = await fetch('/email/send', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
            const j = await res.json()
            if (j.ok) alert('Send request accepted' + (j.sent ? ' and delivered' : ' — logged (no SMTP)'))
            else alert('Send failed: ' + (j.error||'unknown'))
          }
          v.querySelector('.cta')?.appendChild(sendProd)
        })
    }catch(e){ detailEl.textContent = 'Failed to load detail: '+e.message }
  }

  refreshBtn.addEventListener('click', ()=> fetchApprovals())
  fetchApprovals()
})()

=======
(async function(){
  const $ = sel => document.querySelector(sel)
  const listEl = $('#list')
  const detailEl = $('#detail')
  const refreshBtn = $('#refresh')

  async function fetchApprovals(){
    listEl.textContent = 'loading…'
    try{
      const res = await fetch('/approvals')
      const data = await res.json()
      // also fetch suppressions to mark items
      let suppressed = {};
      try{ const s = await fetch('/suppressions'); suppressed = await s.json() }catch(e){}
      renderList(data)
      // annotate suppression markers in list
      document.querySelectorAll('#list .list-item').forEach(el=>{
        try{
          const id = el.querySelector('h3').textContent.split(' — ')[0]
          const match = data.find(i=>i.id===id)
          const recipient = match?.meta?.contact || match?.meta?.email
          if (recipient && suppressed[recipient]){
            const badge = document.createElement('span'); badge.className='badge muted'; badge.textContent='SUPPRESSED'; badge.title = suppressed[recipient].reason || '';
            el.appendChild(badge)
          }
        }catch(e){}
      })
    }catch(e){ listEl.textContent = 'Failed to load approvals.' }
  }

  function renderList(items){
    if (!items.length) { listEl.innerHTML = '<div class="muted">No items waiting for approval</div>'; return }
    listEl.innerHTML = ''
    items.forEach(it=>{
      const div = document.createElement('div'); div.className='list-item';
      div.innerHTML = `<h3>${it.id} — ${it.meta.org||'unknown'}</h3><div class='muted'>${it.meta.notes||''}</div>`
      div.addEventListener('click', ()=> loadDetail(it.id))
      listEl.appendChild(div)
    })
  }

  async function loadDetail(id){
    detailEl.classList.remove('empty')
    detailEl.dataset.id = id
    detailEl.innerHTML = 'loading…'
    try{
      const res = await fetch(`/approvals/${id}`)
      const html = await res.text()
      // extract server-rendered HTML and replace
      detailEl.innerHTML = html
      // transform forms inside detail to call our API with fetch and update UI
      // add suppression status + actions
      try{
        const pre = detailEl.querySelector('pre');
        if (pre){
          const meta = JSON.parse(pre.textContent||'{}');
          const recipient = meta.contact || meta.email || null;
          if (recipient){
            const sresp = await fetch('/suppressions');
            const suppressed = await sresp.json();
            const banner = document.createElement('div'); banner.className='suppression-banner';
            if (suppressed[recipient]){
              banner.innerHTML = `<strong>Suppressed:</strong> ${suppressed[recipient].reason || 'bounced'} `;
              const uns = document.createElement('button'); uns.textContent='Un-suppress'; uns.className='btn ghost';
              uns.onclick = async ()=>{
                const r = await fetch('/suppressions/un', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ recipient }) });
                const j = await r.json(); if (j.ok) { alert('Un-suppressed'); loadDetail(id); fetchApprovals(); } else alert('Failed to un-suppress')
              }
              banner.appendChild(uns)
            } else {
              banner.innerHTML = `<strong>Status:</strong> not suppressed `;
              const sup = document.createElement('button'); sup.textContent='Suppress'; sup.className='btn ghost';
              sup.onclick = async ()=>{
                const r = await fetch('/suppressions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ recipient, reason: 'manual suppression' }) });
                const j = await r.json(); if (j.ok) { alert('Suppressed'); loadDetail(id); fetchApprovals(); } else alert('Failed to suppress')
              }
              banner.appendChild(sup)
            }
            detailEl.insertBefore(banner, detailEl.firstChild)
          }
        }
      }catch(e){ /* ignore UI suppression failures */ }
      detailEl.querySelectorAll('form').forEach(f=>{
        f.addEventListener('submit', async (ev)=>{
          ev.preventDefault()
          const form = ev.currentTarget; const fd = new FormData(form)
          const body = new URLSearchParams(); for (const p of fd.entries()) body.append(p[0], p[1])
          const resp = await fetch(form.action, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body })
          const json = await resp.json()
            if (json.ok) {
            alert('Approved — forwarded to webhook')
            await fetchApprovals(); detailEl.innerHTML = '<div class="muted">Done — choose another lead</div>'
          } else alert('Failed to approve: ' + (json.error||'unknown'))
        })
      })
        // add send test buttons for variants if present
        detailEl.querySelectorAll('.variant').forEach((v, idx)=>{
          const send = document.createElement('button'); send.className='btn ghost'; send.textContent='Send test';
          send.onclick = async ()=>{
            const to = prompt('Send test email to (address)')
            if (!to) return
            // pull variant subject and body
            const subjectEl = v.querySelector('h4'); const bodyEl = v.querySelector('p');
            const subject = subjectEl ? subjectEl.textContent : `Test: ${idx+1}`
            const body = bodyEl ? bodyEl.textContent : ''
            const resp = await fetch('/email/send-test', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to, subject, body }) })
            const msg = await resp.json()
            alert(msg.ok ? 'Test email sent / logged' : 'Failed: '+(msg.error||''))
          }
          v.querySelector('.cta')?.appendChild(send)
          // Add production send button
          const sendProd = document.createElement('button'); sendProd.className='btn primary'; sendProd.textContent='Send';
          sendProd.onclick = async ()=>{
            if (!confirm('Send this pitch to the lead now?')) return
            const payload = { id: document.location.pathname.split('/').pop() || null, variantIndex: idx }
            // derive id from URL (alternatively a hidden field)
            const res = await fetch('/email/send', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
            const j = await res.json()
            if (j.ok) alert('Send request accepted' + (j.sent ? ' and delivered' : ' — logged (no SMTP)'))
            else alert('Send failed: ' + (j.error||'unknown'))
          }
          v.querySelector('.cta')?.appendChild(sendProd)
        })
    }catch(e){ detailEl.textContent = 'Failed to load detail: '+e.message }
  }

  refreshBtn.addEventListener('click', ()=> fetchApprovals())
  fetchApprovals()
})()

>>>>>>> IMPORT (TEXT)
