// The Archive: AI-only cap artwork. No changes to league rules or physics.
const cap=(key,name,primary,edge,skirtColor,origin)=>({key:'arc-'+key,pattern:'arc-'+key,name,primary,edge,skirtColor,origin,badge:'none',finish:'matte',capText:'',capNames:'none',cpu:true})
export const ARCHIVE_DESIGNS=[
 cap('adire','Indigo Bloom','#243956','#E8D9B3','#1D304E','Yoruba indigo resist-dye'),
 cap('akwete','Loomwork','#842C24','#F2D19A','#762720','Igbo woven textiles'),
 cap('uli','Ink Garden','#E4CEA6','#29261F','#A68B5B','Igbo expressive line art'),
 cap('gwari','Clay Gecko','#98502B','#E7BE84','#A25029','Gbagyi pottery'),
 cap('zaria','Earthen Arch','#734435','#DFBC8D','#684032','Hausa earthen architecture'),
 cap('dufuna','Riverwood','#3C5D72','#E8D2A6','#314D64','Ancient Dufuna canoe'),
 cap('nok-kiln','Kiln Eye','#A94F33','#EAB98B','#A04A2D','Nok terracotta'),
 cap('ikom','Stone Cipher','#383831','#D5C3A2','#393932','Cross River monoliths'),
 cap('lost-wax','Coilwork','#214839','#E7C06B','#294837','Igbo-Ukwu bronze'),
 cap('edo-brass','Coral Brass','#75512D','#E6C992','#80582F','Benin brass and coral'),
 cap('aguda','Veranda','#427B79','#EDD6AD','#396E70','Afro-Brazilian Lagos architecture'),
 cap('highlife','Side A','#832F3B','#EBC78D','#782C37','Vintage highlife records'),
 cap('danfo','Yellow Transit','#E8B019','#22251D','#C89116','Lagos bus signwriting'),
 cap('osogbo','Painted Grove','#25303B','#E9CE9E','#293440','Osogbo art workshops'),
 cap('festac','Golden Hour','#6B3046','#F4D197','#6D3446','1977 Festival of Arts and Culture')
]
const byPattern=new Map(ARCHIVE_DESIGNS.map(d=>[d.pattern,d]))
export const archiveDesign=p=>byPattern.get(p)
export const isArchivePattern=p=>byPattern.has(p)
const circle=(x,y,r)=>'M '+(x-r)+' '+y+' a '+r+' '+r+' 0 1 0 '+2*r+' 0 a '+r+' '+r+' 0 1 0 '+(-2*r)+' 0 Z'
const rect=(x,y,w,h)=>'M '+x+' '+y+' h '+w+' v '+h+' h '+(-w)+' Z'
const poly=p=>'M '+p.map(a=>a.join(' ')).join(' L ')+' Z'
const polar=(x,y,r,a)=>[x+r*Math.cos(a),y+r*Math.sin(a)]
export function archiveFace({pattern,number}){
 const d=archiveDesign(pattern);if(!d)return null
 const {primary:b,edge:e}=d,shapes=[],labels=[]
 const fill=(p,c=e,stroke,strokeWidth=.6)=>shapes.push({d:p,fill:c,...(stroke?{stroke,strokeWidth}:{})})
 const line=(p,c=e,strokeWidth=1.2)=>shapes.push({d:p,fill:'none',stroke:c,strokeWidth})
 const dot=(x,y,r,c=e)=>fill(circle(x,y,r),c)
 const ring=(x,y,r,w=1,c=e)=>line(circle(x,y,r),c,w)
 const coil=(x,y,r,sign=1)=>{
  const p='M '+Array.from({length:90},(_,i)=>polar(x,y,r*(1-i/96),sign*i*Math.PI*4/89).join(' ')).join(' L ')
  line(p,'#6B4B26',5.4);line(p,'@gold',3.7);line(p,'#F1D799',.7)
 }
 fill(circle(50,50,50),b)
 switch(pattern){
 case 'arc-adire':
  for(const [x,y] of [[18,9],[78,12],[53,55],[9,68],[91,72]])for(let r=6;r<=30;r+=7){const n=Math.max(7,Math.round(r*.75));for(let i=0;i<n;i++){const [a,c]=polar(x,y,r,i*Math.PI*2/n);dot(a,c,1.5)}}
  for(let i=0;i<7;i++){const [x,y]=polar(9,77,29,-Math.PI/2+i*.25);line('M 9 77 L '+x+' '+y,e,2.6)}
  break
 case 'arc-akwete':
  for(let x=0;x<100;x+=4)for(let y=0;y<81;y+=3){
   const a=Math.abs(x-50),v=Math.abs((y+8)%36-18)
   const c=x<12||x>88||x%20===0?'#DCA52D':a+v<14?'#D89923':a+v<25?e:a+v<34?'#24231E':y%12<6?'#B53C30':'#64251E'
   fill(rect(x,y,3.7,2.6),c)
  }
  for(const x of [13,18,82,87])line('M '+x+' 0 V 82','#E2B24B',1.3)
  break
 case 'arc-uli':
  for(const p of ['M 17 80 Q 43 42 48 0','M 21 73 Q 38 41 8 28','M 33 56 Q 53 19 83 8','M 39 48 Q 37 20 18 9','M 27 67 Q 60 41 93 51','M 46 79 Q 57 62 72 68','M 68 73 Q 80 37 103 26'])line(p,e,4)
  for(const p of ['M 38 42 Q 22 28 30 16 Q 46 23 38 42 Z','M 51 28 Q 60 8 72 9 Q 69 24 51 28 Z','M 43 61 Q 62 43 73 46 Q 64 63 43 61 Z','M 12 58 Q 4 42 9 36 Q 21 43 12 58 Z','M 80 65 Q 83 48 95 42 Q 98 56 80 65 Z'])fill(p)
  for(const [x,y] of [[20,21],[10,43],[66,21],[85,28],[55,53],[73,59],[94,69],[20,64]])dot(x,y,2.2)
  break
 case 'arc-gwari':
  for(let x=-10;x<110;x+=8){line('M '+x+' 8 l 24 24 M '+x+' 32 l 24 -24',e,.8);line('M '+x+' 66 l 18 18 M '+x+' 84 l 18 -18',e,.8)}
  line('M 0 31 H100 M0 66 H100',e,2)
  fill('M 9 49 Q 1 37 12 36 Q 21 36 19 42 Q 12 44 13 49 Q 20 58 35 51 Q 49 40 62 42 Q 70 39 78 32 Q 84 29 89 34 L 96 37 L 89 44 L 80 46 Q 71 61 56 60 Q 44 59 33 62 Q 15 62 9 49 Z',e,'#633720',1.1)
  for(const p of ['M 39 52 l -8 -14 l -9 -3 M31 38 l3 -8 M53 58 l -6 9 l -11 2 M66 49 l 7 -13 l 6 -3 M70 55 l 9 10 l9 -1'])line(p,e,2.7)
  line('M 17 52 Q 35 57 48 47 Q 63 42 80 40','#86502F',1.1);dot(86,37,1.25,'#512E20')
  break
 case 'arc-zaria':
  fill('M 9 79 V 43 H17 V 35 H24 V 22 H34 V 14 H40 Q 50 0 60 14 H66 V22 H76 V35 H83 V43 H91 V79 Z',e)
  fill('M 30 79 V57 Q30 43 50 32 Q70 43 70 57 V79 Z',b)
  fill('M 42 35 V23 Q50 12 58 23 V35 L50 28 Z',b)
  for(const x of [17,83]){fill('M '+(x-7)+' 79 V64 Q'+(x-7)+' 56 '+x+' 51 Q'+(x+7)+' 56 '+(x+7)+' 64 V79 Z',b);for(const [dx,dy] of [[0,0],[-3,0],[3,0],[0,-3],[0,3]])dot(x+dx,44+dy,2.4,b)}
  line('M 2 80 H98',e,2)
  break
 case 'arc-dufuna':
  fill('M 0 0 H100 V43 H0 Z','#87A5A8')
  fill('M0 43 Q10 31 20 40 Q32 31 40 41 Q55 29 62 38 Q72 30 80 38 Q92 32 100 39 V48 H0 Z','#284C4D')
  line('M0 55 H100 M0 70 Q12 66 24 70 T48 70 T72 70 T100 70 M0 77 Q12 73 24 77 T48 77 T72 77 T100 77',e,1.8)
  fill('M 5 49 Q50 61 95 49 Q80 66 50 67 Q20 67 5 49 Z','#B35D2A','#352B22',1.2);line('M10 51 Q50 57 90 51','#E6AA56',1.5)
  line('M 6 40 Q 11 15 24 6','#273C3C',3)
  for(const p of ['M24 6 Q12 -1 1 9 Q13 5 24 6','M24 6 Q12 8 4 25 Q19 15 24 6','M24 6 Q24 21 15 33 Q30 20 24 6','M24 6 Q43 4 49 15 Q36 9 24 6','M24 6 Q40 17 36 30 Q29 17 24 6'])fill(p,'#273C3C')
  break
 case 'arc-nok-kiln':
  fill('M7 63 Q4 27 32 13 Q55 0 88 19 L96 50 L84 77 H22 Z','@copper','#743925',1.2)
  for(let i=0;i<5;i++){line('M'+(9+i*6)+' 69 Q'+(5+i*7)+' 31 '+(29+i*6)+' 12','#743925',2.7);line('M'+(11+i*6)+' 69 Q'+(7+i*7)+' 31 '+(31+i*6)+' 12','#EBAC7B',.7)}
  fill('M30 46 Q55 15 88 42 Q58 72 30 46 Z','#C77649','#753C28',2);line('M34 45 Q59 23 83 42 Q58 63 34 45 Z','#E4A679',1.3)
  dot(59,44,9,'#AE5D37');ring(59,44,9,1.5,'#783C28')
  for(let x=31;x<86;x+=12)line('M'+x+' 66 l6 10 l6 -10','#6D3524',2)
  break
 case 'arc-ikom':
  for(let r=7;r<=34;r+=7)ring(50,44,r,2.2)
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){for(let i=0;i<3;i++){const p1=polar(50,44,34+i*5,a-.25),p2=polar(50,44,44+i*4,a),p3=polar(50,44,34+i*5,a+.25);line('M '+p1.join(' ')+' L '+p2.join(' ')+' L '+p3.join(' '),e,2.3)}}
  break
 case 'arc-lost-wax':
  coil(32,28,22);coil(28,63,13,-1);coil(76,58,18,-1)
  line('M4 50 Q30 72 50 46 Q75 17 96 28','#6B4B26',6);line('M4 50 Q30 72 50 46 Q75 17 96 28','@gold',4)
  for(let i=0;i<41;i++){const [x,y]=polar(50,50,45,i*Math.PI*2/41);fill(circle(x,y,1.6),'@gold','#8A632D',.4)}
  break
 case 'arc-edo-brass':
  fill(circle(50,50,43),'@bronze')
  for(const s of [-1,1]){
   const x=n=>50+s*n
   line('M '+x(5)+' 7 Q'+x(5)+' 34 '+x(38)+' 51 Q'+x(9)+' 59 '+x(7)+' 79','#593B23',5)
   line('M '+x(5)+' 7 Q'+x(5)+' 34 '+x(38)+' 51 Q'+x(9)+' 59 '+x(7)+' 79','@gold',2.8)
   coil(x(22),29,12,s);coil(x(22),67,10,-s)
  }
  for(let i=0;i<26;i++){const [x,y]=polar(50,50,45,i*Math.PI*2/26);fill(circle(x,y,3.9),'#BF5238','#753D2B',.8)}
  break
 case 'arc-aguda':
  for(const y of [14,20,49,65,76])fill(rect(4,y,92,2.8),e)
  for(let x=11;x<=79;x+=27){
   fill('M '+x+' 53 V32 a10 10 0 0 1 20 0 V53 Z',e)
   fill('M '+(x+3)+' 51 V34 a7 7 0 0 1 14 0 V51 Z','#246568')
   line('M '+(x+10)+' 27 V52 M '+(x+3)+' 36 H'+(x+17),'#E4CBA0',.85)
   for(let y=39;y<52;y+=3)line('M '+(x+4)+' '+y+' H'+(x+16),'#173E42',.8)
  }
  fill(rect(2,55,96,13),'#D1B58A')
  for(let x=6;x<96;x+=8){line('M '+x+' 55 V68 M '+x+' 61 q 4 -8 8 0 q -4 8 -8 0','#235053',1.05)}
  break
 case 'arc-highlife':
  for(let r=13;r<46;r+=5)ring(41,36,r,.65,'#E9C697')
  dot(41,36,13,'#E9C697');dot(41,36,2,'#832F3B')
  fill('M0 67 Q22 49 47 68 T100 61 V83 H0 Z','#D77C32')
  fill('M0 76 Q22 57 47 76 T100 71 V85 H0 Z','#EAB04E')
  line('M80 10 Q68 12 72 23 L82 58 Q89 76 69 78 Q56 75 63 65 L67 61','#EDAE54',5)
  line('M80 10 L89 14 M68 59 L62 58 M70 46 L78 44 M73 52 L81 50','#F0C377',2)
  break
 case 'arc-danfo':
  fill('M0 9 L65 0 L0 47 Z','#C34E28');fill('M0 15 L37 0 L0 29 Z','#F5D274')
  fill('M-5 66 L105 43 V51 L-5 74 Z','#23251F');fill('M-5 77 L105 54 V58 L-5 81 Z','#23251F')
  fill('M17 30 Q20 23 30 23 H72 Q82 23 84 35 V51 H16 Z','#23251F')
  for(let x=23;x<=71;x+=12)fill(rect(x,29,9,12),'#F0CC70')
  dot(28,52,5,'#23251F');dot(72,52,5,'#23251F')
  break
 case 'arc-osogbo':
  dot(22,26,20,'#2357A2');dot(77,24,16,'#D9782E')
  fill('M0 67 L34 50 L53 68 L73 54 L100 66 V84 H0 Z','#C36531');fill('M48 83 Q51 52 86 67 L100 83 Z','#2D61AB')
  for(const p of ['M15 82 Q39 40 30 0','M32 79 Q51 44 63 1','M51 80 Q65 42 96 5','M24 63 Q9 42 4 35','M58 63 Q81 41 99 35'])line(p,'#E9D2A7',3.3)
  for(const p of ['M27 48 Q8 35 13 18 Q27 27 27 48 Z','M37 48 Q38 19 53 10 Q54 33 37 48 Z','M60 39 Q60 15 76 5 Q75 25 60 39 Z','M71 58 Q78 32 99 30 Q91 46 71 58 Z'])fill(p,'#E9D2A7')
  break
 case 'arc-festac':
  dot(69,28,23,'#E8A82E');fill(rect(45,36,55,9),'#6B3046')
  for(let i=0;i<5;i++){const a=-2.8+i*.42;fill(poly([[33,45],polar(33,45,70,a),polar(33,45,70,a+.23)]),i%2?'#E6A32D':'#CB552F')}
  for(const [x,c] of [[15,'#356449'],[88,'#D05C34']]){line('M '+(x-40)+' 81 A40 40 0 0 1 '+(x+40)+' 81',c,13);line('M '+(x-22)+' 81 A22 22 0 0 1 '+(x+22)+' 81','#E8AC38',7)}
  break
 }
 // Consistent, restrained worn ink. All paths remain inside the render clip.
 let seed=pattern.split('').reduce((s,c)=>Math.imul(s^c.charCodeAt(0),16777619),2166136261)>>>0
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 let wear='';for(let i=0;i<320;i++){const [x,y]=polar(50,50,Math.sqrt(rand())*47,rand()*Math.PI*2);wear+='M '+x.toFixed(2)+' '+y.toFixed(2)+' l '+(.2+rand()*.7).toFixed(2)+' .1 '}
 line(wear,'rgba(241,222,179,0.23)',.27);ring(50,50,48,.7,'rgba(229,197,147,0.65)')
 // Squad identifiers are optional, small, and never overlap the artwork title.
 if(number!=null){const text=String(number).slice(0,3);fill(circle(50,11,8),b,e,.65);labels.push({text,x:50,y:11,size:7.8,width:Math.min(11,text.length*5),role:'number',style:'normal',fill:e,stroke:b,strokeWidth:.25})}
 return {shapes,labels}
}
