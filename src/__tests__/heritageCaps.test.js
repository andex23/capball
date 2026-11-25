import { describe, expect, it } from 'vitest'
import { HERITAGE_DESIGNS, heritageFace, isHeritagePattern, FACE_GRADIENTS } from '../data/HeritageCaps.js'
import { CAP_TEXT_MAX } from '../data/TeamOptions.js'
import { hasArt, artHasNumber } from '../game/capArt.js'

describe('Counterball collectible cap collection', () => {
  it('includes every reference design, distinct art and bounded printed names', () => {
    expect(HERITAGE_DESIGNS.map(d=>d.key)).toEqual(['nok-ember','edo-regalia','ukwu-gold','ife-dynasty','alaafin','kingmaker','acid-racing','lagos-90','liquid-chrome','midnight-club','purple-hibiscus','confluence-town'])
    const artwork = HERITAGE_DESIGNS.map(d => {
      expect(d.capText.length).toBeLessThanOrEqual(CAP_TEXT_MAX)
      expect(d.pattern.length).toBeLessThanOrEqual(16)
      expect(isHeritagePattern(d.pattern)).toBe(true)
      const f=heritageFace({...d,number:99})
      expect(f.shapes.length).toBeGreaterThan(5)
      expect(f.shapes.every(p=>p.d.startsWith('M')&&!/NaN|Infinity/.test(p.d))).toBe(true)
      for(const p of f.shapes)for(const paint of [p.fill,p.stroke])if(paint?.startsWith('@'))expect(FACE_GRADIENTS[paint.slice(1)]).toBeTruthy()
      expect(f.labels.find(l=>l.role==='number').text).toBe('99')
      if(d.series==='art')expect(f.labels.map(l=>l.role)).toEqual(['number'])
      else {
        expect(f.labels.find(l=>l.role==='name').text).toBe(d.name.toUpperCase())
        expect(f.labels.find(l=>l.role==='name').width).toBeLessThanOrEqual(60)
      }
      return JSON.stringify(f.shapes)
    })
    expect(new Set(artwork).size).toBe(12)
    expect(heritageFace({pattern:'ring'})).toBeNull()
    expect(heritageFace({pattern:'__proto__'})).toBeNull()
  })
  it('keeps all names on the cap even when the custom label is blank or changed',()=>{
    for(const d of HERITAGE_DESIGNS){
      for(const capText of ['', 'PLAYER NAME']){
        const face=heritageFace({...d,number:8,capText})
        if(d.series==='art'){
          expect(face.labels).toHaveLength(1)
          expect(face.labels[0].text).toBe('8')
        }else{
          expect(face.labels.find(l=>l.role==='number').text).toBe('08')
          expect(face.labels.find(l=>l.role==='name').text).toBe(d.name.toUpperCase())
          if(capText)expect(face.labels.find(l=>l.role==='custom').width).toBeLessThanOrEqual(43)
        }
      }
    }
  })
  it('reserves separate text zones for Kingmaker and Midnight Club',()=>{
    for(const pattern of ['kingmaker','midnight-club']){
      for(let number=0;number<100;number++){
        for(const capText of ['', 'PLAYER NAME']){
          const face=heritageFace({pattern,number,capText})
          const labels=face.labels.filter(l=>['number','motto','name'].includes(l.role))
          for(let i=0;i<labels.length;i++){
            const a=labels[i]
            if(a.role==='name')expect(Math.hypot(a.width/2,Math.abs(a.y-50)+a.size/2)).toBeLessThan(49)
            for(let j=i+1;j<labels.length;j++){
              const b=labels[j]
              const overlapsX=Math.abs(a.x-b.x)<(a.width+b.width)/2
              const overlapsY=Math.abs(a.y-b.y)<(a.size+b.size)/2
              expect(overlapsX&&overlapsY).toBe(false)
            }
          }
        }
      }
    }
  })
  it('draws as printed art with its own number, no sticker',()=>{
    for(const d of HERITAGE_DESIGNS){
      expect(hasArt(d.key)).toBe(true)
      expect(artHasNumber(d.key)).toBe(true)
    }
    expect(artHasNumber('cola')).toBe(false)
  })
})
