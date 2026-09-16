import { Link as RouterLink } from 'expo-router';
import React from 'react';
import {
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  Text as RNText,
  TextInput as RNTextInput,
  View as RNView,
} from 'react-native';
import { useCssElement, useNativeVariable as useFunctionalVariable } from 'react-native-css';

export const Link = (props: React.ComponentProps<typeof RouterLink> & { className?: string }) => {
  return useCssElement(RouterLink, props, { className: 'style' });
};

export const useCSSVariable =
  process.env.EXPO_OS !== 'web' ? useFunctionalVariable : (variable: string) => `var(${variable})`;

export type ViewProps = React.ComponentProps<typeof RNView> & { className?: string };
export const View = (props: ViewProps) => {
  return useCssElement(RNView, props, { className: 'style' });
};
View.displayName = 'CSS(View)';

export type TextProps = React.ComponentProps<typeof RNText> & { className?: string };
export const Text = (props: TextProps) => {
  return useCssElement(RNText, props, { className: 'style' });
};
Text.displayName = 'CSS(Text)';

export type ScrollViewProps = React.ComponentProps<typeof RNScrollView> & {
  className?: string;
  contentContainerClassName?: string;
};
export const ScrollView = (props: ScrollViewProps) => {
  return useCssElement(RNScrollView, props, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
  });
};
ScrollView.displayName = 'CSS(ScrollView)';

export type PressableProps = React.ComponentProps<typeof RNPressable> & { className?: string };
export const Pressable = (props: PressableProps) => {
  return useCssElement(RNPressable, props, { className: 'style' });
};
Pressable.displayName = 'CSS(Pressable)';

export type TextInputProps = React.ComponentProps<typeof RNTextInput> & { className?: string };
export const TextInput = (props: TextInputProps) => {
  return useCssElement(RNTextInput, props, { className: 'style' });
};
TextInput.displayName = 'CSS(TextInput)';
