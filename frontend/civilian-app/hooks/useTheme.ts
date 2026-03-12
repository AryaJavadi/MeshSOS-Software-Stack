import { useThemeStore } from '@/store/themeStore';
import { darkTheme, lightTheme, ThemeColors } from '@/constants/themes';

export function useTheme(): { colors: ThemeColors; isDark: boolean; toggleTheme: () => void } {
  const { isDark, toggle } = useThemeStore();
  return {
    colors: isDark ? darkTheme : lightTheme,
    isDark,
    toggleTheme: toggle,
  };
}