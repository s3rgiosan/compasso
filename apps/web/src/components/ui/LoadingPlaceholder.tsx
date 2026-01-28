interface LoadingPlaceholderProps {
  text?: string;
}

export function LoadingPlaceholder({ text }: LoadingPlaceholderProps) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-muted-foreground">{text || 'Loading...'}</div>
    </div>
  );
}
