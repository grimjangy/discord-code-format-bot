require('dotenv').config();

const {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  Client,
  Events,
  GatewayIntentBits
} = require('discord.js');
const {
  extractCode,
  formatCode,
  makeCodeBlock,
  normalizeLanguage,
  summarizeError,
  supportedLanguages
} = require('./formatService');
const { startWebServer } = require('./webServer');

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
        choices: supportedLanguages.map(({ name, value }) => ({ name, value }))
      },
      {
        name: 'code',
        description: '포맷할 코드',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  },
  {
    name: 'ide',
    description: '브라우저에서 쓸 수 있는 코드 IDE 링크를 엽니다.'
  }
];

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
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === 'ide') {
    const ideUrl = process.env.PUBLIC_IDE_URL || process.env.RENDER_EXTERNAL_URL;

    if (!ideUrl) {
      await interaction.reply({
        content: 'IDE URL이 아직 설정되지 않았습니다. Render Web Service 배포 후 PUBLIC_IDE_URL을 설정해주세요.',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `웹 IDE 열기: ${ideUrl}`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName !== 'fmt') {
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

startWebServer();

if (!token) {
  console.error('DISCORD_TOKEN이 없어 Discord 봇 로그인은 건너뜁니다. 웹 IDE만 실행됩니다.');
} else {
  client.login(token).catch((error) => {
    console.error('Discord 봇 로그인에 실패했습니다:', summarizeError(error));
  });
}
