import { archiveFace, archiveDesign, isArchivePattern } from './ArchiveCaps.js'
import { ART_CAPS, artDesign, artFace } from './ArtCaps.js'
/**
 * Counterball collectible prints. Original vector art, drawn in the existing
 * cap preview and 512px match texture; no baked mockups or fixed player numbers.
 * "Heritage" identifiers are retained for compatibility with the first draft.
 */
const cap = (key,name,primary,edge,skirtColor,finish,capText,sample,origin,series='heritage') =>
  ({ key,name,primary,edge,skirtColor,finish,capText,sample,origin,series,pattern:key,badge:'none' })

export const HERITAGE_DESIGNS = [
  cap('nok-ember','Nok Ember','#9E4328','#F1D1A0','#A94C2C','satin','NOK EMBER',7,'Nok terracotta'),
  cap('edo-regalia','Edo Regalia','#221B17','#DDB55B','#8C602B','satin','EDO REGALIA',10,'Benin court brasswork'),
  cap('ukwu-gold','Ukwu Gold','#143F32','#EAC35D','#B17C25','satin','UKWU GOLD',9,'Igbo-Ukwu metalwork'),
  cap('ife-dynasty','Ife Dynasty','#15555D','#DFC797','#A78A58','satin','IFE DYNASTY',11,'Ile-Ife portraiture'),
  cap('alaafin','Aláàfin','#852E25','#EAC473','#A77B30','satin','ALÁÀFIN',10,'Oyo royal beaded crown'),
  cap('kingmaker','Kingmaker','#171717','#EBC25C','#C2963B','satin','KINGMAKER',1,'Championship crown and laurel'),
  cap('acid-racing','Acid Racing','#121414','#C8F900','#161818','satin','ACID RACING',7,'Neon racing graphics','street'),
  cap('lagos-90',"Lagos '90",'#F0E1BC','#16522C','#164A2A','matte',"LAGOS '90",10,'Retro Nigerian football kits','street'),
  cap('liquid-chrome','Liquid Chrome','#D4D6D9','#17181D','#B9BCC2','satin','LIQUID',9,'Iridescent liquid metal','street'),
  cap('midnight-club','Midnight Club','#101A35','#DCE5EF','#101C3D','satin','MIDNIGHT CLUB'.slice(0,12),11,'Electric-blue racing checks','street'),
  ...ART_CAPS,
]
const byPattern = new Map(HERITAGE_DESIGNS.map(d=>[d.pattern,d]))
export const heritageDesign = pattern=>byPattern.get(pattern)||archiveDesign(pattern)
export const isHeritagePattern = pattern=>byPattern.has(pattern)||isArchivePattern(pattern)

// Localized metal and ink gradients are printed artwork, not a reflection
// overlay. They share coordinates in the SVG and Canvas implementations.
export const FACE_GRADIENTS = {
  copper: [17,12,48,79,[[0,'#F4B37D'],[0.36,'#D88B53'],[0.68,'#B96135'],[1,'#E5A36D']]],
  bronze: [18,12,49,76,[[0,'#F0D49A'],[0.27,'#D5AA56'],[0.57,'#99703A'],[0.80,'#D8AE67'],[1,'#8C5F30']]],
  gold: [10,15,86,85,[[0,'#B07B2C'],[0.25,'#F0D58C'],[0.51,'#CC9C40'],[0.74,'#EAC66D'],[1,'#916124']]],
  ivory: [15,0,82,100,[[0,'#F6E6BD'],[0.48,'#E8D4AA'],[1,'#F0E0BB']]],
  silver: [8,8,92,94,[[0,'#B0B4BC'],[0.24,'#E1E3E6'],[0.48,'#B5BAC4'],[0.72,'#DDE0E5'],[1,'#9A9EAA']]],
  holo: [2,5,92,96,[[0,'#080D86'],[0.16,'#245DFB'],[0.29,'#01C1F8'],[0.38,'#4832D2'],[0.54,'#E844CE'],[0.65,'#24129D'],[0.83,'#1451FB'],[1,'#08A9DD']]],
  holoEdge: [0,0,100,90,[[0,'#2622A6'],[0.28,'#B1E3FF'],[0.46,'#9A53DD'],[0.67,'#F5A0EA'],[0.85,'#13247D'],[1,'#70D5F7']]],
}
const circle=(x,y,r)=>'M '+(x-r)+' '+y+' a '+r+' '+r+' 0 1 0 '+(2*r)+' 0 a '+r+' '+r+' 0 1 0 '+(-2*r)+' 0 Z'
const polar=(r,a)=>[50+r*Math.cos(a),50+r*Math.sin(a)]
const line=(a,b)=>'M '+a.join(' ')+' L '+b.join(' ')
const poly=pts=>'M '+pts.map(p=>p.join(' ')).join(' L ')+' Z'
export const HERITAGE_FONT='"Barlow Condensed", "Arial Narrow", Impact, sans-serif'

export function heritageFace({pattern,primary,edge,textColor,number,capText}) {
  if(isArchivePattern(pattern))return archiveFace({pattern,number})
  if(artDesign(pattern))return artFace({pattern,number})
  const design=heritageDesign(pattern)
  if(!design)return null
  const base=primary||design.primary, accent=edge||design.edge, dark='#261B16'
  const ink=textColor||accent
  const shapes=[],labels=[]
  const fill=(d,color=accent,outline,strokeWidth=.65)=>shapes.push({d,fill:color,...(outline?{stroke:outline,strokeWidth}:{})})
  const stroke=(d,color=accent,strokeWidth=1.2)=>shapes.push({d,fill:'none',stroke:color,strokeWidth})
  const dot=(x,y,r,color=accent,outline)=>fill(circle(x,y,r),color,outline)
  const ring=(r,width=1,color=accent)=>stroke(circle(50,50,r),color,width)
  const beads=(count,r,size,color=accent,outline)=>{
    for(let i=0;i<count;i++){const [x,y]=polar(r,i*2*Math.PI/count);dot(x,y,size,color,outline)}
  }
  const relief=(d,material='@bronze')=>fill(d,material,'#69472B',.7)
  const n=String(number??design.sample).slice(0,3)
  const numeral=/^\d$/.test(n)?'0'+n:n
  let nx=72,ny=49,ns=30,nw=35,italic=false,numberInk=ink
  let labelInk=ink,labelBase=base
  const addText=(text,x,y,size,maxWidth,color,role,style='normal')=>{
    // Explicit width is shared by both renderers; no overflow on long names.
    const width=Math.min(maxWidth,size*(style==='italic'?.67:.62)*text.length)
    labels.push({text,x,y,size,width,fill:color,role,style,stroke:role==='number'?'#161616':labelBase,strokeWidth:role==='number'?.9:.25})
  }
  fill(circle(50,50,50),pattern==='liquid-chrome'&&base===design.primary?'@silver':base)

  switch(pattern){
    case 'nok-ember': {
      fill('M 8 51 Q 7 29 22 18 Q 31 9 43 16 L 45 23 L 40 31 L 43 39 L 49 48 Q 50 51 42 53 L 41 58 Q 49 60 46 64 L 39 66 L 40 74 L 33 80 Q 10 72 8 51 Z','@copper','#6E3525',.8)
      fill('M 13 35 Q 27 19 40 32 Q 29 45 13 35 Z','#693522')
      stroke('M 14 35 Q 26 25 38 32 Q 27 41 14 35 M 16 29 Q 27 20 39 27','#F2BF88',1.5)
      fill('M 22 32 Q 27 28 32 33 Q 28 38 22 32 Z',dark)
      stroke('M 12 47 Q 20 44 30 47 M 12 52 H 31 M 15 57 H 30','#6E3525',2.8)
      stroke('M 12 46 H 30 M 15 56 H 28','#F1A974',.65)
      dot(36,48,2.1,dark);stroke('M 35 60 Q 42 59 45 62 M 32 67 Q 36 70 40 68',dark,.9)
      fill('M 48 13 L 56 22 L 63 15 L 73 27 L 81 22 L 87 30 H 48 Z','#C15A30',dark,1)
      stroke('M 50 26 L 57 18 L 64 25 L 73 18 L 83 28',dark,1.9)
      fill('M 47 66 H 86 L 79 76 L 69 69 L 60 79 Z','#C15A30',dark,1)
      stroke('M 51 70 L 60 77 L 69 69 L 79 75',dark,1.6)
      ring(47,1.25,'#E6AC6F');beads(28,44,1.45,'#F0CE9A','#9E4D2B')
      break
    }
    case 'edo-regalia': {
      ring(47,1.6,'@gold')
      for(let i=0;i<32;i++){const a=i*2*Math.PI/32;stroke(line(polar(41,a),polar(45,a)),i%8<2?'#CF5138':accent,2.8)}
      relief('M 17 32 L 17 23 L 21 22 L 23 17 L 29 19 L 31 12 L 35 12 L 37 19 L 43 17 L 45 23 L 49 24 L 49 33 Z')
      for(let i=0;i<6;i++){stroke('M '+(20+i*4)+' 24 l 5 7 M '+(22+i*4)+' 31 l 4 -7','#795426',.8)}
      relief('M 19 34 Q 32 29 47 34 L 47 54 Q 44 68 34 72 Q 23 69 19 55 Z')
      fill('M 22 37 Q 32 34 45 37 L 42 41 Q 33 37 24 41 Z','#795426')
      stroke('M 22 43 Q 27 39 31 44 Q 27 47 23 44 M 36 44 Q 41 39 45 43 Q 41 47 36 44',dark,1.3)
      dot(27,43,1.1,dark);dot(41,43,1.1,dark)
      stroke('M 33 43 L 30 53 Q 33 55 37 53 M 28 59 Q 33 56 38 59 Q 33 62 28 59 M 28 65 Q 34 68 40 64','#69472B',1.2)
      for(const x of [17,49]){stroke('M '+x+' 34 V 62','#D6AD62',3);for(let y=36;y<64;y+=4)dot(x,y,1.6,'#EDBA65','#634322')}
      for(let i=0;i<3;i++)stroke('M 18 '+(65+i*3)+' Q 33 '+(76+i*3)+' 49 '+(65+i*3),'@gold',2.2)
      for(let i=0;i<9;i++)dot(19+i*3.8,75+Math.sin(i*Math.PI/8)*3,1.6,'#CB5339','#7C3026')
      break
    }
    case 'ukwu-gold': {
      ring(47,1.9,'@gold');ring(43,2,'@gold')
      beads(64,44,.8,'#EDD091','#846024')
      const coil=(x,y,r,sign)=>{
        let p=''
        for(let i=0;i<=96;i++){const a=sign*i*Math.PI*4.8/96,q=r*(1-i/103);p+=(i?' L ':'M ')+(x+Math.cos(a)*q)+' '+(y+Math.sin(a)*q)}
        stroke(p,'#694A21',4.4);stroke(p,'@gold',3.2);stroke(p,'#F1D58A',.65)
      }
      coil(31,28,15,1);coil(31,69,14,-1)
      for(const p of ['M 7 30 Q 22 46 49 49 Q 23 52 7 69','M 36 8 Q 52 27 49 42','M 35 90 Q 52 71 49 57','M 52 10 Q 62 23 79 20','M 53 79 Q 70 73 83 79']){
        stroke(p,'#6E4B1C',5);stroke(p,'@gold',3.7);stroke(p,'#EBD08B',.7)
      }
      for(const [x,y,r] of [[13,34,2.8],[14,63,2.8],[30,49,3.5],[42,49,2.6],[49,49,2.5],[51,19,2.6],[53,75,2.6]])dot(x,y,r,'@gold','#765221')
      break
    }
    case 'ife-dynasty': {
      ring(47,1.5,'@bronze');ring(43,1.8,accent);ring(39,.6,accent)
      fill('M 51 29 Q 79 25 93 47 L 93 66 Q 73 76 50 65 Z','#E4D1A5')
      stroke('M 11 34 H 19 M 9 65 H 20 M 51 9 V 26 M 56 10 V 26 M 61 12 V 26 M 50 73 V 88 M 56 74 V 89 M 62 74 V 87','@bronze',2.4)
      relief('M 19 35 Q 16 24 24 17 Q 34 12 44 19 Q 51 25 50 36 L 49 54 Q 46 68 34 78 Q 23 72 19 55 Z')
      relief('M 20 22 Q 34 11 48 23 L 50 32 Q 35 28 18 32 Z')
      dot(34,14,4,'@bronze','#725333')
      for(let i=0;i<10;i++){const x=20+i*3;stroke('M '+x+' 25 Q '+(x-1)+' 19 '+(x+2)+' 17','#755735',.6)}
      for(let i=0;i<9;i++){const x=22+i*3;stroke('M '+x+' 33 Q '+(x-1)+' 50 '+(34+(x-34)*.62)+' 67','#795F3C',.6)}
      fill('M 21 42 Q 27 36 32 42 Q 27 47 22 44 Z','#AC8951','#6F5030',.8)
      fill('M 37 42 Q 42 36 47 42 Q 42 47 37 44 Z','#AC8951','#6F5030',.8)
      stroke('M 33 42 Q 34 48 31 54 Q 34 57 37 54 M 28 61 Q 34 57 40 61 Q 34 65 28 61','#64482B',1.3)
      stroke('M 25 68 Q 34 74 43 68','#AA8750',.9)
      numberInk=textColor||base;labelInk=accent;break
    }
    case 'alaafin': {
      // The beaded crown (ade) of Oyo: a tall cone of bead rows, the royal
      // bird on top and a veil of bead strands, on a field of coral beadwork.
      const coral='#CF5138', ivory='#F3E3BE'
      ring(47,1.8,'@gold');beads(36,43.5,1.1,coral,'#6E2A1F')
      // faint diamond beadwork behind the crown
      for(let r=0;r<4;r++)for(let c=0;c<3;c++){const x=10+c*9+(r%2)*4.5,y=26+r*12;stroke(poly([[x,y-4],[x+4,y],[x,y+4],[x-4,y]]),'rgba(234,196,115,0.28)',.7)}
      // crown cone
      const cone='M 27 60 Q 29.5 40 31.5 29 Q 37 13 42.5 29 Q 44.5 40 47 60 Z'
      fill(cone,'@gold','#7A4E1C',.9)
      // bead rows across the cone, alternating coral and ivory
      for(let i=0;i<7;i++){
        const y=32.5+i*3.9, half=4.4+i*0.75
        for(let k=-3;k<=3;k++){const x=37+k*(half/3.1);if(Math.abs(x-37)<=half)dot(x,y,1.05,(i+k)%2?coral:ivory,'#6E3A18')}
      }
      // zigzag beadwork band near the top
      stroke('M 33.5 27.5 L 35.2 24.8 L 37 27.5 L 38.8 24.8 L 40.5 27.5','#7A4E1C',.9)
      // the royal bird
      fill('M 30 19 L 33 16 Q 36 10.5 41 12.5 L 46 11 L 43.5 14.5 Q 43 18.5 38 20.5 Q 35 21.5 33 20 Z','@gold','#7A4E1C',.7)
      dot(40.6,13.6,.7,'#3A2210')
      stroke('M 37 20.5 V 22.5','#7A4E1C',1.2)
      // brim
      fill('M 25 59 H 49 Q 50 63 47.5 64 H 26.5 Q 24 63 25 59 Z','@gold','#7A4E1C',.8)
      for(let x=27.5;x<=46.5;x+=3.15)dot(x,61.5,.95,coral,'#6E2A1F')
      // veil: bead strands over the face
      for(let x=28;x<=46;x+=2.25){
        const len=10+((x*7)%5)
        stroke('M '+x+' 64 V '+(64+len),'rgba(243,227,190,0.55)',.35)
        for(let y=66;y<64+len;y+=2.6)dot(x,y,.75,((x+y)|0)%3?ivory:coral)
      }
      break
    }
    case 'kingmaker': {
      ring(47,1.7,'@gold')
      fill('M 26 22 L 35 31 L 43 25 L 50 12 L 57 25 L 65 31 L 74 22 L 68 40 H 32 Z','@gold','#A47A30',.8)
      fill('M 32 43 H 68 L 66 47 H 34 Z','@gold')
      for(const [x,y] of [[26,21],[50,12],[74,21]])dot(x,y,2.3,'@gold')
      for(const side of [-1,1]){
        const q=x=>50+side*x
        stroke('M '+q(23)+' 80 Q '+q(43)+' 61 '+q(37)+' 28','@gold',1.8)
        for(let i=0;i<6;i++){
          const x=25+i*2.2,y=77-i*8.4
          fill('M '+q(x)+' '+y+' Q '+q(x+9)+' '+(y-3)+' '+q(x+6)+' '+(y-11)+' Q '+q(x+1)+' '+(y-9)+' '+q(x)+' '+y+' Z','@gold','#A77B31',.35)
          if(i>0 && i<5)fill('M '+q(x+2)+' '+(y-1)+' Q '+q(x-4)+' '+(y-8)+' '+q(x-2)+' '+(y-12)+' Q '+q(x+5)+' '+(y-8)+' '+q(x+2)+' '+(y-1)+' Z','@gold')
        }
      }
      // Keep the number between the crown and the separate championship line.
      nx=50;ny=57.5;ns=18.5;nw=27
      addText('CHAMPION',50,72,7.5,38,ink,'motto','italic')
      break
    }
    case 'acid-racing': {
      ring(47,1.2,accent)
      // Oblique motorsport chequers, cropped inside the disc.
      for(let row=0;row<5;row++)for(let col=0;col<3;col++){
        if((row+col)%2!==0)continue
        const x=4+col*12-row*3,y=8+row*13
        fill(poly([[x+10,y],[x+25,y],[x+14,y+13],[x-1,y+13]]),accent)
      }
      fill('M 12 77 L 32 69 H 88 L 80 77 L 70 77 L 61 87 H 48 L 57 77 H 41 L 31 87 Z',accent)
      stroke('M 43 34 L 84 34',accent,.8)
      nx=68;ny=50;ns=36;nw=41;italic=true;break
    }
    case 'lagos-90': {
      const orange='#D25B20'
      ring(47,1.3,accent)
      for(let i=0;i<4;i++){const x=19+i*7,y=15+i*7;fill(poly([[x,y],[x+14,y+14],[x-7,y+14]]),accent)}
      fill('M 7 33 L 25 46 L 8 46 Z',orange)
      fill('M 8 49 H 26 L 9 60 Z',accent)
      fill('M 27 47 H 40 L 21 64 L 42 84 H 26 L 11 65 Z',orange)
      for(let i=0;i<4;i++){const x=34+i*10;fill(poly([[x,64],[x+10,64],[x+10,76]]),i%2?orange:accent)}
      fill('M 36 76 H 76 L 65 85 H 48 Z',orange)
      nx=69;ny=47;ns=39;nw=40;break
    }
    case 'liquid-chrome': {
      ring(47,1.5,'#8E939D');ring(45,.6,'#E0E3E9')
      // Each ribbon follows a different spline. Iridescence stays within the
      // graphic rather than adding glare to the rest of the print.
      const ribbons=[
        'M -3 20 C 12 15 22 6 42 0 C 58 -4 58 9 44 18 C 31 27 10 29 7 43 C 4 53 23 52 27 60 C 31 69 15 77 0 73 Z',
        'M -3 62 C 15 76 28 44 46 57 C 62 69 76 78 103 60 L 103 78 C 80 99 62 71 47 72 C 26 72 27 94 4 92 Z',
        'M 52 100 C 50 85 66 84 81 86 C 90 87 97 82 105 74 L 105 100 Z'
      ]
      for(const p of ribbons)fill(p,'@holo','@holoEdge',2.1)
      stroke('M 4 24 C 16 21 35 10 47 5 M 6 70 C 24 78 30 52 46 62 C 67 78 85 79 99 66 M 58 97 C 62 88 79 90 91 88','@holoEdge',1.2)
      nx=69;ny=46;ns=35;nw=40;italic=true;numberInk=textColor||'#17181D';labelInk=numberInk;labelBase='#D4D6D9';break
    }
    case 'midnight-club': {
      const blue='#146BEE'
      ring(47,1.4,'#BCCCE0')
      for(let row=0;row<5;row++)for(let col=0;col<5;col++){
        if((row+col)%2!==0)continue
        const x=col*12-row*4,y=8+row*10
        if((row>=2 && x+19>53) || (row===4 && col>=4))continue
        fill(poly([[x+7,y],[x+19,y],[x+15,y+10],[x+3,y+10]]),blue)
      }
      // Leave a dedicated clear band beneath the racing graphics for the name.
      for(let col=0;col<4;col++){const x=46+col*12;fill(poly([[x+5,66],[x+17,63],[x+13,73],[x+1,76]]),blue)}
      fill('M 45 48 Q 46 58 58 60 Q 46 62 44 72 Q 42 62 30 60 Q 42 58 45 48 Z',blue)
      nx=73;ny=46;ns=33;nw=36;italic=true;break
    }
  }

  // Restrained deterministic ink wear, not a specular spot or random noise.
  let seed=pattern.split('').reduce((s,c)=>Math.imul(s^c.charCodeAt(0),16777619),2166136261)>>>0
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  let grain=''
  for(let i=0;i<180;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*45,[x,y]=polar(r,a);grain+='M '+x.toFixed(2)+' '+y.toFixed(2)+' l '+(.15+random()*.55).toFixed(2)+' .12 '}
  stroke(grain,'rgba(250,239,214,0.12)',.23)
  ring(49,.7,pattern==='acid-racing'?accent:'rgba(214,190,146,0.62)')

  addText(numeral,nx,ny,ns,nw,numberInk,'number',italic?'italic':'normal')
  // Every design permanently displays its complete name, independent of
  // the editable squad/team label and the legacy 12-character text field.
  const brand=design.name.toUpperCase()
  if(pattern==='kingmaker'){
    fill('M 26 80 H 74 L 69 92 H 31 Z',labelBase)
    addText(brand,50,86,7.2,44,labelInk,'name')
  }else if(pattern==='midnight-club'){
    fill('M 18 78 H 82 L 72 90 H 28 Z',labelBase)
    ring(47,1.4,'#BCCCE0')
    addText(brand,50,85,7.5,52,labelInk,'name')
  }else{
    fill('M 23 80 Q 50 84 77 80 L 71 91 Q 50 95 29 91 Z',labelBase)
    addText(brand,50,87,7.5,60,labelInk,'name')
  }
  const custom=String(capText??'').trim().toUpperCase().slice(0,12)
  if(custom && custom!==design.capText && custom!==brand){
    fill('M 29 5 Q 50 0 71 5 L 75 12 Q 50 9 25 12 Z',labelBase)
    addText(custom,50,7.5,5.2,43,labelInk,'custom')
  }
  return {shapes,labels}
}

function canvasPaint(ctx,paint){
  if(!paint?.startsWith('@'))return paint
  const [x1,y1,x2,y2,stops]=FACE_GRADIENTS[paint.slice(1)]
  const grad=ctx.createLinearGradient(x1,y1,x2,y2)
  for(const [offset,color] of stops)grad.addColorStop(offset,color)
  return grad
}

export function drawHeritageFace(ctx,size,face){
  ctx.save()
  ctx.scale(size/100,size/100)
  ctx.clip(new Path2D(circle(50,50,50)))
  ctx.lineJoin='round';ctx.lineCap='round'
  for(const item of face.shapes){
    const p=new Path2D(item.d)
    if(item.fill&&item.fill!=='none'){ctx.fillStyle=canvasPaint(ctx,item.fill);ctx.fill(p)}
    if(item.stroke){ctx.strokeStyle=canvasPaint(ctx,item.stroke);ctx.lineWidth=item.strokeWidth;ctx.stroke(p)}
  }
  ctx.textAlign='center';ctx.textBaseline='middle'
  for(const item of face.labels){
    ctx.save()
    ctx.font=item.style+' 900 '+item.size+'px '+(item.fontFamily||HERITAGE_FONT)
    const width=ctx.measureText(item.text).width
    ctx.translate(item.x,item.y)
    ctx.scale(item.width/Math.max(width,1),1)
    ctx.strokeStyle=item.stroke;ctx.lineWidth=item.strokeWidth;ctx.strokeText(item.text,0,0)
    ctx.fillStyle=item.fill;ctx.fillText(item.text,0,0)
    ctx.restore()
  }
  ctx.restore()
}
