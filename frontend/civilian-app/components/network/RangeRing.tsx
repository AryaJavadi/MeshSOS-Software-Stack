import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RangeRingProps {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  delay?: number;
}

export function RangeRing({ cx, cy, radius, color, delay = 0 }: RangeRingProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    r: radius * (0.8 + progress.value * 0.4),
    opacity: 0.2 * (1 - progress.value),
  }));

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill="none"
      stroke={color}
      strokeWidth={1}
      animatedProps={animatedProps}
    />
  );
}
