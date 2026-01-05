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
    [FAIL]
      Messages: ["Bashed footman into obstacle!","Footman punched you! (HP: 2/3)","Punched footman!"]
      Enemies: []
      Player: 0,0
  Scenario: Wall Slam Stun
    [FAIL]
      Messages: ["Bashed footman into obstacle!","Footman punched you! (HP: 2/3)","Punched footman!"]
      Enemies: []
      Player: 0,0

Result: 4 passed, 2 failed.
