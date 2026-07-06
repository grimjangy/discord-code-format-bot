const { spawn } = require('node:child_process');
const { getPrintWidth } = require('../config');

function formatClang(code, language) {
  const assumedFileName = language === 'c' ? 'input.c' : 'input.cpp';
  const style = `{BasedOnStyle: LLVM, ColumnLimit: ${getPrintWidth()}}`;

  return new Promise((resolve, reject) => {
    const child = spawn('clang-format', [`--assume-filename=${assumedFileName}`, `--style=${style}`], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('clang-format이 설치되어 있지 않습니다. 설치 후 다시 시도해주세요.'));
        return;
      }

      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `clang-format이 종료 코드 ${code}로 실패했습니다.`));
    });

    child.stdin.end(code);
  });
}

module.exports = {
  formatClang
};
