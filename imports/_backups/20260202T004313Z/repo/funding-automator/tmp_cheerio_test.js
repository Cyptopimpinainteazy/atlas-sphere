<<<<<<< REPO
<<<<<<< REPO
const cheerio = require('cheerio');
const html = '<a class="result__a" href="https://site1.example">r1</a><a class="result__a" href="https://site2.test">r2</a>';
const $ = cheerio.load(html);
$('a.result__a').each((i, el) => console.log('HREF', $(el).attr('href')));

=======
const cheerio = require('cheerio');
const html = '<a class="result__a" href="https://site1.example">r1</a><a class="result__a" href="https://site2.test">r2</a>';
const $ = cheerio.load(html);
$('a.result__a').each((i, el) => console.log('HREF', $(el).attr('href')));

>>>>>>> IMPORT (TEXT)

=======
const cheerio = require('cheerio');
const html = '<a class="result__a" href="https://site1.example">r1</a><a class="result__a" href="https://site2.test">r2</a>';
const $ = cheerio.load(html);
$('a.result__a').each((i, el) => console.log('HREF', $(el).attr('href')));

>>>>>>> IMPORT (TEXT)
