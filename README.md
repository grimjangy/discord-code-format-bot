# Discord Code Format Bot

Discord 채널에서 `!fmt <language>` 또는 `/fmt` 명령어로 코드를 포맷해 주는 discord.js v14 기반 봇입니다.
웹 IDE도 함께 제공하며, `/ide` 명령어로 브라우저에서 열 수 있습니다.

## 지원 언어

- JavaScript: `js`, `javascript`
- TypeScript: `ts`, `typescript`
- HTML: `html`
- CSS: `css`
- JSON: `json`
- Python: `py`, `python`
- C: `c`
- C++: `cpp`, `c++`
- C#: `cs`, `csharp`, `c#`

JavaScript, TypeScript, HTML, CSS, JSON은 Prettier로 포맷합니다. Python은 `black`, C/C++은 `clang-format`을 child_process로 실행할 수 있도록 분리되어 있습니다.
C#은 CSharpier를 사용합니다.

## 설치

```bash
npm install
```

`.env.example`을 참고해 `.env` 파일을 만들고 Discord 봇 토큰을 입력합니다.

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=your_discord_bot_token_here
FORMAT_PRINT_WIDTH=80
PUBLIC_IDE_URL=https://your-render-service.onrender.com
WEB_SEND_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2-mini
COMPLETION_MAX_TOKENS=160
COMPLETION_API_URL=
COMPLETION_API_KEY=
COMPLETION_MODEL=
```

Discord Developer Portal에서 봇의 Message Content Intent를 활성화해야 `!fmt` 메시지를 읽을 수 있습니다.

`FORMAT_PRINT_WIDTH`는 포매터가 줄을 나누려고 시도하는 기준 길이입니다. Discord 코드블록은 화면에서 긴 줄을 자동 줄바꿈하지 않을 수 있으므로, 더 짧게 나누고 싶으면 예를 들어 `60`으로 낮출 수 있습니다.

## 실행

```bash
npm start
```

봇이 정상적으로 로그인하면 터미널에 `Logged in as ...` 메시지가 출력됩니다.

## Docker로 실행

Docker 이미지는 Node.js, `black`, `clang-format`, CSharpier를 함께 설치합니다.

```bash
docker build -t discord-code-format-bot .
docker run --env-file .env discord-code-format-bot
```

## Render에 배포

이 저장소에는 `render.yaml`과 `Dockerfile`이 포함되어 있어 Render의 Web Service로 배포할 수 있습니다.
Web Service는 Discord 봇과 웹 IDE를 같은 프로세스에서 실행합니다.

1. GitHub에 이 프로젝트를 올립니다.
2. Render에서 New > Blueprint를 선택하고 저장소를 연결합니다.
3. Environment Variables에 `DISCORD_TOKEN`, `FORMAT_PRINT_WIDTH`, `PUBLIC_IDE_URL`을 추가합니다.
   사이트에서 Discord로 보내는 기능에 비밀번호를 걸고 싶으면 `WEB_SEND_SECRET`도 추가합니다.
4. 배포가 끝난 뒤 로그에 `Logged in as ...`가 보이면 준비 완료입니다.

`PUBLIC_IDE_URL`에는 Render 서비스 URL을 넣습니다. 예:

```env
PUBLIC_IDE_URL=https://discord-code-format-bot.onrender.com
```

## Railway/Fly.io에 배포

Railway나 Fly.io도 `Dockerfile`을 자동으로 감지할 수 있습니다. 배포 후 환경 변수에 `DISCORD_TOKEN`만 설정하면 됩니다.

Discord 봇을 서버에 초대할 때는 최소한 다음 권한이 필요합니다.

- View Channels
- Send Messages
- Read Message History
- Attach Files

초대 URL을 다시 만들 때는 `bot` scope와 함께 `applications.commands` scope도 선택해야 `/fmt` 명령어가 보입니다.

또한 Discord Developer Portal의 Bot 설정에서 Message Content Intent를 켜야 합니다.

## 사용법

일반 텍스트로 코드를 입력할 수 있습니다.

```text
!fmt js
if(true){
console.log("hello")
}
```

코드블록으로 감싸서 입력할 수도 있습니다.

````text
!fmt js
```js
if(true){
console.log("hello")
}
```
````

봇은 결과를 Discord 코드블록으로 답장합니다.

```js
if (true) {
  console.log("hello");
}
```

결과 메시지가 Discord 제한을 넘으면 `.txt` 파일로 첨부합니다. 원본 메시지는 삭제하지 않습니다.

C#도 같은 방식으로 사용할 수 있습니다.

```text
!fmt cs
public class Hello{public void Run(){Console.WriteLine("hello");}}
```

슬래시 명령어도 지원합니다. Discord 입력창에서 `/fmt`를 입력하면 언어 선택 목록이 나타납니다.

```text
/fmt language: JavaScript code: if(true){console.log("hello")}
```

웹 IDE를 열려면 `/ide`를 입력합니다. IDE에서는 Monaco Editor 기반 문법 강조, 기본 자동완성, 포맷 버튼, API 자동완성 버튼을 사용할 수 있습니다.

IDE에서는 Monaco Editor 기반 문법 강조, 자동 줄바꿈, 언어별 내장 사전/스니펫 자동완성, 포맷, 복사, Discord 전송을 사용할 수 있습니다.
`Suggest` 버튼이나 `Ctrl/Cmd + Space`로 자동완성 목록을 열 수 있습니다.
자동완성 사전은 `src/completionData.js`에서 관리하며, 웹 IDE는 `/api/completions`로 같은 사전을 받아 사용합니다.

사이트에서 Discord로 보내려면 IDE 상단의 `Discord channel ID`에 보낼 채널 ID를 넣고 `Send`를 누릅니다.
코드는 전송 전에 자동 포맷되며, Discord 메시지에는 다시 IDE에서 열어 수정할 수 있는 링크가 함께 붙습니다.
봇이 `/fmt` 또는 `!fmt`로 만든 포맷 결과에도 같은 수정 링크가 붙습니다.
Discord에서 `/ide`를 입력해 사이트를 열면, 해당 채널 ID가 URL에 포함되어 IDE의 채널 입력칸에 자동으로 들어갑니다.

채널 ID는 Discord 개발자 모드를 켠 뒤 채널을 우클릭해서 복사할 수 있습니다.

`WEB_SEND_SECRET`은 공개 사이트에서 아무나 봇으로 메시지를 보내지 못하게 막는 전송 비밀번호입니다.
설정한 경우 IDE 상단의 `Send secret`에도 같은 값을 입력해야 전송됩니다. 설정하지 않으면 `Send secret`은 비워둬도 됩니다.

AI 기반 자동완성 API도 남겨둘 수 있습니다. `OPENAI_API_KEY`를 설정하면 `/api/complete`가 OpenAI Responses API로 동작합니다. 현재 웹 화면의 `Suggest`는 AI 없이 내장 사전/스니펫을 사용합니다.

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.2-mini
COMPLETION_MAX_TOKENS=160
```

직접 만든 자동완성 API를 쓰고 싶으면 `COMPLETION_API_URL`을 설정할 수도 있습니다. 해당 API는 다음 JSON을 받을 수 있어야 합니다.

```json
{
  "language": "js",
  "code": "const a = ",
  "cursorOffset": 10,
  "model": "optional-model-name"
}
```

응답은 `completion`, `text`, 또는 OpenAI 호환 `choices[0].message.content` 중 하나를 포함하면 됩니다.

## 외부 도구

Python 포맷을 사용하려면 `black`이 설치되어 있어야 합니다.

```bash
pip install black
```

C/C++ 포맷을 사용하려면 `clang-format`이 설치되어 있어야 합니다.

macOS 예시:

```bash
brew install clang-format
```

Ubuntu/Debian 예시:

```bash
sudo apt-get install clang-format
```

설치되어 있지 않으면 봇이 친절한 오류 메시지로 안내합니다.

C# 포맷을 사용하려면 .NET SDK와 CSharpier가 설치되어 있어야 합니다.

```bash
dotnet tool install -g csharpier
```

이미 설치되어 있다면 업데이트할 수 있습니다.

```bash
dotnet tool update -g csharpier
```

## 프로젝트 구조

```text
.
├── package.json
├── .env.example
├── Dockerfile
├── .dockerignore
├── render.yaml
├── src
│   ├── index.js
│   ├── formatService.js
│   ├── shareStore.js
│   ├── webServer.js
│   └── formatters
│       ├── prettierFormatter.js
│       ├── pythonFormatter.js
│       ├── clangFormatter.js
│       └── csharpFormatter.js
└── README.md
```
