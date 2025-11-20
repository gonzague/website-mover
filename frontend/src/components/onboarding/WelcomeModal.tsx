import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface WelcomeModalProps {
  open: boolean;
  onComplete: () => void;
}

export function WelcomeModal({ open, onComplete }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const steps = [
    {
      title: "Welcome to Website Mover! 👋",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Website Mover helps you migrate websites between servers using the power of <strong>rclone</strong>.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Perfect for:</h4>
            <ul className="list-disc list-inside text-blue-800 space-y-1">
              <li>Moving WordPress, PrestaShop, or any website files</li>
              <li>Migrating between hosting providers</li>
              <li>Backing up site files to another server</li>
              <li>Syncing development and production environments</li>
            </ul>
          </div>
          <p className="text-gray-600">
            Supports multiple backends: <strong>SFTP, FTP, Rsync, and Amazon S3</strong>. Choose what works best for your workflow!
          </p>
        </div>
      ),
    },
    {
      title: "How It Works 🚀",
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold">Configure Remotes</h4>
                <p className="text-sm text-gray-600">
                  Add your source and destination using SFTP, FTP, Rsync, or S3
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold">Test Connections</h4>
                <p className="text-sm text-gray-600">
                  Verify that both remotes are accessible before migrating
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold">Configure Migration</h4>
                <p className="text-sm text-gray-600">
                  Select source/destination paths, set options, and start the migration
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h4 className="font-semibold">Monitor Progress</h4>
                <p className="text-sm text-gray-600">
                  Watch real-time statistics and output as files are transferred
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Pro Tips 💡",
      content: (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <h4 className="font-semibold text-yellow-900">Always Test First</h4>
                <p className="text-sm text-yellow-800">
                  Use <strong>Dry Run</strong> mode for your first migration to see what will happen without actually copying files.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-lg">✅</span>
              <div>
                <h4 className="font-semibold text-green-900">Test Your Connections</h4>
                <p className="text-sm text-green-800">
                  Click the <strong>Test</strong> button on each remote to verify connectivity before migrating.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚡</span>
              <div>
                <h4 className="font-semibold text-purple-900">Optimize Performance</h4>
                <p className="text-sm text-purple-800">
                  Increase <strong>Transfers</strong> (8-16) for faster migrations. Adjust based on your connection speed.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    if (dontShowAgain) {
      localStorage.setItem('website-mover-onboarding-completed', 'true');
    }
    onComplete();
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{currentStepData.title}</DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of {steps.length}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{currentStepData.content}</div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 py-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentStep ? 'bg-blue-500 w-6' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <div className="flex-1 flex items-center">
            {currentStep === steps.length - 1 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dont-show"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
                />
                <Label htmlFor="dont-show" className="text-sm text-gray-600 cursor-pointer">
                  Don't show this again
                </Label>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleComplete}>Get Started</Button>
            )}
            {currentStep === 0 && (
              <Button variant="ghost" onClick={handleComplete}>
                Skip
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

