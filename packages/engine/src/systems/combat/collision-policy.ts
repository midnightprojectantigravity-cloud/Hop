import type { AtomicEffect } from '../../types';

export interface CollisionResolutionPolicy {
    onBlocked: 'stop' | 'crush_damage';
    crushDamage?: number;
    damageReason?: string;
    applyStunOnStop?: boolean;
    stunDuration?: number;
}

export const resolveBlockedCollisionEffects = (
    targetId: string,
    policy: CollisionResolutionPolicy,
    defaultCrushDamage = 0
): AtomicEffect[] => {
    if (policy.onBlocked === 'crush_damage') {
        const amount = Math.max(0, Math.floor(policy.crushDamage ?? defaultCrushDamage));
        if (amount <= 0) return [];
        return [{
            type: 'Damage',
            target: targetId,
            amount,
            reason: policy.damageReason || 'crush'
        }];
    }

    if (policy.applyStunOnStop) {
        return [{
            type: 'ApplyStatus',
            target: targetId,
            status: 'stunned',
            duration: Math.max(1, Math.floor(policy.stunDuration ?? 1))
        }];
    }

    return [];
};

