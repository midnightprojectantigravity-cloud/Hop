import type { ScenarioV2 } from '../types';

/**
 * Extended scenario definition with metadata for testing and tutorials
 */
export interface TestScenario extends ScenarioV2 {
    /** Category for grouping scenarios (e.g., 'combat', 'movement', 'hazards') */
    category?: string;

    /** Related skill IDs that this scenario tests */
    relatedSkills: string[];

    /** Difficulty level for tutorial ordering */
    difficulty?: 'beginner' | 'intermediate' | 'advanced';

    /** Whether this scenario should be included in tutorials */
    isTutorial?: boolean;

    /** Tags for filtering and searching */
    tags?: string[];
}

/**
 * Scenario collection organized by category
 */
export interface ScenarioCollection {
    /** Collection name/identifier */
    id: string;

    /** Human-readable name */
    name: string;

    /** Description of what this collection tests */
    description: string;

    /** All scenarios in this collection */
    scenarios: TestScenario[];
}
