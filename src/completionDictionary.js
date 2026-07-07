const { completionData } = require('./completionData');

function currentPrefix(code, cursorOffset) {
  const beforeCursor = code.slice(0, cursorOffset);
  const match = beforeCursor.match(/[A-Za-z_$#][A-Za-z0-9_$#-]*$/);
  return match ? match[0] : '';
}

function completeFromDictionary({ code, cursorOffset, language }) {
  const prefix = currentPrefix(code, cursorOffset);

  if (!prefix) {
    return { completion: '', message: 'Ctrl/Cmd + Space 또는 Suggest로 자동완성 목록을 열어주세요.' };
  }

  const candidates = completionData[language]?.words || [];
  const match = candidates.find(
    (candidate) => candidate.toLowerCase().startsWith(prefix.toLowerCase()) && candidate !== prefix
  );

  if (!match) {
    return { completion: '', message: '맞는 자동완성 후보가 없습니다.' };
  }

  return {
    completion: match.slice(prefix.length)
  };
}

module.exports = {
  completeFromDictionary
};
