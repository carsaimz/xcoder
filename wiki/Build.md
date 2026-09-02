# Compilar do código-fonte

Compilar o XCoder você mesmo é o primeiro passo para contribuir com código — e também garante builds personalizadas (renomear o app, embutir um tema, remover algo que não usa).

## Pré-requisitos

- **Node.js 18+** (recomendado 20/22) e npm
- **JDK 17** para a build Android
- **Android SDK** (platform-tools + build-tools; o Android Studio resolve tudo, ou apenas `sdkmanager` em linha de comando)
- **Git**

## Passo a passo

```bash
# 1. Clone
git clone https://github.com/carsaimz/xcoder.git
cd xcoder

# 2. Instale as dependências
npm install

# 3. Setup do ambiente (auxiliares do Cordova etc.)
npm run setup

# 4. Build web (bundle com rspack)
npm run build

# 5. Rode em modo dev com recarga (navegador)
npm run dev

# 6. Build Android
npx cordova build android   # APK de debug; release exige keystore própria
```

O APK de debug sai em `platforms/android/app/build/outputs/apk/debug/`; o de release requer assinatura própria (keystore) conforme a documentação padrão do Cordova/Gradle.

## Scripts disponíveis

| Script | O que faz |
|---|---|
| `npm run build` | Build de produção do bundle web (rspack) |
| `npm run dev` | Servidor de desenvolvimento com recarga |
| `npm run dev:android` | Dev apontando para o device/emulador Android |
| `npm run test` | Suíte de testes (Vitest) |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run check` | Lint + formatação (Biome) |
| `npm run lang:check` | Varredura de traduções faltantes |
| `npm run plugin` | Auxiliar de criação/empacotamento de plugins |

## Qualidade obrigatória para PRs

Antes de abrir pull request, rode a tríade — é o que a revisão vai verificar primeiro:

```bash
npm run check && npm run typecheck && npm run test
```

## Estrutura do repositório

```
src/
├── api/            # fachadas públicas (xcoder.require) e tipos
├── components/     # componentes de UI (terminal, logo, menus...)
├── core/           # motores internos
├── lib/            # serviços: IA, Git, settings, keyBindings, i18n...
├── lang/           # 31 idiomas (en-us é o arquivo-mestre)
├── pages/          # páginas (welcome, about, plugins...)
├── sidebarApps/    # apps da barra lateral (explorador, Git, IA, search...)
├── sidebar/        # infraestrutura da barra lateral
└── theme/          # temas pré-instalados
res/android/        # ícones e recursos nativos
docs/               # documentação para desenvolvedores
```

Dúvidas de arquitetura? Comece por `src/lib/xcoder.js` (a API global que os plugins consomem) e pelos docs do repositório. E veja [[Contribuindo]] para o fluxo de PRs.
