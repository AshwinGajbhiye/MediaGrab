const axios = require('axios');

async function getInstagramVideo(shortcode) {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const GRAPHQL_DOC_ID = '9510064595728286';

  try {
    const fs = require('fs');
    const cookiesText = fs.readFileSync('cookies.txt', 'utf8');
    let csrfToken = '';
    let cookieParts = [];
    
    for (const line of cookiesText.split('\n')) {
      if (line.trim() === '' || line.startsWith('#')) continue;
      const parts = line.split('\t');
      if (parts.length >= 7) {
        const name = parts[5];
        const value = parts[6].trim();
        cookieParts.push(`${name}=${value}`);
        if (name === 'csrftoken') {
          csrfToken = value;
        }
      }
    }

    const csrfCookie = cookieParts.join('; ');

    if (!csrfToken) {
      throw new Error('Could not find CSRF token');
    }

    console.log('CSRF Token:', csrfToken);

    console.log('2. Querying GraphQL...');
    const variables = JSON.stringify({
      shortcode: shortcode,
      fetch_tagged_user_count: null,
      hoisted_comment_id: null,
      hoisted_reply_id: null,
    });

    const response2 = await axios.post('https://www.instagram.com/graphql/query', 
      new URLSearchParams({
        variables: variables,
        doc_id: GRAPHQL_DOC_ID,
      }), 
      {
        headers: {
          'User-Agent': userAgent,
          'X-CSRFToken': csrfToken,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': csrfCookie,
        }
      }
    );

    const media = response2.data?.data?.xdt_shortcode_media;
    if (!media) {
      console.log('Response:', JSON.stringify(response2.data, null, 2));
      throw new Error('No media found');
    }

    if (media.is_video) {
      console.log('Video URL:', media.video_url);
    } else {
      console.log('Image URL:', media.display_url);
    }

  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error(err.response.data);
    }
  }
}

getInstagramVideo('C2WkL2ZIV6y');
