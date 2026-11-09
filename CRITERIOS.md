# Critérios de aceitação

- [x] Ao arrastar o dedo na área de desenho, o traço aparece na tela em tempo real; ao tocar em "Limpar", a área fica vazia.
- [x] Com o servidor ligado e um "3" desenhado, ao tocar em "Classificar" aparecem, em até 3 segundos, o dígito previsto, o backend usado ("FPGA" ou "simulado") e o tempo de resposta em ms.
- [x] Dos 10 dígitos (0 a 9) desenhados um por vez, pelo menos 7 são classificados corretamente.
Acurácia: 9 de 10 com a NPU simulada; o 9 às vezes é classificado errado. Testado em iPhone com Expo Go, em 09/11/2026.
- [x] Durante a requisição, o botão "Classificar" fica desabilitado e aparece um indicador de carregamento; ao terminar, o botão volta ao normal.
- [x] Com a área de desenho vazia, "Classificar" não envia nada e mostra o aviso "Desenhe um dígito primeiro".
- [x] Com o servidor desligado (ou celular fora da rede do computador), "Classificar" mostra "Não foi possível alcançar o servidor" em até 5 segundos, sem travar o app, e o botão volta a ficar habilitado.
- [x] O mesmo desenho enviado em duas execuções seguidas retorna o mesmo dígito.

**Verificado em:** (x) aparelho físico ( ) emulador
**Resultado:** (x) passou ( ) reprovou
