import React from 'react';
import { AlertCircle, Inbox, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** Shown in place of data that failed to load. */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, className }) => (
  <div
    role="alert"
    className={cn(
      'flex flex-col items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700',
      className
    )}
  >
    <AlertCircle className="h-5 w-5" aria-hidden="true" />
    <p>{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
        Reintentar
      </Button>
    )}
  </div>
);

interface EmptyStateProps {
  message: string;
  className?: string;
}

/** Shown when a query succeeded but there is nothing to display yet. */
export const EmptyState: React.FC<EmptyStateProps> = ({ message, className }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground',
      className
    )}
  >
    <Inbox className="h-5 w-5" aria-hidden="true" />
    <p>{message}</p>
  </div>
);
