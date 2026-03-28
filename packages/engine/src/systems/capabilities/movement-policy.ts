import type { Actor, GameState, MovementModel, Point } from '../../types';
import { getActorAt } from '../../helpers';
import { SpatialSystem } from '../spatial-system';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { canLandOnHazard, canPassHazard } from '../validation';
import { resolveMovementCapabilities } from './movement';

export interface ResolveSkillMovementPolicyOptions {
    skillId: string;
    target?: Point;
    baseRange: number;
    basePathing?: MovementModel['pathing'];
    baseIgnoreWalls?: boolean;
    baseIgnoreGroundHazards?: boolean;
    baseAllowPassThroughActors?: boolean;
}

export interface ResolvedSkillMovementPolicy {
    capabilityResult: ReturnType<typeof resolveMovementCapabilities>;
    movementModel: MovementModel;
    range: number;
    pathing: MovementModel['pathing'];
    ignoreWalls: boolean;
    ignoreGroundHazards: boolean;
    allowPassThroughActors: boolean;
    simulatePath: boolean;
}

const resolveComposedPathing = (
    basePathing: MovementModel['pathing'],
    capabilityPathing: MovementModel['pathing']
): MovementModel['pathing'] => {
    if (basePathing === 'teleport' || capabilityPathing === 'teleport') return 'teleport';
    if (basePathing === 'flight' || capabilityPathing === 'flight') return 'flight';
    return 'walk';
};

export const resolveSkillMovementPolicy = (
    state: GameState,
    actor: Actor,
    options: ResolveSkillMovementPolicyOptions
): ResolvedSkillMovementPolicy => {
    const capabilityResult = resolveMovementCapabilities(state, actor, {
        skillId: options.skillId,
        target: options.target
    });
    const capabilityModel = capabilityResult.model;
    const basePathing = options.basePathing || 'walk';
    const pathing = resolveComposedPathing(basePathing, capabilityModel.pathing);
    const ignoreWalls = (options.baseIgnoreWalls || false) || capabilityModel.ignoreWalls;
    const ignoreGroundHazards = (options.baseIgnoreGroundHazards || false) || capabilityModel.ignoreGroundHazards;
    const allowPassThroughActors = (options.baseAllowPassThroughActors || false) || capabilityModel.allowPassThroughActors;
    const range = Math.max(0, options.baseRange + (capabilityModel.rangeModifier || 0));

    return {
        capabilityResult,
        movementModel: {
            ...capabilityModel,
            pathing,
            ignoreWalls,
            ignoreGroundHazards,
            allowPassThroughActors,
            rangeModifier: capabilityModel.rangeModifier || 0
        },
        range,
        pathing,
        ignoreWalls,
        ignoreGroundHazards,
        allowPassThroughActors,
        simulatePath: pathing !== 'teleport'
    };
};

type OccupancyRule = 'none' | 'enemy' | 'ally' | 'any';

export interface ValidateMovementDestinationOptions {
    occupancy?: OccupancyRule;
    requireWalkable?: boolean;
    enforceBounds?: boolean;
    ignoreHazards?: boolean;
    excludeActorId?: string;
}

export interface ValidateMovementDestinationResult {
    isValid: boolean;
    blockedBy?: 'bounds' | 'wall' | 'hazard' | 'occupied';
    occupantId?: string;
}

const isOccupancyAllowed = (
    actor: Actor,
    occupant: Actor,
    occupancy: OccupancyRule
): boolean => {
    if (occupancy === 'any') return true;
    if (occupancy === 'none') return false;
    const isAlly = occupant.factionId === actor.factionId;
    if (occupancy === 'ally') return isAlly;
    if (occupancy === 'enemy') return !isAlly;
    return false;
};

export const validateMovementDestination = (
    state: GameState,
    actor: Actor,
    target: Point,
    policy: Pick<ResolvedSkillMovementPolicy, 'ignoreWalls' | 'movementModel'>,
    options: ValidateMovementDestinationOptions = {}
): ValidateMovementDestinationResult => {
    const occupancy = options.occupancy || 'none';
    const requireWalkable = options.requireWalkable ?? true;
    const enforceBounds = options.enforceBounds ?? true;
    const ignoreHazards = options.ignoreHazards ?? false;
    const excludeActorId = options.excludeActorId ?? actor.id;

    if (enforceBounds && !SpatialSystem.isWithinBounds(state, target)) {
        return { isValid: false, blockedBy: 'bounds' };
    }

    if (!policy.ignoreWalls) {
        if (requireWalkable && !UnifiedTileService.isWalkable(state, target)) {
            return { isValid: false, blockedBy: 'wall' };
        }
    }

    if (!ignoreHazards && !canLandOnHazard(state, actor, target, { movementModel: policy.movementModel })) {
        return { isValid: false, blockedBy: 'hazard' };
    }

    const occupant = getActorAt(state, target);
    if (!occupant || occupant.id === excludeActorId) {
        return { isValid: true };
    }

    if (!isOccupancyAllowed(actor, occupant as Actor, occupancy)) {
        return { isValid: false, blockedBy: 'occupied', occupantId: occupant.id };
    }

    return { isValid: true, occupantId: occupant.id };
};

export interface ValidateMovementTraversalStepOptions {
    skillId: string;
    allowAlliedOccupancy?: boolean;
    excludeActorId?: string;
}

export interface ValidateMovementTraversalStepResult {
    isValid: boolean;
    blockedBy?: 'bounds' | 'wall' | 'hazard' | 'occupied';
    occupantId?: string;
}

export const validateMovementTraversalStep = (
    state: GameState,
    actor: Actor,
    step: Point,
    policy: Pick<ResolvedSkillMovementPolicy, 'ignoreWalls' | 'ignoreGroundHazards' | 'allowPassThroughActors' | 'movementModel'>,
    options: ValidateMovementTraversalStepOptions
): ValidateMovementTraversalStepResult => {
    const allowAlliedOccupancy = options.allowAlliedOccupancy ?? true;
    const excludeActorId = options.excludeActorId ?? actor.id;

    if (!SpatialSystem.isWithinBounds(state, step)) {
        return { isValid: false, blockedBy: 'bounds' };
    }

    if (!policy.ignoreWalls && !UnifiedTileService.isWalkable(state, step)) {
        return { isValid: false, blockedBy: 'wall' };
    }

    if (!policy.ignoreGroundHazards && !canPassHazard(state, actor, step, options.skillId, { movementModel: policy.movementModel })) {
        return { isValid: false, blockedBy: 'hazard' };
    }

    if (!policy.allowPassThroughActors) {
        const occupant = getActorAt(state, step) as Actor | undefined;
        if (occupant && occupant.id !== excludeActorId) {
            const isAlly = occupant.factionId === actor.factionId;
            if (!(allowAlliedOccupancy && isAlly)) {
                return { isValid: false, blockedBy: 'occupied', occupantId: occupant.id };
            }
        }
    }

    return { isValid: true };
};
