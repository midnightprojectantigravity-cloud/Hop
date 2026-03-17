import React from 'react';
import { recordDebugPerfReactCommit, resolveDebugPerfConfig } from './debug-perf-runtime';

export const DevRenderProfiler: React.FC<{
  id: string;
  children: React.ReactNode;
}> = ({ id, children }) => {
  if (!import.meta.env.DEV || !resolveDebugPerfConfig().enabled) {
    return <>{children}</>;
  }

  return (
    <React.Profiler
      id={id}
      onRender={(profilerId) => {
        recordDebugPerfReactCommit(profilerId);
      }}
    >
      {children}
    </React.Profiler>
  );
};
