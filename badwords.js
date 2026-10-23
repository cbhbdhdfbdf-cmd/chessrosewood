// Simple profanity filter for names and chat. Edit freely: add words to STRONG (matched anywhere in the
// message once spaces/symbols are removed) or TOKENS (matched only as whole words).
const STRONG=['fuck','shit','bitch','cunt','nigg','faggot','whore','slut','porn','nazi','rapist','chutiya','madarchod','behenchod','bhosd','gandu','randi','harami','kutta','kamina','motherfuck','asshole','dickhead','retard'];
const TOKENS=['ass','dick','cock','sex','fag','pussy','kys','rape','nude','nudes','tits','boob','boobs','lund','gaand','chut','bsdk','mc','bc'];
const LEET={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i','+':'t'};
const norm=s=>String(s).toLowerCase().replace(/[01345 7@$!+]/g,c=>LEET[c]||c);
function isBad(text){
  const t=norm(text);
  const letters=t.replace(/[^a-z]/g,'').replace(/(.)\1{2,}/g,'$1$1');
  if(STRONG.some(w=>letters.includes(w)))return true;
  const toks=t.replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean);
  return toks.some(w=>TOKENS.includes(w.replace(/(.)\1{2,}/g,'$1$1')));
}
module.exports={isBad};
