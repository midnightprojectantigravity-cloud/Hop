export type BootMilestoneId = 'shell' | 'assets';
export type BootPhase = 'shell' | 'assets' | 'ready';

export interface BootMilestone {
  id: BootMilestoneId;
  label: string;
  ready: boolean;
  detail: string;
}

export interface BootState {
  phase: BootPhase;
  statusLine: string;
  ready: boolean;
  milestones: BootMilestone[];
}

export interface BootStateInput {
  shellReady: boolean;
  assetManifestReady: boolean;
}

export const deriveBootState = ({
  shellReady,
  assetManifestReady
}: BootStateInput): BootState => {
  const milestones: BootMilestone[] = [
    {
      id: 'shell',
      label: 'Shell',
      ready: shellReady,
      detail: shellReady ? 'Application shell mounted' : 'Mounting application shell'
    },
    {
      id: 'assets',
      label: 'Assets',
      ready: assetManifestReady,
      detail: assetManifestReady ? 'Visual manifest loaded' : 'Loading visual manifest'
    }
  ];

  if (!shellReady) {
    return {
      phase: 'shell',
      statusLine: 'Mounting shell...',
      ready: false,
      milestones
    };
  }

  if (!assetManifestReady) {
    return {
      phase: 'assets',
      statusLine: 'Loading visual manifest...',
      ready: false,
      milestones
    };
  }

  return {
    phase: 'ready',
    statusLine: 'Hub ready',
    ready: true,
    milestones
  };
};
