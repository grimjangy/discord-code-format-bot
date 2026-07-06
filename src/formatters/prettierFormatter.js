const prettier = require('prettier');
const { getPrintWidth } = require('../config');

const parserByLanguage = {
  js: 'babel',
  javascript: 'babel',
  ts: 'typescript',
  typescript: 'typescript',
  html: 'html',
  css: 'css',
  json: 'json'
};

async function formatWithPrettier(code, language) {
  const parser = parserByLanguage[language];

  if (!parser) {
    throw new Error('Prettier가 지원하지 않는 언어입니다.');
  }

  return prettier.format(code, {
    parser,
    printWidth: getPrintWidth(),
    semi: true,
    singleQuote: false
  });
}

module.exports = {
  formatWithPrettier
};
