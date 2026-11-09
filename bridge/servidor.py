"""
API ponte da NPU: recebe pela rede o dígito desenhado no celular e o classifica na NPU.

O celular não fala UART com a placa. Este servidor roda no computador ligado à FPGA, recebe o
desenho por HTTP e reaproveita o código do Digit-Tracker: o mesmo pré-processamento 28x28
(vision.to_npu_input) e os mesmos backends de inferência (npu.CpuNpu e npu.FpgaNpu).

    python bridge/servidor.py --sim            # NPU emulada no computador (sem placa)
    python bridge/servidor.py                  # FPGA, porta detectada automaticamente
    python bridge/servidor.py --port COM4      # FPGA em uma porta específica
    python bridge/servidor.py --sim --atraso 2 # responde 2 s mais tarde (teste de carregamento e timeout)

Rotas:
    GET  /health  -> {"status": "ok", "backend": "simulado" | "FPGA", ...}
    POST /infer   -> recebe {"tracos": [[[x, y], ...], ...]} ou {"pixels": [784 inteiros 0..255]}
                     e devolve {"digito", "backend", "tempo_ms", "confianca", "logits", "entrada"}
"""
import argparse
import json
import os
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AQUI = os.path.dirname(os.path.abspath(__file__))
DIGIT_TRACKER_PADRAO = os.path.normpath(os.path.join(AQUI, "..", "..", "Digit Tracker", "digit-tracker"))

MAX_CORPO = 1_000_000   # bytes aceitos no corpo da requisição
MAX_PONTOS = 20_000     # pontos somados de todos os traços


class ErroEntrada(ValueError):
    """Requisição com formato inválido: vira resposta 400."""


def ip_local():
    """IP do computador na rede local (o que o celular usa para chegar aqui)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # UDP: nenhum pacote é enviado, só escolhe a interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Ponte:
    """Converte o desenho na entrada da NPU e chama o backend, um pedido por vez."""

    def __init__(self, backend, nome_backend, np, to_npu_input, softmax_pct, atraso_s=0.0):
        self.backend = backend
        self.atraso_s = atraso_s  # atraso artificial antes de responder, só para testes
        self.nome_backend = nome_backend  # "FPGA" ou "simulado"
        self.np = np
        self.to_npu_input = to_npu_input
        self.softmax_pct = softmax_pct
        self.trava = threading.Lock()  # a porta serial não aceita dois pedidos ao mesmo tempo

    def entrada_de_tracos(self, tracos):
        if not isinstance(tracos, list) or not tracos:
            raise ErroEntrada("Desenhe um dígito primeiro: 'tracos' está vazio.")
        convertidos, total = [], 0
        for traco in tracos:
            if not isinstance(traco, list) or not traco:
                raise ErroEntrada("Cada traço deve ser uma lista não vazia de pontos [x, y].")
            pontos = []
            for p in traco:
                if not (isinstance(p, (list, tuple)) and len(p) == 2
                        and all(isinstance(v, (int, float)) for v in p)):
                    raise ErroEntrada("Cada ponto deve ser [x, y] com números.")
                pontos.append((int(round(p[0])), int(round(p[1]))))  # o Digit-Tracker trabalha com pixels inteiros
            total += len(pontos)
            convertidos.append(pontos)
        if total > MAX_PONTOS:
            raise ErroEntrada(f"Desenho com pontos demais ({total}; máximo {MAX_PONTOS}).")
        resultado = self.to_npu_input(convertidos)
        if resultado is None:
            raise ErroEntrada("Desenhe um dígito primeiro: nenhum ponto recebido.")
        entrada_int8, img28 = resultado
        return entrada_int8, img28.reshape(-1)

    def entrada_de_pixels(self, pixels):
        np = self.np
        if not isinstance(pixels, list) or len(pixels) != 784:
            raise ErroEntrada("'pixels' deve ser uma lista de 784 inteiros (imagem 28x28).")
        if not all(isinstance(v, int) and 0 <= v <= 255 for v in pixels):
            raise ErroEntrada("Cada pixel deve ser um inteiro de 0 a 255 (tinta clara sobre fundo escuro).")
        img28 = np.array(pixels, np.uint8)
        if not img28.any():
            raise ErroEntrada("Desenhe um dígito primeiro: a imagem está toda preta.")
        # Mesma redução do Digit-Tracker: 0..255 -> 0..127 em int8
        return np.clip(img28 // 2, 0, 127).astype(np.int8), img28

    def inferir(self, corpo):
        if "tracos" in corpo:
            entrada, img28 = self.entrada_de_tracos(corpo["tracos"])
        elif "pixels" in corpo:
            entrada, img28 = self.entrada_de_pixels(corpo["pixels"])
        else:
            raise ErroEntrada("Envie 'tracos' ou 'pixels' no corpo JSON.")

        if self.atraso_s > 0:
            time.sleep(self.atraso_s)  # fora da trava e fora do tempo_ms: simula rede ou servidor lento

        with self.trava:
            inicio = time.perf_counter()
            logits = self.backend.infer(entrada)
            tempo_ms = (time.perf_counter() - inicio) * 1000.0

        logits = self.np.asarray(logits)
        digito = int(self.np.argmax(logits))
        return {
            "digito": digito,
            "backend": self.nome_backend,
            "tempo_ms": round(tempo_ms, 1),  # só a inferência; a ida e volta pela rede o app mede
            "confianca": round(float(self.softmax_pct(logits)[digito]), 1),
            "logits": [int(v) for v in logits],
            "entrada": [int(v) for v in img28],  # a imagem 28x28 (0..255) que a NPU recebeu
        }


def criar_handler(ponte, info_health):
    class Handler(BaseHTTPRequestHandler):
        server_version = "PonteNPU/1.0"

        def _responder(self, status, dados):
            corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(corpo)))
            self.send_header("Access-Control-Allow-Origin", "*")  # só importa se testar pelo Expo web
            self.end_headers()
            self.wfile.write(corpo)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self):
            if self.path.rstrip("/") == "/health":
                self._responder(200, info_health)
            else:
                self._responder(404, {"erro": "Rota não encontrada. Use GET /health ou POST /infer."})

        def do_POST(self):
            if self.path.rstrip("/") != "/infer":
                self._responder(404, {"erro": "Rota não encontrada. Use POST /infer."})
                return
            try:
                tamanho = int(self.headers.get("Content-Length") or 0)
                if tamanho <= 0 or tamanho > MAX_CORPO:
                    raise ErroEntrada(f"Corpo ausente ou grande demais (máximo {MAX_CORPO} bytes).")
                try:
                    corpo = json.loads(self.rfile.read(tamanho).decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    raise ErroEntrada("O corpo precisa ser JSON válido.")
                if not isinstance(corpo, dict):
                    raise ErroEntrada("O corpo JSON precisa ser um objeto.")
                resposta = ponte.inferir(corpo)
            except ErroEntrada as e:
                self._responder(400, {"erro": str(e)})
                return
            except Exception as e:  # falha na NPU ou na serial: o app recebe o motivo
                print(f"  ERRO na inferência: {e!r}", flush=True)
                self._responder(500, {"erro": f"Falha na inferência: {e}"})
                return
            print(f"  -> dígito {resposta['digito']} ({resposta['confianca']}%) em "
                  f"{resposta['tempo_ms']} ms [{resposta['backend']}]", flush=True)
            self._responder(200, resposta)

        def log_message(self, formato, *args):
            print(f"{self.client_address[0]} {formato % args}", flush=True)

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sim", action="store_true", help="sem placa: emula a NPU no computador")
    parser.add_argument("--port", help="porta serial da FPGA (padrão: detectada automaticamente)")
    parser.add_argument("--baud", type=int, default=921600)
    parser.add_argument("--digit-tracker", default=DIGIT_TRACKER_PADRAO, help="pasta do Digit-Tracker")
    parser.add_argument("--host", default="0.0.0.0", help="0.0.0.0 aceita conexões da rede local")
    parser.add_argument("--porta-http", type=int, default=8000)
    parser.add_argument("--atraso", type=float, default=0.0,
                        help="segundos de atraso antes de cada resposta do /infer (só para testes)")
    args = parser.parse_args()

    if not os.path.exists(os.path.join(args.digit_tracker, "npu.py")):
        sys.exit(f"Digit-Tracker não encontrado em: {args.digit_tracker}\nUse --digit-tracker com a pasta dele.")
    sys.path.insert(0, args.digit_tracker)

    import numpy as np
    from engine import find_fpga_port, softmax_pct
    from npu import CpuNpu, FpgaNpu, load_weights
    from vision import to_npu_input

    weights = load_weights(os.path.join(args.digit_tracker, "weights.npz"))

    if args.sim:
        backend, nome = CpuNpu(weights), "simulado"
        detalhe = "NPU emulada no computador (aritmética int8)"
    else:
        porta = args.port
        if not porta:
            porta, encontradas = find_fpga_port()
            if not porta:
                sys.exit("Nenhuma porta USB-serial encontrada. Conecte a FPGA, use --port ou rode com --sim.")
            print(f"Portas USB-serial: {', '.join(encontradas)} -> usando {porta} (outra: --port)")
        firmware = os.path.join(args.digit_tracker, "firmware", "cnn_server.bin")
        backend, nome = FpgaNpu(porta, args.baud, firmware, weights, log=print), "FPGA"
        detalhe = f"{porta} @ {args.baud} baud"

    ponte = Ponte(backend, nome, np, to_npu_input, softmax_pct, atraso_s=args.atraso)
    info_health = {"status": "ok", "backend": nome, "detalhe": detalhe}
    servidor = ThreadingHTTPServer((args.host, args.porta_http), criar_handler(ponte, info_health))

    ip = ip_local()
    print(f"\nPonte da NPU pronta [{nome}: {detalhe}]")
    print(f"  No computador: http://127.0.0.1:{args.porta_http}/health")
    print(f"  No celular:    http://{ip}:{args.porta_http}/health")
    if args.atraso > 0:
        print(f"  ATENÇÃO: atraso de teste de {args.atraso} s em cada /infer")
    print("Ctrl+C para encerrar.\n", flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando...")
    finally:
        servidor.server_close()
        backend.close()


if __name__ == "__main__":
    main()