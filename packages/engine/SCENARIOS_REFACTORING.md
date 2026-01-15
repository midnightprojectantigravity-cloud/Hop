# Scenarios Refactoring Summary

## Overview

Refactored the test scenarios from individual skill files into a dedicated `scenarios/` folder that serves as the **single source of truth** for automated testing and tutorial generation.

## Changes Made

### 1. Created New Scenarios Folder Structure

```
packages/engine/src/scenarios/
├── README.md              # Comprehensive documentation
├── types.ts               # Extended scenario types with metadata
├── index.ts               # Central registry and query functions
├── grapple_hook.ts        # Grapple hook scenarios
├── shield_throw.ts        # Shield throw scenarios
└── auto_attack.ts         # Auto attack scenarios
```

### 2. Enhanced Scenario Types

Created `TestScenario` type that extends `ScenarioV2` with:
- **relatedSkills**: Array of skill IDs this scenario tests
- **category**: Grouping (e.g., 'combat', 'movement', 'hazards')
- **difficulty**: 'beginner', 'intermediate', or 'advanced'
- **isTutorial**: Flag for tutorial inclusion
- **tags**: Array of tags for filtering

### 3. Central Registry with Query Functions

The `scenarios/index.ts` provides:
- `SCENARIO_COLLECTIONS` - All scenario collections
- `ALL_SCENARIOS` - Flat list of all scenarios
- `getScenariosBySkill(skillId)` - Get scenarios for a specific skill
- `getScenariosByCategory(category)` - Get scenarios by category
- `getTutorialScenarios(difficulty?)` - Get tutorial scenarios
- `getScenariosByTags(tags)` - Get scenarios by tags
- `getScenarioById(id)` - Get a specific scenario
- `getSkillScenarios(skillId)` - Get scenarios in ScenarioV2 format for skill definitions

### 4. Updated Skill Files

Modified the following skill files to import scenarios from the central registry:
- `skills/grapple_hook.ts`
- `skills/shield_throw.ts`
- `skills/auto_attack.ts`

Each now uses:
```typescript
import { getSkillScenarios } from '../scenarios';

export const SKILL: SkillDefinition = {
  // ... other properties
  scenarios: getSkillScenarios('SKILL_ID')
};
```

### 5. Updated Test Runner

Modified `skillTests.ts` to:
- Import `SCENARIO_COLLECTIONS` from scenarios folder
- Iterate over collections instead of individual skill definitions
- Display collection name and description in test output

## Benefits

### 1. Single Source of Truth
- All scenarios defined in one centralized location
- No duplication between skill files and test files
- Easier to maintain and update

### 2. Cross-Skill Testing
- Scenarios can test multiple skills (e.g., GRAPPLE_HOOK + AUTO_ATTACK)
- Better integration testing capabilities
- More realistic test scenarios

### 3. Tutorial Generation
- Metadata enables automatic tutorial creation
- Difficulty levels for progressive learning
- Tags for topic-based filtering

### 4. Better Organization
- Scenarios grouped by feature/collection
- Clear categorization (combat, movement, hazards)
- Easy to find related tests

### 5. Improved Discoverability
- Query functions for finding scenarios
- Filter by skill, category, difficulty, or tags
- Programmatic access to test scenarios

## Migration Path

### For Existing Code
- Skill definitions automatically get scenarios via `getSkillScenarios()`
- Existing test file (`__tests__/grapple_lava.test.ts`) continues to work
- No breaking changes to the API

### For New Scenarios
1. Create scenario in appropriate collection file
2. Add to `SCENARIO_COLLECTIONS` in index.ts
3. Scenarios automatically available to:
   - Test runner
   - Skill definitions
   - Tutorial system

## Future Enhancements

### Potential Additions
1. **Scenario Difficulty Progression** - Automatically order tutorials by difficulty
2. **Scenario Dependencies** - Define prerequisite scenarios
3. **Scenario Rewards** - Track completion and award achievements
4. **Interactive Tutorials** - Generate in-game tutorials from scenarios
5. **Scenario Editor** - Visual tool for creating scenarios
6. **Scenario Validation** - Automated checks for scenario correctness
7. **Scenario Documentation** - Auto-generate documentation from scenarios

### Integration Opportunities
1. **Tutorial System** - Use scenarios to create interactive tutorials
2. **Achievement System** - Track scenario completion
3. **Practice Mode** - Let players practice specific scenarios
4. **Skill Showcase** - Demonstrate skills using scenarios
5. **Testing Dashboard** - Visualize test coverage and results

## Files Modified

### New Files
- `packages/engine/src/scenarios/types.ts`
- `packages/engine/src/scenarios/index.ts`
- `packages/engine/src/scenarios/grapple_hook.ts`
- `packages/engine/src/scenarios/shield_throw.ts`
- `packages/engine/src/scenarios/auto_attack.ts`
- `packages/engine/src/scenarios/README.md`

### Modified Files
- `packages/engine/src/skills/grapple_hook.ts` - Now imports scenarios
- `packages/engine/src/skills/shield_throw.ts` - Now imports scenarios
- `packages/engine/src/skills/auto_attack.ts` - Now imports scenarios
- `packages/engine/src/skillTests.ts` - Updated to use SCENARIO_COLLECTIONS

### Unchanged Files
- `packages/engine/src/__tests__/grapple_lava.test.ts` - Still works as before
- All other skill files - No changes needed

## Testing

The refactoring maintains backward compatibility:
- Existing tests continue to work
- Skill definitions still have scenarios array
- Test runner finds all scenarios

Run tests with:
```bash
npm test
```

Run skill test runner with:
```bash
SKILL_TESTS_RUN=1 node src/skillTests.ts
```

## Conclusion

This refactoring successfully separates test scenarios from skill implementations while maintaining full backward compatibility. The new structure provides a solid foundation for:
- Comprehensive automated testing
- Interactive tutorial generation
- Better test organization and discoverability
- Future enhancements to the testing and tutorial systems
