import type { Actor, WeightClass } from '../../types';
import type { PhysicsComponent } from '../components';
import { getComponent } from '../components';
import { extractTrinityStats } from './combat-calculator';

export interface ForceScalars {
    mass: number;
    velocity: number;
    momentum: number;
}

const WEIGHT_CLASS_BASE_MASS: Record<WeightClass, number> = {
    Light: 0.8,
    Standard: 1,
    Heavy: 1.2,
    Anchored: 1.5,
    OuterWall: 2
};

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export const resolveActorForceScalars = (actor: Actor): ForceScalars => {
    const trinity = extractTrinityStats(actor);
    const physics = getComponent<PhysicsComponent>(actor.components, 'physics');
    const weightClass = physics?.weightClass || actor.weightClass || 'Standard';
    const baseMass = WEIGHT_CLASS_BASE_MASS[weightClass];

    const mass = round3(Math.max(0.5, baseMass + (trinity.body * 0.03)));
    const velocity = round3(Math.max(0.5, Number(actor.speed || 1)));
    const momentum = round3(Math.max(0, ((mass * velocity) + (trinity.instinct * 0.15)) / 4));

    return { mass, velocity, momentum };
};

