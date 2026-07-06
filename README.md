# Discord Code Format Bot

Discord 채널에서 `!fmt <language>` 또는 `/fmt` 명령어로 코드를 포맷해 주는 discord.js v14 기반 봇입니다.

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

이 저장소에는 `render.yaml`과 `Dockerfile`이 포함되어 있어 Render의 Background Worker로 배포할 수 있습니다.

1. GitHub에 이 프로젝트를 올립니다.
2. Render에서 New > Blueprint를 선택하고 저장소를 연결합니다.
3. Environment Variables에 `DISCORD_TOKEN`을 추가합니다.
4. 배포가 끝난 뒤 로그에 `Logged in as ...`가 보이면 준비 완료입니다.

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
│   └── formatters
│       ├── prettierFormatter.js
│       ├── pythonFormatter.js
│       ├── clangFormatter.js
│       └── csharpFormatter.js
└── README.md
```
