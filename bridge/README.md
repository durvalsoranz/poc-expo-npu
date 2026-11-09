# API ponte da NPU

Servidor HTTP que roda no computador (com a NPU simulada ou ligado à FPGA). Ele recebe o dígito desenhado no celular e o
classifica na NPU, reaproveitando o código do Digit-Tracker:

- `vision.to_npu_input`: o mesmo pré-processamento 28x28 do Digit-Tracker (recorte, traço com espessura
  proporcional, encaixe em 20x20, centralização em 28x28, redução para int8 0..127);
- `npu.CpuNpu` (simulado) e `npu.FpgaNpu` (placa por UART a 921600 baud).

Só usa a biblioteca padrão do Python para o HTTP; as dependências são as do próprio Digit-Tracker.

## Estrutura esperada

```
Dev/
├── Digit Tracker/
│   └── digit-tracker/     ← Digit-Tracker (npu.py, vision.py, engine.py, weights.npz, firmware/)
└── poc-tcc/
    └── bridge/
        └── servidor.py    ← procura o Digit-Tracker em ../../Digit Tracker/digit-tracker
```

Se o Digit-Tracker estiver em outro lugar, use `--digit-tracker "C:\caminho\para\digit-tracker"`.

## Instalação (uma vez)

No PowerShell, dentro de `poc-tcc`:

```
python -m venv bridge\.venv
bridge\.venv\Scripts\Activate.ps1
pip install -r bridge\requirements.txt
```

## Executar

```
bridge\.venv\Scripts\Activate.ps1
python bridge\servidor.py --sim            # NPU emulada, sem placa
python bridge\servidor.py                  # FPGA, porta detectada automaticamente
python bridge\servidor.py --port COM4      # FPGA em uma porta específica
```

Ao iniciar, o servidor mostra o endereço para abrir no celular, por exemplo
`http://192.168.0.15:8000/health`.

## Rede (Windows)

1. A rede Wi-Fi precisa estar como **Privada** (Configurações → Rede e Internet → Wi-Fi → propriedades).
2. Libere a porta 8000 no firewall, num PowerShell **como administrador**:
   ```
   netsh advfirewall firewall add rule name="poc-tcc ponte 8000" dir=in action=allow protocol=TCP localport=8000
   ```
3. Confira o IP com `ipconfig` (linha "Endereço IPv4" do adaptador Wi-Fi).
4. No navegador do celular, na mesma rede, abra `http://SEU-IP:8000/health`.

## Contrato da API

### `GET /health`
```json
{ "status": "ok", "backend": "simulado", "detalhe": "NPU emulada no computador (aritmética int8)" }
```

### `POST /infer`
Corpo JSON com **uma** das duas formas:

- `tracos`: lista de traços, cada um uma lista de pontos `[x, y]` em qualquer escala (pixels da
  tela servem). O servidor aplica o pré-processamento do Digit-Tracker.
  ```json
  { "tracos": [[[150, 40], [150, 45], [151, 50]], [[120, 60], [180, 60]]] }
  ```
- `pixels`: 784 inteiros de 0 a 255, imagem 28x28 por linhas, **tinta clara sobre fundo escuro**.
  ```json
  { "pixels": [0, 0, 0, "...", 255, 0] }
  ```

Resposta 200:
```json
{
  "digito": 3,
  "backend": "simulado",
  "tempo_ms": 0.4,
  "confianca": 72.5,
  "logits": [-20, -15, 3, 25, -8, 1, -30, -2, 9, -12],
  "entrada": [0, 0, 0, "... 784 valores 0..255: a imagem 28x28 que a NPU recebeu"]
}
```

- `backend`: `"FPGA"` ou `"simulado"`.
- `tempo_ms`: só a inferência na NPU. O tempo de ida e volta pela rede o app mede.
- `confianca`: porcentagem do dígito previsto, com a mesma calibração do GUI-TCC.

Erros: `400` com `{"erro": "..."}` para entrada inválida (por exemplo, desenho vazio),
`404` para rota inexistente, `500` para falha na NPU ou na porta serial.
