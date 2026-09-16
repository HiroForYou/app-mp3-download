import { Pressable, Text } from './index';

type Variant = 'filled' | 'outlined' | 'text';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
}

const base = 'rounded-xl py-3 px-4 items-center justify-center';
const variantClasses: Record<Variant, string> = {
  filled: 'bg-blue-600 active:bg-blue-700',
  outlined: 'border border-blue-600 active:bg-blue-50',
  text: 'active:opacity-60',
};
const textClasses: Record<Variant, string> = {
  filled: 'text-white font-semibold',
  outlined: 'text-blue-600 font-semibold',
  text: 'text-blue-600 font-medium',
};

export function Button({ label, onPress, variant = 'filled', disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${base} ${variantClasses[variant]} ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={textClasses[variant]}>{label}</Text>
    </Pressable>
  );
}
