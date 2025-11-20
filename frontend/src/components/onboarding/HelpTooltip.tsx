import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface HelpTooltipProps {
  title: string;
  content: React.ReactNode;
  learnMoreUrl?: string;
}

export function HelpTooltip({ title, content, learnMoreUrl }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        className="inline-flex items-center justify-center text-blue-500 hover:text-blue-700 transition-colors ml-1"
        type="button"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            <div className="space-y-3 text-sm text-gray-700 pt-2">
              {content}
              {learnMoreUrl && (
                <div className="pt-3 border-t">
                  <a
                    href={learnMoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                  >
                    Learn more →
                  </a>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

