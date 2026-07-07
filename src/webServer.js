const express = require('express');
const path = require('node:path');
const { formatCode, normalizeLanguage, summarizeError, supportedLanguages } = require('./formatService');

const editorLanguageByValue = Object.fromEntries(
  supportedLanguages.map(({ value, editorLanguage }) => [value, editorLanguage])
);

function extractResponseText(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  const outputText = data.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text || '')
    .join('');

  return outputText || '';
}

function makeCompletionPrompt({ code, cursorOffset, language }) {
  const beforeCursor = code.slice(0, cursorOffset);
  const afterCursor = code.slice(cursorOffset);
  const editorLanguage = editorLanguageByValue[language] || language;

  return [
    `Language: ${editorLanguage}`,
    '',
    'Complete the code at <cursor>.',
    'Return only the code that should be inserted at the cursor.',
    'Do not wrap the answer in markdown.',
    'Do not repeat code that already appears before or after the cursor.',
    '',
    '<code>',
    `${beforeCursor}<cursor>${afterCursor}`,
    '</code>'
  ].join('\n');
}

async function requestOpenAICompletion({ code, cursorOffset, language }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || process.env.COMPLETION_MODEL || 'gpt-5.2-mini',
      input: makeCompletionPrompt({ code, cursorOffset, language }),
      instructions:
        'You are a precise code completion engine inside a browser IDE. Return only the minimal code suffix to insert.',
      max_output_tokens: Number.parseInt(process.env.COMPLETION_MAX_TOKENS || '160', 10)
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI 자동완성 요청 실패: HTTP ${response.status}`);
  }

  return {
    completion: extractResponseText(await response.json()).trimStart()
  };
}

async function requestCompletion({ code, cursorOffset, language }) {
  const endpoint = process.env.COMPLETION_API_URL;

  if (!endpoint) {
    if (process.env.OPENAI_API_KEY) {
      return requestOpenAICompletion({ code, cursorOffset, language });
    }

    return { completion: '', message: 'OPENAI_API_KEY 또는 COMPLETION_API_URL을 설정해주세요.' };
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

  app.get('/healthz', (req, res) => {
    res.json({ ok: true });
  });

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
