import { extendTheme, type ThemeConfig, type ComponentStyleConfig } from '@chakra-frontend/frontend/ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: '#e6f7ff',
    100: '#b3e0ff',
    200: '#80caff',
    300: '#4db3ff',
    400: '#1a9cff',
    500: '#0080ff',
    600: '#0066cc',
    700: '#004d99',
    800: '#003366',
    900: '#001a33',
  },
  blue: {
    50: '#ebf8ff',
    100: '#bee3f8',
    200: '#90cdf4',
    300: '#63b3ed',
    400: '#4299e1',
    500: '#3182ce',
    600: '#2b6cb0',
    700: '#2c5282',
    800: '#2a4365',
    900: '#1A365D',
  },
  purple: {
    50: '#faf5ff',
    100: '#e9d8fd',
    200: '#d6bcfa',
    300: '#b794f4',
    400: '#9f7aea',
    500: '#805ad5',
    600: '#6b46c1',
    700: '#553c9a',
    800: '#44337a',
    900: '#322659',
  },
  yellow: {
    50: '#fffff0',
    100: '#fefcbf',
    200: '#faf089',
    300: '#f6e05e',
    400: '#ecc94b',
    500: '#d69e2e',
    600: '#b7791f',
    700: '#975a16',
    800: '#744210',
    900: '#5F370E',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

const styles = {
  global: (props: { colorMode: string }) => ({
    'html, body': {
      fontSize: '16px',
      color: props.colorMode === 'dark' ? 'white' : 'gray.800',
      backgroundColor: props.colorMode === 'dark' ? 'gray.900' : 'white',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      lineHeight: 'tall',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    'h1, h2, h3, h4, h5, h6': {
      fontWeight: 'bold',
      color: 'inherit',
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
    },
    h1: {
      fontSize: ['2.5rem', '3.5rem'],
      lineHeight: 1.1,
    },
    h2: {
      fontSize: ['2rem', '2.5rem'],
    },
    h3: {
      fontSize: ['1.5rem', '1.875rem'],
    },
    a: {
      color: 'blue.400',
      _hover: {
        textDecoration: 'none',
        color: 'blue.300',
      },
    },
  }),
};

const components: Record<string, ComponentStyleConfig> = {
  Button: {
    baseStyle: {
      fontWeight: 'semibold',
      borderRadius: 'md',
      _focus: {
        boxShadow: 'none',
      },
    },
    variants: {
      solid: (props: any) => ({
        bg: props.colorMode === 'dark' ? 'brand.500' : 'brand.400',
        color: 'white',
        _hover: {
          bg: props.colorMode === 'dark' ? 'brand.600' : 'brand.500',
          _disabled: {
            bg: props.colorMode === 'dark' ? 'brand.500' : 'brand.400',
          },
        },
        _active: {
          bg: props.colorMode === 'dark' ? 'brand.700' : 'brand.600',
        },
      }),
      outline: (props: any) => ({
        borderColor: props.colorMode === 'dark' ? 'gray.600' : 'gray.300',
        _hover: {
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.50',
        },
      }),
      ghost: (props: any) => ({
        _hover: {
          bg: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'gray.100',
        },
      }),
    },
  },
  Input: {
    variants: {
      filled: (props: any) => ({
        field: {
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.50',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'white',
          },
          _focus: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'white',
            borderColor: 'brand.500',
          },
        },
      }),
    },
    defaultProps: {
      variant: 'filled',
    },
  },
  Select: {
    variants: {
      filled: (props: any) => ({
        field: {
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.50',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'white',
          },
          _focus: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'white',
            borderColor: 'brand.500',
          },
        },
      }),
    },
    defaultProps: {
      variant: 'filled',
    },
  },
  Card: {
    baseStyle: (props: { colorMode: string }) => ({
      container: {
        backgroundColor: props.colorMode === 'dark' ? 'gray.800' : 'white',
        borderRadius: 'lg',
        boxShadow: 'sm',
        borderWidth: '1px',
        borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
      },
    }),
  },
};
const theme = extendTheme({
  config,
  colors,
  shadows: {
    outline: '0 0 0 3px rgba(66, 153, 225, 0.6)',
  },
  styles,
  components,
  fonts: {
    heading: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
});

export default theme;
