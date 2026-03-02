import { createHex } from '../hex';
import { applyEffects } from '../systems/effect-engine';
import { getComponent, type AttachmentComponent } from '../systems/components';
import type { ScenarioCollection } from './types';

const getAttachmentLinkCount = (state: any, actorId: string): number => {
    const actor = actorId === state.player.id
        ? state.player
        : state.enemies.find((e: any) => e.id === actorId) || state.companions?.find((e: any) => e.id === actorId);
    return getComponent<AttachmentComponent>(actor?.components, 'attachment')?.links.length || 0;
};

export const attachmentScenarios: ScenarioCollection = {
    id: 'attachments',
    name: 'Attachment States',
    description: 'Deterministic attach/release shared-vector movement scenarios.',
    scenarios: [
        {
            id: 'attachment_shared_vector_follow',
            title: 'Attached counterpart follows anchor displacement vector',
            description: 'When two actors are attached, moving the anchor drags the attached actor by the same vector.',
            relatedSkills: ['GRAPPLE_HOOK'],
            category: 'movement',
            difficulty: 'advanced',
            tags: ['attachment', 'displacement', 'shared-vector'],
            setup: (engine) => {
                engine.setPlayer(createHex(2, 2), ['BASIC_MOVE']);
                engine.spawnEnemy('footman', createHex(4, 4), 'anchor');
                engine.spawnEnemy('footman', createHex(5, 4), 'attached');
                engine.setTile(createHex(4, 4), 'floor');
                engine.setTile(createHex(5, 4), 'floor');
                engine.setTile(createHex(4, 5), 'floor');
                engine.setTile(createHex(5, 5), 'floor');
            },
            run: (engine) => {
                engine.state = applyEffects(engine.state, [
                    { type: 'AttachActors', anchor: 'anchor', attached: 'attached', mode: 'tow' },
                    { type: 'Displacement', target: 'anchor', source: createHex(4, 4), destination: createHex(4, 5), simulatePath: true }
                ], { sourceId: 'anchor', targetId: 'anchor' });
            },
            verify: (state) => {
                const anchor = state.enemies.find(e => e.id === 'anchor');
                const attached = state.enemies.find(e => e.id === 'attached');
                if (!anchor || !attached) return false;
                return anchor.position.q === 4
                    && anchor.position.r === 5
                    && attached.position.q === 5
                    && attached.position.r === 5
                    && getAttachmentLinkCount(state, 'anchor') === 1
                    && getAttachmentLinkCount(state, 'attached') === 1;
            }
        },
        {
            id: 'attachment_obstacle_break_release',
            title: 'Attachment releases when attached actor cannot follow through obstacle',
            description: 'Obstacle break release should clear links when shared-vector follower movement is blocked.',
            relatedSkills: ['GRAPPLE_HOOK'],
            category: 'movement',
            difficulty: 'advanced',
            tags: ['attachment', 'release', 'obstacle'],
            setup: (engine) => {
                engine.setPlayer(createHex(2, 2), ['BASIC_MOVE']);
                engine.spawnEnemy('footman', createHex(4, 4), 'anchor');
                engine.spawnEnemy('footman', createHex(5, 4), 'attached');
                engine.setTile(createHex(4, 4), 'floor');
                engine.setTile(createHex(5, 4), 'floor');
                engine.setTile(createHex(4, 5), 'floor');
                engine.setTile(createHex(5, 5), 'wall');
            },
            run: (engine) => {
                engine.state = applyEffects(engine.state, [
                    { type: 'AttachActors', anchor: 'anchor', attached: 'attached', mode: 'tow' },
                    { type: 'Displacement', target: 'anchor', source: createHex(4, 4), destination: createHex(4, 5), simulatePath: true }
                ], { sourceId: 'anchor', targetId: 'anchor' });
            },
            verify: (state) => {
                const anchor = state.enemies.find(e => e.id === 'anchor');
                const attached = state.enemies.find(e => e.id === 'attached');
                if (!anchor || !attached) return false;
                return anchor.position.q === 4
                    && anchor.position.r === 5
                    && attached.position.q === 5
                    && attached.position.r === 4
                    && getAttachmentLinkCount(state, 'anchor') === 0
                    && getAttachmentLinkCount(state, 'attached') === 0;
            }
        }
    ]
};
