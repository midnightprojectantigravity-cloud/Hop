--- Skill Test Runner ---
Skill: Grapple Hook (GRAPPLE_HOOK)
  Scenario: Grappling with Fire
    [PASS]
  Scenario: Hook & Bash
    [PASS]
Skill: Spear Throw (SPEAR_THROW)
  Scenario: Spear Kill
    [PASS]
  Scenario: Spear Miss & Spawn
    [PASS]
Skill: Shield Bash (SHIELD_BASH)
  Scenario: Shield Push
    [CRASH]
      Error: Cannot read properties of undefined (reading 'position')
TypeError: Cannot read properties of undefined (reading 'position')
    at Object.verify (C:\Users\philippe.cave\Documents\Antigravity\Hop\src\game\skills\shield_bash.ts:156:41)
    at runTests (C:\Users\philippe.cave\Documents\Antigravity\Hop\src\game\skillTests.ts:130:44)
    at <anonymous> (C:\Users\philippe.cave\Documents\Antigravity\Hop\src\game\skillTests.ts:155:1)
    at ModuleJob.run (node:internal/modules/esm/module_job:274:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:644:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:116:5)
  Scenario: Wall Slam Stun
    [CRASH]
      Error: Cannot read properties of undefined (reading 'position')
TypeError: Cannot read properties of undefined (reading 'position')
    at Object.verify (C:\Users\philippe.cave\Documents\Antigravity\Hop\src\game\skills\shield_bash.ts:174:50)
    at runTests (C:\Users\philippe.cave\Documents\Antigravity\Hop\src\game\skillTests.ts:130:44)
    at <anonymous> (C:\Users\philippe.cave\Documents\Antigravity\Hop\src\game\skillTests.ts:155:1)
    at ModuleJob.run (node:internal/modules/esm/module_job:274:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:644:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:116:5)

Result: 4 passed, 2 failed.
