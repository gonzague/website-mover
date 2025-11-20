import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  helpText?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action, helpText }: EmptyStateProps) {
  return (
    <Card className="border-2 border-dashed border-gray-300">
      <CardContent className="py-12 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="rounded-full bg-gray-100 p-4">
            <Icon className="h-12 w-12 text-gray-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <p className="text-gray-600 max-w-md">{description}</p>
          </div>
          {helpText && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md text-left">
              {helpText}
            </div>
          )}
          {action && (
            <Button onClick={action.onClick} size="lg" className="mt-4">
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

