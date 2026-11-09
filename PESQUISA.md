# Diário de pesquisa

## Contexto do TCC
Plataforma educacional baseada em um SoC RISC-V com NPU (matriz sistólica) em FPGA, controlada por um app desktop PyQt5 (GUI-TCC) com experimentos de arquitetura, sistema operacional e redes neurais. O Eureka (Digit-Tracker) classifica dígitos desenhados no ar com uma CNN que roda na NPU, com a imagem enviada por UART a 921600 baud.

## Pergunta de pesquisa
Como o Expo (`react-native-svg` + `fetch`) permite desenhar um dígito no celular, enviá-lo a uma API ponte do Eureka e mostrar a predição da NPU, na condição de que a NPU está ligada por UART a um computador e a rede local pode falhar?

## Alternativas consideradas
| Opção | Serve para | Decisão |
|-------|-----------|---------|
| `react-native-svg` + `PanResponder` | Desenhar traços e guardar os pontos para rasterizar em JS | [a confirmar na documentação: funciona no Expo Go?] |
| `@shopify/react-native-skia` | Canvas de alto desempenho | [a confirmar: Expo Go? exagero para uma tela?] |
| `react-native-view-shot` | Capturar a tela como imagem | [a confirmar: exige decodificar PNG para 28x28, o que complica] |
| WebView com `<canvas>` | Desenhar em HTML e ler os pixels | [a confirmar: troca de mensagens e desempenho] |
| WebSocket em vez de `fetch` | Comunicação contínua com o servidor | [a confirmar: desnecessário para um envio por toque?] |

## Fontes oficiais lidas
- [título da página] ([endereço])

## Onde a IA errou
- Pedido: [o que foi pedido]
- O que veio: [a resposta errada]
- Como percebi: [erro de compilação, documentação, teste no aparelho]
- O certo: [o que a documentação confirma]

## Resultado e próximos passos no TCC
- [o que a prova de conceito demonstrou e o que muda no TCC]
