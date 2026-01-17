import type { WeightClass } from '../types';

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
