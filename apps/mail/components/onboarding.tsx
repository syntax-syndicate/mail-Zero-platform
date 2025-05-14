import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

const steps = [
  {
    title: 'Welcome to Zero Email!',
    description: 'Your new intelligent email experience starts here.',
    video: 'https://assets.0.email/get-started.png',
  },
  {
    title: 'Chat with your inbox',
    description: 'Zero allows you to chat with your inbox, and take actions on your behalf.',
    video: 'https://assets.0.email/step2.gif',
  },
  {
    title: 'AI Compose & Reply',
    description: 'Our AI assistant allows you to write emails that sound like you.',
    video: 'https://assets.0.email/step1.gif',
  },
  {
    title: 'Label your emails',
    description: 'Zero helps you label your emails to focus on what matters.',
    video: 'https://assets.0.email/step3.gif',
  },
  {
    title: 'Coming Soon',
    description: (
      <>
        <span className="text-muted-foreground mb-6">
          We're excited to bring these powerful features to all users very soon!
        </span>
      </>
    ),
    video: 'https://assets.0.email/coming-soon.png',
  },
  {
    title: 'Ready to start?',
    description: 'Click below to begin your intelligent email experience!',
    video: 'https://assets.0.email/ready.png',
  },
];

export function OnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep === steps.length - 1) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [currentStep, steps.length]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogContent
        showOverlay
        className="bg-panelLight mx-auto w-full rounded-xl border p-4 sm:max-w-[690px] dark:bg-[#111111]"
      >
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-center">
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 w-16 rounded-full ${
                    index === currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-4xl font-semibold">{steps[currentStep]?.title}</h2>
            <p className="text-muted-foreground mx-auto max-w-md text-sm">
              {steps[currentStep]?.description}
            </p>
          </div>

          {steps[currentStep] && steps[currentStep].video && (
            <div className="relative flex items-center justify-center">
              <div className="bg-muted aspect-video w-full max-w-4xl overflow-hidden rounded-lg">
                {steps.map(
                  (step, index) =>
                    step.video && (
                      <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-300 ${
                          index === currentStep ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <img
                          loading="eager"
                          width={500}
                          height={500}
                          src={step.video}
                          alt={step.title}
                          className="h-full w-full rounded-lg border object-cover"
                        />
                      </div>
                    ),
                )}
              </div>
            </div>
          )}

          <div className="mx-auto flex w-full max-w-xl gap-2">
            <Button
              onClick={() => setCurrentStep(currentStep - 1)}
              variant="outline"
              className="h-8 w-full"
              disabled={currentStep === 0}
            >
              Go back
            </Button>
            <Button onClick={handleNext} className="h-8 w-full">
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingWrapper() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasOnboarded = localStorage.getItem('hasOnboarded');
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOpenChange = (open: boolean) => {
    setShowOnboarding(open);
    if (!open) {
      localStorage.setItem('hasOnboarded', 'true');
    }
  };

  return <OnboardingDialog open={showOnboarding} onOpenChange={handleOpenChange} />;
}
