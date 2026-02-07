/**
 * Debug script to trace JUMP stun application
 */
import { ScenarioEngine } from '../skillTests';
import { hexEquals } from '../hex';

import { generateInitialState } from '../logic';
const engine = new ScenarioEngine(generateInitialState());

// Setup from jump_stunning_landing scenario
engine.setPlayer({ q: 3, r: 6, s: -9 }, ['JUMP']);
engine.spawnEnemy('footman', { q: 3, r: 7, s: -10 }, 'neighbor_1');
engine.spawnEnemy('footman', { q: 4, r: 7, s: -11 }, 'neighbor_2');
engine.spawnEnemy('footman', { q: 3, r: 5, s: -8 }, 'distant_enemy');

console.log('=== BEFORE JUMP ===');
console.log('Player position:', engine.state.player.position);
console.log('Enemy neighbor_1:', engine.getEnemy('neighbor_1')?.position, 'Status:', engine.getEnemy('neighbor_1')?.statusEffects);
console.log('Enemy neighbor_2:', engine.getEnemy('neighbor_2')?.position, 'Status:', engine.getEnemy('neighbor_2')?.statusEffects);

// Execute JUMP to target
engine.useSkill('JUMP', { q: 3, r: 8, s: -11 });

console.log('\n=== AFTER JUMP ===');
console.log('Player position:', engine.state.player.position);
console.log('Enemy neighbor_1:', engine.getEnemy('neighbor_1')?.position, 'Status:', engine.getEnemy('neighbor_1')?.statusEffects);
console.log('Enemy neighbor_2:', engine.getEnemy('neighbor_2')?.position, 'Status:', engine.getEnemy('neighbor_2')?.statusEffects);
console.log('\n=== LOGS ===');
engine.logs.forEach(log => console.log(log));

// Check neighbors of landing position
import { getNeighbors } from '../hex';
const landingNeighbors = getNeighbors({ q: 3, r: 8, s: -11 });
console.log('\n=== LANDING NEIGHBORS ===');
landingNeighbors.forEach(n => console.log(JSON.stringify(n)));

// Check if enemy positions match neighbors
const n1Pos = engine.getEnemy('neighbor_1')?.position;
const n2Pos = engine.getEnemy('neighbor_2')?.position;
console.log('\n=== NEIGHBOR MATCHING ===');
console.log('neighbor_1 at:', n1Pos, 'Is neighbor?', landingNeighbors.some(n => hexEquals(n, n1Pos!)));
console.log('neighbor_2 at:', n2Pos, 'Is neighbor?', landingNeighbors.some(n => hexEquals(n, n2Pos!)));
