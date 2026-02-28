import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateInitialState } from '../logic';
import { decideEnemyIntent } from '../systems/ai/ai';
import { WildStrategy } from '../strategy/wild';
import { SkillRegistry } from '../skillRegistry';

interface CorpusStateDescriptor {
    id: string;
    floor: number;
    seed: string;
}

const corpusPath = fileURLToPath(new URL('./__fixtures__/ai/enemy_decision_corpus/baseline_states.json', import.meta.url));
const descriptors = JSON.parse(readFileSync(corpusPath, 'utf8')) as CorpusStateDescriptor[];

describe('wild strategy intent parity', () => {
    it('matches shared enemy intent adapter outputs for standard enemies and emits valid intents', () => {
        const wild = new WildStrategy();
        let assertions = 0;

        for (const descriptor of descriptors) {
            const state = generateInitialState(descriptor.floor, descriptor.seed, descriptor.seed);
            for (const enemy of state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy')) {
                const expected = decideEnemyIntent(enemy, state.player.position, { ...state, occupiedCurrentTurn: state.occupiedCurrentTurn });
                const actual = wild.getIntent(state, enemy);

                expect(actual, `${descriptor.id}:${enemy.id}`).toEqual(expected);
                expect(actual.metadata.reasoningCode.length).toBeGreaterThan(0);
                expect(typeof actual.metadata.expectedValue).toBe('number');
                expect(typeof actual.metadata.rngConsumption).toBe('number');

                if (actual.skillId !== 'WAIT_SKILL') {
                    const def = SkillRegistry.get(actual.skillId);
                    if (def?.getValidTargets && actual.targetHex) {
                        const validTargets = def.getValidTargets(state, enemy.position);
                        expect(validTargets.some(hex => hex.q === actual.targetHex!.q && hex.r === actual.targetHex!.r)).toBe(true);
                    }
                }

                assertions++;
            }
        }

        expect(assertions).toBeGreaterThan(0);
    });
});

