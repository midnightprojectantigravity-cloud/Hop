import { describe, expect, it } from 'vitest';
import { createEntityFromDefinition } from '../systems/entities/entity-factory';
import type { BaseUnitDefinition } from '../data/contracts';

describe('unit definition factory', () => {
    it('instantiates a companion from a single generic unit definition', () => {
        const definition: BaseUnitDefinition = {
            version: '1.0.0',
            id: 'COMPANION_FALCON_TEST',
            name: 'Falcon Test',
            actorType: 'enemy',
            unitKind: 'companion',
            subtype: 'falcon',
            factionId: 'player',
            weightClass: 'Light',
            coordSpace: {
                system: 'cube-axial',
                pointFormat: 'qrs'
            },
            tags: ['companion', 'flying'],
            traits: ['COMPANION', 'COMMANDABLE'],
            instantiate: {
                rngStream: 'unit.instantiate',
                seedSalt: 'falcon_test',
                counterMode: 'consume_global',
                drawOrder: ['body', 'mind', 'instinct', 'speed', 'mass'],
                includeRollTrace: false
            },
            propensities: {
                body: { method: 'fixed', value: 4 },
                mind: { method: 'fixed', value: 6 },
                instinct: { method: 'fixed', value: 18 },
                speed: { method: 'fixed', value: 95 },
                mass: { method: 'fixed', value: 3 }
            },
            derivedStats: {
                maxHp: { formulaId: 'trinity_hp_v1' }
            },
            combatProfile: {
                outgoingPhysical: 1.2,
                outgoingMagical: 1,
                incomingPhysical: 1,
                incomingMagical: 1
            },
            skillLoadout: {
                baseSkillIds: ['BASIC_MOVE', 'FALCON_PECK'],
                passiveSkillIds: ['FALCON_AUTO_ROOST']
            },
            lifecycle: {
                companionState: {
                    mode: 'roost',
                    keenSight: true
                },
                behaviorState: {
                    controller: 'generic_ai',
                    anchorActorId: 'owner',
                    overlays: [{
                        id: 'falcon_test_roost',
                        source: 'summon',
                        sourceId: 'falcon_roost',
                        selfPreservationBias: 0.25
                    }]
                },
                isFlying: true
            },
            runtimeDefaults: {
                startingHp: 'maxHp',
                temporaryArmor: 0,
                isVisible: true
            }
        };

        const actor = createEntityFromDefinition(definition, {
            id: 'falcon-test',
            type: 'enemy',
            position: { q: 4, r: 4, s: -8 },
            hp: 84,
            maxHp: 84,
            speed: 95,
            factionId: 'player',
            weightClass: 'Light',
            companionOf: 'player',
            trinity: { body: 4, mind: 6, instinct: 18 },
        }, {
            source: 'companion',
            ownerId: 'player',
            companionType: 'falcon'
        });

        expect(actor.subtype).toBe('falcon');
        expect(actor.factionId).toBe('player');
        expect(actor.isFlying).toBe(true);
        expect(actor.companionOf).toBe('player');
        expect(actor.companionState?.mode).toBe('roost');
        expect(actor.companionState?.keenSight).toBe(true);
        expect(actor.behaviorState?.controller).toBe('generic_ai');
        expect(actor.behaviorState?.anchorActorId).toBe('owner');
        expect(actor.behaviorState?.overlays[0]?.sourceId).toBe('falcon_roost');
        expect(actor.activeSkills.map(skill => skill.id)).toEqual([
            'BASIC_MOVE',
            'FALCON_PECK',
            'FALCON_AUTO_ROOST'
        ]);
    });
});
