import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  return (
    <div className="flex items-center gap-2 p-4 bg-red-50 text-red-800 rounded-lg">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
