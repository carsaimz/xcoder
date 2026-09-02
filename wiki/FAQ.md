# Perguntas frequentes (FAQ)

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
