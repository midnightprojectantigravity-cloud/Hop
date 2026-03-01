import type { ScenarioV2 } from '../types';
import type { TestScenario } from './types';

/**
 * Convert TestScenario to ScenarioV2 (for backward compatibility with skill definitions)
 */
export function toScenarioV2(scenario: TestScenario): ScenarioV2 {
    return {
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        rationale: scenario.rationale,
        setup: scenario.setup,
        run: scenario.run,
        verify: scenario.verify,
    };
}
