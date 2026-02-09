## Checklist

- [ ] I ran `npm run build --workspace=@hop/engine`.
- [ ] I ran relevant tests for my changes.
- [ ] If I changed any skill stats/profile data, I regenerated static grades:
  - `npm run upa:grades:static`
- [ ] If I changed skill behavior/targeting/execution logic, I regenerated dynamic/drift artifacts:
  - `npm run upa:grades:dynamic`
  - `npm run upa:grades:drift`
- [ ] I updated milestone progress in `docs/NEXT_LEVEL.md` when applicable.

## Notes

Include any notable skill-grade deltas from:
- `docs/UPA_SKILL_GRADES_STATIC.json`
- `docs/UPA_SKILL_GRADES_DYNAMIC.json`
- `docs/UPA_SKILL_GRADE_DRIFT.json`

