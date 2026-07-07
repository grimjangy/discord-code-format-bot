const express = require('express');
const path = require('node:path');
const { formatCode, normalizeLanguage, summarizeError, supportedLanguages } = require('./formatService');

async function requestCompletion({ code, cursorOffset, language }) {
  const endpoint = process.env.COMPLETION_API_URL;

  if (!endpoint) {
    return {
      completion: '',
      message: '자동완성 API가 아직 설정되지 않았습니다.'
    };
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (process.env.COMPLETION_API_KEY) {
    headers.Authorization = `Bearer ${process.env.COMPLETION_API_KEY}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code,
      cursorOffset,
      language,
      model: process.env.COMPLETION_MODEL
    })
  });

  if (!response.ok) {
    throw new Error(`자동완성 API 요청 실패: HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    completion: data.completion || data.text || data.choices?.[0]?.message?.content || ''
  };
}

function startWebServer() {
  const app = express();
  const port = Number.parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/languages', (req, res) => {
    res.json({ languages: supportedLanguages });
  });

  app.post('/api/format', async (req, res) => {
    const language = normalizeLanguage(String(req.body.language || ''));
    const code = String(req.body.code || '');

    if (!language) {
      res.status(400).json({ error: '지원하지 않는 언어입니다' });
      return;
    }

    try {
      const formatted = await formatCode(code, language);

      if (formatted === null) {
        res.status(400).json({ error: '지원하지 않는 언어입니다' });
        return;
      }

      res.json({ code: formatted });
    } catch (error) {
      res.status(400).json({ error: summarizeError(error) });
    }
  });

  app.post('/api/complete', async (req, res) => {
    const language = normalizeLanguage(String(req.body.language || ''));
    const code = String(req.body.code || '');
    const cursorOffset = Number.parseInt(req.body.cursorOffset || '0', 10);

    if (!language) {
      res.status(400).json({ error: '지원하지 않는 언어입니다' });
      return;
    }

    try {
      res.json(await requestCompletion({ code, cursorOffset, language }));
    } catch (error) {
      res.status(400).json({ error: summarizeError(error) });
    }
  });

  app.listen(port, () => {
    console.log(`Web IDE listening on port ${port}`);
  });
}

module.exports = {
  startWebServer
};
