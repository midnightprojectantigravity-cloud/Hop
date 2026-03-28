import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';

/**
 * FALCON_AUTO_ROOST Skill
 *
 * Internal companion safety behavior.
 * Used by Falcon AI when predator mark is lost, so mode changes are
 * routed through the same intent -> skill -> effect pipeline.
 */
export const FALCON_AUTO_ROOST: SkillDefinition = {
    id: 'FALCON_AUTO_ROOST' as any,
    name: 'Auto Roost',
    description: 'Automatically returns the falcon to roost mode when mark is lost.',
    slot: 'utility',
    icon: 'R',
    baseVariables: {
        range: 0,
        cost: 0,
        cooldown: 0,
    },
    execute: (_state: GameState, attacker: Actor, _target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        return {
            effects: [
                {
                    type: 'UpdateCompanionState',
                    target: attacker.id,
                    mode: 'roost',
                    markTarget: undefined
                },
                {
                    type: 'UpdateBehaviorState',
                    target: attacker.id,
                    clearOverlays: true,
                    overlays: [{
                        id: 'falcon_roost',
                        source: 'command',
                        sourceId: 'falcon_roost',
                        rangeModel: 'owner_proximity',
                        selfPreservationBias: 0.35,
                        controlBias: 0.2,
                        commitBias: -0.3
                    }],
                    anchorActorId: attacker.companionOf || null,
                    anchorPoint: null
                }
            ],
            messages: ['Falcon loses prey and returns to roost mode.'],
            consumesTurn: true
        };
    },
    getValidTargets: (_state: GameState, origin: Point) => [origin],
    upgrades: {}
};
