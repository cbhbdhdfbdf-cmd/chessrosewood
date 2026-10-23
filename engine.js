const N8=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]],K8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],V={P:100,N:320,B:330,R:500,Q:900,K:0};
const isW=p=>p<'a',inb=(f,r)=>f>=0&&f<8&&r>=0&&r<8;
function att(b,s,w){const f=s&7,r=s>>3,pr=w?r-1:r+1;
 for(const d of[-1,1])if(inb(f+d,pr)&&b[pr*8+f+d]==(w?'P':'p'))return 1;
 for(const[a,c]of N8)if(inb(f+a,r+c)&&b[(r+c)*8+f+a]==(w?'N':'n'))return 1;
 for(const[a,c]of K8){if(inb(f+a,r+c)&&b[(r+c)*8+f+a]==(w?'K':'k'))return 1;
  let ff=f+a,rr=r+c;while(inb(ff,rr)){const p=b[rr*8+ff];if(p){const u=p.toUpperCase();if(isW(p)==!!w&&(u=='Q'||u==(a&&c?'B':'R')))return 1;break}ff+=a;rr+=c}}
 return 0}
function gen(S){const{b,t,c,ep}=S,w=t=='w',o=[];
 for(let s=0;s<64;s++){const p=b[s];if(!p||isW(p)!=w)continue;const f=s&7,r=s>>3,u=p.toUpperCase(),add=(to,x)=>o.push(Object.assign({from:s,to},x)),ap=(to,x,pr)=>{if(pr)for(const l of'QRBN')add(to,Object.assign({pro:l},x));else add(to,x)};
  if(u=='P'){const d=w?1:-1,r1=r+d,pro=r1==(w?7:0);
   if(!b[r1*8+f]){ap(r1*8+f,{},pro);if(r==(w?1:6)&&!b[(r+2*d)*8+f])add((r+2*d)*8+f,{dbl:1})}
   for(const df of[-1,1]){if(!inb(f+df,r1))continue;const to=r1*8+f+df,q=b[to];if(q&&isW(q)!=w)ap(to,{cap:1},pro);else if(to==ep)add(to,{ep:1,cap:1})}}
  else if(u=='N'||u=='K'){for(const[a,e]of u=='N'?N8:K8){if(!inb(f+a,r+e))continue;const to=(r+e)*8+f+a,q=b[to];if(!q||isW(q)!=w)add(to,q?{cap:1}:{})}
   if(u=='K'){const o0=w?0:56,rk=w?'R':'r',sh=w?1:4,lg=w?2:8,e=!w;
    if(s==o0+4&&!att(b,s,e)){
     if(c&sh&&!b[o0+5]&&!b[o0+6]&&b[o0+7]==rk&&!att(b,o0+5,e)&&!att(b,o0+6,e))add(o0+6,{cas:1});
     if(c&lg&&!b[o0+3]&&!b[o0+2]&&!b[o0+1]&&b[o0]==rk&&!att(b,o0+3,e)&&!att(b,o0+2,e))add(o0+2,{cas:1})}}}
  else for(const[a,e]of K8){if(u=='B'&&!(a&&e))continue;if(u=='R'&&a&&e)continue;let ff=f+a,rr=r+e;
   while(inb(ff,rr)){const to=rr*8+ff,q=b[to];if(!q)add(to,{});else{if(isW(q)!=w)add(to,{cap:1});break}ff+=a;rr+=e}}}
 return o}
function mk(S,m){const b=S.b.slice(),p=b[m.from],w=S.t=='w';let c=S.c,ep=-1;
 b[m.to]=m.pro?(w?m.pro:m.pro.toLowerCase()):p;b[m.from]='';
 if(m.ep)b[m.to+(w?-8:8)]='';
 if(m.cas){const o=w?0:56,k=m.to>m.from;b[o+(k?5:3)]=w?'R':'r';b[o+(k?7:0)]=''}
 if(m.dbl)ep=(m.from+m.to)/2;
 const rm={4:3,0:2,7:1,60:12,56:8,63:4};c&=~(rm[m.from]||0);c&=~(rm[m.to]||0);
 return{b,t:w?'b':'w',c,ep,hm:(p.toUpperCase()=='P'||m.cap)?0:S.hm+1}}
const inChk=S=>att(S.b,S.b.indexOf(S.t=='w'?'K':'k'),S.t!='w');
const legal=S=>gen(S).filter(m=>!inChk(Object.assign(mk(S,m),{t:S.t})));
function ev(b){let s=0,ph=0,wB=0,bB=0;const wf=[0,0,0,0,0,0,0,0],bf=[0,0,0,0,0,0,0,0],wmin=[9,9,9,9,9,9,9,9],bmax=[-1,-1,-1,-1,-1,-1,-1,-1];
 for(let i=0;i<64;i++){const p=b[i];if(!p)continue;const u=p.toUpperCase(),f=i&7,r=i>>3,w=isW(p);
  if(u=='P'){if(w){wf[f]++;if(r<wmin[f])wmin[f]=r}else{bf[f]++;if(r>bmax[f])bmax[f]=r}}
  else if(u!='K'){ph+=u=='Q'?4:u=='R'?2:1;if(u=='B'){if(w)wB++;else bB++}}}
 const eg=ph<=8;
 for(let i=0;i<64;i++){const p=b[i];if(!p)continue;const u=p.toUpperCase(),f=i&7,r=i>>3,w=isW(p),rr=w?r:7-r,c=7-Math.abs(f-3.5)-Math.abs(r-3.5),own=w?wf:bf,en=w?bf:wf;let v=V[u];
  if(u=='P'){v+=rr*7+(rr<5?c*2:0)-(f==0||f==7?5:0);if(own[f]>1)v-=12;if(!(f>0&&own[f-1])&&!(f<7&&own[f+1]))v-=10;
   let ps=1;for(let x=f-1;x<=f+1;x++){if(x<0||x>7)continue;if(w?bmax[x]>r:wmin[x]<r)ps=0}if(ps)v+=15+rr*rr*3}
  else if(u=='N')v+=c*7-(rr==0?14:0);else if(u=='B')v+=c*5-(rr==0?14:0);
  else if(u=='R'){if(!own[f])v+=en[f]?7:15;if(rr==6)v+=12}
  else if(u=='Q')v+=c;
  else if(eg)v+=c*12;
  else{const d=w?1:-1;let sh=0;if(r+d>=0&&r+d<8)for(let x=f-1;x<=f+1;x++)if(x>=0&&x<8&&b[(r+d)*8+x]==(w?'P':'p'))sh++;v+=sh*9-Math.min(rr,3)*14-c*3}
  s+=w?v:-v}
 return s+(wB>1?30:0)-(bB>1?30:0)}
const osc=(m,S)=>(m.cap?1000+V[(S.b[m.to]||'P').toUpperCase()]*10-V[S.b[m.from].toUpperCase()]:0)+(m.pro=='Q'?800:0);
function nm(S,d,a,B,pl){const L=legal(S);if(!L.length)return inChk(S)?-99000+pl:0;if(d==0)return(S.t=='w'?1:-1)*ev(S.b);
 L.sort((x,y)=>osc(y,S)-osc(x,S));for(const m of L){const v=-nm(mk(S,m),d-1,-B,-a,pl+1);if(v>=B)return B;if(v>a)a=v}return a}
function best(S,d,nz,rp){const L=legal(S);if(Math.random()<rp)return L[Math.random()*L.length|0];const sc=L.map(m=>({m,v:-nm(mk(S,m),d-1,-1e9,1e9,1)+Math.random()*nz}));sc.sort((x,y)=>y.v-x.v);return sc[0].m}
const perft=(S,d)=>d?legal(S).reduce((n,m)=>n+(d>1?perft(mk(S,m),d-1):1),0):1;
const START='RNBQKBNRPPPPPPPP'+' '.repeat(32)+'pppppppprnbqkbnr';
const init=()=>({b:[...START].map(x=>x==' '?'':x),t:'w',c:15,ep:-1,hm:0});

let _s=88172645;const rnd=()=>(_s=(Math.imul(_s,1664525)+1013904223)>>>0),ZB=[...Array(768)].map(()=>[rnd(),rnd()]),ZT=[rnd(),rnd()],ZC=[...Array(16)].map(()=>[rnd(),rnd()]),ZE=[...Array(64)].map(()=>[rnd(),rnd()]),PI='PNBRQKpnbrqk';
function hash(S){let a=0,b=0;for(let i=0;i<64;i++){const p=S.b[i];if(p){const z=ZB[i*12+PI.indexOf(p)];a^=z[0];b^=z[1]}}
 if(S.t=='b'){a^=ZT[0];b^=ZT[1]}a^=ZC[S.c][0];b^=ZC[S.c][1];if(S.ep>=0){a^=ZE[S.ep][0];b^=ZE[S.ep][1]}return(a>>>0)*2097152+(b>>>11)}
const TT=new Map(),now=()=>performance.now();let nodes=0,stop=0,dead=0,killer=[],NZ=0;
const rn=()=>NZ?(Math.random()-.5)*NZ:0,kingOk=(S,n,k,m)=>!att(n.b,m.from==k?m.to:k,S.t!='w'),same=(m,x)=>x&&m.from==x.from&&m.to==x.to&&m.pro==x.pro;
function qs(S,a,B){if((++nodes&2047)==0&&now()>dead)stop=1;if(stop)return 0;
 const sp=(S.t=='w'?1:-1)*ev(S.b)+rn();if(sp>=B)return B;if(sp>a)a=sp;
 const L=gen(S).filter(m=>m.cap||m.pro=='Q').sort((x,y)=>osc(y,S)-osc(x,S)),k=S.b.indexOf(S.t=='w'?'K':'k');
 for(const m of L){if(!m.pro&&sp+V[(S.b[m.to]||'P').toUpperCase()]+200<a)continue;const n=mk(S,m);if(!kingOk(S,n,k,m))continue;
  const v=-qs(n,-B,-a);if(stop)return 0;if(v>=B)return B;if(v>a)a=v}return a}
function ab(S,d,a,B,pl,np){if((++nodes&2047)==0&&now()>dead)stop=1;if(stop)return 0;
 const k=S.b.indexOf(S.t=='w'?'K':'k'),chk=att(S.b,k,S.t!='w');if(chk)d++;if(d<=0)return qs(S,a,B);
 const key=hash(S),e=TT.get(key),a0=a;let tm=null;
 if(e){tm=e.m;if(e.d>=d){if(e.f==0)return e.s;if(e.f==1&&e.s>=B)return e.s;if(e.f==2&&e.s<=a)return e.s}}
 if(np&&!chk&&d>=3&&B<90000&&S.b.some(p=>p&&isW(p)==(S.t=='w')&&!/[pk]/i.test(p))){
  const v=-ab({b:S.b,t:S.t=='w'?'b':'w',c:S.c,ep:-1,hm:S.hm},d-3,-B,-B+1,pl+1,0);if(stop)return 0;if(v>=B)return B}
 const L=gen(S),kl=killer[pl],sc=m=>same(m,tm)?1e6:osc(m,S)+(!m.cap&&kl&&same(m,kl)?900:0);L.sort((x,y)=>sc(y)-sc(x));
 let bm=null,n0=0;
 for(const m of L){const n=mk(S,m);if(!kingOk(S,n,k,m))continue;n0++;
  const v=-ab(n,d-1,-B,-a,pl+1,1);if(stop)return 0;
  if(v>a){a=v;bm=m;if(a>=B){if(!m.cap)killer[pl]=m;TT.set(key,{d,f:1,s:a,m});return a}}}
 if(!n0)return chk?-99000+pl:0;
 TT.set(key,{d,f:a>a0?0:2,s:a,m:bm||tm});return a}
function search(S,maxD,ms){nodes=0;stop=0;dead=now()+ms;killer=[];if(TT.size>300000)TT.clear();
 let L=legal(S);if(L.length<2)return L[0];let best=L[0];
 for(let d=1;d<=maxD;d++){let a=-1e9,bm=null;L.sort((x,y)=>(same(y,best)?1e6:osc(y,S))-(same(x,best)?1e6:osc(x,S)));
  for(const m of L){const v=-ab(mk(S,m),d-1,-1e9,-a,1,1)+(m.pro=='Q'?8:0);if(stop)break;if(!bm||v>a){a=v;bm=m}}
  if(stop)break;best=bm;if(a>90000||a<-90000)break}
 return best}
const LVL=[0,[1,120,.35],[1,60,.12],[2,45,0],[2,18,0],[3,300,12],[4,500,8],[5,800,5],[6,1200,3],[8,1800,2],[10,2500,0],[12,3500,0],[14,5000,0]];
function think(S,lvl,cap){const q=LVL[lvl]||LVL[5];if(lvl<=4)return best(S,q[0],q[1],q[2]);NZ=q[2];return search(S,q[0],Math.min(q[1],cap||1e9))}