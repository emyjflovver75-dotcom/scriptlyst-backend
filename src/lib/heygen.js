const https = require('https');

const HEYGEN_BASE = 'https://api.heygen.com';

function heygenRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.heygen.com',
      path,
      method,
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
        ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function createVideo({ script, voiceId = 'en-US-ChristopherNeural', avatarId = '5f038bdd7c4048af97cffd4ee9e4c51d' }) {
  const response = await heygenRequest('POST', '/v2/video/generate', {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          input_text: script.substring(0, 1500), // HeyGen limit per clip
          voice_id: voiceId,
        },
      },
    ],
    dimension: { width: 1280, height: 720 },
    test: false,
  });

  if (response.status !== 200 || !response.body?.data?.video_id) {
    throw new Error(response.body?.message || 'HeyGen video creation failed');
  }

  return response.body.data.video_id;
}

async function getVideoStatus(videoId) {
  const response = await heygenRequest('GET', `/v1/video_status.get?video_id=${videoId}`);

  if (response.status !== 200) {
    throw new Error('Failed to check HeyGen video status');
  }

  const { status, video_url } = response.body?.data || {};
  return { status, videoUrl: video_url || null };
}

// Poll until the video is ready (max 15 minutes)
async function waitForVideo(videoId, maxWaitMs = 15 * 60 * 1000) {
  const start = Date.now();
  const interval = 15000; // poll every 15 seconds

  while (Date.now() - start < maxWaitMs) {
    const { status, videoUrl } = await getVideoStatus(videoId);

    if (status === 'completed') return videoUrl;
    if (status === 'failed') throw new Error('HeyGen video generation failed');

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error('HeyGen video timed out after 15 minutes');
}

module.exports = { createVideo, getVideoStatus, waitForVideo };
