# Contribuindo / Contributing

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

Obrigado por querer contribuir! O XCoder é um projeto de comunidade e toda forma de ajuda conta. Este guia resume o fluxo.

## Formas de contribuir

- **Código** — bugs, recursos, refatorações (veja [[Build|Compilar do código-fonte]] para o ambiente).
- **Traduções** — 31 idiomas; o português e o inglês são os arquivos-mestre.
- **Documentação** — esta wiki, os docs do repositório e o site da comunidade.
- **Plugins** — publique no marketplace e ajude outros autores.
- **Testes e bug reports** — issues bem escritas valem ouro.

## Fluxo de código (pull requests)

1. **Abra uma issue primeiro** para bugs/feature não triviais — alinhamos o desenho antes do código.
2. Faça um fork, crie uma branch descritiva: `git checkout -b feat/minha-feature`.
3. Implemente com os padrões do projeto (o lint dita a formatação — não discuta tabs no PR 😄).
4. Rode a tríade de qualidade **antes** do PR:
   ```bash
   npm run check && npm run typecheck && npm run test
   ```
5. Abra o PR preenchendo o template (checklist bilíngue) e referencie a issue (`Closes #123`).

Os templates de **bug report** e **feature request** ficam em `.github/ISSUE_TEMPLATE/` e o de **PR** em `.github/PULL_REQUEST_TEMPLATE.md`.

## Traduções

O arquivo-mestre é `src/lang/en-us.json`; o português (`pt-br.json`) deve estar sempre 100%. Para traduzir/adicionar um idioma:

1. Copie o `en-us.json` para o código do idioma (ex.: `pt-pt.json`).
2. Traduza os valores — **não renomeie chaves**.
3. Rode `npm run lang:check` para validar cobertura contra o mestre.
4. Abra o PR — a varredura de traduções é automatizada, então traduções incompletas aparecem no relatório antes de a revisão humana entrar.

Chaves de comandos da paleta usam o prefixo `cmd:` e também fazem parte da varredura.

## Documentação e wiki

Melhorias nesta wiki são PRs diretos: os fontes ficam em `wiki/` no repositório e o mesmo conteúdo alimenta o site ([xcoder-web](https://github.com/carsaimz/xcoder-web)). Correções de erro de português/inglês são aceitas na hora.

## Estilo de commits

Padrão *Conventional Commits*: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:` — exemplos reais do histórico: `feat(plugins): own plugin marketplace — remote registry...`, `style(brand): correct icon layout...`.

## Comunidade

- Discussões, dúvidas e ideias: [Discussões](https://github.com/carsaimz/xcoder/discussions)
- Reporte bugs com o template em [Issues](https://github.com/carsaimz/xcoder/issues/new/choose)
- Conduta: seja gentil, seja claro, ajude quem está começando — foi assim que o software livre chegou até aqui.

## Agradecimentos

O XCoder existe por cima de ombros de gigantes: o [Acode](https://github.com/Acode-Foundation/Acode) da Foxdebug (base do fork), CodeMirror 6, o ecossistema Cordova, e todos os contribuidores e usuários que testam, traduzem e divulgam. Obrigado!

---

<a id="english"></a>

## 🇺🇸 English

Thank you for wanting to contribute! XCoder is a community project and every form of help counts. This guide sums up the flow.

## Ways to contribute

- **Code** — bugs, features, refactors (see [[Build|Building from source]] for the environment).
- **Translations** — 31 languages; Portuguese and English are the master files.
- **Documentation** — this wiki, the repository docs and the community website.
- **Plugins** — publish to the marketplace and help other authors.
- **Tests and bug reports** — well-written issues are worth gold.

## Code flow (pull requests)

1. **Open an issue first** for non-trivial bugs/features — we align on the design before the code.
2. Fork the repo and create a descriptive branch: `git checkout -b feat/my-feature`.
3. Implement with the project's standards (lint dictates formatting — do not argue about tabs in the PR 😄).
4. Run the quality triad **before** the PR:
   ```bash
   npm run check && npm run typecheck && npm run test
   ```
5. Open the PR filling in the template (bilingual checklist) and reference the issue (`Closes #123`).

The **bug report** and **feature request** templates live in `.github/ISSUE_TEMPLATE/` and the **PR** template in `.github/PULL_REQUEST_TEMPLATE.md`.

## Translations

The master file is `src/lang/en-us.json`; Portuguese (`pt-br.json`) should always be 100%. To translate/add a language:

1. Copy `en-us.json` to the language code (e.g. `pt-pt.json`).
2. Translate the values — **do not rename keys**.
3. Run `npm run lang:check` to validate coverage against the master.
4. Open the PR — the translation scan is automated, so incomplete translations show up in the report before human review kicks in.

Command palette keys use the `cmd:` prefix and are part of the scan too.

## Documentation and wiki

Improvements to this wiki are direct PRs: the sources live in `wiki/` in the repository and the same content feeds the website ([xcoder-web](https://github.com/carsaimz/xcoder-web)). Portuguese/English typo fixes are accepted on the spot.

## Commit style

*Conventional Commits* standard: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:` — real examples from history: `feat(plugins): own plugin marketplace — remote registry...`, `style(brand): correct icon layout...`.

## Community

- Discussions, questions and ideas: [Discussions](https://github.com/carsaimz/xcoder/discussions)
- Report bugs with the template at [Issues](https://github.com/carsaimz/xcoder/issues/new/choose)
- Conduct: be kind, be clear, help beginners — that is how free software got this far.

## Acknowledgements

XCoder stands on the shoulders of giants: Foxdebug's [Acode](https://github.com/Acode-Foundation/Acode) (the fork's base), CodeMirror 6, the Cordova ecosystem, and every contributor and user who tests, translates and spreads the word. Thank you!
