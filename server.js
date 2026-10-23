'use strict';
// Rosewood Chess online server. One file, no dependencies. Node 18 or newer.
const http=require('http'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const {isBad}=require('./badwords');
const PORT=process.env.PORT||8787,DATA=path.join(process.env.DATA_DIR||__dirname,'data.json');
const E=new Function(fs.readFileSync(path.join(__dirname,'engine.js'),'utf8')+'\nreturn{init,legal,mk,inChk,hash}')();
const TCS={none:null,rapid:[600,0],blitz:[180,2],bullet:[60,0]};
const EMOJI=['👍','😂','😮','😢','😡','🔥','👏','🤝'];
// ---------- storage (a JSON file; on free hosts it may be wiped when the server restarts)
let DB={players:{},reports:[]};try{DB=JSON.parse(fs.readFileSync(DATA,'utf8'))}catch(e){}
DB.players=DB.players||{};DB.reports=DB.reports||[];
let dirty=0;const save=()=>{if(!dirty)return;dirty=0;try{fs.writeFileSync(DATA+'.tmp',JSON.stringify(DB));fs.renameSync(DATA+'.tmp',DATA)}catch(e){console.error('save failed:',e.message)}};
setInterval(save,10000);for(const sg of['SIGTERM','SIGINT'])process.on(sg,()=>{save();process.exit(0)});
// ---------- websocket plumbing
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const server=http.createServer((req,res)=>{if(req.url=='/health'||req.url=='/'){res.writeHead(200,{'content-type':'text/plain','access-control-allow-origin':'*'});res.end('ok '+open().length+' online')}else{res.writeHead(404);res.end()}});
const socks=new Set(),ipCount={};
server.on('upgrade',(req,sock)=>{
  const key=req.headers['sec-websocket-key'],ip=(req.headers['x-forwarded-for']||sock.remoteAddress||'').split(',')[0].trim();
  if(!key||req.url.split('?')[0]!='/ws'||(ipCount[ip]||0)>=8){sock.destroy();return}
  const acc=crypto.createHash('sha1').update(key+GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
  ipCount[ip]=(ipCount[ip]||0)+1;
  const s={sock,ip,open:true,buf:Buffer.alloc(0),frag:null,pid:null,game:null,q:null,room:null,alive:Date.now(),times:[],chats:[],lastReact:0};
  socks.add(s);sock.setNoDelay(true);
  sock.on('data',b=>{s.alive=Date.now();onData(s,b)});
  sock.on('close',()=>gone(s));sock.on('error',()=>gone(s));
});
function frame(op,p){const n=p.length;const h=n<126?Buffer.from([0x80|op,n]):n<65536?Buffer.from([0x80|op,126,n>>8,n&255]):null;return Buffer.concat([h,p])}
function send(s,o){if(s&&s.open){try{s.sock.write(frame(1,Buffer.from(JSON.stringify(o))))}catch(e){}}}
function closeSock(s,code){if(!s.open)return;try{const c=Buffer.alloc(2);c.writeUInt16BE(code||1000);s.sock.write(frame(8,c));s.sock.end()}catch(e){}gone(s)}
function onData(s,chunk){
  s.buf=Buffer.concat([s.buf,chunk]);
  for(;;){const b=s.buf;if(b.length<2)return;
    const op=b[0]&15,fin=b[0]&128,masked=b[1]&128;let len=b[1]&127,off=2;
    if(len==126){if(b.length<4)return;len=b.readUInt16BE(2);off=4}else if(len==127){if(b.length<10)return;len=Number(b.readBigUInt64BE(2));off=10}
    if(!masked||len>8192){closeSock(s,1009);return}
    if(b.length<off+4+len)return;
    const mask=b.slice(off,off+4),p=Buffer.from(b.slice(off+4,off+4+len));for(let i=0;i<len;i++)p[i]^=mask[i&3];
    s.buf=b.slice(off+4+len);
    if(op==8){closeSock(s);return}
    if(op==9){try{s.sock.write(frame(10,p))}catch(e){}continue}
    if(op==10)continue;
    if(op==1||op==0){s.frag=op==1?p:Buffer.concat([s.frag||Buffer.alloc(0),p]);if(fin){const t=s.frag.toString('utf8');s.frag=null;onText(s,t)}}}}
setInterval(()=>{const now=Date.now();for(const s of socks){if(now-s.alive>70000){closeSock(s,1001);continue}try{s.sock.write(frame(9,Buffer.alloc(0)))}catch(e){}}},25000);
// ---------- helpers
const live=new Map(); // player id -> session
const open=()=>[...live.values()].filter(s=>s.open);
const pub=p=>({id:p.id,name:p.name,av:p.av,rating:p.rating,games:p.games,w:p.w,l:p.l,d:p.d});
const sendTo=(pid,o)=>send(live.get(pid),o);
const cleanName=x=>String(x||'').normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,'').replace(/\s+/g,' ').trim().slice(0,16);
const nameOk=n=>n.length>=3&&!isBad(n);
const hex=/^[a-f0-9]{16,64}$/;
// ---------- messages
function onText(s,text){
  const now=Date.now();s.times=s.times.filter(t=>now-t<5000);if(s.times.length>60){closeSock(s,1008);return}s.times.push(now);
  let m;try{m=JSON.parse(text)}catch(e){return}
  if(!m||typeof m.t!='string')return;
  if(m.t=='hello')return hello(s,m);
  if(m.t=='ping')return send(s,{t:'pong'});
  if(!s.pid)return;
  const h={queue,cancel,room,join,move,resign,draw,drawA,drawD,chat,react,rematch,leave,report}[m.t];
  if(h)h(s,m);
}
function hello(s,m){
  if(!hex.test(m.id||'')||!hex.test(m.secret||'')){send(s,{t:'err',code:'auth'});return}
  const sh=crypto.createHash('sha256').update(m.secret).digest('hex');let p=DB.players[m.id];
  const nm=cleanName(m.name),av=Number.isInteger(m.av)&&m.av>=0&&m.av<12?m.av:0;
  if(p&&p.sh!==sh){send(s,{t:'err',code:'auth'});return}
  if(!p){
    if(!nameOk(nm)){send(s,{t:'err',code:'name'});return}
    const hint=Number.isFinite(m.r)?Math.min(1600,Math.max(600,Math.round(m.r))):1200;
    p=DB.players[m.id]={id:m.id,sh,name:nm,av,rating:hint,games:0,w:0,l:0,d:0,seen:now()};dirty=1;
  }else if(nm&&(nm!==p.name||av!==p.av)){
    if(nameOk(nm)){p.name=nm;p.av=av;dirty=1}else send(s,{t:'err',code:'name'});
  }
  p.seen=now();
  const old=live.get(p.id);if(old&&old!==s&&old.open){old.pid=null;closeSock(old,4000)}
  s.pid=p.id;live.set(p.id,s);
  let resume=null;const g=activeGame(p.id);
  if(g){s.game=g;const col=g.w==p.id?'w':'b';clearTimeout(g.dc[col]);g.dc[col]=null;resume=snap(g,col);sendTo(g[col=='w'?'b':'w'],{t:'oppback'})}
  send(s,{t:'welcome',me:pub(p),online:open().length,resume});
}
function now(){return Date.now()}
const activeGame=pid=>{for(const g of games.values())if(!g.over&&(g.w==pid||g.b==pid))return g;return null};
const games=new Map(),queueList=[],rooms=new Map();
function snap(g,col){const o=DB.players[g[col=='w'?'b':'w']];return{gid:g.id,you:col,tc:g.tc,rated:g.rated,opp:pub(o),moves:g.moves,w:left(g,'w'),b:left(g,'b'),chat:g.chat.slice(-30)}}
function left(g,c){let t=g.clock[c];if(g.turnAt&&g.S.t==c&&g.moves.length>0)t-=now()-g.turnAt;return Math.max(0,Math.round(t))}
// ---------- matchmaking and rooms
function leaveGame(s,quit){
  const g=s.game;if(g&&!g.over&&quit){const col=g.w==s.pid?'w':'b';finish(g,'resign',col=='w'?'b':'w')}
  s.game=null;const i=queueList.findIndex(q=>q.pid==s.pid);if(i>=0)queueList.splice(i,1);
  for(const[c,r]of rooms)if(r.pid==s.pid)rooms.delete(c);
}
function queue(s,m){const tc=m.tc in TCS?m.tc:'none';leaveGame(s,true);const p=DB.players[s.pid];queueList.push({pid:s.pid,tc,t0:now(),rating:p.rating});send(s,{t:'queued',tc});matchmake()}
function cancel(s){leaveGame(s,false);send(s,{t:'cancelled'})}
function matchmake(){
  const t=now();
  for(let i=0;i<queueList.length;i++){const a=queueList[i];let best=-1,bd=1e9;
    for(let j=0;j<queueList.length;j++){if(j==i)continue;const b=queueList[j];if(b.tc!=a.tc)continue;const win=100+40*Math.max(t-a.t0,t-b.t0)/1000,d=Math.abs(a.rating-b.rating);if(d<=win&&d<bd){bd=d;best=j}}
    if(best>=0){const b=queueList[best];queueList.splice(Math.max(i,best),1);queueList.splice(Math.min(i,best),1);const [w,k]=Math.random()<.5?[a,b]:[b,a];startGame(w.pid,k.pid,a.tc,true);i=-1}}
}
setInterval(matchmake,1000);
function startGame(w,b,tc,rated){
  const S=E.init(),c=TCS[tc],id=crypto.randomBytes(6).toString('hex');
  const g={id,w,b,tc,rated,S,moves:[],hist:{[E.hash(S)]:1},timed:!!c,clock:{w:c?c[0]*1000:0,b:c?c[0]*1000:0},inc:c?c[1]*1000:0,turnAt:null,timer:null,over:false,draw:null,chat:[],rm:{},dc:{}};
  games.set(id,g);
  for(const col of['w','b']){const pid=g[col],s=live.get(pid);if(s){leaveGame(s,false);s.game=g}send(s,{t:'matched',...snap(g,col)})}
  return g;
}
function room(s,m){
  const tc=m.tc in TCS?m.tc:'none',sd=m.sd=='b'||m.sd=='r'?m.sd:'w';leaveGame(s,true);
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ';let code;do{code=Array.from({length:4},()=>A[Math.random()*A.length|0]).join('')}while(rooms.has(code));
  rooms.set(code,{pid:s.pid,tc,sd,t:now()});send(s,{t:'roomed',code});
}
setInterval(()=>{for(const[c,r]of rooms)if(now()-r.t>15*60000)rooms.delete(c)},60000);
function join(s,m){
  const code=String(m.code||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4),r=rooms.get(code);
  if(!r||r.pid==s.pid||!live.get(r.pid)||!live.get(r.pid).open){send(s,{t:'err',code:'noroom'});return}
  rooms.delete(code);leaveGame(s,true);
  const sd=r.sd=='r'?(Math.random()<.5?'w':'b'):r.sd;startGame(sd=='w'?r.pid:s.pid,sd=='w'?s.pid:r.pid,r.tc,false);
}
// ---------- playing
const insuf=S=>{const p=S.b.filter(x=>x&&x.toUpperCase()!='K');return p.length==0||(p.length==1&&/[nb]/i.test(p[0]))};
function colorOf(s,g){return g.w==s.pid?'w':g.b==s.pid?'b':null}
function arm(g){clearTimeout(g.timer);if(g.over||!g.timed||g.moves.length==0)return;const c=g.S.t,ms=Math.max(0,left(g,c));g.timer=setTimeout(()=>{if(!g.over&&g.S.t==c&&left(g,c)<=50)finish(g,'time',c=='w'?'b':'w');else arm(g)},ms+60)}
function move(s,m){
  const g=s.game;if(!g||g.over)return;const col=colorOf(s,g);if(col!==g.S.t)return send(s,{t:'err',code:'turn'});
  const from=m.from,to=m.to,pro=m.pro;if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>63||to>63)return;
  const mm=E.legal(g.S).find(x=>x.from==from&&x.to==to&&x.pro==pro);if(!mm)return send(s,{t:'err',code:'illegal'});
  const timed=g.timed;
  if(timed&&g.moves.length>0){g.clock[col]-=now()-g.turnAt;if(g.clock[col]<=0){g.clock[col]=0;finish(g,'time',col=='w'?'b':'w');return}}
  if(timed)g.clock[col]+=g.inc;
  g.S=E.mk(g.S,mm);g.moves.push({from,to,pro});g.turnAt=now();const k=E.hash(g.S);g.hist[k]=(g.hist[k]||0)+1;g.draw=null;
  const out={t:'move',from,to,pro,w:left(g,'w'),b:left(g,'b')};
  send(live.get(g[col=='w'?'b':'w']),out);send(s,{t:'ack',w:out.w,b:out.b});
  const L=E.legal(g.S);
  if(!L.length)finish(g,E.inChk(g.S)?'mate':'stale',E.inChk(g.S)?col:null);
  else if(g.S.hm>=100)finish(g,'fifty',null);else if(insuf(g.S))finish(g,'insuf',null);else if(g.hist[k]>=3)finish(g,'rep',null);
  else arm(g);
}
function elo(g,res){
  const W=DB.players[g.w],B=DB.players[g.b],sw=res=='w'?1:res=='b'?0:.5,ew=1/(1+Math.pow(10,(B.rating-W.rating)/400)),kf=p=>p.games<20?40:24;
  const dw=Math.round(kf(W)*(sw-ew)),db=Math.round(kf(B)*((1-sw)-(1-ew)));
  W.rating=Math.max(100,W.rating+dw);B.rating=Math.max(100,B.rating+db);
  for(const[p,s]of[[W,sw],[B,1-sw]]){p.games++;if(s==1)p.w++;else if(s==0)p.l++;else p.d++}
  return{w:dw,b:db};
}
function finish(g,k,winner){
  if(g.over)return;g.over=true;clearTimeout(g.timer);clearTimeout(g.dc.w);clearTimeout(g.dc.b);
  let d={w:0,b:0};if(g.rated&&g.moves.length>=2){d=elo(g,winner||'d');dirty=1}
  for(const col of['w','b'])sendTo(g[col],{t:'over',k,w:winner||null,delta:d[col],rating:DB.players[g[col]].rating,rated:g.rated&&g.moves.length>=2});
  setTimeout(()=>games.delete(g.id),10*60000);
}
function resign(s){const g=s.game;if(!g||g.over)return;finish(g,'resign',colorOf(s,g)=='w'?'b':'w')}
function draw(s){const g=s.game;if(!g||g.over)return;if(g.moves.length<10)return send(s,{t:'err',code:'early'});const col=colorOf(s,g);g.draw=col;send(live.get(g[col=='w'?'b':'w']),{t:'draw'})}
function drawA(s){const g=s.game;if(!g||g.over||!g.draw||g.draw==colorOf(s,g))return;finish(g,'agree',null)}
function drawD(s){const g=s.game;if(!g||g.over||!g.draw||g.draw==colorOf(s,g))return;const o=g.draw;g.draw=null;send(live.get(g[o]),{t:'drawD'})}
function chat(s,m){
  const g=s.game;if(!g)return;let t=String(m.text||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,140);if(!t)return;
  const n=now();s.chats=s.chats.filter(x=>n-x<60000);if(s.chats.length>=12||n-(s.chats[s.chats.length-1]||0)<900)return send(s,{t:'err',code:'slow'});
  s.chats.push(n);
  if(isBad(t))return send(s,{t:'blocked'});
  const col=colorOf(s,g);g.chat.push({c:col,text:t,ts:n});if(g.chat.length>60)g.chat.shift();
  send(live.get(g[col=='w'?'b':'w']),{t:'chat',text:t,ts:n});
}
function react(s,m){const g=s.game;if(!g||!EMOJI.includes(m.e))return;const n=now();if(n-s.lastReact<1200)return;s.lastReact=n;send(live.get(g[colorOf(s,g)=='w'?'b':'w']),{t:'react',e:m.e})}
function rematch(s){
  const g=s.game;if(!g||!g.over)return;const col=colorOf(s,g);g.rm[col]=true;send(live.get(g[col=='w'?'b':'w']),{t:'rematch'});
  if(g.rm.w&&g.rm.b){games.delete(g.id);const ng=startGame(g.b,g.w,g.tc,g.rated)}
}
function leave(s){leaveGame(s,true);send(s,{t:'left'})}
function report(s,m){const g=s.game;if(!g)return;const opp=g[colorOf(s,g)=='w'?'b':'w'];DB.reports.push({ts:now(),by:s.pid,about:opp,reason:String(m.reason||'').slice(0,60),chat:g.chat.slice(-15)});if(DB.reports.length>300)DB.reports.shift();dirty=1;console.log('REPORT',s.pid,'about',opp);send(s,{t:'reported'})}
function gone(s){
  if(!s.open)return;s.open=false;socks.delete(s);ipCount[s.ip]=Math.max(0,(ipCount[s.ip]||1)-1);
  if(s.pid&&live.get(s.pid)===s){live.delete(s.pid);const i=queueList.findIndex(q=>q.pid==s.pid);if(i>=0)queueList.splice(i,1);for(const[c,r]of rooms)if(r.pid==s.pid)rooms.delete(c);
    const g=s.game;if(g&&!g.over){const col=colorOf(s,g);sendTo(g[col=='w'?'b':'w'],{t:'oppdc'});g.dc[col]=setTimeout(()=>finish(g,'abandon',col=='w'?'b':'w'),45000)}}
}
setInterval(()=>{const n=open().length,q=queueList.length;for(const s of open())send(s,{t:'online',n,q})},20000);
server.listen(PORT,()=>console.log('Rosewood Chess server listening on',PORT));
