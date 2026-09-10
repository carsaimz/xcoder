# Contribuindo para o XCoder / Contributing to XCoder

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

Guia bilíngue de contribuição — as duas línguas vivem neste mesmo ficheiro.
Bilingual contribution guide — both languages live in this same file.

---

<a id="português"></a>

## 🇧🇷 Português

Obrigado pelo interesse em contribuir com o XCoder! Este guia ajuda você a
começar o desenvolvimento.

## Opções rápidas de início

### Opção 1: DevContainer (recomendado)

1. Instale a extensão [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) no VS Code ou em outro editor com suporte a [DevContainers](https://containers.dev/).
2. Clone e abra o repositório:
   ```bash
   git clone https://github.com/carsaimz/xcoder.git
   code XCoder
   ```
3. Quando o VS Code perguntar "Reopen in Container", clique na opção
   - ou use a paleta de comandos (Cmd/Ctrl+Shift+P) → "Dev Containers: Reopen in Container"
4. Aguarde a construção do contêiner (~5–10 min na primeira vez; as seguintes são instantâneas)
5. Quando estiver pronto, construa o APK:
   ```bash
   pnpm run build paid dev apk
   ```

   > Use qualquer gerenciador de pacotes (pnpm, bun, npm, yarn etc.)

### Opção 2: Docker CLI (para qualquer editor)

> [!NOTE]
> Se quiser usar Podman, saiba que não funciona corretamente até que
> https://github.com/containers/buildah/pull/5845 seja implementado no Podman.

Se o seu editor não suporta DevContainers, use o Docker diretamente:

```bash
# Clone o repositório
git clone https://github.com/carsaimz/xcoder.git
cd XCoder

# Construa a imagem Docker a partir do nosso Dockerfile
docker build --target standalone -t xcoder-dev .devcontainer/

# Rode o contêiner com o seu código montado
docker run -it --rm \
  -v "$(pwd):/workspaces/xcoder" \
  -w /workspaces/xcoder \
  xcoder-dev \
  bash

# Dentro do contêiner, rode o setup e o build
pnpm run setup
pnpm run build paid dev apk # ou pnpm run build p d
```

**Mantendo o contêiner vivo para uso repetido:**
```bash
# Inicie em segundo plano
docker run -d --name xcoder-dev \
  -v "$(pwd):/workspaces/xcoder" \
  -w /workspaces/xcoder \
  xcoder-dev \
  sleep infinity

# Execute comandos no contêiner ativo
docker exec -it xcoder-dev bash -c "pnpm run setup"
docker exec -it xcoder-dev pnpm run build paid dev apk

# Pare e remova ao terminar
docker stop xcoder-dev && docker rm xcoder-dev
```

---

## 🛠️ Setup manual (sem Docker)

Se preferir não usar Docker:

### Pré-requisitos

| Requisito | Versão |
|------------|---------|
| **Node.js** | 18+ (22 recomendado) |
| **pnpm** ou **bun** | Mais recente |
| **Java JDK** | 17+ (21 recomendado) |
| **Android SDK** | API 35 |
| **Gradle** | 8.x |

### Variáveis de ambiente

Adicione ao seu perfil de shell (`~/.bashrc`, `~/.zshrc` ou `~/.config/fish/config.fish`):

**macOS:**
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

**Linux:**
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Mais variáveis na [documentação do Cordova](https://cordova.apache.org/docs/en/latest/guide/platforms/android/index.html).

### Passos de build

```bash
git clone https://github.com/carsaimz/xcoder.git
cd XCoder

pnpm run setup          # dependências + setup do Cordova
pnpm run build paid dev apk   # ou pnpm run build p d
```

O APK ficará em: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

## 📝 Diretrizes de contribuição

### Antes de abrir um PR

1. **Fork** o repositório e crie um branch a partir do `main`
2. **Faça as mudanças** — commits focados e atômicos
3. **Cheque a qualidade do código:**
   ```bash
   pnpm run check
   ```
4. **Teste** num dispositivo ou emulador quando possível

### Checklist do Pull Request

- [ ] Descrição clara das mudanças
- [ ] Referência à issue relacionada (se existir)
- [ ] Capturas de tela/GIFs para mudanças de UI
- [ ] CI passando

### Estilo de código

Usamos [Biome](https://biomejs.dev/) para lint e formatação:
- Rode `pnpm run check` antes de commitar
- Instale a extensão Biome no VS Code para formatar automaticamente

### Mensagens de commit

Use mensagens claras e descritivas:
```
feat: adiciona alternância de tema escuro nas configurações
fix: corrige crash ao abrir ficheiros grandes
docs: atualiza instruções de build
refactor: simplifica a lógica de carregamento de ficheiros
```

## 🌍 Adicionando traduções

1. Crie um JSON em `src/lang/` (ex.: `fr-fr.json` para francês)
2. Registre-o em `src/lib/lang.js`
3. Use os utilitários:
   ```bash
   pnpm run lang add       # Adicionar string
   pnpm run lang remove    # Remover string
   pnpm run lang search    # Buscar strings
   pnpm run lang update    # Atualizar traduções
   ```

## ℹ️ Adicionando novos ícones (à fonte existente)

> [!NOTE]
> O XCoder usa SVGs e os converte numa fonte de ícones, usada no editor e
> por desenvolvedores de plugins. **Ícones específicos de plugin NÃO devem
> entrar no editor — apenas ícones de utilidade geral.**

Ferramentas recomendadas:

| Nome | Plataforma |
|------|----------|
| https://icomoon.io/ | Gratuito (web, PWA, offline) |
| https://fontforge.org/ | Open-source (Linux, Mac, Windows) |

### Passos no IcoMoon

1. Baixe o `code-editor-icon.icomoon.json` de https://github.com/carsaimz/xcoder/tree/main/utils
2. Vá em https://icomoon.io/ > Import
3. Importe o JSON baixado no passo 1
4. Todos os ícones aparecerão após importar
5. Importe o SVG novo que quer adicionar à fonte
6. À direita, ative **Show Characters** e **Show Names** para ver Unicode e nome
7. Dê um nome ao ícone novo (na caixa de nome)
8. Repita os passos 5–7 até terminar
9. Pressione o ícone de exportação no topo à esquerda
10. Clique em download — um zip será baixado
11. Na seção Projects do [icomoon](https://icomoon.io/new-app), expanda o projeto `code-editor-icon` e clique em **save** (baixa o `code-editor-icon.icomoon.json`)

### Atualizando os ficheiros do projeto

1. Extraia o zip; navegue até a pasta `fonts`
2. Renomeie `code-editor-icon.ttf` para `icons.ttf`
3. Copie o `icons.ttf` para https://github.com/carsaimz/xcoder/tree/main/src/res/icons
4. Copie o `code-editor-icon.icomoon.json` para https://github.com/carsaimz/xcoder/tree/main/utils (substituindo pelo novo)
5. Commit **num branch NOVO** (seguindo o [guia de mensagens de commit](#mensagens-de-commit))

## 🔌 Desenvolvimento de plugins

- [Repositório inicial de plugins](https://github.com/carsaimz/xcoder/tree/main/src/plugins)
- [Documentação de plugins](./readme.md)

---

<a id="english"></a>

## 🇺🇸 English

Thank you for your interest in contributing to XCoder! This guide will help you get started with development.

## Quick Start Options

### Option 1: DevContainer (Recommended)

1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) in VS Code or other editors that support [DevContainers](https://containers.dev/).

2. Clone and open the repository:
   ```bash
   git clone https://github.com/carsaimz/xcoder.git
   code XCoder
   ```

3. When VS Code prompts "Reopen in Container", click it
   - Or use Command Palette (Cmd/Ctrl+Shift+P) → "Dev Containers: Reopen in Container"

4. Wait for the container to build (~5-10 minutes first time, subsequent opens are instant)

5. Once ready, build the APK:
   ```bash
   pnpm run build paid dev apk
   ```

   > Use any package manager (pnpm, bun, npm, yarn, etc.)

### Option 2: Docker CLI (For Any Editor)

> [!NOTE]
> If you try to use Podman, Kindly note that it would not work properly until https://github.com/containers/buildah/pull/5845 is merged/implemented in Podman.

If your editor doesn't support DevContainers, you can use Docker directly:

```bash
# Clone the repository
git clone https://github.com/carsaimz/xcoder.git
cd XCoder

# Build the Docker image from our Dockerfile
docker build --target standalone -t xcoder-dev .devcontainer/

# Run the container with your code mounted
docker run -it --rm \
  -v "$(pwd):/workspaces/xcoder" \
  -w /workspaces/xcoder \
  xcoder-dev \
  bash

# Inside the container, run setup and build
pnpm run setup
pnpm run build paid dev apk # or pnpm run build p d
```

**Keep container running for repeated use:**
```bash
# Start container in background
docker run -d --name xcoder-dev \
  -v "$(pwd):/workspaces/xcoder" \
  -w /workspaces/xcoder \
  xcoder-dev \
  sleep infinity

# Execute commands in the running container
docker exec -it xcoder-dev bash -c "pnpm run setup"
docker exec -it xcoder-dev pnpm run build paid dev apk

# Stop and remove when done
docker stop xcoder-dev && docker rm xcoder-dev
```

## 🛠️ Manual Setup (Without Docker)

If you prefer not to use Docker at all:

### Prerequisites

| Requirement | Version |
|------------|---------|
| **Node.js** | 18+ (22 recommended) |
| **pnpm** or **bun** | Latest |
| **Java JDK** | 17+ (21 recommended) |
| **Android SDK** | API 35 |
| **Gradle** | 8.x |

### Environment Setup

Add these to your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`):

**macOS:**
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

**Linux:**
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Some more environment variables, check [cordova docs](https://cordova.apache.org/docs/en/latest/guide/platforms/android/index.html).

### Build Steps

```bash
git clone https://github.com/carsaimz/xcoder.git
cd XCoder

pnpm run setup
pnpm run build paid dev apk # or pnpm run build p d
```

The APK will be at: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

## 📝 Contribution Guidelines

### Before Submitting a PR

1. **Fork** the repository and create a branch from `main`
2. **Make changes** — keep commits focused and atomic
3. **Check code quality:**
   ```bash
   pnpm run check
   ```
4. **Test** on a device or emulator if possible

### Pull Request Checklist

- [ ] Clear description of changes
- [ ] Reference to related issue (if applicable)
- [ ] Screenshots/GIFs for UI changes
- [ ] Passing CI checks

### Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting:
- Run `pnpm run check` before committing
- Install the Biome VS Code extension for auto-formatting

### Commit Messages

Use clear, descriptive messages:
```
feat: add dark mode toggle to settings
fix: resolve crash when opening large files
docs: update build instructions
refactor: simplify file loading logic
```

## 🌍 Adding Translations

1. Create a JSON file in `src/lang/` (e.g., `fr-fr.json` for French)
2. Add it to `src/lib/lang.js`
3. Use the translation utilities:
   ```bash
   pnpm run lang add       # Add new string
   pnpm run lang remove    # Remove string
   pnpm run lang search    # Search strings
   pnpm run lang update    # Update translations
   ```

## ℹ️ Adding New Icons (to the existing font family)

> [!NOTE]
> XCoder uses SVG and converts them into a font family, to be used inside the editor and generally for plugin devs.
>
> **Plugin-specific icons SHOULD NOT be added into the editor. Only generally helpful icons SHOULD BE added.**

| Name | Platform |
|------|----------|
| https://icomoon.io/ | Free (Web-Based, PWA-supported, Offline-supported) |
| https://fontforge.org/ | Open-Source (Linux, Mac, Windows) |

### Steps in Icomoon to add new Icons

1. Download the `code-editor-icon.icomoon.json` file from https://github.com/carsaimz/xcoder/tree/main/utils
2. Go to https://icomoon.io/ > Import
3. Import the `code-editor-icon.icomoon.json` downloaded (in step 1)
4. All icons will be displayed after importing.
5. Import the SVG icon created/downloaded to be added to the Font Family.
6. On the right side, press **enable Show Characters** & **Show Names** to view the Unicode character & Name for that icon.
7. Provide the newly added SVG icon with a name (in the name box).
8. Repeat Step 5 and Step 7 until all needed new icons are added.
9. Press the export icon from the top left-hand side.
10. Press the download button, and a zip file will be downloaded.
11. Go to the Projects section of [icomoon](https://icomoon.io/new-app), uncollapse/expand the Project named `code-editor-icon` and press the **save** button (this downloads the project file named: `code-editor-icon.icomoon.json`)

### Updating Project files for Icon Contribution

1. Extract the downloaded zip file; navigate to the `fonts` folder inside it.
2. Rename `code-editor-icon.ttf` to `icons.ttf`.
3. Copy & paste the renamed `icons.ttf` into https://github.com/carsaimz/xcoder/tree/main/src/res/icons
4. Copy and paste the `code-editor-icon.icomoon.json` file (downloaded in the adding icons steps) onto https://github.com/carsaimz/xcoder/tree/main/utils (yes, replace it with the newer one we downloaded!)
5. Commit the changes **ON A NEW branch** (following the [Commit Messages guide](#commit-messages-1))

## 🔌 Plugin Development

To create plugins for XCoder:
- [Plugin Starter Repository](https://github.com/carsaimz/xcoder/tree/main/src/plugins)
- [Plugin Documentation](./readme.md)
