import type { Actor as EntityType, MovementTrace } from '@hop/engine';
import type { RegisterActorNodes } from '../game-board/actor-node-registry';

export interface EntityVisualPose {
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface EntityProps {
  entity: EntityType;
  isSpear?: boolean;
  isDying?: boolean;
  movementTrace?: MovementTrace;
  waapiControlled?: boolean;
  assetHref?: string;
  fallbackAssetHref?: string;
  floorTheme?: string;
  visualPose?: EntityVisualPose;
  synapseMode?: boolean;
  onSynapseInspect?: (actorId: string) => void;
  synapsePulseToken?: number;
  registerActorNodes?: RegisterActorNodes;
}
