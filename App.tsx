import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const API_URL = 'http://192.168.0.252:8000';

type Point = {
  x: number;
  y: number;
};

type Stroke = Point[];

type InferenceResponse = {
  digito: number;
  backend: 'FPGA' | 'simulado';
  tempo_ms: number;
};

type InferenceResult = InferenceResponse & {
  roundTripMs: number;
};

const STROKE_WIDTH = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInferenceResponse(value: unknown): value is InferenceResponse {
  return (
    isRecord(value) &&
    typeof value.digito === 'number' &&
    (value.backend === 'FPGA' || value.backend === 'simulado') &&
    typeof value.tempo_ms === 'number'
  );
}

export default function App() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const classifyStrokes = async () => {
    if (isLoading) {
      return;
    }

    if (strokes.length === 0) {
      setShowEmptyWarning(true);
      return;
    }

    setShowEmptyWarning(false);
    setResult(null);
    setRequestError(null);
    setIsLoading(true);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${API_URL}/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracos: strokes.map((stroke) =>
            stroke.map(({ x, y }) => [x, y]),
          ),
        }),
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setRequestError('Resposta inválida da API.');
        return;
      }

      const roundTripMs = Date.now() - startedAt;
      if (!response.ok) {
        setRequestError(
          isRecord(payload) && typeof payload.erro === 'string'
            ? payload.erro
            : `Erro na API (${response.status}).`,
        );
        return;
      }

      if (!isInferenceResponse(payload)) {
        setRequestError('Resposta inválida da API.');
        return;
      }

      setResult({ ...payload, roundTripMs });
    } catch {
      setRequestError('Não foi possível conectar à API.');
    } finally {
      setIsLoading(false);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: ({ nativeEvent }) => {
          setShowEmptyWarning(false);
          setStrokes((current) => [
            ...current,
            [{ x: nativeEvent.locationX, y: nativeEvent.locationY }],
          ]);
        },
        onPanResponderMove: ({ nativeEvent }) => {
          setStrokes((current) => {
            if (current.length === 0) {
              return current;
            }

            const lastIndex = current.length - 1;
            const next = [...current];
            next[lastIndex] = [
              ...next[lastIndex],
              { x: nativeEvent.locationX, y: nativeEvent.locationY },
            ];
            return next;
          });
        },
      }),
    [],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Desenhe um dígito</Text>
      <Text style={styles.instructions}>
        Use o dedo na área abaixo para desenhar.
      </Text>

      <View
        style={styles.canvas}
        onLayout={({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          setCanvasSize({ width, height });
        }}
        {...panResponder.panHandlers}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${canvasSize.width || 1} ${canvasSize.height || 1}`}
        >
          {strokes.map((stroke, strokeIndex) =>
            stroke.length === 1 ? (
              <Circle
                key={strokeIndex}
                cx={stroke[0].x}
                cy={stroke[0].y}
                r={STROKE_WIDTH / 2}
                fill={styles.stroke.color}
              />
            ) : (
              <Path
                key={strokeIndex}
                d={stroke
                  .map(
                    (point, pointIndex) =>
                      `${pointIndex === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
                  )
                  .join(' ')}
                fill="none"
                stroke={styles.stroke.color}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ),
          )}
        </Svg>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setStrokes([]);
            setShowEmptyWarning(false);
            setResult(null);
            setRequestError(null);
          }}
          style={[styles.actionButton, styles.clearButton]}
        >
          <Text style={styles.buttonText}>Limpar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading }}
          disabled={isLoading}
          onPress={() => void classifyStrokes()}
          style={[
            styles.actionButton,
            styles.classifyButton,
            isLoading && styles.disabledButton,
          ]}
        >
          <Text style={styles.buttonText}>Classificar</Text>
        </Pressable>
      </View>
      {isLoading && (
        <ActivityIndicator
          accessibilityLabel="Classificando"
          color="#172033"
          style={styles.loadingIndicator}
        />
      )}
      {showEmptyWarning && (
        <Text accessibilityRole="alert" style={styles.warning}>
          Desenhe um dígito primeiro
        </Text>
      )}
      {requestError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {requestError}
        </Text>
      )}
      {result && (
        <View style={styles.result}>
          <Text style={styles.resultText}>Dígito previsto: {result.digito}</Text>
          <Text style={styles.resultText}>Backend: {result.backend}</Text>
          <Text style={styles.resultText}>
            Tempo de resposta (app): {result.roundTripMs} ms
          </Text>
          <Text style={styles.resultText}>
            Tempo da NPU: {result.tempo_ms} ms
          </Text>
        </View>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 24,
    paddingTop: 32,
  },
  title: {
    color: '#172033',
    fontSize: 24,
    fontWeight: '700',
  },
  instructions: {
    color: '#5d6678',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  canvas: {
    flex: 1,
    minHeight: 260,
    backgroundColor: '#fff',
    borderColor: '#cbd2de',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stroke: {
    color: '#172033',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  clearButton: {
    backgroundColor: '#5d6678',
  },
  classifyButton: {
    backgroundColor: '#172033',
  },
  disabledButton: {
    backgroundColor: '#9aa3b2',
    opacity: 0.65,
  },
  loadingIndicator: {
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warning: {
    color: '#b42318',
    fontSize: 14,
    marginTop: 8,
  },
  error: {
    color: '#b42318',
    fontSize: 14,
    marginTop: 8,
  },
  result: {
    gap: 4,
    marginTop: 12,
  },
  resultText: {
    color: '#172033',
    fontSize: 14,
  },
});
