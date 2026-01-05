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
      Messages: ["Pushed footman!","footman moves to (4, 3)","Footman punched you! (HP: 2/3)"]
      Enemies: ["victim@4,3"]
      Player: 4,4
  Scenario: Wall Slam Stun
    [FAIL]
      Messages: ["DBG: Col 4,2 W:true E:n B:false","Bashed footman into obstacle!","Footman punched you! (HP: 2/3)","Punched footman!"]
      Enemies: []
      Player: 4,4

Result: 4 passed, 2 failed.
