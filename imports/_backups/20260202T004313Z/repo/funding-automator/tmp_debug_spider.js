<<<<<<< REPO
<<<<<<< REPO
const m = require('./tools/email_spider');
(async () => {
    const fakeHtml = `<html><body><a class="result__a" href="https://site1.example">r1</a><a class="result__a" href="https://site2.test">r2</a></body></html>`;
    const http = { post: async () => ({ data: fakeHtml }) };
    const out = await m.fetchDuckDuckGoSearch('q', 10, http);
    console.log('RESULT', out);
})();

=======
const m = require('./tools/email_spider');
(async () => {
    const fakeHtml = `<html><body><a class="result__a" href="https://site1.example">r1</a><a class="result__a" href="https://site2.test">r2</a></body></html>`;
    const http = { post: async () => ({ data: fakeHtml }) };
    const out = await m.fetchDuckDuckGoSearch('q', 10, http);
    console.log('RESULT', out);
})();

>>>>>>> IMPORT (TEXT)

=======
const m = require('./tools/email_spider');
(async () => {
    const fakeHtml = `<html><body><a class="result__a" href="https://site1.example">r1</a><a class="result__a" href="https://site2.test">r2</a></body></html>`;
    const http = { post: async () => ({ data: fakeHtml }) };
    const out = await m.fetchDuckDuckGoSearch('q', 10, http);
    console.log('RESULT', out);
})();

>>>>>>> IMPORT (TEXT)
