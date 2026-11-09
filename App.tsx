import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Point = {
  x: number;
  y: number;
};

type Stroke = Point[];

const STROKE_WIDTH = 12;

export default function App() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: ({ nativeEvent }) => {
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

      <Pressable
        accessibilityRole="button"
        onPress={() => setStrokes([])}
        style={styles.clearButton}
      >
        <Text style={styles.clearButtonText}>Limpar</Text>
      </Pressable>

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
  clearButton: {
    alignItems: 'center',
    backgroundColor: '#172033',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 52,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
