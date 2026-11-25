// Standalone, wordless cap designs: original illustrations, not book-cover reproductions.
export const ART_CAPS=[
 {key:'purple-hibiscus',pattern:'purple-hibiscus',name:'Purple Hibiscus',primary:'#391D35',edge:'#E8C38B',skirtColor:'#542D4F',finish:'matte',badge:'none',capText:'',sample:null,origin:'Literary-inspired floral illustration',series:'art'},
 {key:'confluence-town',pattern:'confluence-town',name:'Confluence Town',primary:'#244C4B',edge:'#EBCB90',skirtColor:'#264744',finish:'matte',badge:'none',capText:'',sample:null,origin:'Two rivers meeting',series:'art'}
]
export const artDesign=pattern=>ART_CAPS.find(d=>d.pattern===pattern)
const circle=(x,y,r)=>'M '+(x-r)+' '+y+' a '+r+' '+r+' 0 1 0 '+2*r+' 0 a '+r+' '+r+' 0 1 0 '+(-2*r)+' 0 Z'
const polar=(r,a)=>[50+r*Math.cos(a),50+r*Math.sin(a)]
export function artFace({pattern,number}){
 const design=artDesign(pattern);if(!design)return null
 const {primary:b,edge:e}=design,shapes=[],labels=[]
 const fill=(d,c,stroke,strokeWidth=.6)=>shapes.push({d,fill:c,...(stroke?{stroke,strokeWidth}:{})})
 const line=(d,stroke=e,strokeWidth=1)=>shapes.push({d,fill:'none',stroke,strokeWidth})
 const dot=(x,y,r,c)=>fill(circle(x,y,r),c)
 fill(circle(50,50,50),b)
 if(pattern==='purple-hibiscus'){
  // Layered botanical woodcut: open petals, stems, leaves and a gold stamen.
  fill('M 0 62 Q 23 42 51 61 Q 77 45 100 23 V100 H0 Z','#C5A176')
  fill('M 5 87 Q 9 60 36 61 Q 31 81 5 87 Z','#283B30')
  fill('M 10 100 Q 15 76 47 69 Q 47 91 10 100 Z','#2B4032')
  fill('M 46 97 Q 57 75 85 67 Q 82 91 46 97 Z','#243B30')
  fill('M 98 98 Q 95 70 73 62 Q 91 59 98 74 Z','#314638')
  fill('M 0 43 Q 15 27 33 37 Q 18 49 0 43 Z','#283C32')
  fill('M 66 18 Q 81 4 93 14 Q 88 30 69 31 Z','#2B4032')
  fill('M 49 80 Q 30 92 30 109 L35 109 Q 37 88 53 70 Z','#412839')
  for(const p of ['M 7 85 Q 19 72 36 61','M 14 97 Q 31 81 47 69','M 52 94 Q 65 76 85 67','M 95 93 Q 89 77 73 62','M 2 43 Q 17 36 33 37','M 69 30 Q 80 20 93 14'])line(p,'#C1A474',.7)
  // Five individually drawn petals radiate from the dark throat.
  fill('M 48 54 C 36 40 20 34 18 20 Q 15 10 29 10 Q 39 4 46 10 Q 61 4 66 17 C 72 32 58 44 48 54 Z','#AD658B','#D09BB0',.7)
  fill('M 48 54 C 62 41 59 25 72 20 Q 82 14 88 22 Q 99 26 96 36 Q 100 49 86 54 C 74 59 59 48 48 54 Z','#A35484','#CC92AF',.7)
  fill('M 48 54 C 63 49 84 51 86 67 Q 89 77 76 80 Q 67 91 55 83 C 43 76 53 62 48 54 Z','#954470','#C184A2',.7)
  fill('M 48 54 C 43 67 40 88 24 84 Q 11 86 10 74 Q 3 67 10 59 C 20 46 37 50 48 54 Z','#BA7297','#D69DB4',.7)
  fill('M 48 54 C 34 51 14 55 7 42 Q 0 32 11 25 Q 21 18 30 28 C 40 34 41 44 48 54 Z','#9E4D7A','#C98CAB',.7)
  // Woodcut hatching and shaded petal bases, not specular glare.
  for(const p of ['M48 54 Q42 25 32 13','M48 54 Q52 27 56 12','M48 54 Q70 36 85 29','M48 54 Q72 45 94 38','M48 54 Q68 64 75 77','M48 54 Q55 74 60 83','M48 54 Q29 65 18 78','M48 54 Q24 55 11 64','M48 54 Q31 38 12 33','M48 54 Q24 44 8 42'])line(p,'#75385D',1)
  for(const p of ['M48 54 Q42 38 34 33','M48 54 Q53 42 62 35','M48 54 Q63 49 73 51','M48 54 Q59 65 62 72','M48 54 Q41 65 35 71','M48 54 Q35 49 25 48'])line(p,'#451F3C',2.2)
  dot(48,54,4,'#451F3C')
  line('M48 54 Q55 39 68 16','#EAC17D',2.4)
  for(const [x,y] of [[66,12],[71,10],[75,14],[64,18],[70,18],[68,23],[61,24],[65,28]]){line('M'+x+' '+y+' L'+(x-2)+' '+(y+5),'#EAC17D',.7);dot(x,y,1.65,'#EAC17D')}
 }else{
  // An imagined landscape, not a claim to map the actual river geography.
  fill('M0 0 H100 V43 H0 Z','#284C4D')
  for(const [x,y,r] of [[16,26,6],[22,22,7],[31,27,6],[78,25,6],[84,20,7],[91,25,5]])dot(x,y,r,'#E4C591')
  fill('M0 37 L13 29 L25 34 L38 26 L47 30 L61 16 Q66 13 72 18 L80 26 L100 34 V48 H0 Z','#283C31','#D8B77D',.8)
  fill('M30 39 L49 32 L61 16 L66 17 L60 29 L75 21 L80 30 L93 37 L100 43 H0 L13 35 Z','#7C773E')
  fill('M 0 42 Q 25 35 48 42 T100 39 V100 H0 Z','#76743E')
  for(const p of ['M0 52 Q15 43 32 50 T61 52','M0 72 Q13 62 37 65','M62 55 Q82 44 100 50','M72 77 Q88 65 100 70','M3 85 Q15 77 35 81'])line(p,'#324833',3)
  // The two banks meet in the middle; one continuous channel exits below.
  const river='M-12 41 C16 42 39 45 50 57 C62 43 83 37 112 31 L112 44 C85 45 71 50 63 58 C53 68 58 76 67 87 L80 110 H16 L25 88 C34 78 37 70 32 64 C24 56 9 54 -12 52 Z'
  fill(river,'#426C70')
  fill('M-12 41 C16 42 39 45 50 57 Q47 65 44 71 Q36 79 31 94 L25 88 C34 78 37 70 32 64 C24 56 9 54 -12 52 Z','#B96C32')
  line(river,'#E7C68B',1.8)
  for(const p of ['M-2 47 C18 47 30 51 40 58','M2 52 C22 54 37 58 40 64','M95 43 C78 45 62 50 55 59','M100 48 Q74 49 61 62','M49 71 Q42 81 37 96','M57 74 Q58 85 66 98','M43 74 Q31 84 30 94'])line(p,'#E8CD9B',.85)
  for(const [x,y] of [[7,60],[14,66],[5,81],[83,62],[91,57],[92,78],[76,82],[28,39],[38,40],[56,41],[69,39]]){
   dot(x,y,2.4,'#2C4534');dot(x+2,y+1,1.8,'#2C4534')
  }
 }
 // Fine aged-ink texture and a narrow printed edge.
 let seed=pattern.split('').reduce((s,c)=>Math.imul(s^c.charCodeAt(0),16777619),2166136261)>>>0
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 let wear='';for(let i=0;i<440;i++){const [x,y]=polar(Math.sqrt(rand())*48,rand()*Math.PI*2);wear+='M '+x.toFixed(2)+' '+y.toFixed(2)+' l '+(.15+rand()*.65).toFixed(2)+' .13 '}
 line(wear,'rgba(242,213,166,0.24)',.26);line(circle(50,50,48),e,.8)
 // Only gameplay numbers, never the design name or location.
 if(number!=null){const text=String(number).slice(0,3);fill(circle(50,10,7),b,e,.65);labels.push({text,x:50,y:10,size:7,width:Math.min(10,text.length*4.8),role:'number',style:'normal',fill:e,stroke:b,strokeWidth:.25})}
 return {shapes,labels}
}
