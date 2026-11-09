This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Convenções deste projeto

- Não altere arquivos fora do escopo pedido. Explique cada alteração.
- Componentes ficam em `components/`, um arquivo por componente.
- Estado nunca é modificado no lugar: sempre gere um novo valor.
- Valores que podem ser calculados a partir do estado não viram estado.
- Antes de usar um pacote, confirme na documentação se ele funciona no Expo Go.

## Contexto desta prova de conceito

- TCC: criação de uma NPU em FPGA, parte de uma plataforma educacional com um SoC RISC-V. O Digit-Tracker, um app Python do TCC, classifica dígitos desenhados com uma CNN que roda na NPU. Nesta PoC a NPU roda na versão simulada, no computador.
- Problema: a NPU roda no computador (simulada, ou na FPGA por UART), não no celular. A PoC investiga como um app Expo pode ser a entrada da NPU, enviando o dígito desenhado a uma API ponte no computador e mostrando a predição.
- Tecnologia investigada: desenho com `react-native-svg` + `PanResponder` e consumo de API com `fetch` (timeout com `AbortController`).
- Uma tela só, em `App.tsx`: o usuário desenha um dígito com o dedo, toca em "Classificar" e vê o dígito previsto, o backend (FPGA ou simulado) e o tempo de resposta. Há também o botão "Limpar".
- O app envia os traços, não a imagem: `POST /infer` com JSON `{"tracos": [[[x, y], ...], ...]}`, um traço por toque contínuo do dedo, em coordenadas da área de desenho. A ponte aplica o pré-processamento 28x28 do Digit-Tracker. A resposta tem `digito`, `backend` ("FPGA" ou "simulado"), `tempo_ms`, `confianca`, `logits` e `entrada`; erros vêm como `{"erro": "..."}`. O contrato completo está em `bridge/README.md`.
- O endereço da API ponte fica em uma constante no topo do `App.tsx` (IP do computador na rede local, porta 8000).
- A API ponte é um script Python separado, em `bridge/`, fora do app Expo. Não a reescreva dentro do app.
- Não usar Expo Router, a menos que a tecnologia investigada seja a navegação.
- Fora de escopo: login, design final, câmera, MediaPipe, Bluetooth e tudo que não demonstre a pergunta.