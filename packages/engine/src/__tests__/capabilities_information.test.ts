import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { createActiveSkill } from '../skillRegistry';
import { createEnemy } from '../systems/entities/entity-factory';
import { getActorInformation, getActorInformationStrict } from '../systems/capabilities/information';

const makeState = () => {
    const state = generateInitialState(1, 'capabilities-info-seed');
    const enemy = createEnemy({
        id: 'info-target',
        subtype: 'archer',
        position: createHex(3, 5),
        hp: 4,
        maxHp: 6,
        speed: 1,
        skills: ['BASIC_MOVE'],
        weightClass: 'Standard'
    });
    enemy.intent = 'BASIC_ATTACK';
    enemy.components = new Map([
        ['trinity', { type: 'trinity', body: 4, mind: 7, instinct: 2 }]
    ]);

    state.player = {
        ...state.player,
        position: createHex(3, 7),
        components: new Map([
            ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 0 }]
        ])
    };
    state.enemies = [enemy];
    return state;
};

describe('capabilities information facade', () => {
    it('falls back to full reveal when no information capability skills are present', () => {
        const state = makeState();
        state.player.activeSkills = [createActiveSkill('BASIC_MOVE') as any];

        const info = getActorInformationStrict(state, state.player.id, 'info-target');
        expect(info.reveal.name).toBe(true);
        expect(info.reveal.hp).toBe(true);
        expect(info.reveal.trinityStats).toBe(true);
        expect(info.reveal.intentBadge).toBe(true);
    });

    it('reveals only basic fields with BASIC_AWARENESS', () => {
        const state = makeState();
        state.player.activeSkills = [createActiveSkill('BASIC_AWARENESS') as any];

        const info = getActorInformationStrict(state, state.player.id, 'info-target');
        expect(info.reveal.name).toBe(true);
        expect(info.reveal.hp).toBe(true);
        expect(info.reveal.trinityStats).toBe(false);
        expect(info.reveal.intentBadge).toBe(false);
        expect(info.reveal.topActionUtilities).toBe(false);
        expect(info.data.trinityStats).toBeUndefined();
    });

    it('progressively reveals stats, intent, and utilities with advanced passives', () => {
        const state = makeState();
        state.player.components = new Map([
            ['trinity', { type: 'trinity', body: 0, mind: 20, instinct: 20 }]
        ]);
        state.player.activeSkills = [
            createActiveSkill('BASIC_AWARENESS') as any,
            createActiveSkill('COMBAT_ANALYSIS') as any,
            createActiveSkill('TACTICAL_INSIGHT') as any,
            createActiveSkill('ORACLE_SIGHT') as any
        ];

        const info = getActorInformationStrict(state, state.player.id, 'info-target', {
            topActionUtilities: [
                { skillId: 'BASIC_ATTACK', score: 0.9 },
                { skillId: 'BASIC_MOVE', score: 0.4 }
            ]
        });
        expect(info.reveal.name).toBe(true);
        expect(info.reveal.hp).toBe(true);
        expect(info.reveal.trinityStats).toBe(true);
        expect(info.reveal.intentBadge).toBe(true);
        expect(info.reveal.topActionUtilities).toBe(true);
        expect(info.data.topActionUtilities?.length).toBe(2);
    });

    it('masks fields in strict mode and force-reveals in compatibility mode', () => {
        const state = makeState();
        state.player.activeSkills = [createActiveSkill('COMBAT_ANALYSIS') as any];
        state.player.components = new Map([
            ['trinity', { type: 'trinity', body: 0, mind: 1, instinct: 0 }]
        ]);

        const strict = getActorInformationStrict(state, state.player.id, 'info-target');
        expect(strict.reveal.name).toBe(false);
        expect(strict.reveal.hp).toBe(false);
        expect(strict.reveal.trinityStats).toBe(false);

        const forced = getActorInformation(state, state.player.id, 'info-target', { revealMode: 'force_reveal' });
        expect(forced.meta.isForceRevealApplied).toBe(true);
        expect(forced.reveal.name).toBe(true);
        expect(forced.reveal.hp).toBe(true);
        expect(forced.reveal.trinityStats).toBe(true);
    });
});
