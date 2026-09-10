# Perguntas frequentes (FAQ) / Frequently asked questions (FAQ)

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

## Geral

**O XCoder é gratuito?**
Sim, em todos os sentidos: o app é gratuito, o código é aberto (MIT) e não há versão "premium". Alguns provedores de IA cobram pelo uso das suas APIs — isso é entre você e o provedor, não com o app.

**Qual a diferença para o Acode?**
O XCoder é um fork mantido pela comunidade com foco em evolução rápida: assistente de IA com 20 provedores e chat lateral, login GitHub por device flow, marketplace próprio de plugins com registro remoto, novo visual e ícones, 30 temas, português como fallback de primeira execução, troca de idioma imediata, paleta de comandos com busca fuzzy e traduções, menu de desenvolvedor oculto, e correções contínuas de estabilidade. Veja os [releases](https://github.com/carsaimz/xcoder/releases) para o detalhado.

**Tem para iPhone/Windows/Linux?**
Não — o projeto é Android (8.0+). Em PCs, o Acode original também não atende; existem ótimas opções nativas (VS Code etc.).

**Funciona offline?**
O editor, terminal, temas, plugins instalados e Git local funcionam 100% offline. Rede é necessária para: IA, push/pull do Git, marketplace e changelog.

## Privacidade e segurança

**Onde ficam meus tokens (IA e GitHub)?**
Somente no armazenamento local do app. O chat de IA fala direto com o endpoint do provedor; o Git fala direto com a API do GitHub. Nenhum servidor do projeto intermedeia ou armazena credenciais.

**O app coleta dados?**
Não há telemetria embutida. Uma integração opcional com Firebase (analytics/crashlytics, sempre desligada por padrão) está prevista e será ativada **somente** com consentimento explícito — veja [[Integracao-App]].

**Posso usar meu próprio backend?**
Sim — **Configurações › Backend URL** aponta para qualquer instância compatível ([xcoder-backend](https://github.com/carsaimz/xcoder-backend) ou o site da comunidade). marketplace, anúncios e configurações remota passam a vir de lá. Detalhes em [[Integracao-App]].

## Plugins

**De onde vêm os plugins do marketplace?**
Do registro oficial em [carsaimz/xcoder-plugins](https://github.com/carsaimz/xcoder-plugins), servido via GitHub raw com espelho no jsDelivr. Você pode apontar para qualquer registro próprio em **Marketplace URL**.

**Como publico meu plugin?**
Issue ou PR no repositório do registro — guia completo em [[Plugins]].

## Ajuda

**Encontrei um bug — o que faço?**
1. Confira a [[Solucao-de-Problemas]] (o menu dev oculto copia as infos de build).
2. Abra uma issue com o template em [Issues](https://github.com/carsaimz/xcoder/issues/new/choose).
3. Se puder, traga o log do console (menu dev › Console).

**Como ajudo o projeto?**
Código, traduções, documentação, testes e divulgação — tudo vale. Comece por [[Contribuindo]]. Dúvidas e ideias vão nas [Discussões](https://github.com/carsaimz/xcoder/discussions), o fórum oficial.

---

<a id="english"></a>

## 🇺🇸 English

## General

**Is XCoder free?**
Yes, in every sense: the app is free, the code is open (MIT) and there is no "premium" version. Some AI providers charge for their API usage — that is between you and the provider, not with the app.

**How is it different from Acode?**
XCoder is a community-maintained fork focused on fast evolution: an AI assistant with 20 providers and a side chat, GitHub login via device flow, its own plugin marketplace with a remote registry, new look and icons, 30 themes, Portuguese as the first-run fallback, instant language switching, a command palette with fuzzy search and translations, a hidden developer menu, and continuous stability fixes. See the [releases](https://github.com/carsaimz/xcoder/releases) for the details.

**Is there an iPhone/Windows/Linux version?**
No — the project is Android (8.0+). On desktops, the original Acode does not cover it either; there are great native options (VS Code etc.).

**Does it work offline?**
The editor, terminal, themes, installed plugins and local Git work 100% offline. Network is needed for: AI, Git push/pull, marketplace and changelog.

## Privacy and security

**Where are my tokens kept (AI and GitHub)?**
Only in the app's local storage. The AI chat talks straight to the provider's endpoint; Git talks straight to the GitHub API. No project server intermediates or stores credentials.

**Does the app collect data?**
There is no built-in telemetry. An optional Firebase integration (analytics/crashlytics, always off by default) is planned and will be enabled **only** with explicit consent — see [[Integracao-App|Integration API]].

**Can I use my own backend?**
Yes — **Settings › Backend URL** points to any compatible instance ([xcoder-backend](https://github.com/carsaimz/xcoder-backend) or the community website). Marketplace, announcements and remote config then come from there. Details in [[Integracao-App|Integration API]].

## Plugins

**Where do marketplace plugins come from?**
From the official registry at [carsaimz/xcoder-plugins](https://github.com/carsaimz/xcoder-plugins), served via GitHub raw with a jsDelivr mirror. You can point to any registry of your own under **Marketplace URL**.

**How do I publish my plugin?**
Issue or PR on the registry repository — full guide in [[Plugins]].

## Help

**Found a bug — what do I do?**
1. Check [[Solucao-de-Problemas|Troubleshooting]] (the hidden dev menu copies the build info).
2. Open an issue with the template at [Issues](https://github.com/carsaimz/xcoder/issues/new/choose).
3. If possible, bring the console log (dev menu › Console).

**How can I help the project?**
Code, translations, documentation, tests and outreach — everything counts. Start at [[Contribuindo|Contributing]]. Questions and ideas go to [Discussions](https://github.com/carsaimz/xcoder/discussions), the official forum.
