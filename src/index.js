require('dotenv').config();

const {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  Client,
  Events,
  GatewayIntentBits
} = require('discord.js');
const { formatWithPrettier } = require('./formatters/prettierFormatter');
const { formatPython } = require('./formatters/pythonFormatter');
const { formatClang } = require('./formatters/clangFormatter');
const { formatCSharp } = require('./formatters/csharpFormatter');

const DISCORD_MESSAGE_LIMIT = 2000;
const COMMAND_PATTERN = /^!fmt\s+([^\s]+)\s*([\s\S]*)$/;
const SLASH_COMMANDS = [
  {
    name: 'fmt',
    description: '코드를 언어에 맞게 자동 포맷합니다.',
    options: [
      {
        name: 'language',
        description: '포맷할 코드 언어',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: 'JavaScript', value: 'js' },
          { name: 'TypeScript', value: 'ts' },
          { name: 'HTML', value: 'html' },
          { name: 'CSS', value: 'css' },
          { name: 'JSON', value: 'json' },
          { name: 'Python', value: 'py' },
          { name: 'C', value: 'c' },
          { name: 'C++', value: 'cpp' },
          { name: 'C#', value: 'cs' }
        ]
      },
      {
        name: 'code',
        description: '포맷할 코드',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  }
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

async function sendFormattedResult(message, language, formattedCode) {
  const codeBlock = makeCodeBlock(language, formattedCode);

  if (codeBlock.length <= DISCORD_MESSAGE_LIMIT) {
    await message.reply(codeBlock);
    return;
  }

  const attachment = new AttachmentBuilder(Buffer.from(formattedCode, 'utf8'), {
    name: `formatted.${language === 'cpp' ? 'cpp' : language}.txt`
  });

  await message.reply({
    content: '포맷 결과가 너무 길어서 파일로 첨부합니다.',
    files: [attachment]
  });
}

async function sendInteractionResult(interaction, language, formattedCode) {
  const codeBlock = makeCodeBlock(language, formattedCode);

  if (codeBlock.length <= DISCORD_MESSAGE_LIMIT) {
    await interaction.reply(codeBlock);
    return;
  }

  const attachment = new AttachmentBuilder(Buffer.from(formattedCode, 'utf8'), {
    name: `formatted.${language === 'cpp' ? 'cpp' : language}.txt`
  });

  await interaction.reply({
    content: '포맷 결과가 너무 길어서 파일로 첨부합니다.',
    files: [attachment]
  });
}

async function sendMessageFormatFailure(message, error) {
  const content = `포맷에 실패했습니다: ${summarizeError(error)}`;

  try {
    await message.author.send(content);
    await message.react('⚠️');
  } catch {
    await message.reply('포맷에 실패했습니다. 개인 메시지를 받을 수 없어 오류 내용은 공개하지 않았습니다.');
  }
}

async function registerSlashCommands() {
  const guilds = [...client.guilds.cache.values()];

  await Promise.all(guilds.map((guild) => guild.commands.set(SLASH_COMMANDS)));

  console.log(`Registered /fmt command in ${guilds.length} guild(s).`);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    await registerSlashCommands();
  } catch (error) {
    console.error('슬래시 명령어 등록에 실패했습니다:', summarizeError(error));
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) {
    return;
  }

  const match = message.content.match(COMMAND_PATTERN);
  if (!match) {
    return;
  }

  const language = normalizeLanguage(match[1]);
  if (!language) {
    await message.reply('지원하지 않는 언어입니다');
    return;
  }

  const code = extractCode(match[2]);
  if (!code.trim()) {
    await message.reply('포맷할 코드를 함께 입력해주세요.');
    return;
  }

  try {
    const formattedCode = await formatCode(code, language);

    if (formattedCode === null) {
      await message.reply('지원하지 않는 언어입니다');
      return;
    }

    await sendFormattedResult(message, language, formattedCode);
  } catch (error) {
    await sendMessageFormatFailure(message, error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'fmt') {
    return;
  }

  const language = normalizeLanguage(interaction.options.getString('language', true));
  const code = extractCode(interaction.options.getString('code', true));

  if (!language) {
    await interaction.reply({
      content: '지원하지 않는 언어입니다',
      ephemeral: true
    });
    return;
  }

  if (!code.trim()) {
    await interaction.reply({
      content: '포맷할 코드를 함께 입력해주세요.',
      ephemeral: true
    });
    return;
  }

  try {
    const formattedCode = await formatCode(code, language);

    if (formattedCode === null) {
      await interaction.reply({
        content: '지원하지 않는 언어입니다',
        ephemeral: true
      });
      return;
    }

    await sendInteractionResult(interaction, language, formattedCode);
  } catch (error) {
    await interaction.reply({
      content: `포맷에 실패했습니다: ${summarizeError(error)}`,
      ephemeral: true
    });
  }
});

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('.env 파일에 DISCORD_TOKEN을 설정해주세요.');
  process.exit(1);
}

client.login(token);
