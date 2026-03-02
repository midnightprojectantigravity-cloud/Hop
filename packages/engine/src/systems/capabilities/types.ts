import type {
    CapabilityBlockKind,
    CapabilityDecision,
    InformationProvider,
    MovementProvider,
    SenseProvider
} from '../../types';

export interface CompiledSenseProvider {
    skillId: string;
    providerId: string;
    priority: number;
    provider: SenseProvider;
}

export interface CompiledInformationProvider {
    skillId: string;
    providerId: string;
    priority: number;
    provider: InformationProvider;
}

export interface CompiledMovementProvider {
    skillId: string;
    providerId: string;
    priority: number;
    resolutionMode: 'EXTEND' | 'REPLACE';
    provider: MovementProvider;
}

export interface CompiledCapabilityBundle {
    senses: CompiledSenseProvider[];
    information: CompiledInformationProvider[];
    movement: CompiledMovementProvider[];
}

export interface FoldCandidate {
    providerKey: string;
    priority: number;
    decision: CapabilityDecision;
    blockKind?: CapabilityBlockKind;
}

export interface FoldedDecision {
    decision: CapabilityDecision;
    blockedByHardBlock: boolean;
    topAllowPriority: number | null;
    topSoftBlockPriority: number | null;
}
