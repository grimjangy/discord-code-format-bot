const { spawn } = require('node:child_process');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { getPrintWidth } = require('../config');

function runFormatter(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        DOTNET_CLI_HOME: tmpdir(),
        XDG_DATA_HOME: tmpdir()
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `CSharpier가 종료 코드 ${code}로 실패했습니다.`));
    });
  });
}

async function runCSharpier(filePath) {
  try {
    await runFormatter('dotnet', ['csharpier', filePath]);
  } catch (error) {
    if (error.code === 'ENOENT' || error.message.includes('dotnet-csharpier')) {
      throw new Error(
        'CSharpier 또는 .NET SDK가 설치되어 있지 않습니다. `dotnet tool install -g csharpier` 후 다시 시도해주세요.'
      );
    }

    throw error;
  }
}

function isMissingToolError(error) {
  const message = error?.message || '';
  return message.includes('CSharpier 또는 .NET SDK');
}

function shouldTryWrappedClass(error, code) {
  return (
    !/\b(class|struct|record|interface|namespace)\b/.test(code) &&
    /[A-Za-z_][\w<>,\s\[\]]+\s+[A-Za-z_]\w*\s*\([^)]*\)\s*\{/.test(code) &&
    !isMissingToolError(error)
  );
}

function shouldTryWrappedMethod(error, code) {
  return (
    !isMissingToolError(error) &&
    !/\b(class|struct|record|interface|namespace)\b/.test(code) &&
    !/[A-Za-z_][\w<>,\s\[\]]+\s+[A-Za-z_]\w*\s*\([^)]*\)\s*\{/.test(code)
  );
}

function findMatchingBrace(code, openBraceIndex) {
  let depth = 0;

  for (let index = openBraceIndex; index < code.length; index += 1) {
    const character = code[index];

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function wrapBareClassBodyInRunMethod(code) {
  const classMatch = code.match(/\b(?:public|private|internal|protected|sealed|abstract|static|\s)*class\s+\w[^{]*\{/);

  if (!classMatch || classMatch.index === undefined) {
    return null;
  }

  const openBraceIndex = classMatch.index + classMatch[0].lastIndexOf('{');
  const closeBraceIndex = findMatchingBrace(code, openBraceIndex);

  if (closeBraceIndex === -1) {
    return null;
  }

  const beforeBody = code.slice(0, openBraceIndex + 1);
  const body = code.slice(openBraceIndex + 1, closeBraceIndex).trim();
  const afterBody = code.slice(closeBraceIndex);

  if (!body || /\b(?:void|int|string|bool|float|double|decimal|var|Task|IEnumerator|IEnumerable)\s+\w+\s*\([^)]*\)\s*\{/.test(body)) {
    return null;
  }

  return `${beforeBody}\n    public void Run()\n    {\n${body}\n    }\n${afterBody}`;
}

function unwrapFormattedClass(formattedCode) {
  const lines = formattedCode.replace(/\r\n/g, '\n').split('\n');
  const classLineIndex = lines.findIndex((line) => line.includes('__DiscordFmtWrapper'));
  const openBraceIndex = lines.findIndex((line, index) => index > classLineIndex && line.trim() === '{');

  if (classLineIndex === -1 || openBraceIndex === -1) {
    return formattedCode;
  }

  const bodyLines = [];
  let depth = 1;

  for (const line of lines.slice(openBraceIndex + 1)) {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (depth === 1 && line.trim() === '}') {
      break;
    }

    bodyLines.push(line.replace(/^ {4}/, ''));
    depth += opens - closes;
  }

  return bodyLines.join('\n').trimEnd() + '\n';
}

function unwrapFormattedMethod(formattedCode) {
  const classBody = unwrapFormattedClass(formattedCode);
  const lines = classBody.replace(/\r\n/g, '\n').split('\n');
  const methodLineIndex = lines.findIndex((line) => line.includes('__DiscordFmtMethod'));
  const openBraceIndex = lines.findIndex((line, index) => index > methodLineIndex && line.trim() === '{');

  if (methodLineIndex === -1 || openBraceIndex === -1) {
    return classBody;
  }

  const bodyLines = [];
  let depth = 1;

  for (const line of lines.slice(openBraceIndex + 1)) {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (depth === 1 && line.trim() === '}') {
      break;
    }

    bodyLines.push(line.replace(/^ {4}/, ''));
    depth += opens - closes;
  }

  return bodyLines.join('\n').trimEnd() + '\n';
}

async function formatFile(tempFile, code) {
  await writeFile(tempFile, code, 'utf8');
  await runCSharpier(tempFile);
  return readFile(tempFile, 'utf8');
}

async function formatCSharp(code) {
  const tempDir = await mkdtemp(join(tmpdir(), 'discord-fmt-csharp-'));
  const tempFile = join(tempDir, 'Input.cs');
  const configFile = join(tempDir, '.csharpierrc');
  let firstError;

  try {
    await writeFile(configFile, JSON.stringify({ printWidth: getPrintWidth() }), 'utf8');

    try {
      return await formatFile(tempFile, code);
    } catch (error) {
      firstError = error;

      if (!shouldTryWrappedClass(error, code)) {
        const classBodyWrappedCode = wrapBareClassBodyInRunMethod(code);

        if (classBodyWrappedCode) {
          try {
            return await formatFile(tempFile, classBodyWrappedCode);
          } catch {
            // Fall through to the snippet wrappers below.
          }
        }

        if (!shouldTryWrappedMethod(error, code)) {
          throw error;
        }

        const wrappedCode = `public class __DiscordFmtWrapper\n{\n    public void __DiscordFmtMethod()\n    {\n${code}\n    }\n}\n`;
        const formattedCode = await formatFile(tempFile, wrappedCode);
        return unwrapFormattedMethod(formattedCode);
      }

      try {
        const wrappedCode = `public class __DiscordFmtWrapper\n{\n${code}\n}\n`;
        const formattedCode = await formatFile(tempFile, wrappedCode);
        return unwrapFormattedClass(formattedCode);
      } catch (wrappedClassError) {
        if (!shouldTryWrappedMethod(firstError, code)) {
          throw wrappedClassError;
        }

        const wrappedCode = `public class __DiscordFmtWrapper\n{\n    public void __DiscordFmtMethod()\n    {\n${code}\n    }\n}\n`;
        const formattedCode = await formatFile(tempFile, wrappedCode);
        return unwrapFormattedMethod(formattedCode);
      }
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

module.exports = {
  formatCSharp
};
