import React from 'react';
import { recordDebugPerfReactCommit, resolveDebugPerfConfig } from './debug-perf-runtime';

const DevRenderCommitCounter = ({
  id,
  children
}: {
  id: string;
  children: React.ReactNode;
}) => {
  React.useEffect(() => {
    recordDebugPerfReactCommit(id);
  });

  return <>{children}</>;
};

export const DevRenderProfiler: React.FC<{
  id: string;
  children: React.ReactNode;
}> = ({ id, children }) => {
  if (!import.meta.env.DEV || !resolveDebugPerfConfig().enabled) {
    return <>{children}</>;
  }

  // React's dev profiler attempts to diff component props/state for render logging.
  // The board screen carries engine BigInt values (for example occupancy masks),
  // which causes the dev logger to throw during JSON serialization.
  return <DevRenderCommitCounter id={id}>{children}</DevRenderCommitCounter>;
};
