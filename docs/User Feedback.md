1/28/26
- basic
- 


TO REVIEW vvvv
- new archetypes and skills: 
    - Fire Mage
        - Fireball
        - Firewall 
          - WALL IN A STRAIGHT LINE centered on the click
          - extends 2 tiles on each side
          - enemies should be able to move through it but they might die, so in general they would be better off not moving through it, it should not block LoS
        - Firewalk 
          - skill seems to be missing on the UI
          - teleport to a tile in range, but limited to tiles on fire or lava tiles
          - grants immunity to fire and lava for 2 turns - current + next basically
        - Fire 
          - tile property
          - deals 1 damage per turn to all entities on it at the beginning of their turn
          - visual effect missing
    - Necromancer
        - Corpse Explosion 
          - should not damage the player and his faction
        - Raise Dead 
          - should not be allowed to raise dead if the tile is occupied by another entity
        - Soul Swap 
          - skill seems to be missing on the UI
        - Skeleton 
          - new type of entity
          - should be the same color as the player (blue) and have the same initiative as the player
          - player should not be allowed to attack their own skeletons
          - skeletons should be able to move to next map with the player
          - if the player has high movement range, the skeleton should teleport close to the player after the player moves
          - skeleton should stay within 3-4 tiles ahead of the player depending on the direction the player is moving, but not closer so it doesn't block the player's movement
    - Hunter
        - Multi-Shoot 
          - single click on a target to shoot it, dealing damage to it and any other targets in range
        - Set Trap 
          - single click on a tile to set a trap
        - Swift Roll 
          - single click on a tile to roll to it
    - Assassin
        - Sneak Attack 
          - single click on a target to deal extra damage
          - only works if invisible
        - Smoke Screen 
          - becomes invisible for 2 turns - current + next + remaining if already invisible
          - CD 2 turns
        - Shadow Step
          - teleport range 2
          - only works if invisible
          - extends invisibility for 2 turns - 2 + remaining
          - CD 2 turns
        - invisibility
          - passive
          - enemies ignore the player, no movement, no attack
          - invisibility doesn't seem to be working



TODOs
- needs juice for grapple hook - see the hook travel to the target, the cable tension and the unit being pulled + optional swap + fling **(Planned: Needs cable/path renderer)**
- needs juice for shield throw - see the shield travel animation and impact **(Planned: Needs arc renderer)**

QUESTIONS & CLARIFICATIONS
1. **Item Interference**: If an enemy moves onto your dropped shield or spear, what is the intended behavior?
    - still need to figure out dropped spear and shield interaction when other entity (non owner) goes to their tile **(Question: Does the enemy destroy the item? Do they block it? Can they pick it up?)**
    - hold on this one for now, I have to think about it

DONEs
- Dash logic refined (Turns consumed only if player moves or shunts an enemy; immediate blocks are free)
- Transition Sync (Shrines/Stairs now strictly wait for all animations and impact effects to finish before showing menus)
- Bomb explosion radial ring (Added visual trace for all tiles in range)
- needs juice for move to lava tile (Ripple VFX added)
- needs juice for lava sink (Vaporize VFX added)
- needs juice for bomb explosion (Flash + Shake + Boom text added)
- should be able to bash bombs but not attack them
- leave shield behind + be able to pick it up again
- completely block any ui interaction when the game is not in a state where the player can act
- Stunned units should not be able to act after stun clears out (that should happen at the end of the turn)
- Enemy intent needs to be flexible, meaning if that intent is not possible, the enemy should choose another action - if they are trying to throw the spear at the player but the player moves, they should reassess if the player is still in range and if not, choose another action, but if they are, then they should throw the spear at the player