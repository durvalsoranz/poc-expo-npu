# Diário de pesquisa

## Contexto do TCC
Plataforma educacional baseada em um SoC RISC-V com NPU (matriz sistólica) em FPGA, controlada por um app desktop PyQt5 (GUI-TCC) com experimentos de arquitetura, sistema operacional e redes neurais. O Eureka (Digit-Tracker) classifica dígitos desenhados no ar com uma CNN que roda na NPU, com a imagem enviada por UART a 921600 baud.

## Pergunta de pesquisa
Como o Expo (`react-native-svg` + `fetch`) permite desenhar um dígito no celular, enviá-lo a uma API ponte do Eureka e mostrar a predição da NPU, na condição de que a NPU está ligada por UART a um computador e a rede local pode falhar?

## Alternativas consideradas

Legenda das conferências (fontes lidas em 09/11/2026): **[doc]** = confirmado na página oficial; **[IA]** = veio das IAs ou de raciocínio próprio, a página não diz.

### Parte 1: capturar o desenho e gerar a imagem 28x28
| Opção | Serve para | Decisão |
|-------|-----------|---------|
| `react-native-svg` + `PanResponder` | Desenhar o traço como `Path` e guardar as coordenadas do dedo | **Sim.** Incluído no Expo Go [doc: selo na página, versão 15.16.0]. O 28x28 é gerado a partir dos pontos em JS puro, sem capturar a tela [IA: nenhuma página trata de rasterizar a partir de coordenadas]. Atenção: `moveX`/`moveY` do `PanResponder` são coordenadas de **tela** [doc]; é preciso convertê-las para o sistema do canvas (subtrair a posição da `View`). |
| `react-native-svg` + `react-native-gesture-handler` | Mesmo que o anterior, com gestos mais robustos | **Não, por ora.** Dependência a mais para uma tela com um dedo. Plano B se o traço travar no aparelho. [A página do `PanResponder` não menciona o gesture-handler; o plano B é decisão nossa.] |
| `@shopify/react-native-skia` | Canvas de alto desempenho e leitura direta de pixels | **Não.** Incluído no Expo Go [doc: selo, versão 2.14.0], mas é exagero para uma tela. [IA: a página do Expo não fala em "alto desempenho", em leitura de pixels nem em o Expo Go ficar atrás da lib; esses pontos vêm das IAs e não foram confirmados.] |
| `react-native-view-shot` | "Foto" de uma `View` como arquivo de imagem | **Não.** Gera uma imagem (o exemplo da página usa PNG com `result: 'tmpfile'`) que teria de ser decodificada para 28x28 [IA: a necessidade de decodificar é inferência nossa]. Ressalva [doc]: a página cita justamente o caso de assinatura, em que o usuário desenha e se salva uma imagem, e permite definir largura/altura em pixels físicos (dividindo pelo `PixelRatio`). "As duas IAs concordam" não basta como argumento; o motivo real é evitar a decodificação. Incluído no Expo Go (versão 6.1.1). |
| WebView com `<canvas>` | Desenhar em HTML e ler pixels com `getImageData` | **Não.** Plano B se a rasterização em JS ficar ruim; a troca de mensagens complica a depuração. [A página do Expo (versão 14.0.1, incluída no Expo Go) mostra só `source` com URL e HTML inline; `<canvas>`, `getImageData` e troca de mensagens não aparecem lá.] |

### Parte 2: enviar à API e tratar espera, timeout e erro
| Opção | Serve para | Decisão |
|-------|-----------|---------|
| `fetch` + `AbortController` + `setTimeout` | POST com timeout manual, sem dependências | **Sim.** As duas IAs apontam como base. Timeout de 5 s (critério do servidor desligado). [doc: a página Networking confirma `fetch` com POST e JSON, mas **não menciona `AbortController` nem timeout**; testar no aparelho.] |
| `AbortSignal.timeout()` | Timeout em uma linha, como no navegador | **Não.** Suporte no React Native não confirmado em fonte oficial [doc: a página Networking não menciona]; testar no aparelho (ver "Onde a IA errou"). |
| `@tanstack/react-query` (`useMutation`) | Estados prontos, retry e cache | **Não.** As duas IAs consideram exagero para um POST por toque. [doc: a página de React Native diz que a lib funciona sem configuração extra e trata `onlineManager` e `focusManager`.] |
| `axios` | Opção `timeout` pronta e parse automático de JSON | **Não.** Dependência extra sem ganho sobre `fetch` + `AbortController`. [doc: a página Networking confirma que axios funciona via `XMLHttpRequest`; `timeout` e parse de JSON não aparecem lá.] |
| `@react-native-community/netinfo` | Detectar se o aparelho está sem Wi-Fi antes de enviar | **Não na PoC.** Não detecta servidor desligado; esse caso é coberto pelo timeout. [doc: a página (versão 12.0.1, incluída no Expo Go) fala em tipo e qualidade de conexão, com exemplos de `isConnected`; nada sobre alcançar um servidor específico. Conclusão sobre servidor desligado = a confirmar no teste.] Alternativa citada na página do TanStack: `expo-network`. |
| WebSocket | Comunicação contínua com o servidor | **Não.** Um envio por toque não precisa de conexão persistente. [doc: a página Networking confirma que o React Native suporta WebSocket.] |

## Comparação entre IAs (exercício 3)
Mesmo prompt de mapa do tema, rodado no Claude (com busca na web) e no Gemini.

### Onde concordam
- `fetch` + `AbortController` é a base da comunicação, sem dependências. *(Conferência: a página Networking confirma o `fetch`; `AbortController` não aparece nela.)*
- TanStack Query é exagero para uma única requisição por toque.
- `react-native-view-shot` é ruim para o caso, porque gera um arquivo que precisa ser decodificado. *(Conferência: a página do Expo cita assinatura/desenho como caso de uso e permite fixar o tamanho em pixels; o ponto da decodificação é inferência.)*
- WebView com `<canvas>` resolve o 28x28 com `getImageData`, ao custo da troca de mensagens. *(Conferência: não confirmado na página do Expo.)*

### Onde divergem
| Ponto | Claude | Gemini | O que a documentação confirma |
|-------|--------|--------|-------------------------------|
| Origem do 28x28 | Rasterizar a partir das coordenadas do traço, em JS; a lib de desenho só mostra o traço | Só considera capturar pixels da tela (Skia, WebView ou SVG + view-shot) | Nenhuma página oficial trata de rasterizar a partir de coordenadas. A página do view-shot cita captura de assinatura como caso de uso. [a confirmar no experimento: acurácia com rasterização em JS] |
| Opção preferida na Parte 1 | `react-native-svg` + `PanResponder` (mais simples) | Skia ("altíssima performance", extrai pixels sem arquivos) | As duas libs aparecem como "Included in Expo Go" (svg 15.16.0, skia 2.14.0). A página do Skia no Expo não fala em desempenho nem em leitura de pixels; o argumento do Gemini não vem da doc. |
| Papel do `react-native-svg` | Usado sozinho, sem view-shot | Sempre acoplado ao view-shot, e por isso descartado | Confirmado: são pacotes independentes (a página do svg não cita o view-shot). O acoplamento do Gemini corresponde ao caso de assinatura da página do view-shot, mas não é obrigatório. |
| Compatibilidade com Expo Go | Confere página por página e aponta a página do Expo SDK | Afirma no início que tudo é compatível, mas linka os repositórios no GitHub, que não mostram isso | Confirmado: as 5 páginas do Expo (svg, skia, view-shot, netinfo, webview) mostram o selo "Included in Expo Go". Os repositórios do GitHub não foram abertos. |
| Opções da Parte 2 | `fetch`, `AbortSignal.timeout()`, TanStack, NetInfo, axios, WebSocket | `fetch`, axios, TanStack | A página Networking confirma `fetch`, `XMLHttpRequest`/axios e WebSocket. Não menciona `AbortController` nem `AbortSignal.timeout()`. |
| Sem rede vs. servidor fora do ar | Distingue: NetInfo pega Wi-Fi desligado, só o timeout pega a ponte fora do ar | Não aborda | A página do NetInfo descreve tipo/qualidade de conexão e `isConnected`; não trata de alcançar um servidor específico. [a confirmar no teste com o servidor desligado] |
| Ponto fraco do `fetch` | Não tem retry nem cache | Exige criar estados (`isLoading`, `isError`) à mão | **Não confirmado na doc.** A página Networking só alerta que os erros do `fetch` devem ser capturados com `catch`, senão se perdem em silêncio. As duas observações são plausíveis e se complementam, mas não estão documentadas. |
| Armadilhas de rede | Levanta HTTP sem TLS no Android e permissão de rede local no iOS (não confirmadas) | Não aborda | Android confirmado: a partir da API 28, tráfego em texto claro é bloqueado por padrão (`usesCleartextTraffic`). Novo: o iOS também exige HTTPS por padrão (App Transport Security), com exceção via `Info.plist`. Permissão de rede local no iOS: não aparece na página. [a confirmar no aparelho] |
| Link do TanStack Query | Página específica de React Native | Visão geral do framework React | Confirmado: a página de React Native é a que trata do `onlineManager` (com NetInfo ou `expo-network`) e do `focusManager`. O link v5 redireciona para `/query/latest/docs/framework/react/react-native`. |

## Comparação das libs de desenho (prompt de comparação)
Prompt de comparação da apostila, com as colunas pedidas. Mesma legenda: **[doc]** = confirmado na página oficial; **[IA]** = veio da IA, a página não diz.

| Lib | Funciona no Expo Go | Android e iOS | Complexidade de uso | Limitações conhecidas |
|-----|---------------------|---------------|---------------------|-----------------------|
| `react-native-svg` | Sim [doc: selo, versão 15.16.0] | Sim [doc] | Baixa: `PanResponder` + `Path`; 28x28 rasterizado em JS a partir dos pontos [IA] | Coordenadas do `PanResponder` são de tela e precisam de conversão [doc]; não lê pixels da tela diretamente [IA]; muitos pontos podem pesar em aparelhos fracos [IA] |
| `@shopify/react-native-skia` | Sim [doc: selo, versão 2.14.0] | Sim [doc] | Média a alta: API gráfica própria [IA] | Versão no Expo Go pode ficar atrás da lib (artigo de 2024, fonte não oficial) [IA] |
| `react-native-view-shot` | Sim [doc: selo, versão 6.1.1] | Sim [doc] | Baixa para capturar, alta para chegar ao 28x28 [IA] | Gera imagem em arquivo (exemplo com PNG e `tmpfile`) [doc]; precisaria ser decodificada para 28x28 [IA]; a página cita o caso de assinatura e permite fixar o tamanho em pixels [doc] |
| `react-native-webview` | Sim [doc: selo, versão 14.0.1] | Sim [doc] | Média: HTML + `<canvas>` + troca de mensagens [IA] | Dois ambientes JS para depurar [IA]; um tutorial de terceiros (2026) diz que não roda no Expo Go no iOS 18+, contradizendo o selo da página oficial [IA, fonte não oficial; testar no aparelho] |

Conclusão: as quatro funcionam no Expo Go [doc]. A escolha de `react-native-svg` se apoia na menor complexidade e em não precisar decodificar imagem, e esses dois pontos são [IA], a confirmar na construção.

## Achados da leitura das fontes
1. **view-shot cita o nosso caso.** A página do Expo menciona assinatura (usuário desenha, app salva imagem) e mostra como fixar largura/altura em pixels físicos, dividindo pelo `PixelRatio`. Continua fora da PoC por exigir decodificação, mas o argumento deve ser esse, e não "as IAs concordam".
2. **Coordenadas do PanResponder.** `moveX`/`moveY` são de tela; converter para o sistema do canvas antes de montar o `Path` e o 28x28.
3. **iOS também bloqueia HTTP puro.** A ponte na rede local provavelmente será `http://192.168...`; testar no iOS, não só no Android.
4. **Alternativa ao NetInfo:** `expo-network`, citada na página do TanStack para o `onlineManager`.
5. **Sem respaldo oficial até aqui:** `AbortController`/timeout no `fetch`, `AbortSignal.timeout()`, rasterização em JS, servidor desligado vs. NetInfo, permissão de rede local no iOS. Todos dependem do teste no aparelho.

## Fontes oficiais lidas
Marque `[x]` depois de abrir cada página e conferir o que está anotado acima. (Todas abertas e conferidas em 09/11/2026.)
- [x] Expo: react-native-svg (https://docs.expo.dev/versions/latest/sdk/svg/)
- [x] Expo: @shopify/react-native-skia (https://docs.expo.dev/versions/latest/sdk/skia/)
- [x] Expo: react-native-view-shot (https://docs.expo.dev/versions/latest/sdk/captureRef/)
- [x] Expo: @react-native-community/netinfo (https://docs.expo.dev/versions/latest/sdk/netinfo/)
- [x] Expo: react-native-webview (https://docs.expo.dev/versions/latest/sdk/webview/)
- [x] React Native: PanResponder (https://reactnative.dev/docs/panresponder)
- [x] React Native: Networking (https://reactnative.dev/docs/network)
- [x] TanStack Query: React Native (https://tanstack.com/query/v5/docs/react/react-native)

## Onde a IA errou
- Pedido: mapa do tema (Claude), alternativa TanStack Query.
- O que veio: "a doc diz que ele foi pensado para funcionar com React Native sem configuração extra".
- Como percebi: documentação. A mesma página diz que, para refazer requisições ao reconectar, é preciso configurar o `onlineManager` (com NetInfo) à mão.
- O certo: o TanStack Query funciona no React Native, mas o comportamento de rede (reconexão) precisa de configuração extra.

- Pedido: mapa do tema (Gemini), compatibilidade com Expo Go.
- O que veio: "alternativas compatíveis com o Expo Go", com links apenas para os repositórios no GitHub.
- Como percebi: documentação. Os READMEs no GitHub não indicam se a lib roda no Expo Go; essa informação está na página de cada lib na referência do Expo SDK.
- O certo: as cinco libs da Parte 1 aparecem como "Included in Expo Go" na referência do SDK. A afirmação estava certa, mas sem uma fonte que a confirmasse.

- Pedido: mapa do tema (Claude), timeout do `fetch`.
- O que veio: `AbortSignal.timeout()` "provavelmente não existe" no React Native, com base em um boletim de notícias, não na documentação oficial.
- Como percebi: [pendente: testar `AbortSignal.timeout(5000)` no Expo Go e anotar se dá erro]
- O certo: [preencher com o resultado do teste e a versão do SDK]

## Resultado e próximos passos no TCC
- Hipótese (a confirmar na PoC): o celular funciona como entrada do Eureka sem falar UART. O traço é rasterizado em 28x28 no próprio app e a API ponte no computador repassa a imagem à NPU.
- [preencher após a PoC: acurácia nos 10 dígitos, tempo de resposta medido, FPGA ou simulado]
- [preencher após a PoC: o que muda no TCC, por exemplo um modo de entrada pelo celular no GUI-TCC]
