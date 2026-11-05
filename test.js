import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://music.apple.com/us/album/never-gonna-give-you-up/1558533900?i=1558534271';
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content');
    const description = $('meta[property="og:description"]').attr('content');
    const image = $('meta[property="og:image"]').attr('content');
    console.log({ title, description, image });
  } catch (e) {
    console.error('Test error:', e);
  }
}

test();
