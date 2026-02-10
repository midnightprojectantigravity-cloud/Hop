new
the juice for entity displacement should be improved.
- depending on the type of movement (teleport, normal move, etc) the visual effect should be different.
- for normal move, the entity should slide along the path of movement (not in a straight line from source to destination).
- for teleport, the entity should disappear from the source and reappear at the destination.

archive
it should not be possible to move to lava either as a target or as passing during free move unless it is safe (flying, resist, absorb, etc) DONE

Free Move needs to be treated as a normal move (it is equivalent to BASIC_MOVE with infinite range), not as a teleport and the ui displacement juice needs to be updated accordingly. DONE

Fire Walk should be treated like a teleport type of movement, there is no passing through tiles between the source and destination either for the engine or for the visual movement. DONE

Bombs should be more consistent (tick down each turn, explode when timer runs out), currently the timer is stuck sometimes. DONE

prevent clicking on a tile's text and selecting it. DONE


Jump target preview shows an enemy, but clicking on it says 'Target out of reach or blocked!'. This shows a disconnect between the preview and the actual action. CRITICAL ISSUE TO BE CHECKED FOR THE ENTIRE GAME, Single source of truth for engine, preview, UI, etc. DONE (for JUMP)


Jump Stun is glitchy:
[7]
INFO
COMBAT
footman is stunned!

[8]
INFO
COMBAT
archer is stunned!

[9]
INFO
COMBAT
Jumped!

[10]
INFO
COMBAT
footman stunned by landing impact!

[11]
INFO
COMBAT
archer stunned by landing impact!

[12]
INFO
COMBAT
footman attacked you!

7 and 8 happen before the actual jump message, and then 10 and 11 happen after with a duplicate stun info message.
12 should not happen at all, the footman should be stunned and not be able to attack.
DONE (stunned telegraphed actors no longer execute queued attack intents while stunned; duplicate stun messaging reduced)
