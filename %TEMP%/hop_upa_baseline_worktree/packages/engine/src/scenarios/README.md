# Scenarios Folder

This folder contains all test scenarios for the game engine. It serves as the **single source of truth** for:

1. **Automated Testing** - Running comprehensive test suites for game mechanics
2. **Tutorial Generation** - Providing interactive tutorials for players

## Structure

### Files

- **`types.ts`** - Extended scenario types with metadata for categorization and tutorial generation
- **`index.ts`** - Central registry with helper functions for querying scenarios
- **`<skill_name>.ts`** - Individual scenario collections grouped by skill or feature

### Scenario Collections

Each scenario collection file exports a `ScenarioCollection` object containing:

- **id**: Unique identifier for the collection
- **name**: Human-readable name
- **description**: What this collection tests
- **scenarios**: Array of test scenarios

### Test Scenarios

Each `TestScenario` extends the base `ScenarioV2` type with additional metadata:

```typescript
{
  id: string;                    // Unique scenario ID
  title: string;                 // Display title
  description: string;           // What this scenario tests
  relatedSkills: string[];       // Skills involved in this scenario
  category?: string;             // Grouping category (e.g., 'combat', 'movement')
  difficulty?: string;           // 'beginner', 'intermediate', or 'advanced'
  isTutorial?: boolean;          // Whether to include in tutorials
  tags?: string[];               // Additional tags for filtering
  setup: (engine) => void;       // Setup the test environment
  run: (engine) => void;         // Execute the test actions
  verify: (state, logs) => bool; // Verify the expected outcome
}
```

## Usage

### For Testing

The test runner in `skillTests.ts` automatically discovers and runs all scenarios:

```typescript
import { SCENARIO_COLLECTIONS } from './scenarios';

for (const collection of SCENARIO_COLLECTIONS) {
  for (const scenario of collection.scenarios) {
    // Run scenario...
  }
}
```

### For Skill Definitions

Skills can reference their scenarios from the centralized registry:

```typescript
import { getSkillScenarios } from '../scenarios';

export const MY_SKILL: SkillDefinition = {
  // ... skill properties
  scenarios: getSkillScenarios('MY_SKILL')
};
```

### Querying Scenarios

The index provides several helper functions:

```typescript
import {
  getScenariosBySkill,
  getScenariosByCategory,
  getTutorialScenarios,
  getScenariosByTags,
  getScenarioById
} from './scenarios';

// Get all scenarios for a specific skill
const grappleScenarios = getScenariosBySkill('GRAPPLE_HOOK');

// Get all beginner tutorials
const beginnerTutorials = getTutorialScenarios('beginner');

// Get scenarios by category
const combatScenarios = getScenariosByCategory('combat');

// Get scenarios by tags
const lavaScenarios = getScenariosByTags(['lava', 'hazards']);
```

## Adding New Scenarios

### 1. Create a new scenario collection file

```typescript
// scenarios/my_feature.ts
import type { GameState } from '../types';
import type { TestScenario, ScenarioCollection } from './types';

export const myFeatureScenarios: ScenarioCollection = {
  id: 'my_feature',
  name: 'My Feature',
  description: 'Tests for my feature',
  scenarios: [
    {
      id: 'my_test',
      title: 'My Test',
      description: 'Tests something specific',
      relatedSkills: ['SKILL_ID'],
      category: 'combat',
      difficulty: 'beginner',
      isTutorial: true,
      tags: ['tag1', 'tag2'],
      setup: (engine) => {
        // Setup test environment
      },
      run: (engine) => {
        // Execute test actions
      },
      verify: (state, logs) => {
        // Verify expected outcome
        return true;
      }
    }
  ]
};
```

### 2. Register in the index

```typescript
// scenarios/index.ts
import { myFeatureScenarios } from './my_feature';

export const SCENARIO_COLLECTIONS: ScenarioCollection[] = [
  // ... existing collections
  myFeatureScenarios,
];
```

### 3. Reference from skill definition (if applicable)

```typescript
// skills/my_skill.ts
import { getSkillScenarios } from '../scenarios';

export const MY_SKILL: SkillDefinition = {
  // ... skill properties
  scenarios: getSkillScenarios('MY_SKILL')
};
```

## Benefits of This Structure

1. **Single Source of Truth** - All scenarios are defined in one place
2. **Reusability** - Scenarios can test multiple skills or features
3. **Discoverability** - Easy to find and query scenarios by various criteria
4. **Separation of Concerns** - Test logic is separate from implementation
5. **Tutorial Generation** - Metadata enables automatic tutorial creation
6. **Maintainability** - Easier to update and extend test coverage

## Categories

Current categories include:

- **combat** - Combat mechanics and damage
- **movement** - Movement and displacement
- **hazards** - Environmental hazards (lava, void, etc.)

## Tags

Common tags include:

- **lava** - Lava-related mechanics
- **wall** - Wall interactions
- **displacement** - Movement/pushing mechanics
- **stun** - Stun effects
- **line-of-sight** - LoS mechanics
- **auto-attack** - Passive auto-attack
- **passive** - Passive skills
- **enemy-ai** - Enemy AI behavior
- **stress-test** - Edge cases and stress tests
- **integration** - Multi-skill integration tests
