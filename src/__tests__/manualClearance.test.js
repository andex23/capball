import { it, expect } from 'vitest'
import { createShot, predictShot, capBounds, ownGoalRisk } from '../game/predict'
import { CAP_RADIUS, GK_RADIUS, PHYSICS } from '../data/TeamData'
import { makeContext, simulateFlick } from '../ai/planner'
it('recreates the supplied near-post position', () => {
 const positions={team1_gk:{x:-13.6,y:0},team1_def1:{x:-12.8,y:4.9},ball:{x:-13.3,y:3.5}}
 const ctx=makeContext({positions,team:'team1'})
 for(const capId of ['team1_def1','team1_gk']){
 const p=positions[capId],b=positions.ball,d=Math.hypot(b.x-p.x,b.y-p.y)
 const out=simulateFlick(ctx,capId,{x:2*(b.x-p.x)/d,y:2*(b.y-p.y)/d},{maxFrames:400})
 if(capId === 'team1_def1') {
   expect(out.verdict).toEqual({outcome:'goal',scorer:'team2'})
   const shot=createShot()
   Object.assign(shot,{x:p.x,y:p.y,vx:2*(b.x-p.x)/d,vy:2*(b.y-p.y)/d,r:CAP_RADIUS,mass:PHYSICS.playerMass,ballX:b.x,ballY:b.y,bodyCount:1})
   Object.assign(shot.bodies[0],{...positions.team1_gk,r:GK_RADIUS,contact:'teammate'})
   capBounds(capId,'left',shot)
   expect(ownGoalRisk(predictShot(shot),capId,'left')).toBe(true)
 }
 else { expect(out.verdict).toBeNull(); expect(out.positions.ball.y).toBeGreaterThan(b.y) }
 }
})

it('only warns for goalward ball paths in the defending box, on either end', () => {
  const path = (x, y, nx, ny) => ({ contact: 'ball', ballPoints: 2, ballPath: [x, y, nx, ny], end: 'cap', goalDir: 0 })
  expect(ownGoalRisk(path(-13, 2, -14, 1), 'team1_def1', 'left')).toBe(true)
  expect(ownGoalRisk(path(13, 2, 14, 1), 'team1_def1', 'right')).toBe(true)
  expect(ownGoalRisk(path(-13, 2, -12, 3), 'team1_gk', 'left')).toBe(false)
  expect(ownGoalRisk(path(-13, 2, -13, 4), 'team1_def1', 'left')).toBe(false)
  expect(ownGoalRisk(path(-13, 2, -14, 5), 'team1_def1', 'left')).toBe(false)
})
