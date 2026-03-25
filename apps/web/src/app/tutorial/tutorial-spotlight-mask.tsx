import type { TutorialStepId } from './tutorial-state-machine';

const resolveSpotlightGradient = (stepId: TutorialStepId): string => {
  if (stepId === 'movement') return 'radial-gradient(circle at 50% 70%, transparent 0, transparent 12rem, rgba(0,0,0,0.42) 18rem)';
  if (stepId === 'attack') return 'radial-gradient(circle at 50% 52%, transparent 0, transparent 10rem, rgba(0,0,0,0.48) 17rem)';
  return 'radial-gradient(circle at 18% 82%, transparent 0, transparent 8rem, rgba(0,0,0,0.44) 15rem)';
};

export const TutorialSpotlightMask = ({
  visible,
  stepId
}: {
  visible: boolean;
  stepId: TutorialStepId;
}) => {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-[220] pointer-events-none"
      style={{ background: resolveSpotlightGradient(stepId) }}
      aria-hidden
    />
  );
};
