# Instalação

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
