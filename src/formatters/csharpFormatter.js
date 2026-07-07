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
