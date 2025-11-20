import { Check } from 'lucide-react';
import { Card } from '../ui/card';

interface Step {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

interface StepIndicatorProps {
  steps: Step[];
  onStepClick?: (stepId: string) => void;
}

export function StepIndicator({ steps, onStepClick }: StepIndicatorProps) {
  return (
    <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Migration Workflow</h3>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-shrink-0">
              <button
                onClick={() => onStepClick?.(step.id)}
                disabled={!step.completed && !step.current}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  step.completed
                    ? 'bg-green-500 text-white shadow-lg'
                    : step.current
                    ? 'bg-blue-500 text-white shadow-lg ring-4 ring-blue-200 animate-pulse'
                    : 'bg-gray-200 text-gray-500'
                } ${onStepClick && (step.completed || step.current) ? 'cursor-pointer hover:scale-110' : ''}`}
              >
                {step.completed ? <Check className="h-5 w-5" /> : index + 1}
              </button>
              <div className="mt-2 text-center">
                <div
                  className={`text-sm font-medium ${
                    step.current ? 'text-blue-700' : step.completed ? 'text-green-700' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </div>
                <div className="text-xs text-gray-500 max-w-[120px]">{step.description}</div>
              </div>
            </div>

            {/* Connecting Line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 mb-16 transition-colors ${
                  step.completed ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

