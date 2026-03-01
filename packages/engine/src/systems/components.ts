import type { WeightClass } from '../types';
import type { AilmentID } from '../types/registry';

/**
 * Base Interface for all Components
 */
export interface Component {
    type: string;
}

/**
 * Physics Component
 * Handles weight, facing, and potentially collision properties
 */
export interface PhysicsComponent extends Component {
    type: 'physics';
    weightClass: WeightClass;
    facing?: number;
}

/**
 * Combat Stats Component
 * Can be used to store modifiers or specific combat data
 */
export interface StatsComponent extends Component {
    type: 'stats';
    strength?: number;
    defense?: number;
    evasion?: number;
}

/**
 * Canonical Trinity stats used by centralized combat math.
 */
export interface TrinityComponent extends Component {
    type: 'trinity';
    body: number;
    mind: number;
    instinct: number;
}

/**
 * Combat Profile Component
 * Data-driven weapon/trait style multipliers applied by damage class.
 */
export interface CombatProfileComponent extends Component {
    type: 'combat_profile';
    outgoingPhysical: number;
    outgoingMagical: number;
    incomingPhysical: number;
    incomingMagical: number;
}

/**
 * ACAE ailment counter balances.
 */
export interface AilmentCountersComponent extends Component {
    type: 'ailments';
    counters: Partial<Record<AilmentID, number>>;
}

/**
 * ACAE per-ailment hardening progression (per run).
 */
export interface AilmentResilienceComponent extends Component {
    type: 'ailment_resilience';
    xp: Partial<Record<AilmentID, number>>;
    resistancePct: Partial<Record<AilmentID, number>>;
}

/**
 * ACAE actor profile for base resistance and growth propensity.
 */
export interface AilmentProfileComponent extends Component {
    type: 'ailment_profile';
    baseResistancePct: Partial<Record<AilmentID, number>>;
    resistanceGrowthRate: number;
}

/**
 * Visibility / Stealth Component
 */
export interface VisibilityComponent extends Component {
    type: 'visibility';
    isVisible: boolean;
    stealthLevel?: number;
}

/**
 * Example mechanic-specific components
 */
export interface VaultComponent extends Component {
    type: 'vault';
    counter: number;
}

/**
 * Archetype for passive/core logic
 */
export interface ArchetypeComponent extends Component {
    type: 'archetype';
    archetype: 'VANGUARD' | 'SKIRMISHER';
}

/**
 * Union type for all registered components
 */
export type GameComponent =
    | PhysicsComponent
    | StatsComponent
    | TrinityComponent
    | CombatProfileComponent
    | AilmentCountersComponent
    | AilmentResilienceComponent
    | AilmentProfileComponent
    | VisibilityComponent
    | VaultComponent
    | ArchetypeComponent;

/**
 * Component Helper Functions
 */

/**
 * Checks if an actor has a component of a specific type
 */
export function hasComponent<T extends GameComponent>(
    components: Map<string, GameComponent> | undefined,
    type: T['type']
): boolean {
    return components?.has(type) ?? false;
}

/**
 * Gets a component from an actor's component map
 */
export function getComponent<T extends GameComponent>(
    components: Map<string, GameComponent> | undefined,
    type: T['type']
): T | undefined {
    return components?.get(type) as T | undefined;
}

/**
 * Returns a new components map with the component added/updated
 */
export function setComponent(
    components: Map<string, GameComponent> | undefined,
    component: GameComponent
): Map<string, GameComponent> {
    const newMap = new Map(components || []);
    newMap.set(component.type, component);
    return newMap;
}

/**
 * Returns a new components map with the component removed
 */
export function removeComponent(
    components: Map<string, GameComponent> | undefined,
    type: string
): Map<string, GameComponent> {
    const newMap = new Map(components || []);
    newMap.delete(type);
    return newMap;
}
