import { it, expect } from 'vitest'
import { newCareer, setTableFinish, sanitizeCareer, TOP } from '../game/career'
import { TABLE_FINISHES, resolveFinish, finishForName, withFinish, STADIUMS, isFinish } from '../data/StadiumData'
import { FILE_NAVIGATION } from '../pwa/swRoutes'

it('only a top-division club picks its pro table, and the choice is saved', () => {
  const k = newCareer({ name: 'Yaba United', primary: '#1d4ed8', edge: '#ffffff' }, { now: 1 })
  expect(setTableFinish(k, 'walnut')).toBeNull()
  const pro = { ...k, level: TOP }
  expect(setTableFinish(pro, 'marble')).toBeNull()
  const picked = setTableFinish(pro, 'walnut')
  expect(picked.biz.finish).toBe('walnut')
  expect(sanitizeCareer(JSON.parse(JSON.stringify(picked))).biz.finish).toBe('walnut')
})

it('every finish paints a full table, club colours from the kit, away clubs always the same', () => {
  for (const f of TABLE_FINISHES) {
    const r = resolveFinish(f.id, { primary: '#c62828', edge: '#ffd700' })
    for (const key of ['c1', 'c2', 'line', 'rail', 'body', 'frame', 'trim', 'base']) expect(r[key], `${f.id}.${key}`).toBeTruthy()
  }
  expect(resolveFinish('club', { primary: '#c62828', edge: '#ffd700' }).trim).toBe('#ffd700')
  expect(finishForName('Kerbside Utd')).toBe(finishForName('Kerbside Utd'))
  expect(isFinish(finishForName('Anyone'))).toBe(true)
  const painted = withFinish(STADIUMS.capArena, resolveFinish('midnight'))
  expect(painted.top.c1).toBe(resolveFinish('midnight').c1)
  expect(painted.woodColor).toBe(resolveFinish('midnight').frame)
})

it('the admin console link is a real page, never the game shell', () => {
  expect(FILE_NAVIGATION.test('/hq-dzutgl2qil.html')).toBe(true)
})
