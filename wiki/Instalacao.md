# Instalação / Installation

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

O XCoder é distribuído como um APK Android instalável diretamente no aparelho. Não há versão para iOS, Windows ou Linux — o alvo do projeto é Android 8.0 ou superior.

## Requisitos

- **Android 8.0 (API 26) ou superior** — versões anteriores não são suportadas.
- Aproximadamente **150 MB de espaço livre** (app + cache de projetos).
- Conexão com a internet **apenas para recursos online** (IA, Git remoto, marketplace). O editor funciona 100% offline.

## Instalar pela última versão estável

1. Acesse a página de [Releases](https://github.com/carsaimz/xcoder/releases) do repositório.
2. Na versão mais recente (por exemplo `v1.4.4`), baixe o arquivo **APK** publicado nos *assets* da release.
3. No aparelho, abra o APK baixado. O Android perguntará se você permite instalar apps dessa fonte — confirme (**Configurações › Segurança › Instalar apps desconhecidos**, o caminho exato varia conforme o fabricante).
4. Conclua a instalação e abra o XCoder.

> **Dica**: se o aparelho acusar "app danificado" ou "bloqueado pelo Play Protect", toque em *Instalar mesmo assim*. O APK é compilado diretamente do código-fonte aberto deste repositório — nada é distribuído por canais oficiais (Play Store) no momento.

## Atualizações

Não há atualização automática. Acompanhe as [Releases](https://github.com/carsaimz/xcoder/releases) ou o canal [Discussões › Anúncios](https://github.com/carsaimz/xcoder/discussions) para saber quando uma versão nova sai. Para atualizar, basta instalar o APK novo **por cima** do existente — seus projetos, configurações e tokens são preservados.

## Verificar a versão instalada

Abra **Configurações (Ctrl-,) › Sobre** — o número da versão aparece no topo. Toque **7 vezes** no número da versão para revelar o menu oculto de desenvolvedor (limpar cache, reiniciar, console e informações de build). Veja [[Solucao-de-Problemas]] quando algo der errado.

## Compilar a partir do código-fonte

Se preferir compilar você mesmo (para testar recursos em desenvolvimento, personalizar o app ou contribuir), siga o guia [[Build|Compilar do código-fonte]]. O repositório é público e a build de produção é gerada com o mesmo processo documentado lá.

---

<a id="english"></a>

## 🇺🇸 English

XCoder is distributed as an Android APK installed directly on the device. There is no iOS, Windows or Linux version — the project targets Android 8.0 or higher.

## Requirements

- **Android 8.0 (API 26) or higher** — earlier versions are not supported.
- Roughly **150 MB of free space** (app + project cache).
- Internet connection **only for online features** (AI, remote Git, marketplace). The editor works 100% offline.

## Install from the latest stable release

1. Go to the repository's [Releases](https://github.com/carsaimz/xcoder/releases) page.
2. On the most recent version (for example `v1.4.4`), download the **APK** file published in the release *assets*.
3. On the device, open the downloaded APK. Android will ask whether you allow installing apps from this source — confirm (**Settings › Security › Install unknown apps**, the exact path varies by manufacturer).
4. Finish the installation and open XCoder.

> **Tip**: if the device reports a "damaged app" or "blocked by Play Protect", tap *Install anyway*. The APK is compiled directly from this repository's open source code — nothing is distributed through official channels (Play Store) at the moment.

## Updates

There is no automatic update. Watch the [Releases](https://github.com/carsaimz/xcoder/releases) page or the [Discussions › Announcements](https://github.com/carsaimz/xcoder/discussions) channel to know when a new version ships. To update, simply install the new APK **on top of** the existing one — your projects, settings and tokens are preserved.

## Check the installed version

Open **Settings (Ctrl-,) › About** — the version number appears at the top. Tap the version number **7 times** to reveal the hidden developer menu (clear cache, restart, console and build info). See [[Solucao-de-Problemas|Troubleshooting]] when something goes wrong.

## Build from source

If you prefer to compile it yourself (to test features in development, customize the app or contribute), follow the [[Build|Building from source]] guide. The repository is public and the production build is generated with the exact process documented there.
