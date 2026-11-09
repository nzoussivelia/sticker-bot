// SERVEUR POUR RENDER - ne pas enlever
const http = require('http');
http.createServer((req,res)=>{ res.end('Bot en ligne'); }).listen(process.env.PORT || 3000, ()=> console.log('Serveur Render sur', process.env.PORT || 3000));

// ANTI-CRASH - ne pas enlever
process.on('uncaughtException', e => console.log('[ANTI-CRASH] Erreur ignorée:', e.message));
process.on('unhandledRejection', e => console.log('[ANTI-CRASH] Promesse ignorée:', e?.message || e));
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs')

// ===== CLASSEMENT AUTO - AJOUTE PAR CHEF =====
const HIST_FILE = 'historique.json';
let historique = [];
try { historique = JSON.parse(fs.readFileSync(HIST_FILE,'utf8')); } catch(e){ historique = []; }
let lastGroupId = null;
function saveHist(){ try{ fs.writeFileSync(HIST_FILE, JSON.stringify(historique)); }catch(e){} }
function noterSticker(sender, groupId){
  if(groupId) lastGroupId = groupId;
  historique.push({ t: Date.now(), sender: sender });
  // on garde seulement 90 jours pour ne pas charger le téléphone
  let limite = Date.now() - 90*24*60*60*1000;
  historique = historique.filter(h => h.t > limite);
  saveHist();
}
function classementPeriode(debut){
  let map = {};
  historique.filter(h => h.t >= debut).forEach(h => { map[h.sender] = (map[h.sender]||0)+1; });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}
function texteClassement(titre, liste){
  if(liste.length===0) return titre + "\nAucun sticker pour cette période.";
  let txt = titre + "\n";
  liste.slice(0,10).forEach(([num, count], i)=>{
    let medal = i===0?'🥇':i===1?'🥈':i===2?'🥉': (i+1)+'\uFE0F\u20E3';
    txt += medal + ' @' + num.split('@')[0] + ' - ' + count + ' stickers\n';
  });
  return txt;
}
function heureBrazzaville(){
  // Heure à Brazzaville
  let d = new Date(new Date().toLocaleString('en-US',{timeZone:'Africa/Brazzaville'}));
  return d;
}
let dejaEnvoye = '';
async function checkHoraires(sock){
  try{
    let d = heureBrazzaville();
    let jour = d.getDay(); // 0 = Dimanche
    let date = d.getDate();
    let h = d.getHours();
    let m = d.getMinutes();
    let cle = d.getFullYear()+'-'+d.getMonth()+'-'+date+'-'+h+':'+m;
    if(dejaEnvoye === cle) return;
    if(!lastGroupId) return;
    // 1. Tous les jours à 14h00 -> TOTAL
    if(h===14 && m===0){
      dejaEnvoye = cle;
      let total = classementPeriode(0);
      let txt = texteClassement('🏆 CLASSEMENT TOTAL - 14H00 🏆\n', total);
      await sock.sendMessage(lastGroupId, { text: txt, mentions: total.slice(0,10).map(x=>x[0]) });
    }
    // 2. Dimanche à 17h00 -> SEMAINE (7 derniers jours)
    else if(jour===0 && h===17 && m===0){
      dejaEnvoye = cle;
      let debut = Date.now() - 7*24*60*60*1000;
      let sem = classementPeriode(debut);
      let txt = texteClassement('📅 CLASSEMENT DE LA SEMAINE - DIMANCHE 17H 📅\n', sem);
      await sock.sendMessage(lastGroupId, { text: txt, mentions: sem.slice(0,10).map(x=>x[0]) });
    }
    // 3. Le 1er du mois à 00h00 -> MOIS PRECEDENT
    else if(date===1 && h===0 && m===0){
      dejaEnvoye = cle;
      let debutMois = new Date(d.getFullYear(), d.getMonth()-1, 1).getTime();
      let finMois = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      let map = {};
      historique.filter(h=>h.t>=debutMois && h.t<finMois).forEach(h=>{ map[h.sender]=(map[h.sender]||0)+1; });
      let mois = Object.entries(map).sort((a,b)=>b[1]-a[1]);
      let txt = texteClassement('🗓️ CLASSEMENT DU MOIS - 1er DU MOIS 00H 🗓️\n', mois);
      await sock.sendMessage(lastGroupId, { text: txt, mentions: mois.slice(0,10).map(x=>x[0]) });
    }
  }catch(e){ console.log('Erreur horaire:', e.message); }
}
// Vérifie toutes les 30 secondes
setInterval(()=>{ if(global.sockGlobal) checkHoraires(global.sockGlobal); }, 30*1000);
// ===== FIN AJOUT =====
;
const crypto = require('crypto');
const FILE = 'voleurs.json';
let data = {};
if (fs.existsSync(FILE)) { try { data = JSON.parse(fs.readFileSync(FILE)); } catch(e){ data = {}; } }
function save(){ fs.writeFileSync(FILE, JSON.stringify(data)); }
function getLevel(count){
  if (count <= 99) return { n: 1, name: 'BRONZE 🥉' };
  if (count <= 199) return { n: 2, name: 'ARGENT 🥈' };
  if (count <= 399) return { n: 3, name: 'OR 🥇' };
  if (count <= 799) return { n: 4, name: 'DIAMANT 💎' };
  if (count <= 1599) return { n: 5, name: 'ADAMANTINE ⚫' };
  let etoiles = Math.floor(count / 1000);
  if (etoiles < 1) etoiles = 1;
  if (etoiles > 10) etoiles = 10;
  let stars = '⭐'.repeat(etoiles);
  return { n: 7, name: 'GRAND EMPEREUR ' + etoiles + ' ETOILES DE JADE ' + stars + ' 👑' };
}
function getWeekKey(){ const d=new Date(); const y=d.getFullYear(); const w=Math.ceil((((d - new Date(y,0,1))/86400000)+new Date(y,0,1).getDay()+1)/7); return `${y}-W${w}`; }
function getMonthKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
async function start(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: false, browser: ['Voleur-Bot','Chrome','1.0'] });
  global.sockGlobal = sock;
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u)=>{
    if (u.connection === 'open') console.log('BOT VOLEUR CONNECTE ! - SERVEUR ACTIF - GALERIE AUTO ON');
    if (u.connection === 'close' && (u.lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut) start();
  });
  sock.ev.on('messages.upsert', async ({ messages })=>{
    const msg = messages[0];
    if (!msg.message) return;
    const jid = msg.key.remoteJid;
    if (!jid.endsWith('@g.us')) return;
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderNum = sender.split('@')[0];
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const cmd = text.toLowerCase().trim();
    if (!data[jid]) data[jid] = { users:{}, hashes:{}, week:{}, month:{}, weekKey:getWeekKey(), monthKey:getMonthKey() };
    if (data[jid].weekKey !== getWeekKey()){ data[jid].week={}; data[jid].weekKey=getWeekKey(); save(); }
    if (data[jid].monthKey !== getMonthKey()){ data[jid].month={}; data[jid].monthKey=getMonthKey(); save(); }
    if (cmd === '.score' || cmd === '.moi'){ const u = data[jid].users[sender] || { count: 0 }; const lvl = getLevel(u.count); return sock.sendMessage(jid, { text: `@${senderNum} 🏆 *TON SCORE*\n\nTotal: *${u.count}*\nGrade: *${lvl.name}* (Niveau ${lvl.n})\nSemaine: *${data[jid].week[sender]||0}*\nMois: *${data[jid].month[sender]||0}*`, mentions:[sender] }); }
    if (cmd === '.niveaux'){ return sock.sendMessage(jid, { text: `⭐ *LES 6 NIVEAUX* ⭐\n\n🥉 BRONZE - 0 à 100\n🥈 ARGENT - 101 à 200\n🥇 OR - 201 à 400\n💎 DIAMANT - 401 à 800\n⚫ ADAMANTINE - 801 à 1600\n👑 AU-DELÀ - +1600\n\n🚫 PAS DE DOUBLON !` }); }
    if (cmd === '.classement' || cmd === '.tableau' || cmd === '.top'){ const users = data[jid].users || {}; const sorted = Object.entries(users).sort((a,b)=>b[1].count-a[1].count).slice(0,10); if(!sorted.length) return sock.sendMessage(jid,{text:'Personne n\'a encore volé !'}); let t=`🏆 *TABLEAU - CLASSEMENT TOTAL* 🏆\n\n`; sorted.forEach(([id,u],i)=>{ const lvl=getLevel(u.count); const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`; t+=`${medal} @${id.split('@')[0]} - ${u.count} - ${lvl.name}\n`; }); return sock.sendMessage(jid,{text:t, mentions:sorted.map(s=>s[0])}); }
    if (cmd === '.semaine'){ const sorted = Object.entries(data[jid].week||{}).sort((a,b)=>b[1]-a[1]).slice(0,10); if(!sorted.length) return sock.sendMessage(jid,{text:'Aucun vol cette semaine !'}); let t=`🏆 *TABLEAU DE LA SEMAINE* 🏆\n\n`; sorted.forEach(([id,c],i)=>{ const total=data[jid].users[id]?.count||0; const lvl=getLevel(total); t+=`${i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`} @${id.split('@')[0]} - ${c} cette semaine (Total: ${total} - ${lvl.name})\n`; }); return sock.sendMessage(jid,{text:t, mentions:sorted.map(s=>s[0])}); }
    if (cmd === '.mois'){ const sorted = Object.entries(data[jid].month||{}).sort((a,b)=>b[1]-a[1]).slice(0,10); if(!sorted.length) return sock.sendMessage(jid,{text:'Aucun vol ce mois !'}); let t=`🏆 *TABLEAU DU MOIS* 🏆\n\n`; sorted.forEach(([id,c],i)=>{ const total=data[jid].users[id]?.count||0; const lvl=getLevel(total); t+=`${i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`} @${id.split('@')[0]} - ${c} ce mois - Grade: ${lvl.name} (Total: ${total})\n`; }); return sock.sendMessage(jid,{text:t, mentions:sorted.map(s=>s[0])}); }
    if (cmd === '.ping') return sock.sendMessage(jid, { text: 'Pong ! Bot Voleur en ligne 🔥' });
    if (!msg.message.stickerMessage) return;
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (data[jid].hashes[hash]){ const firstBy = data[jid].hashes[hash]; if (firstBy !== sender) return sock.sendMessage(jid, { text: `🚫 *DOUBLON !* @${senderNum}, déjà volé par @${firstBy.split('@')[0]} ! *0 point.*`, mentions:[sender, firstBy] }); else return sock.sendMessage(jid, { text: `🚫 *DOUBLON !* Tu as déjà envoyé ce sticker @${senderNum} ! 0 point.`, mentions:[sender] }); }
      // ENREGISTREMENT AUTOMATIQUE DANS LA GALERIE
      const fileName = `stickers/${senderNum}_${Date.now()}.webp`;
      fs.writeFileSync(fileName, buffer);
      console.log(`[AUTO] Sticker enregistré: ${fileName} de ${senderNum}`);
      data[jid].hashes[hash] = sender;
      if (!data[jid].users[sender]) data[jid].users[sender] = { count: 0 };
      const oldLvl = getLevel(data[jid].users[sender].count);
      data[jid].users[sender].count++;
      noterSticker(sender, jid);;
      data[jid].week[sender] = (data[jid].week[sender]||0)+1;
      data[jid].month[sender] = (data[jid].month[sender]||0)+1;
      const newCount = data[jid].users[sender].count;
      const newLvl = getLevel(newCount);
      save();
      if (newLvl.n > oldLvl.n){ await sock.sendMessage(jid, { text: `🎉🎉 *ÉVOLUTION !* 🎉🎉\n\nFélicitations @${senderNum} !\nTu passes de *${oldLvl.name}* à *${newLvl.name}* !\nNiveau ${newLvl.n} - *${newCount}* stickers !\nTout le groupe le saura ! 🔥👑`, mentions:[sender] }); }
    } catch(e){ console.log('Erreur sticker', e.message); }
  });
}
start();
