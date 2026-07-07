const { formatWithPrettier } = require('./formatters/prettierFormatter');
const { formatPython } = require('./formatters/pythonFormatter');
const { formatClang } = require('./formatters/clangFormatter');
const { formatCSharp } = require('./formatters/csharpFormatter');

const supportedLanguages = [
  { name: 'JavaScript', value: 'js', editorLanguage: 'javascript' },
  { name: 'TypeScript', value: 'ts', editorLanguage: 'typescript' },
  { name: 'HTML', value: 'html', editorLanguage: 'html' },
  { name: 'CSS', value: 'css', editorLanguage: 'css' },
  { name: 'JSON', value: 'json', editorLanguage: 'json' },
  { name: 'Python', value: 'py', editorLanguage: 'python' },
  { name: 'C', value: 'c', editorLanguage: 'c' },
  { name: 'C++', value: 'cpp', editorLanguage: 'cpp' },
  { name: 'C#', value: 'cs', editorLanguage: 'csharp' }
];

const languageAliases = {
  js: 'js',
  javascript: 'js',
  ts: 'ts',
  typescript: 'ts',
  html: 'html',
  css: 'css',
  json: 'json',
  py: 'py',
  python: 'py',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  cs: 'cs',
  csharp: 'cs',
  'c#': 'cs'
};

const codeBlockLanguage = {
  js: 'js',
  ts: 'ts',
  html: 'html',
  css: 'css',
  json: 'json',
  py: 'py',
  c: 'c',
  cpp: 'cpp',
  cs: 'csharp'
};

function normalizeLanguage(language) {
  return languageAliases[language.toLowerCase()];
}

function extractCode(rawCode) {
  const trimmed = rawCode.trim();
  const codeBlockMatch = trimmed.match(/^```[^\n`]*\n([\s\S]*?)\n?```$/);

  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }

  return rawCode.replace(/^\n+/, '').replace(/\s+$/, '');
}

function summarizeError(error) {
  const message = error?.message || String(error);
  const compact = message.replace(/\s+/g, ' ').trim();

  if (compact.length <= 300) {
    return compact;
  }

  return `${compact.slice(0, 297)}...`;
}

function makeCodeBlock(language, code) {
  const fenceLanguage = codeBlockLanguage[language] || '';
  return `\`\`\`${fenceLanguage}\n${code}\n\`\`\``;
}

async function formatCode(code, language) {
  if (['js', 'ts', 'html', 'css', 'json'].includes(language)) {
    return formatWithPrettier(code, language);
  }

  if (language === 'py') {
    return formatPython(code);
  }

  if (language === 'c' || language === 'cpp') {
    return formatClang(code, language);
  }

  if (language === 'cs') {
    return formatCSharp(code);
  }

  return null;
}

module.exports = {
  extractCode,
  formatCode,
  makeCodeBlock,
  normalizeLanguage,
  summarizeError,
  supportedLanguages
};
