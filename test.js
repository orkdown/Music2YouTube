import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://music.apple.com/us/album/lost-children/1528243305?i=1528243306';
  const res = await fetch(url);
  const html = await res.text();
  
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content');
  const description = $('meta[property="og:description"]').attr('content');
  const image = $('meta[property="og:image"]').attr('content');
  
  console.log({ title, description, image });
}

test();
