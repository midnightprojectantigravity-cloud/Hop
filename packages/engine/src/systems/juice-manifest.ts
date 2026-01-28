/**
 * JUICE MANIFEST
 * 
 * Defines the complete visual/haptic signature for every skill and effect in the engine.
 * This is the contract between the headless simulation and the frontend renderer.
 * 
 * Each skill has 4 phases:
 * 1. ANTICIPATION - Pre-action telegraph (player intent)
 * 2. EXECUTION - The action itself (movement, projectile)
 * 3. IMPACT - Collision/damage/environmental reaction
 * 4. RESOLUTION - Aftermath/settling (dust, debris, status effects)
 */

import type { AtomicEffect, Point } from '../types';

export interface JuiceSignature {
    anticipation?: AtomicEffect[];
    execution: AtomicEffect[];
    impact?: AtomicEffect[];
    resolution?: AtomicEffect[];
}

/**
 * Juice Helpers - Reusable effect generators
 */
export const JuiceHelpers = {
    /**
     * Camera shake with directional bias
     */
    shake: (intensity: 'low' | 'medium' | 'high' | 'extreme', direction?: Point): AtomicEffect => ({
        type: 'Juice',
        effect: 'shake',
        intensity,
        direction
    }),

    /**
     * Screen flash for critical moments
     */
    flash: (color?: string): AtomicEffect => ({
        type: 'Juice',
        effect: 'flash',
        intensity: 'high',
        color
    }),

    /**
     * Freeze frame for impactful moments
     */
    freeze: (duration: number = 80): AtomicEffect => ({
        type: 'Juice',
        effect: 'freeze',
        duration
    }),

    /**
     * Combat text floating from a position
     */
    combatText: (text: string, target: Point | string, color?: string): AtomicEffect => ({
        type: 'Juice',
        effect: 'combat_text',
        text,
        target,
        color
    }),

    /**
     * Momentum trail for moving units (speed-based particles)
     */
    momentumTrail: (path: Point[], intensity: 'low' | 'medium' | 'high'): AtomicEffect => ({
        type: 'Juice',
        effect: 'momentumTrail',
        path,
        intensity
    }),

    /**
     * Heavy impact with screen shake and particles
     */
    heavyImpact: (target: Point | string, direction?: Point): AtomicEffect => ({
        type: 'Juice',
        effect: 'heavyImpact',
        target,
        direction,
        intensity: 'extreme'
    }),

    /**
     * Light impact (minimal feedback)
     */
    lightImpact: (target: Point | string): AtomicEffect => ({
        type: 'Juice',
        effect: 'lightImpact',
        target,
        intensity: 'low'
    }),

    /**
     * Kinetic wave emanating from impact point
     */
    kineticWave: (origin: Point, direction: Point, intensity: 'low' | 'medium' | 'high'): AtomicEffect => ({
        type: 'Juice',
        effect: 'kineticWave',
        target: origin,
        direction,
        intensity
    }),

    /**
     * Stun burst (radial particle explosion)
     */
    stunBurst: (target: Point | string): AtomicEffect => ({
        type: 'Juice',
        effect: 'stunBurst',
        target,
        intensity: 'medium'
    }),

    /**
     * Lava ripple effect
     */
    lavaRipple: (position: Point): AtomicEffect => ({
        type: 'Juice',
        effect: 'lavaRipple',
        target: position,
        intensity: 'medium'
    }),

    /**
     * Wall crack on impact
     */
    wallCrack: (position: Point, direction: Point): AtomicEffect => ({
        type: 'Juice',
        effect: 'wallCrack',
        target: position,
        direction,
        intensity: 'high'
    }),

    /**
     * Explosion ring (radial expansion)
     */
    explosionRing: (position: Point): AtomicEffect => ({
        type: 'Juice',
        effect: 'explosion_ring',
        target: position
    })
};

/**
 * SKILL JUICE SIGNATURES
 * Each skill defines its complete sensory profile
 */
export const SKILL_JUICE_SIGNATURES = {
    /**
     * GRAPPLE HOOK
     * Intent: Pull enemy toward you, swap positions, fling them past you
     * Weight: Medium-Heavy (kinetic momentum transfer)
     */
    GRAPPLE_HOOK: {
        anticipation: (origin: Point, target: Point): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'aimingLaser',
                target: origin,
                path: [origin, target],
                intensity: 'low',
                color: '#00ff88'
            }
        ],
        execution: (path: Point[]): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'hookCable',
                path,
                intensity: 'medium',
                duration: 200,
                color: '#00ff88'
            },
            JuiceHelpers.shake('low')
        ],
        impact: (swapPoint: Point, direction: Point): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'grappleHookWinch',
                target: swapPoint,
                direction,
                intensity: 'high',
                duration: 150
            },
            JuiceHelpers.shake('medium', direction)
        ],
        resolution: (flingPath: Point[], momentum: number): AtomicEffect[] => [
            JuiceHelpers.momentumTrail(flingPath, momentum > 6 ? 'high' : 'medium'),
            JuiceHelpers.kineticWave(flingPath[0], flingPath[flingPath.length - 1], 'high')
        ]
    },

    /**
     * SHIELD THROW
     * Intent: Throw shield in straight line, trigger kinetic pulse on impact
     * Weight: Heavy (projectile + kinetic chain)
     */
    SHIELD_THROW: {
        anticipation: (origin: Point, target: Point): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'trajectory',
                target: origin,
                path: [origin, target],
                intensity: 'medium',
                color: '#4169e1'
            }
        ],
        execution: (path: Point[]): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'shieldArc',
                path,
                intensity: 'high',
                duration: 300,
                metadata: { rotation: 720 } // Full spins
            },
            {
                type: 'Juice',
                effect: 'shieldSpin',
                path,
                intensity: 'medium'
            }
        ],
        impact: (impactPoint: Point, direction: Point): AtomicEffect[] => [
            JuiceHelpers.heavyImpact(impactPoint, direction),
            JuiceHelpers.shake('high', direction),
            JuiceHelpers.freeze(120),
            JuiceHelpers.combatText('IMPACT!', impactPoint, '#ff4444')
        ],
        resolution: (kineticPath: Point[]): AtomicEffect[] => [
            JuiceHelpers.kineticWave(kineticPath[0], kineticPath[kineticPath.length - 1], 'high'),
            JuiceHelpers.momentumTrail(kineticPath, 'high')
        ]
    },

    /**
     * DASH
     * Intent: Linear charge, shield shunt on collision
     * Weight: Medium (player movement) -> Heavy (collision)
     */
    DASH: {
        anticipation: (origin: Point, target: Point): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'chargeUp',
                target: origin,
                direction: target,
                intensity: 'medium',
                duration: 100
            }
        ],
        execution: (path: Point[]): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'dashBlur',
                path,
                intensity: 'high',
                duration: 150
            },
            JuiceHelpers.momentumTrail(path, 'medium')
        ],
        impact: (collisionPoint: Point, direction: Point, hasShield: boolean): AtomicEffect[] => {
            if (!hasShield) {
                return [JuiceHelpers.lightImpact(collisionPoint)];
            }
            return [
                JuiceHelpers.heavyImpact(collisionPoint, direction),
                JuiceHelpers.shake('extreme', direction),
                JuiceHelpers.freeze(100),
                JuiceHelpers.combatText('SHUNT!', collisionPoint, '#ffaa00')
            ];
        },
        resolution: (kineticPath?: Point[]): AtomicEffect[] => {
            if (!kineticPath) return [];
            return [
                JuiceHelpers.kineticWave(kineticPath[0], kineticPath[kineticPath.length - 1], 'high'),
                JuiceHelpers.momentumTrail(kineticPath, 'high')
            ];
        }
    },

    /**
     * SPEAR THROW
     * Intent: Instant-kill projectile
     * Weight: Light-Medium (precision strike)
     */
    SPEAR_THROW: {
        anticipation: (origin: Point, target: Point): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'aimingLaser',
                target: origin,
                path: [origin, target],
                intensity: 'low',
                color: '#ff6b6b'
            }
        ],
        execution: (path: Point[]): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'spearTrail',
                path,
                intensity: 'high',
                duration: 150
            },
            {
                type: 'Juice',
                effect: 'spearWhistle',
                path,
                intensity: 'medium',
                metadata: { pitch: 'rising' }
            }
        ],
        impact: (hitPoint: Point, isKill: boolean): AtomicEffect[] => {
            if (isKill) {
                return [
                    JuiceHelpers.heavyImpact(hitPoint),
                    JuiceHelpers.shake('medium'),
                    JuiceHelpers.freeze(60),
                    JuiceHelpers.combatText('LETHAL', hitPoint, '#ff0000')
                ];
            }
            return [
                JuiceHelpers.lightImpact(hitPoint),
                JuiceHelpers.combatText('MISS', hitPoint, '#888888')
            ];
        },
        resolution: (): AtomicEffect[] => []
    },

    /**
     * VAULT
     * Intent: Leap over enemy, stun on odd turns
     * Weight: Light (acrobatic)
     */
    VAULT: {
        anticipation: (origin: Point, target: Point): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'trajectory',
                target: origin,
                path: [origin, target],
                intensity: 'low',
                color: '#00ddff',
                metadata: { arc: 'high' }
            }
        ],
        execution: (path: Point[]): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'vaultLeap',
                path,
                intensity: 'medium',
                duration: 250,
                metadata: { arc: 'parabolic' }
            }
        ],
        impact: (landingPoint: Point, shouldStun: boolean): AtomicEffect[] => {
            if (shouldStun) {
                return [
                    JuiceHelpers.heavyImpact(landingPoint),
                    JuiceHelpers.shake('medium'),
                    JuiceHelpers.stunBurst(landingPoint),
                    JuiceHelpers.combatText('STUN!', landingPoint, '#ffff00')
                ];
            }
            return [JuiceHelpers.lightImpact(landingPoint)];
        },
        resolution: (): AtomicEffect[] => []
    },

    /**
     * BOMB
     * Intent: Area explosion after countdown
     * Weight: Extreme (environmental force)
     */
    BOMB: {
        impact: (position: Point): AtomicEffect[] => [
            {
                type: 'Juice',
                effect: 'flash',
                target: position,
                color: '#ffaa00',
                intensity: 'extreme'
            },
            JuiceHelpers.explosionRing(position),
            JuiceHelpers.heavyImpact(position),
            JuiceHelpers.shake('extreme'),
            JuiceHelpers.freeze(100),
            JuiceHelpers.combatText('BOOM!', position, '#ff4400')
        ],
        resolution: (affectedPoints: Point[]): AtomicEffect[] =>
            affectedPoints.map(p => JuiceHelpers.lightImpact(p))
    }
};

/**
 * ENVIRONMENTAL JUICE
 * Reactions to hazards and terrain
 */
export const ENVIRONMENTAL_JUICE = {
    lavaSink: (position: Point): AtomicEffect[] => [
        {
            type: 'Juice',
            effect: 'lavaSink',
            target: position,
            intensity: 'extreme',
            duration: 500,
            metadata: { particleCount: 50 }
        },
        JuiceHelpers.lavaRipple(position),
        JuiceHelpers.shake('high'),
        JuiceHelpers.combatText('CONSUMED', position, '#ff4400')
    ],

    wallImpact: (position: Point, direction: Point, shouldStun: boolean): AtomicEffect[] => {
        const effects: AtomicEffect[] = [
            JuiceHelpers.wallCrack(position, direction),
            JuiceHelpers.shake('high', direction)
        ];
        if (shouldStun) {
            effects.push(JuiceHelpers.stunBurst(position));
            effects.push(JuiceHelpers.combatText('STUNNED', position, '#ffaa00'));
        }
        return effects;
    },

    voidConsume: (position: Point): AtomicEffect[] => [
        {
            type: 'Juice',
            effect: 'voidConsume',
            target: position,
            intensity: 'extreme',
            duration: 800,
            color: '#000000'
        },
        JuiceHelpers.freeze(150),
        JuiceHelpers.combatText('VOID', position, '#8800ff')
    ]
};

/**
 * STATUS EFFECT JUICE
 * Visual feedback for status application/removal
 */
export const STATUS_JUICE = {
    stunned: (target: Point | string): AtomicEffect[] => [
        JuiceHelpers.stunBurst(target),
        {
            type: 'Juice',
            effect: 'stunBurst',
            target,
            intensity: 'medium',
            duration: 200,
            color: '#ffff00'
        }
    ],

    poisoned: (target: Point | string): AtomicEffect[] => [
        {
            type: 'Juice',
            effect: 'poisonCloud',
            target,
            intensity: 'low',
            duration: 1000,
            color: '#00ff00'
        }
    ],

    armored: (target: Point | string): AtomicEffect[] => [
        {
            type: 'Juice',
            effect: 'armorGleam',
            target,
            intensity: 'medium',
            duration: 300,
            color: '#4169e1'
        }
    ],

    hidden: (target: Point | string): AtomicEffect[] => [
        {
            type: 'Juice',
            effect: 'hiddenFade',
            target,
            intensity: 'low',
            duration: 500,
            metadata: { fadeOut: true }
        }
    ]
};
