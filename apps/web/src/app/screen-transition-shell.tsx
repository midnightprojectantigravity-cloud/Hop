import React from 'react';
import type { UiMotionMode } from './ui-preferences';

export type ScreenTransitionPreset = 'screen' | 'overlay' | 'floor';

export const resolveTransitionClasses = (
  motionMode: UiMotionMode,
  preset: ScreenTransitionPreset
): string => {
  if (motionMode === 'reduced') {
    return 'animate-in fade-in duration-150';
  }

  if (preset === 'overlay') {
    return 'animate-in fade-in zoom-in-95 duration-300';
  }

  if (preset === 'floor') {
    return 'animate-in fade-in slide-in-from-bottom-6 duration-700';
  }

  return 'animate-in fade-in slide-in-from-bottom-3 duration-300';
};

export const ScreenTransitionShell = ({
  motionMode,
  preset = 'screen',
  screenId,
  className = '',
  children
}: {
  motionMode: UiMotionMode;
  preset?: ScreenTransitionPreset;
  screenId: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    key={screenId}
    data-screen-transition={screenId}
    data-motion-mode={motionMode}
    data-transition-preset={preset}
    className={`${resolveTransitionClasses(motionMode, preset)} ${className}`.trim()}
  >
    {children}
  </div>
);

export default ScreenTransitionShell;
