(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function e(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerPolicy&&(r.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?r.credentials="include":n.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(n){if(n.ep)return;n.ep=!0;const r=e(n);fetch(n.href,r)}})();const xh={turret:3,uiHover:2,uiClick:3,impactGround:4,heartbeat:1,zoom:2,breathIn:1,breathOut:1};class Mh{ctx=null;master;sfx;music;ambient;reverb;reverbSend;noise;active=new Map;windSource=null;windFilter=null;windGain=null;musicNodes=[];musicTimer=null;volumes={master:.8,sfx:.9,music:.45,muted:!1};wantMusic=!1;get ready(){return this.ctx!==null&&this.ctx.state==="running"}unlock(){try{if(!this.ctx){const t=window.AudioContext??window.webkitAudioContext;if(!t)return;this.ctx=new t,this.build()}this.ctx.state==="suspended"&&this.ctx.resume().catch(()=>{})}catch{this.ctx=null}}build(){const t=this.ctx;this.master=t.createGain(),this.master.connect(t.destination),this.sfx=t.createGain(),this.sfx.connect(this.master),this.music=t.createGain(),this.music.connect(this.master),this.ambient=t.createGain(),this.ambient.connect(this.sfx);const e=t.sampleRate*2;this.noise=t.createBuffer(1,e,t.sampleRate);const i=this.noise.getChannelData(0);for(let a=0;a<e;a++)i[a]=Math.random()*2-1;this.reverb=t.createConvolver();const n=Math.floor(t.sampleRate*2.8),r=t.createBuffer(2,n,t.sampleRate);for(let a=0;a<2;a++){const o=r.getChannelData(a);for(let l=0;l<n;l++){const c=l/t.sampleRate,h=Math.abs(c-.35)<.04?.5:0;o[l]=(Math.random()*2-1)*(Math.exp(-c*2.2)*.6+h*Math.exp(-c*3))}}this.reverb.buffer=r,this.reverbSend=t.createGain(),this.reverbSend.gain.value=.35,this.reverbSend.connect(this.reverb),this.reverb.connect(this.sfx),this.applyVolumes(),this.wantMusic&&this.startMusic()}setVolumes(t,e,i,n){this.volumes={master:t,sfx:e,music:i,muted:n},this.applyVolumes()}applyVolumes(){if(!this.ctx)return;const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(this.volumes.muted?0:this.volumes.master,t,.02),this.sfx.gain.setTargetAtTime(this.volumes.sfx,t,.02),this.music.gain.setTargetAtTime(this.volumes.music*.5,t,.05)}suspend(){this.ctx&&this.ctx.state==="running"&&this.ctx.suspend().catch(()=>{})}resume(){this.ctx&&this.ctx.state==="suspended"&&this.ctx.resume().catch(()=>{})}allow(t,e,i){if(!this.ctx)return!1;const n=xh[t]??6,r=this.ctx.currentTime,a=(this.active.get(t)??[]).filter(o=>o>r);return a.length>=n?(this.active.set(t,a),!1):(a.push(r+i+e),this.active.set(t,a),!0)}noiseSource(t,e){const n=this.ctx.createBufferSource();return n.buffer=this.noise,n.loop=!0,n.start(t,Math.random()*1.5),n.stop(t+e+.05),n}env(t,e,i,n){const r=this.ctx.createGain();return r.gain.setValueAtTime(1e-4,t),r.gain.exponentialRampToValueAtTime(Math.max(2e-4,n),t+e),r.gain.exponentialRampToValueAtTime(1e-4,t+e+i),r}tone(t,e,i,n,r,a,o,l){const h=this.ctx.createOscillator();h.type=t,h.frequency.setValueAtTime(e,i),l&&h.frequency.exponentialRampToValueAtTime(l,i+n+r);const u=this.env(i,n,r,a);h.connect(u).connect(o),h.start(i),h.stop(i+n+r+.05)}burst(t,e,i,n,r,a,o,l){const c=this.ctx,h=this.noiseSource(t,e),u=c.createBiquadFilter();u.type=i,u.frequency.setValueAtTime(n,t),l&&u.frequency.exponentialRampToValueAtTime(l,t+e),u.Q.value=r;const d=this.env(t,.002,e,a);h.connect(u).connect(d).connect(o)}play(t,e={}){if(!this.ctx||this.ctx.state!=="running")return;const i=Math.max(0,e.delay??0),n={shot:1.5,impactSteel:1.2,star:.8,success:1.4,fail:1.2};if(!this.allow(t,n[t]??.4,i))return;const r=this.ctx,a=r.currentTime+i,o=e.volume??1,l=(e.pitch??1)*(.95+Math.random()*.1);let c=this.sfx;if(e.pan!==void 0&&r.createStereoPanner){const u=r.createStereoPanner();u.pan.value=Math.max(-1,Math.min(1,e.pan)),u.connect(this.sfx),c=u}const h=e.weight??1;switch(t){case"shot":{const u=r.createGain();u.gain.value=o,u.connect(c),u.connect(this.reverbSend),this.burst(a,.35*h,"lowpass",9e3*l,.7,1,u,300),this.burst(a,.08,"highpass",2500,.5,.6,u),this.tone("sine",85/h,a,.003,.28*h,.9,u,35);break}case"shotSub":{const u=r.createGain();u.gain.value=o*.6,u.connect(c),this.burst(a,.12,"bandpass",1800*l,1.2,.5,u,600),this.burst(a+.02,.03,"highpass",5e3,1,.25,u),this.tone("sine",120,a,.002,.08,.3,u,60);break}case"shotSup":{const u=r.createGain();u.gain.value=o*.7,u.connect(c),this.burst(a,.16*h,"lowpass",1600*l,.9,.7,u,220),this.tone("sine",70,a,.003,.16,.5,u,40),this.burst(a+.03,.025,"bandpass",3200,3,.18,u);break}case"tag":this.tone("sine",1760*(e.pitch??1),a,.003,.08,.12*o,c),this.tone("sine",2349*(e.pitch??1),a+.07,.003,.12,.1*o,c);break;case"impactGround":this.burst(a,.18,"lowpass",1400*l,.8,.5*o,c,200);break;case"impactSteel":{const u=r.createGain();u.gain.value=o,u.connect(c),u.connect(this.reverbSend);for(const[d,f,m]of[[1180,.5,1],[2760,.25,.7],[4130,.12,.4]])this.tone("sine",d*l,a,.002,m,f,u);this.burst(a,.03,"highpass",3e3,1,.3,u);break}case"botHit":{const u=r.createGain();u.gain.value=o,u.connect(c),u.connect(this.reverbSend),this.burst(a,.25,"bandpass",2200*l,2,.7,u,700),this.tone("square",420*l,a,.002,.18,.18,u,90),this.tone("sine",760*l,a+.01,.002,.35,.2,u);break}case"headshot":this.tone("sine",1568*l,a,.005,.5,.25*o,c),this.tone("sine",2093*l,a+.06,.005,.6,.2*o,c);break;case"bolt":{const u=e.weight??1;for(const[d,f,m]of[[0,2600,.35],[.22,1600,.45],[.55,1900,.45],[.8,3200,.35]])this.burst(a+d*u,.045,"bandpass",f*l,3,m*o,c);break}case"reload":for(const[u,d,f]of[[0,1200,.4],[.35,900,.3],[1.3,1500,.45],[1.6,2400,.4]])this.burst(a+u*h,.06,"bandpass",d*l,3,f*o,c);break;case"turret":this.burst(a,.012,"bandpass",4200*l,6,.35*o,c);break;case"zoom":this.burst(a,.03,"bandpass",2500*l,4,.08*o,c);break;case"heartbeat":this.tone("sine",55,a,.01,.12,.5*o,c,40),this.tone("sine",50,a+.18,.01,.14,.35*o,c,38);break;case"breathIn":this.burst(a,.6,"bandpass",900,.8,.07*o,c,1400);break;case"breathOut":this.burst(a,.8,"bandpass",1100,.8,.08*o,c,600);break;case"uiClick":this.tone("triangle",880*l,a,.002,.07,.18*o,c,660);break;case"uiHover":this.tone("sine",1320*l,a,.002,.04,.05*o,c);break;case"star":this.tone("triangle",1046*(e.pitch??1),a,.005,.5,.22*o,c),this.tone("sine",2093*(e.pitch??1),a,.005,.35,.1*o,c);break;case"alert":this.tone("square",880,a,.005,.12,.08*o,c),this.tone("square",660,a+.15,.005,.16,.08*o,c);break;case"fail":this.tone("triangle",392,a,.01,.4,.2*o,c,300),this.tone("triangle",294,a+.3,.01,.7,.2*o,c,200);break;case"success":for(const[u,d]of[523,659,784,1046].entries())this.tone("triangle",d,a+u*.09,.01,.7,.16*o,c);break;case"beep":this.tone("sine",2400,a,.003,.06,.12*o,c);break;case"hint":this.tone("sine",988,a,.005,.2,.08*o,c),this.tone("sine",1319,a+.08,.005,.25,.08*o,c);break;case"dry":this.burst(a,.02,"bandpass",3e3,4,.3*o,c);break}}setWind(t,e){if(!this.ctx)return;const i=this.ctx;if(e&&!this.windSource&&(this.windSource=i.createBufferSource(),this.windSource.buffer=this.noise,this.windSource.loop=!0,this.windFilter=i.createBiquadFilter(),this.windFilter.type="bandpass",this.windFilter.Q.value=.6,this.windGain=i.createGain(),this.windGain.gain.value=0,this.windSource.connect(this.windFilter).connect(this.windGain).connect(this.ambient),this.windSource.start()),!e&&this.windSource){try{this.windSource.stop()}catch{}this.windSource.disconnect(),this.windSource=null;return}if(this.windGain&&this.windFilter){const n=i.currentTime;this.windGain.gain.setTargetAtTime(.02+Math.min(.12,t*.018),n,.4),this.windFilter.frequency.setTargetAtTime(250+t*90,n,.4)}}startMusic(){if(this.wantMusic=!0,!this.ctx||this.musicTimer!==null)return;const t=[[220,261.6,329.6],[196,246.9,293.7],[174.6,220,261.6],[196,246.9,329.6]];let e=0;const i=()=>{if(!this.ctx)return;const n=this.ctx,r=n.currentTime,a=n.createBiquadFilter();a.type="lowpass",a.frequency.value=900,a.connect(this.music);for(const o of t[e%t.length])for(const l of[-6,6]){const c=n.createOscillator();c.type="sawtooth",c.frequency.value=o,c.detune.value=l;const h=n.createGain();h.gain.setValueAtTime(1e-4,r),h.gain.linearRampToValueAtTime(.025,r+1.5),h.gain.linearRampToValueAtTime(1e-4,r+4.2),c.connect(h).connect(a),c.start(r),c.stop(r+4.3),this.musicNodes.push(c)}this.musicNodes.length>48&&this.musicNodes.splice(0,this.musicNodes.length-48),e++};i(),this.musicTimer=window.setInterval(i,4e3)}stopMusic(){this.wantMusic=!1,this.musicTimer!==null&&(clearInterval(this.musicTimer),this.musicTimer=null);for(const t of this.musicNodes)try{t.stop()}catch{}this.musicNodes=[]}}const ni={type:"clear",label:"모든 필수 표적 제거"},si={type:"accuracy",label:"명중률 100% (빗나감 없음)"},ge=[{id:"m1",codename:"자격 심사 I",name:"첫 발",subtitle:"기초 사격",category:"qualification",briefing:["고스트 프로토콜 저격수 자격 심사를 시작합니다.","강철판 두 개를 맞히십시오. 바람은 없습니다."],intel:["심사관: 무풍 조건, 100m 영점","1클릭 = 0.1mil = 100m에서 1cm"],newSkill:"조준 · 숨 참기 · 고각 보정",theme:"plains",timeOfDay:"day",atmosphere:{altitude:100,temperature:15},wind:{zones:[{from:0,speed:0,dir:90}],variability:0},ammoTotal:15,timeLimit:0,targets:[{id:"p1",kind:"plate",x:0,dist:200,w:.6,h:.6,shape:"circle",required:!0,label:"200m 강철판"},{id:"p2",kind:"plate",x:9,dist:350,w:.6,h:.6,shape:"circle",required:!0,label:"350m 강철판"}],props:[{kind:"sandbag",x:-5,dist:205,w:3,h:.8,d:1},{kind:"crate",x:14,dist:345,w:1.5,h:1,d:1.5},{kind:"barrel",x:12,dist:352,w:.6,h:.9,d:.6}],objectives:[ni,si,{type:"time",value:60,label:"60초 이내 완료"}],hints:[{text:"{scope} 로 스코프를 들여다보세요.",touchText:"[스코프] 버튼을 누르세요.",until:"scope"},{text:"마우스 휠로 배율을 올려 200m 강철판을 찾으세요.",touchText:"두 손가락으로 벌리거나 [+] 버튼으로 배율을 올리세요.",until:"zoom"},{text:"{breath} 를 누르고 있으면 숨을 참아 흔들림이 줄어듭니다.",touchText:"[숨] 버튼을 누르고 있으면 흔들림이 줄어듭니다.",until:"breath"},{text:"숨을 참은 채 강철판 중앙에 맞추고 {fire} 로 쏘세요.",touchText:"숨을 참은 채 강철판 중앙에 맞추고 [발사]를 누르세요.",until:"hit"},{text:"다음은 350m입니다. 멀수록 탄이 떨어집니다. {dope} 로 탄도표를 확인하세요.",touchText:"다음은 350m. [표] 버튼으로 탄도표를 확인하세요.",until:"dope"},{text:"탄도표의 350m 값만큼 {elevUp} 로 고각을 올리세요. (1클릭 = 0.1mil)",touchText:"탄도표의 350m 값만큼 [▲] 로 고각을 올리세요.",until:"turretElev"},{text:"고각을 맞췄다면 레티클 중앙을 표적에 그대로 겨누고 쏘세요.",until:"hit"}]},{id:"m2",codename:"자격 심사 II",name:"바람 읽기",subtitle:"횡풍 보정",category:"qualification",briefing:["왼쪽에서 바람이 붑니다. 깃발이 얼마나 펄럭이는지 보십시오.","바람은 탄을 오른쪽으로 밀어냅니다."],intel:["풍속 약 3m/s, 9시 방향","깃발이 수평에 가까울수록 강풍(8m/s↑)"],newSkill:"바람 보정 (깃발 · 풍속계 · 레티클 홀드)",theme:"plains",timeOfDay:"overcast",atmosphere:{altitude:150,temperature:18},wind:{zones:[{from:0,speed:3,dir:90}],variability:.08},ammoTotal:15,timeLimit:0,targets:[{id:"p1",kind:"plate",x:-4,dist:400,w:.6,h:.6,shape:"circle",required:!0,label:"400m 강철판"},{id:"p2",kind:"plate",x:10,dist:500,w:.6,h:.6,shape:"circle",required:!0,label:"500m 강철판"}],props:[{kind:"rock",x:3,dist:395,w:2.5,h:1,d:2},{kind:"sandbag",x:14,dist:503,w:3,h:.8,d:1}],objectives:[ni,si,{type:"holdOnly",label:"좌우 터렛을 쓰지 않고 레티클 홀드로만 명중"}],hints:[{text:"깃발과 풍속계(왼쪽 아래)를 확인하세요. 3m/s, 왼쪽에서 오른쪽으로 붑니다.",until:"scope"},{text:'{dope} 탄도표의 "바람 1m/s당" 값 × 풍속 = 좌우 보정량(mil)입니다.',touchText:'[표] 탄도표의 "바람 1m/s당" 값 × 풍속 = 좌우 보정량(mil)',until:"dope"},{text:"고각은 {elevUp}/{elevDown}. 바람은 레티클 눈금만큼 표적 왼쪽(바람 오는 쪽)을 겨누세요.",until:"hit"}]},{id:"m3",codename:"자격 심사 III",name:"눈으로 재는 거리",subtitle:"밀 거리측정",category:"qualification",briefing:["모래폭풍으로 거리측정기가 고장났습니다.","표적판의 높이는 정확히 1m입니다. 레티클로 재십시오."],intel:["거리(m) = 크기(m) × 1000 ÷ mil","표적판: 높이 1.0m, 폭 0.5m"],newSkill:"레티클로 거리 계산",theme:"desert",timeOfDay:"day",atmosphere:{altitude:400,temperature:32},wind:{zones:[{from:0,speed:2,dir:270}],variability:.1},ammoTotal:15,timeLimit:0,noRangefinder:!0,targets:[{id:"p1",kind:"plate",x:-12,dist:450,w:.5,h:1,shape:"rect",required:!0,label:"표적판 A"},{id:"p2",kind:"plate",x:15,dist:620,w:.5,h:1,shape:"rect",required:!0,label:"표적판 B"}],props:[{kind:"rock",x:-20,dist:440,w:4,h:2,d:3},{kind:"rock",x:24,dist:600,w:5,h:2.5,d:4},{kind:"barrel",x:-9,dist:455,w:.6,h:.9,d:.6}],objectives:[ni,si,{type:"time",value:120,label:"120초 이내 완료"}],hints:[{text:"표적판(1m)이 레티클 눈금 몇 mil에 걸치는지 재세요. 거리(m) = 1000 ÷ mil",until:"scope"},{text:"예: 2.2mil이면 1000 ÷ 2.2 ≈ 455m. 그 거리를 탄도표에서 찾아 보정하세요.",until:"hit"}]},{id:"m4",codename:"작전: 검은 소나무",name:"초소 정리",subtitle:"연속 사격",category:"operation",briefing:["침투조가 새벽에 이 숲길을 지납니다. 초소 경계병 3명을 제거하십시오.","총성이 들리면 나머지는 바위 뒤로 달아납니다. 빠르게."],intel:["경계병 3명, 470~515m","도주 경로: 좌우 바위 엄폐물","스코프로 1초 관측하면 표적이 식별(태그)됩니다"],newSkill:"표적 식별 · 우선순위 · 연속 사격",theme:"forest",timeOfDay:"dawn",atmosphere:{altitude:600,temperature:8},wind:{zones:[{from:0,speed:2.5,dir:60}],variability:.1},ammoTotal:12,timeLimit:0,targets:[{id:"b1",kind:"person",role:"guard",outfit:"guard",x:-6,dist:470,behavior:"idle",escape:[-30,482],required:!0,label:"경계병 A"},{id:"b2",kind:"person",role:"guard",outfit:"guard",x:2,dist:490,behavior:"idle",escape:[-30,488],required:!0,label:"경계병 B"},{id:"b3",kind:"person",role:"guard",outfit:"guard",x:9,dist:515,behavior:"idle",escape:[32,520],required:!0,label:"경계병 C"}],props:[{kind:"rock",x:-33,dist:485,w:5,h:2.6,d:4},{kind:"rock",x:35,dist:522,w:5,h:2.6,d:4},{kind:"sandbag",x:0,dist:496,w:4,h:.9,d:1},{kind:"tent",x:14,dist:505,w:4,h:2.2,d:4},{kind:"barrel",x:-3,dist:480,w:.6,h:.9,d:.6}],objectives:[ni,{type:"maxShots",value:3,label:"3발로 3명 제거 (1탄 1킬)"},{type:"headshots",value:1,label:"헤드샷 1회 이상"}],hints:[{text:"스코프로 사람을 1초간 관측하면 식별 태그가 붙습니다. 3명 모두 식별하세요.",until:"tag"},{text:"첫 발 이후 약 2초 뒤에 나머지가 달아납니다. 도주 경로가 긴 표적을 나중에 쏘세요.",until:"fire"}]},{id:"m5",codename:"작전: 회색 도로",name:"운반책",subtitle:"리드 사격 · 민간인 구별",category:"operation",briefing:["무기 운반책 두 명이 도로를 오갑니다. 갈색 재킷에 배낭을 멨습니다.","근처에 농부들이 있습니다. 민간인을 쏘면 작전은 즉시 중단됩니다."],intel:["운반책 2명: 갈색 재킷 · 배낭","민간인: 파란 셔츠 · 모자","탄이 날아가는 동안 표적도 걷습니다"],dossier:{name:"운반책 2명",alias:'"짐꾼"',summary:"국경 너머로 소형 무기를 나르는 운반책. 도로 끝에서 잠시 멈춘다.",features:["갈색 가죽 재킷","검은 배낭","도로 위를 좌우로 걸음"],outfit:"courier"},newSkill:"이동 표적 리드 · 민간인 구별",theme:"plains",timeOfDay:"overcast",atmosphere:{altitude:200,temperature:14},wind:{zones:[{from:0,speed:2,dir:120}],variability:.1},ammoTotal:12,timeLimit:0,targets:[{id:"b1",kind:"person",role:"hvt",outfit:"courier",x:-14,dist:560,behavior:"patrol",path:[[-14,560],[14,560]],pause:2,escape:[-45,570],required:!0,label:"운반책 A"},{id:"b2",kind:"person",role:"hvt",outfit:"courier",x:16,dist:640,behavior:"patrol",path:[[16,640],[-12,640]],pause:2,escape:[45,650],required:!0,label:"운반책 B"},{id:"c1",kind:"person",role:"civilian",outfit:"civilian",x:-28,dist:600,behavior:"idle",escape:[-60,610],required:!1,label:"농부"},{id:"c2",kind:"person",role:"civilian",outfit:"civilianRed",x:26,dist:590,behavior:"patrol",path:[[26,590],[34,600]],pause:4,escape:[60,600],required:!1,label:"농부"}],props:[{kind:"road",x:0,dist:560,w:120,h:.02,d:4},{kind:"road",x:0,dist:640,w:120,h:.02,d:4},{kind:"wall",x:-48,dist:570,w:6,h:2.2,d:1},{kind:"wall",x:48,dist:650,w:6,h:2.2,d:1},{kind:"truck",x:-38,dist:556,w:2.4,h:2.6,d:6,rot:90},{kind:"fence",x:-26,dist:606,w:14,h:1.1,d:.1},{kind:"crate",x:30,dist:596,w:1.2,h:.9,d:1.2}],objectives:[ni,si,{type:"headshots",value:1,label:"헤드샷 1회 이상"}],hints:[{text:"먼저 관측하세요. 갈색 재킷 = 운반책, 파란·빨간 셔츠 = 민간인입니다.",until:"tag"},{text:"리드(mil) ≈ 속도 × 비행시간 ÷ 거리 × 1000. 걷는 표적 600m ≈ 진행 방향으로 2mil.",until:"hit"}]},{id:"m6",codename:"작전: 백색 침묵",name:"소리 없이",subtitle:"소음기 · 아음속탄",category:"operation",briefing:["설원 야영지의 보초 네 명을 아무도 모르게 제거하십시오.","소음기와 아음속탄({ammo})을 함께 쓰면 총성이 거의 나지 않습니다. 대신 탄이 아주 많이 떨어집니다."],intel:["보초 4명, 290~340m","시신이 보이면 순찰병이 경보를 울립니다","아음속탄 300m 낙차 ≈ 15mil"],newSkill:"소음기 · 탄종 선택 · 큰 낙차 보정",theme:"snow",timeOfDay:"dusk",atmosphere:{altitude:900,temperature:-5},wind:{zones:[{from:0,speed:1.5,dir:270}],variability:.1},ammoTotal:15,timeLimit:0,weaponLock:"r308",targets:[{id:"b1",kind:"person",role:"guard",outfit:"guardSnow",x:-28,dist:290,behavior:"idle",escape:[-60,300],required:!0,label:"보초 A"},{id:"b2",kind:"person",role:"guard",outfit:"guardSnow",x:2,dist:305,behavior:"idle",escape:[-60,315],required:!0,label:"보초 B"},{id:"b3",kind:"person",role:"guard",outfit:"guardSnow",x:31,dist:300,behavior:"idle",escape:[65,312],required:!0,label:"보초 C"},{id:"b4",kind:"person",role:"guard",outfit:"guardSnow",x:6,dist:340,behavior:"patrol",path:[[-10,340],[22,340]],pause:3,escape:[65,350],required:!0,label:"순찰병 D"}],props:[{kind:"tent",x:-22,dist:296,w:4,h:2.2,d:4},{kind:"tent",x:9,dist:312,w:4,h:2.2,d:4},{kind:"tent",x:38,dist:306,w:4,h:2.2,d:4},{kind:"crate",x:-3,dist:300,w:1.2,h:1,d:1.2},{kind:"barrel",x:16,dist:300,w:.6,h:.9,d:.6},{kind:"jeep",x:-40,dist:320,w:2,h:1.8,d:4,rot:30},{kind:"rock",x:-63,dist:302,w:5,h:2.6,d:4},{kind:"rock",x:68,dist:330,w:5,h:3,d:6}],objectives:[ni,{type:"noAlert",label:"한 명도 경계시키지 않기"},si],hints:[{text:"{ammo} 로 아음속탄으로 바꾸세요. 탄도표도 함께 바뀝니다. (소음기는 브리핑에서 장착)",touchText:"[탄] 버튼으로 아음속탄으로 바꾸세요.",until:"ammo"},{text:"빗나간 탄이 표적 근처(20m)에 떨어지면 들킵니다. 순찰병이 시신을 보지 않게 순서를 정하세요.",until:"hit"}]},{id:"m7",codename:"작전: 철의 능선",name:"레이더 기지",subtitle:"구간별 바람 · 돌풍",category:"operation",briefing:["산악 레이더 기지의 경비 두 명을 제거해 공습로를 여십시오.","계곡 구간마다 바람이 다릅니다. 돌풍은 깃발이 먼저 알려줍니다."],intel:["근거리 3.5m/s · 중간 1.5m/s · 원거리 4.5m/s","돌풍: 약 9~15초 간격, 2초에 걸쳐 강해짐","탄은 먼 구간에서 느려져 바람을 더 오래 받습니다"],newSkill:"구간 바람 · 돌풍 타이밍",theme:"mountain",timeOfDay:"day",atmosphere:{altitude:1400,temperature:6},wind:{zones:[{from:0,speed:3.5,dir:90},{from:300,speed:1.5,dir:90},{from:560,speed:4.5,dir:60}],variability:.12,gusts:{intervalMin:9,intervalMax:15,strength:3,rise:2,hold:3,fall:2}},ammoTotal:12,timeLimit:0,targets:[{id:"b1",kind:"person",role:"guard",outfit:"guard",x:-10,dist:740,behavior:"idle",escape:[-42,750],required:!0,label:"경비 A"},{id:"b2",kind:"person",role:"guard",outfit:"guard",x:12,dist:815,behavior:"idle",escape:[45,820],required:!0,label:"경비 B"}],props:[{kind:"rock",x:-45,dist:752,w:6,h:3,d:5},{kind:"rock",x:48,dist:822,w:6,h:3,d:5},{kind:"radar",x:2,dist:790,w:6,h:9,d:6},{kind:"container",x:-18,dist:760,w:6,h:2.6,d:2.5,rot:10},{kind:"antenna",x:22,dist:808,w:1,h:14,d:1},{kind:"sandbag",x:12,dist:812,w:3.5,h:.9,d:1}],objectives:[ni,si,{type:"time",value:150,label:"150초 이내 완료"}],flagSpacing:130,hints:[{text:"가까운 깃발과 먼 깃발을 비교하세요. 먼 구간의 바람에 더 무게를 두세요.",until:"hit"}]},{id:"m8",codename:"작전: 마지막 계약",name:"1km",subtitle:"최종 암살",category:"operation",briefing:["무기상 빅토르 렌코가 1km 밖 저택 단지에 있습니다. 건물 사이를 오갈 때만 노출됩니다.","고지대(2200m)라 공기가 희박해 탄이 덜 떨어집니다. 150초 안에 끝내십시오."],intel:["표적: 흰 정장 · 붉은 넥타이 · 선글라스","경호원 2명(선택), 연구원 1명(민간인)","노출 → 건물 뒤 약 5초 정지 → 반대편으로 이동","비행시간 약 1.6초"],dossier:{name:"빅토르 렌코",alias:'"상인"',summary:"3개 대륙의 분쟁 지역에 무기를 공급한 밀매상. 이번이 유일한 기회다.",features:["흰 정장","붉은 넥타이","선글라스","경호원 없이 건물 사이를 걸음"],outfit:"hvtSuit"},newSkill:"종합: 고지대 · 장거리 · 노출 타이밍 · 표적 식별",theme:"mountain",timeOfDay:"dusk",atmosphere:{altitude:2200,temperature:4},wind:{zones:[{from:0,speed:2.5,dir:240},{from:500,speed:3.5,dir:260}],variability:.12,gusts:{intervalMin:12,intervalMax:18,strength:2,rise:2,hold:2,fall:2}},ammoTotal:10,timeLimit:150,targets:[{id:"vip",kind:"person",role:"hvt",outfit:"hvtSuit",x:-9,dist:1050,behavior:"patrol",path:[[-9,1050],[9,1050]],pause:5,escape:[-9,1062],required:!0,label:"빅토르 렌코"},{id:"g1",kind:"person",role:"guard",outfit:"guard",x:-14,dist:1045,behavior:"idle",escape:[-24,1060],required:!1,label:"경호원 A"},{id:"g2",kind:"person",role:"guard",outfit:"guard",x:14,dist:1046,behavior:"idle",escape:[24,1060],required:!1,label:"경호원 B"},{id:"c1",kind:"person",role:"civilian",outfit:"scientist",x:5,dist:1058,behavior:"idle",escape:[10,1066],required:!1,label:"연구원"}],props:[{kind:"building",x:-16,dist:1052,w:12,h:7,d:10},{kind:"building",x:16,dist:1052,w:12,h:9,d:10},{kind:"wall",x:0,dist:1064,w:10,h:3,d:1},{kind:"jeep",x:-26,dist:1044,w:2,h:1.8,d:4,rot:75},{kind:"barrel",x:7,dist:1044,w:.6,h:.9,d:.6},{kind:"antenna",x:18,dist:1050,w:1,h:16,d:1}],objectives:[ni,si,{type:"headshots",value:1,label:"헤드샷 1회 이상"}],flagSpacing:160,hints:[{text:"흰 정장의 표적을 찾아 관측하세요. 흰 가운은 연구원(민간인)입니다.",until:"tag"},{text:"렌코는 건물 뒤에서 약 5초 멈춘 뒤 다시 나옵니다. 나오기 직전에 보정을 끝내세요.",until:"hit"}]}];function Qo(s,t){const e=[];for(let i=100;i<=1500;i+=100){const n=Math.round((.3+i*6e-4)*100)/100;e.push({id:`r${i}`,kind:"plate",x:i/100%2===0?7:-7,dist:i,w:n,h:n,shape:"circle",required:!1,label:`${i}m`})}return{id:"range",codename:"훈련장",name:"사격장",subtitle:"자유 연습",category:"range",briefing:["100m부터 1500m까지 강철판이 놓여 있습니다.","바람을 직접 설정하고 탄도를 익히십시오."],newSkill:"자유 연습",theme:"plains",timeOfDay:"day",atmosphere:{altitude:100,temperature:15},wind:{zones:[{from:0,speed:s,dir:t}],variability:s>0?.06:0},ammoTotal:0,timeLimit:0,targets:e,props:[],objectives:[ni,si,si],isRange:!0,flagSpacing:200}}function ur(s){let t=s>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function tl(s=new Date){const t=s.getFullYear(),e=String(s.getMonth()+1).padStart(2,"0"),i=String(s.getDate()).padStart(2,"0");return`${t}-${e}-${i}`}const yh={plains:"guard",forest:"guard",mountain:"guard",desert:"guardDesert",snow:"guardSnow"},Sh=["카잔","베르크","도란","말코프","세라노","이바르","코스타","렌스키"];function bh(s){const t=Number(s.replace(/-/g,"")),e=ur(t),i=p=>p[Math.floor(e()*p.length)],r=i(["plains","desert","forest","snow","mountain"]),a=i(["day","dawn","dusk","overcast"]),o=Math.round(380+e()*420),l=Math.round((1+e()*3.5)*10)/10,c=i([60,90,120,240,270,300]),h=i(["hvtOfficer","hvtSuit"]),u=`${i(Sh)} ${i(["대령","중개인","사령관","회계사"])}`,d=[],f=[],m=e()<.45,v=Math.round((e()-.5)*24);d.push({id:"hvt",kind:"person",role:"hvt",outfit:h,x:v,dist:o,behavior:m?"patrol":"idle",path:m?[[v-10,o],[v+10,o]]:void 0,pause:2,escape:[v+(v<0?-30:30),o+8],required:!0,label:u}),f.push({kind:"rock",x:v+(v<0?-33:33),dist:o+10,w:5,h:2.6,d:4});const g=1+Math.floor(e()*2);for(let p=0;p<g;p++){const M=v+(p===0?-6:7)+Math.round((e()-.5)*4),x=o+Math.round((e()-.5)*20);d.push({id:`g${p}`,kind:"person",role:"guard",outfit:yh[r],x:M,dist:x,behavior:"idle",escape:[M+(M<v?-25:25),x+10],required:!1,label:`경호원 ${String.fromCharCode(65+p)}`})}if(e()<.6){const p=v+(e()<.5?-16:16);d.push({id:"c0",kind:"person",role:"civilian",outfit:i(["civilian","civilianRed","scientist"]),x:p,dist:o+6,behavior:"idle",required:!1,label:"민간인"})}return f.push({kind:i(["jeep","truck","container"]),x:v+4,dist:o+14,w:2.2,h:2.2,d:4.5,rot:Math.round(e()*180)}),f.push({kind:"sandbag",x:v-2,dist:o-4,w:3,h:.8,d:1}),{id:`daily-${s}`,codename:`계약 #${s.replace(/-/g,"").slice(2)}`,name:"일일 계약",subtitle:s,category:"contract",briefing:[`오늘의 계약 표적: ${u}.`,"경호원은 선택 사항, 민간인 사살 시 계약 파기. 점수: 거리 · 헤드샷 · 시간 · 명중률."],intel:[`예상 거리 약 ${Math.round(o/50)*50}m`,m?"표적이 이동 중":"표적이 정지해 있음"],dossier:{name:u,alias:'"계약 표적"',summary:"의뢰인이 지정한 표적. 매일 바뀐다.",features:h==="hvtOfficer"?["검은 제복","붉은 베레모"]:["흰 정장","붉은 넥타이","선글라스"],outfit:h},newSkill:"종합",theme:r,timeOfDay:a,atmosphere:{altitude:Math.round(100+e()*1500),temperature:Math.round(-5+e()*35)},wind:{zones:[{from:0,speed:l,dir:c}],variability:.12},ammoTotal:12,timeLimit:0,targets:d,props:f,objectives:[ni,si,{type:"headshots",value:1,label:"헤드샷 1회 이상"}]}}class wh{keys;codeToAction=new Map;down=new Set;virtualDown=new Set;pressedQueue=new Set;releasedQueue=new Set;lookX=0;lookY=0;zoomSteps=0;zoomFactor=1;_enabled=!1;enabledAt=0;pointerLocked=!1;isTouch;captureNext=null;el;disposers=[];onPointerLockChange=null;onKeyDown=null;constructor(t,e){this.el=t,this.keys=e,this.rebuild(),this.isTouch=typeof window<"u"&&(window.matchMedia?.("(pointer: coarse)").matches||"ontouchstart"in window),this.listen(window,"keydown",i=>this.handleKey(i,!0)),this.listen(window,"keyup",i=>this.handleKey(i,!1)),this.listen(t,"mousedown",i=>this.handleMouse(i,!0)),this.listen(window,"mouseup",i=>this.handleMouse(i,!1)),this.listen(window,"mousemove",i=>this.handleMove(i)),this.listen(t,"wheel",i=>this.handleWheel(i),{passive:!1}),this.listen(t,"contextmenu",i=>i.preventDefault()),this.listen(document,"pointerlockchange",()=>{this.pointerLocked=document.pointerLockElement===this.el,this.onPointerLockChange?.(this.pointerLocked)}),this.listen(window,"blur",()=>this.releaseAll())}get enabled(){return this._enabled}set enabled(t){t&&!this._enabled&&(this.enabledAt=performance.now()),this._enabled=t}listen(t,e,i,n){t.addEventListener(e,i,n),this.disposers.push(()=>t.removeEventListener(e,i,n))}dispose(){for(const t of this.disposers)t();this.disposers.length=0}setKeys(t){this.keys=t,this.rebuild()}rebuild(){this.codeToAction.clear();for(const[t,e]of Object.entries(this.keys))this.codeToAction.set(e,t);this.codeToAction.set("Escape","pause"),this.codeToAction.has("Space")||this.codeToAction.set("Space","breath")}captureKey(t){this.captureNext=t}cancelCapture(){this.captureNext=null}handleKey(t,e){if(this.captureNext&&e){t.preventDefault();const n=this.captureNext;this.captureNext=null,n(t.code);return}if(e&&this.onKeyDown?.(t.code,t))return;const i=this.codeToAction.get(t.code);i&&(this.enabled&&(t.code==="Tab"||t.code==="Space"||t.code.startsWith("Arrow"))&&t.preventDefault(),!t.repeat&&this.setAction(i,e))}handleMouse(t,e){const i=`Mouse${t.button}`;if(this.captureNext&&e){t.preventDefault();const r=this.captureNext;this.captureNext=null,r(i);return}const n=this.codeToAction.get(i);n&&(e&&!this.enabled||this.setAction(n,e))}handleMove(t){if(!this.enabled||performance.now()-this.enabledAt<150)return;const e=t.movementX||0,i=t.movementY||0;Math.abs(e)>400||Math.abs(i)>400||(this.lookX+=e,this.lookY+=i)}handleWheel(t){this.enabled&&(t.preventDefault(),this.zoomSteps+=t.deltaY<0?1:-1)}setAction(t,e){e?(this.down.has(t)||this.pressedQueue.add(t),this.down.add(t)):(this.down.has(t)&&this.releasedQueue.add(t),this.down.delete(t))}setVirtual(t,e){e?(this.isDown(t)||this.pressedQueue.add(t),this.virtualDown.add(t)):(this.virtualDown.has(t)&&!this.down.has(t)&&this.releasedQueue.add(t),this.virtualDown.delete(t))}tapVirtual(t){this.pressedQueue.add(t),this.releasedQueue.add(t)}addLook(t,e){this.lookX+=t,this.lookY+=e}isDown(t){return this.down.has(t)||this.virtualDown.has(t)}consumePressed(t){return this.pressedQueue.has(t)?(this.pressedQueue.delete(t),!0):!1}consumeReleased(t){return this.releasedQueue.has(t)?(this.releasedQueue.delete(t),!0):!1}endFrame(t=!0){this.lookX=0,this.lookY=0,t&&(this.pressedQueue.clear(),this.releasedQueue.clear(),this.zoomSteps=0,this.zoomFactor=1)}releaseAll(){for(const t of this.down)this.releasedQueue.add(t);for(const t of this.virtualDown)this.releasedQueue.add(t);this.down.clear(),this.virtualDown.clear()}requestPointerLock(){if(!this.isTouch)try{const t=this.el.requestPointerLock();t&&typeof t.catch=="function"&&t.catch(()=>{})}catch{}}exitPointerLock(){document.pointerLockElement&&document.exitPointerLock()}keyLabel(t){return Ea(this.keys[t])}}function Ea(s){if(!s)return"없음";const t={Mouse0:"좌클릭",Mouse1:"휠클릭",Mouse2:"우클릭",Mouse3:"마우스4",Mouse4:"마우스5",ShiftLeft:"Shift",ShiftRight:"오른쪽 Shift",ControlLeft:"Ctrl",ControlRight:"오른쪽 Ctrl",AltLeft:"Alt",Space:"Space",Tab:"Tab",Escape:"Esc",Enter:"Enter",Backspace:"Backspace",ArrowUp:"↑",ArrowDown:"↓",ArrowLeft:"←",ArrowRight:"→"};return t[s]?t[s]:s.startsWith("Key")?s.slice(3):s.startsWith("Digit")?s.slice(5):s.startsWith("Numpad")?`Num${s.slice(6)}`:s}const Ir={fire:"발사",scope:"스코프",breath:"숨 참기",zoomIn:"배율 +",zoomOut:"배율 −",elevUp:"고각 ▲",elevDown:"고각 ▼",windLeft:"좌우 ◀ (L)",windRight:"좌우 ▶ (R)",turretReset:"터렛 초기화",rangefinder:"거리측정기",dope:"탄도표",ammo:"탄종 변경",pause:"일시정지",restart:"재시작(길게)"},yc={fire:"Mouse0",scope:"Mouse2",breath:"ShiftLeft",zoomIn:"KeyE",zoomOut:"KeyQ",elevUp:"KeyW",elevDown:"KeyS",windLeft:"KeyA",windRight:"KeyD",turretReset:"KeyZ",rangefinder:"KeyF",dope:"Tab",ammo:"KeyX",pause:"KeyP",restart:"KeyR"},Ur="longshot.save",Sc=1;function Th(){return{masterVolume:.8,sfxVolume:.9,musicVolume:.45,muted:!1,mouseSensitivity:1,scopedSensitivity:1,touchSensitivity:1,invertY:!1,reticleColor:"black",breathMode:"hold",scopeMode:"toggle",bulletCam:"final",reduceFlashes:!1,screenShake:!0,quality:"auto",showHints:!0,difficulty:"recruit",weapon:"r308",suppressor:!1,keys:{...yc}}}function bc(){return{missions:{},daily:{},stats:{shots:0,hits:0,kills:0,headshots:0,longestHit:0,playSeconds:0},firstRun:!0}}function rs(){return{version:Sc,settings:Th(),progress:bc()}}function ls(s,t){if(s===null||typeof s!="object")return typeof t==typeof s&&(typeof t!="number"||Number.isFinite(t))?t:s;if(Array.isArray(s))return!Array.isArray(t)||t.length!==s.length?s:s.map((i,n)=>ls(i,t[n]));if(!t||typeof t!="object"||Array.isArray(t))return s;const e={};for(const i of Object.keys(s))e[i]=ls(s[i],t[i]);return e}function Nr(s){return Math.min(1,Math.max(0,s))}function Eh(s){const t=rs();if(!s||typeof s!="object")return t;const e=s,i=ls(t.settings,e.settings);i.masterVolume=Nr(i.masterVolume),i.sfxVolume=Nr(i.sfxVolume),i.musicVolume=Nr(i.musicVolume),i.mouseSensitivity=Math.min(3,Math.max(.2,i.mouseSensitivity)),i.scopedSensitivity=Math.min(3,Math.max(.2,i.scopedSensitivity)),i.touchSensitivity=Math.min(3,Math.max(.2,i.touchSensitivity)),["recruit","marksman","expert"].includes(i.difficulty)||(i.difficulty="recruit"),["black","red","lime","white"].includes(i.reticleColor)||(i.reticleColor="black"),["auto","high","medium","low"].includes(i.quality)||(i.quality="auto"),["always","final","off"].includes(i.bulletCam)||(i.bulletCam="final"),["hold","toggle"].includes(i.breathMode)||(i.breathMode="hold"),["hold","toggle"].includes(i.scopeMode)||(i.scopeMode="toggle");const n=ls({...t.progress,missions:{},daily:{}},e.progress),r=e.progress?.missions;if(r&&typeof r=="object")for(const[o,l]of Object.entries(r)){n.missions[o]=ls({stars:[!1,!1,!1],bestTime:0,cleared:!1},l);const c=l?.bestTime;n.missions[o].bestTime=typeof c=="number"&&Number.isFinite(c)&&c>0?c:null}const a=e.progress?.daily;if(a&&typeof a=="object")for(const[o,l]of Object.entries(a))typeof l=="number"&&Number.isFinite(l)&&(n.daily[o]=l);return{version:Sc,settings:i,progress:n}}class wo{data;loadWarning=null;storage;constructor(t){this.storage=t===void 0?wo.probe():t,this.data=this.load()}static probe(){try{const t=window.localStorage;return t.setItem("__ls_probe","1"),t.getItem("__ls_probe"),t}catch{return null}}load(){if(!this.storage)return this.loadWarning="브라우저 저장소를 사용할 수 없어 기록이 저장되지 않습니다.",rs();let t=null;try{t=this.storage.getItem(Ur)}catch{return rs()}if(!t)return rs();try{const e=JSON.parse(t);return Eh(e)}catch{try{this.storage.setItem(`${Ur}.corrupt`,t)}catch{}return this.loadWarning="저장 데이터가 손상되어 초기화했습니다. (손상된 데이터는 백업됨)",rs()}}save(){if(this.storage)try{this.storage.setItem(Ur,JSON.stringify(this.data))}catch{}}totalStars(){let t=0;for(const e of Object.values(this.data.progress.missions))t+=e.stars.filter(Boolean).length;return t}resetProgress(){this.data.progress=bc(),this.data.progress.firstRun=!1,this.save()}}/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const To="170",Ah=0,el=1,Rh=2,wc=1,Ch=2,_i=3,Oi=0,Te=1,Be=2,Ui=0,Pn=1,Aa=2,il=3,nl=4,Ph=5,Ki=100,Lh=101,Dh=102,Ih=103,Uh=104,Nh=200,Fh=201,Oh=202,zh=203,Ra=204,Ca=205,kh=206,Bh=207,Hh=208,Vh=209,Gh=210,Wh=211,$h=212,Xh=213,qh=214,Pa=0,La=1,Da=2,In=3,Ia=4,Ua=5,Na=6,Fa=7,Eo=0,Yh=1,Kh=2,Ni=0,jh=1,Zh=2,Jh=3,Ao=4,Qh=5,tu=6,eu=7,Tc=300,Un=301,Nn=302,Oa=303,za=304,Er=306,ka=1e3,Zi=1001,Ba=1002,Ne=1003,iu=1004,ys=1005,oi=1006,Fr=1007,Ji=1008,Si=1009,Ec=1010,Ac=1011,ps=1012,Ro=1013,Qi=1014,li=1015,gs=1016,Co=1017,Po=1018,Fn=1020,Rc=35902,Cc=1021,Pc=1022,je=1023,Lc=1024,Dc=1025,Ln=1026,On=1027,Lo=1028,Do=1029,Ic=1030,Io=1031,Uo=1033,er=33776,ir=33777,nr=33778,sr=33779,Ha=35840,Va=35841,Ga=35842,Wa=35843,$a=36196,Xa=37492,qa=37496,Ya=37808,Ka=37809,ja=37810,Za=37811,Ja=37812,Qa=37813,to=37814,eo=37815,io=37816,no=37817,so=37818,ro=37819,ao=37820,oo=37821,rr=36492,lo=36494,co=36495,Uc=36283,ho=36284,uo=36285,fo=36286,nu=3200,su=3201,No=0,ru=1,Ii="",Ce="srgb",Bn="srgb-linear",Ar="linear",Jt="srgb",sn=7680,sl=519,au=512,ou=513,lu=514,Nc=515,cu=516,hu=517,uu=518,du=519,po=35044,rl="300 es",xi=2e3,dr=2001;class Hn{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(e)===-1&&i[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const i=this._listeners;return i[t]!==void 0&&i[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const n=this._listeners[t];if(n!==void 0){const r=n.indexOf(e);r!==-1&&n.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const i=this._listeners[t.type];if(i!==void 0){t.target=this;const n=i.slice(0);for(let r=0,a=n.length;r<a;r++)n[r].call(this,t);t.target=null}}}const ye=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Or=Math.PI/180,mo=180/Math.PI;function Fi(){const s=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(ye[s&255]+ye[s>>8&255]+ye[s>>16&255]+ye[s>>24&255]+"-"+ye[t&255]+ye[t>>8&255]+"-"+ye[t>>16&15|64]+ye[t>>24&255]+"-"+ye[e&63|128]+ye[e>>8&255]+"-"+ye[e>>16&255]+ye[e>>24&255]+ye[i&255]+ye[i>>8&255]+ye[i>>16&255]+ye[i>>24&255]).toLowerCase()}function _e(s,t,e){return Math.max(t,Math.min(e,s))}function fu(s,t){return(s%t+t)%t}function zr(s,t,e){return(1-e)*s+e*t}function ai(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Qt(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}class ot{constructor(t=0,e=0){ot.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,i=this.y,n=t.elements;return this.x=n[0]*e+n[3]*i+n[6],this.y=n[1]*e+n[4]*i+n[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const i=this.dot(t)/e;return Math.acos(_e(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,i=this.y-t.y;return e*e+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const i=Math.cos(e),n=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*i-a*n+t.x,this.y=r*n+a*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Nt{constructor(t,e,i,n,r,a,o,l,c){Nt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,i,n,r,a,o,l,c)}set(t,e,i,n,r,a,o,l,c){const h=this.elements;return h[0]=t,h[1]=n,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=i,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],this}extractBasis(t,e,i){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const i=t.elements,n=e.elements,r=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],h=i[4],u=i[7],d=i[2],f=i[5],m=i[8],v=n[0],g=n[3],p=n[6],M=n[1],x=n[4],_=n[7],C=n[2],E=n[5],A=n[8];return r[0]=a*v+o*M+l*C,r[3]=a*g+o*x+l*E,r[6]=a*p+o*_+l*A,r[1]=c*v+h*M+u*C,r[4]=c*g+h*x+u*E,r[7]=c*p+h*_+u*A,r[2]=d*v+f*M+m*C,r[5]=d*g+f*x+m*E,r[8]=d*p+f*_+m*A,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-i*r*h+i*o*l+n*r*c-n*a*l}invert(){const t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,d=o*l-h*r,f=c*r-a*l,m=e*u+i*d+n*f;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/m;return t[0]=u*v,t[1]=(n*c-h*i)*v,t[2]=(o*i-n*a)*v,t[3]=d*v,t[4]=(h*e-n*l)*v,t[5]=(n*r-o*e)*v,t[6]=f*v,t[7]=(i*l-c*e)*v,t[8]=(a*e-i*r)*v,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,i,n,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*a+c*o)+a+t,-n*c,n*l,-n*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(kr.makeScale(t,e)),this}rotate(t){return this.premultiply(kr.makeRotation(-t)),this}translate(t,e){return this.premultiply(kr.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,i,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,i=t.elements;for(let n=0;n<9;n++)if(e[n]!==i[n])return!1;return!0}fromArray(t,e=0){for(let i=0;i<9;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){const i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const kr=new Nt;function Fc(s){for(let t=s.length-1;t>=0;--t)if(s[t]>=65535)return!0;return!1}function fr(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function pu(){const s=fr("canvas");return s.style.display="block",s}const al={};function as(s){s in al||(al[s]=!0,console.warn(s))}function mu(s,t,e){return new Promise(function(i,n){function r(){switch(s.clientWaitSync(t,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:n();break;case s.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:i()}}setTimeout(r,e)})}function gu(s){const t=s.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function vu(s){const t=s.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const Xt={enabled:!0,workingColorSpace:Bn,spaces:{},convert:function(s,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===Jt&&(s.r=Mi(s.r),s.g=Mi(s.g),s.b=Mi(s.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(s.applyMatrix3(this.spaces[t].toXYZ),s.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===Jt&&(s.r=Dn(s.r),s.g=Dn(s.g),s.b=Dn(s.b))),s},fromWorkingColorSpace:function(s,t){return this.convert(s,this.workingColorSpace,t)},toWorkingColorSpace:function(s,t){return this.convert(s,t,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Ii?Ar:this.spaces[s].transfer},getLuminanceCoefficients:function(s,t=this.workingColorSpace){return s.fromArray(this.spaces[t].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,t,e){return s.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace}};function Mi(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function Dn(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}const ol=[.64,.33,.3,.6,.15,.06],ll=[.2126,.7152,.0722],cl=[.3127,.329],hl=new Nt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ul=new Nt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Xt.define({[Bn]:{primaries:ol,whitePoint:cl,transfer:Ar,toXYZ:hl,fromXYZ:ul,luminanceCoefficients:ll,workingColorSpaceConfig:{unpackColorSpace:Ce},outputColorSpaceConfig:{drawingBufferColorSpace:Ce}},[Ce]:{primaries:ol,whitePoint:cl,transfer:Jt,toXYZ:hl,fromXYZ:ul,luminanceCoefficients:ll,outputColorSpaceConfig:{drawingBufferColorSpace:Ce}}});let rn;class _u{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{rn===void 0&&(rn=fr("canvas")),rn.width=t.width,rn.height=t.height;const i=rn.getContext("2d");t instanceof ImageData?i.putImageData(t,0,0):i.drawImage(t,0,0,t.width,t.height),e=rn}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=fr("canvas");e.width=t.width,e.height=t.height;const i=e.getContext("2d");i.drawImage(t,0,0,t.width,t.height);const n=i.getImageData(0,0,t.width,t.height),r=n.data;for(let a=0;a<r.length;a++)r[a]=Mi(r[a]/255)*255;return i.putImageData(n,0,0),e}else if(t.data){const e=t.data.slice(0);for(let i=0;i<e.length;i++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[i]=Math.floor(Mi(e[i]/255)*255):e[i]=Mi(e[i]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let xu=0;class Oc{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:xu++}),this.uuid=Fi(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const i={uuid:this.uuid,url:""},n=this.data;if(n!==null){let r;if(Array.isArray(n)){r=[];for(let a=0,o=n.length;a<o;a++)n[a].isDataTexture?r.push(Br(n[a].image)):r.push(Br(n[a]))}else r=Br(n);i.url=r}return e||(t.images[this.uuid]=i),i}}function Br(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?_u.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Mu=0;class Ee extends Hn{constructor(t=Ee.DEFAULT_IMAGE,e=Ee.DEFAULT_MAPPING,i=Zi,n=Zi,r=oi,a=Ji,o=je,l=Si,c=Ee.DEFAULT_ANISOTROPY,h=Ii){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Mu++}),this.uuid=Fi(),this.name="",this.source=new Oc(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=i,this.wrapT=n,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new ot(0,0),this.repeat=new ot(1,1),this.center=new ot(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Nt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const i={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),e||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Tc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case ka:t.x=t.x-Math.floor(t.x);break;case Zi:t.x=t.x<0?0:1;break;case Ba:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case ka:t.y=t.y-Math.floor(t.y);break;case Zi:t.y=t.y<0?0:1;break;case Ba:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}Ee.DEFAULT_IMAGE=null;Ee.DEFAULT_MAPPING=Tc;Ee.DEFAULT_ANISOTROPY=1;class te{constructor(t=0,e=0,i=0,n=1){te.prototype.isVector4=!0,this.x=t,this.y=e,this.z=i,this.w=n}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,i,n){return this.x=t,this.y=e,this.z=i,this.w=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,i=this.y,n=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*i+a[8]*n+a[12]*r,this.y=a[1]*e+a[5]*i+a[9]*n+a[13]*r,this.z=a[2]*e+a[6]*i+a[10]*n+a[14]*r,this.w=a[3]*e+a[7]*i+a[11]*n+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,i,n,r;const l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],f=l[5],m=l[9],v=l[2],g=l[6],p=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-v)<.01&&Math.abs(m-g)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+v)<.1&&Math.abs(m+g)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const x=(c+1)/2,_=(f+1)/2,C=(p+1)/2,E=(h+d)/4,A=(u+v)/4,P=(m+g)/4;return x>_&&x>C?x<.01?(i=0,n=.707106781,r=.707106781):(i=Math.sqrt(x),n=E/i,r=A/i):_>C?_<.01?(i=.707106781,n=0,r=.707106781):(n=Math.sqrt(_),i=E/n,r=P/n):C<.01?(i=.707106781,n=.707106781,r=0):(r=Math.sqrt(C),i=A/r,n=P/r),this.set(i,n,r,e),this}let M=Math.sqrt((g-m)*(g-m)+(u-v)*(u-v)+(d-h)*(d-h));return Math.abs(M)<.001&&(M=1),this.x=(g-m)/M,this.y=(u-v)/M,this.z=(d-h)/M,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this.w=t.w+(e.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class yu extends Hn{constructor(t=1,e=1,i={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new te(0,0,t,e),this.scissorTest=!1,this.viewport=new te(0,0,t,e);const n={width:t,height:e,depth:1};i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:oi,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},i);const r=new Ee(n,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.colorSpace);r.flipY=!1,r.generateMipmaps=i.generateMipmaps,r.internalFormat=i.internalFormat,this.textures=[];const a=i.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.depthTexture=i.depthTexture,this.samples=i.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,i=1){if(this.width!==t||this.height!==e||this.depth!==i){this.width=t,this.height=e,this.depth=i;for(let n=0,r=this.textures.length;n<r;n++)this.textures[n].image.width=t,this.textures[n].image.height=e,this.textures[n].image.depth=i;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let i=0,n=t.textures.length;i<n;i++)this.textures[i]=t.textures[i].clone(),this.textures[i].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new Oc(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class tn extends yu{constructor(t=1,e=1,i={}){super(t,e,i),this.isWebGLRenderTarget=!0}}class zc extends Ee{constructor(t=null,e=1,i=1,n=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:i,depth:n},this.magFilter=Ne,this.minFilter=Ne,this.wrapR=Zi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class Su extends Ee{constructor(t=null,e=1,i=1,n=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:i,depth:n},this.magFilter=Ne,this.minFilter=Ne,this.wrapR=Zi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ze{constructor(t=0,e=0,i=0,n=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=i,this._w=n}static slerpFlat(t,e,i,n,r,a,o){let l=i[n+0],c=i[n+1],h=i[n+2],u=i[n+3];const d=r[a+0],f=r[a+1],m=r[a+2],v=r[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=f,t[e+2]=m,t[e+3]=v;return}if(u!==v||l!==d||c!==f||h!==m){let g=1-o;const p=l*d+c*f+h*m+u*v,M=p>=0?1:-1,x=1-p*p;if(x>Number.EPSILON){const C=Math.sqrt(x),E=Math.atan2(C,p*M);g=Math.sin(g*E)/C,o=Math.sin(o*E)/C}const _=o*M;if(l=l*g+d*_,c=c*g+f*_,h=h*g+m*_,u=u*g+v*_,g===1-o){const C=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=C,c*=C,h*=C,u*=C}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,i,n,r,a){const o=i[n],l=i[n+1],c=i[n+2],h=i[n+3],u=r[a],d=r[a+1],f=r[a+2],m=r[a+3];return t[e]=o*m+h*u+l*f-c*d,t[e+1]=l*m+h*d+c*u-o*f,t[e+2]=c*m+h*f+o*d-l*u,t[e+3]=h*m-o*u-l*d-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,i,n){return this._x=t,this._y=e,this._z=i,this._w=n,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const i=t._x,n=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(i/2),h=o(n/2),u=o(r/2),d=l(i/2),f=l(n/2),m=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*f*m,this._y=c*f*u-d*h*m,this._z=c*h*m+d*f*u,this._w=c*h*u-d*f*m;break;case"YXZ":this._x=d*h*u+c*f*m,this._y=c*f*u-d*h*m,this._z=c*h*m-d*f*u,this._w=c*h*u+d*f*m;break;case"ZXY":this._x=d*h*u-c*f*m,this._y=c*f*u+d*h*m,this._z=c*h*m+d*f*u,this._w=c*h*u-d*f*m;break;case"ZYX":this._x=d*h*u-c*f*m,this._y=c*f*u+d*h*m,this._z=c*h*m-d*f*u,this._w=c*h*u+d*f*m;break;case"YZX":this._x=d*h*u+c*f*m,this._y=c*f*u+d*h*m,this._z=c*h*m-d*f*u,this._w=c*h*u-d*f*m;break;case"XZY":this._x=d*h*u-c*f*m,this._y=c*f*u-d*h*m,this._z=c*h*m+d*f*u,this._w=c*h*u+d*f*m;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const i=e/2,n=Math.sin(i);return this._x=t.x*n,this._y=t.y*n,this._z=t.z*n,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,i=e[0],n=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=i+o+u;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(a-n)*f}else if(i>o&&i>u){const f=2*Math.sqrt(1+i-o-u);this._w=(h-l)/f,this._x=.25*f,this._y=(n+a)/f,this._z=(r+c)/f}else if(o>u){const f=2*Math.sqrt(1+o-i-u);this._w=(r-c)/f,this._x=(n+a)/f,this._y=.25*f,this._z=(l+h)/f}else{const f=2*Math.sqrt(1+u-i-o);this._w=(a-n)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let i=t.dot(e)+1;return i<Number.EPSILON?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(_e(this.dot(t),-1,1)))}rotateTowards(t,e){const i=this.angleTo(t);if(i===0)return this;const n=Math.min(1,e/i);return this.slerp(t,n),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const i=t._x,n=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=i*h+a*o+n*c-r*l,this._y=n*h+a*l+r*o-i*c,this._z=r*h+a*c+i*l-n*o,this._w=a*h-i*o-n*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const i=this._x,n=this._y,r=this._z,a=this._w;let o=a*t._w+i*t._x+n*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=i,this._y=n,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const f=1-e;return this._w=f*a+e*this._w,this._x=f*i+e*this._x,this._y=f*n+e*this._y,this._z=f*r+e*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=a*u+this._w*d,this._x=i*u+this._x*d,this._y=n*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,i){return this.copy(t).slerp(e,i)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),i=Math.random(),n=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(n*Math.sin(t),n*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class T{constructor(t=0,e=0,i=0){T.prototype.isVector3=!0,this.x=t,this.y=e,this.z=i}set(t,e,i){return i===void 0&&(i=this.z),this.x=t,this.y=e,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(dl.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(dl.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,i=this.y,n=this.z,r=t.elements;return this.x=r[0]*e+r[3]*i+r[6]*n,this.y=r[1]*e+r[4]*i+r[7]*n,this.z=r[2]*e+r[5]*i+r[8]*n,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,i=this.y,n=this.z,r=t.elements,a=1/(r[3]*e+r[7]*i+r[11]*n+r[15]);return this.x=(r[0]*e+r[4]*i+r[8]*n+r[12])*a,this.y=(r[1]*e+r[5]*i+r[9]*n+r[13])*a,this.z=(r[2]*e+r[6]*i+r[10]*n+r[14])*a,this}applyQuaternion(t){const e=this.x,i=this.y,n=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*n-o*i),h=2*(o*e-r*n),u=2*(r*i-a*e);return this.x=e+l*c+a*u-o*h,this.y=i+l*h+o*c-r*u,this.z=n+l*u+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,i=this.y,n=this.z,r=t.elements;return this.x=r[0]*e+r[4]*i+r[8]*n,this.y=r[1]*e+r[5]*i+r[9]*n,this.z=r[2]*e+r[6]*i+r[10]*n,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const i=t.x,n=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=n*l-r*o,this.y=r*a-i*l,this.z=i*o-n*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const i=t.dot(this)/e;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return Hr.copy(this).projectOnVector(t),this.sub(Hr)}reflect(t){return this.sub(Hr.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const i=this.dot(t)/e;return Math.acos(_e(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,i=this.y-t.y,n=this.z-t.z;return e*e+i*i+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,i){const n=Math.sin(e)*t;return this.x=n*Math.sin(i),this.y=Math.cos(e)*t,this.z=n*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,i){return this.x=t*Math.sin(e),this.y=i,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),n=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=i,this.z=n,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,i=Math.sqrt(1-e*e);return this.x=i*Math.cos(t),this.y=e,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Hr=new T,dl=new Ze;class en{constructor(t=new T(1/0,1/0,1/0),e=new T(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e+=3)this.expandByPoint(qe.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,i=t.count;e<i;e++)this.expandByPoint(qe.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const i=qe.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const i=t.geometry;if(i!==void 0){const r=i.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,qe):qe.fromBufferAttribute(r,a),qe.applyMatrix4(t.matrixWorld),this.expandByPoint(qe);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Ss.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),Ss.copy(i.boundingBox)),Ss.applyMatrix4(t.matrixWorld),this.union(Ss)}const n=t.children;for(let r=0,a=n.length;r<a;r++)this.expandByObject(n[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,qe),qe.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,i;return t.normal.x>0?(e=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),e<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Xn),bs.subVectors(this.max,Xn),an.subVectors(t.a,Xn),on.subVectors(t.b,Xn),ln.subVectors(t.c,Xn),Ti.subVectors(on,an),Ei.subVectors(ln,on),Hi.subVectors(an,ln);let e=[0,-Ti.z,Ti.y,0,-Ei.z,Ei.y,0,-Hi.z,Hi.y,Ti.z,0,-Ti.x,Ei.z,0,-Ei.x,Hi.z,0,-Hi.x,-Ti.y,Ti.x,0,-Ei.y,Ei.x,0,-Hi.y,Hi.x,0];return!Vr(e,an,on,ln,bs)||(e=[1,0,0,0,1,0,0,0,1],!Vr(e,an,on,ln,bs))?!1:(ws.crossVectors(Ti,Ei),e=[ws.x,ws.y,ws.z],Vr(e,an,on,ln,bs))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,qe).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(qe).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(di[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),di[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),di[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),di[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),di[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),di[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),di[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),di[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(di),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const di=[new T,new T,new T,new T,new T,new T,new T,new T],qe=new T,Ss=new en,an=new T,on=new T,ln=new T,Ti=new T,Ei=new T,Hi=new T,Xn=new T,bs=new T,ws=new T,Vi=new T;function Vr(s,t,e,i,n){for(let r=0,a=s.length-3;r<=a;r+=3){Vi.fromArray(s,r);const o=n.x*Math.abs(Vi.x)+n.y*Math.abs(Vi.y)+n.z*Math.abs(Vi.z),l=t.dot(Vi),c=e.dot(Vi),h=i.dot(Vi);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const bu=new en,qn=new T,Gr=new T;class Vn{constructor(t=new T,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const i=this.center;e!==void 0?i.copy(e):bu.setFromPoints(t).getCenter(i);let n=0;for(let r=0,a=t.length;r<a;r++)n=Math.max(n,i.distanceToSquared(t[r]));return this.radius=Math.sqrt(n),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const i=this.center.distanceToSquared(t);return e.copy(t),i>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;qn.subVectors(t,this.center);const e=qn.lengthSq();if(e>this.radius*this.radius){const i=Math.sqrt(e),n=(i-this.radius)*.5;this.center.addScaledVector(qn,n/i),this.radius+=n}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Gr.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(qn.copy(t.center).add(Gr)),this.expandByPoint(qn.copy(t.center).sub(Gr))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const fi=new T,Wr=new T,Ts=new T,Ai=new T,$r=new T,Es=new T,Xr=new T;class kc{constructor(t=new T,e=new T(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,fi)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const i=e.dot(this.direction);return i<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=fi.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(fi.copy(this.origin).addScaledVector(this.direction,e),fi.distanceToSquared(t))}distanceSqToSegment(t,e,i,n){Wr.copy(t).add(e).multiplyScalar(.5),Ts.copy(e).sub(t).normalize(),Ai.copy(this.origin).sub(Wr);const r=t.distanceTo(e)*.5,a=-this.direction.dot(Ts),o=Ai.dot(this.direction),l=-Ai.dot(Ts),c=Ai.lengthSq(),h=Math.abs(1-a*a);let u,d,f,m;if(h>0)if(u=a*l-o,d=a*o-l,m=r*h,u>=0)if(d>=-m)if(d<=m){const v=1/h;u*=v,d*=v,f=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;else d<=-m?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c):d<=m?(u=0,d=Math.min(Math.max(-r,-l),r),f=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,u),n&&n.copy(Wr).addScaledVector(Ts,d),f}intersectSphere(t,e){fi.subVectors(t.center,this.origin);const i=fi.dot(this.direction),n=fi.dot(fi)-i*i,r=t.radius*t.radius;if(n>r)return null;const a=Math.sqrt(r-n),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(t.normal)+t.constant)/e;return i>=0?i:null}intersectPlane(t,e){const i=this.distanceToPlane(t);return i===null?null:this.at(i,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let i,n,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(i=(t.min.x-d.x)*c,n=(t.max.x-d.x)*c):(i=(t.max.x-d.x)*c,n=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),i>a||r>n||((r>i||isNaN(i))&&(i=r),(a<n||isNaN(n))&&(n=a),u>=0?(o=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),i>l||o>n)||((o>i||i!==i)&&(i=o),(l<n||n!==n)&&(n=l),n<0)?null:this.at(i>=0?i:n,e)}intersectsBox(t){return this.intersectBox(t,fi)!==null}intersectTriangle(t,e,i,n,r){$r.subVectors(e,t),Es.subVectors(i,t),Xr.crossVectors($r,Es);let a=this.direction.dot(Xr),o;if(a>0){if(n)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Ai.subVectors(this.origin,t);const l=o*this.direction.dot(Es.crossVectors(Ai,Es));if(l<0)return null;const c=o*this.direction.dot($r.cross(Ai));if(c<0||l+c>a)return null;const h=-o*Ai.dot(Xr);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Yt{constructor(t,e,i,n,r,a,o,l,c,h,u,d,f,m,v,g){Yt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,i,n,r,a,o,l,c,h,u,d,f,m,v,g)}set(t,e,i,n,r,a,o,l,c,h,u,d,f,m,v,g){const p=this.elements;return p[0]=t,p[4]=e,p[8]=i,p[12]=n,p[1]=r,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=h,p[10]=u,p[14]=d,p[3]=f,p[7]=m,p[11]=v,p[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Yt().fromArray(this.elements)}copy(t){const e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],e[9]=i[9],e[10]=i[10],e[11]=i[11],e[12]=i[12],e[13]=i[13],e[14]=i[14],e[15]=i[15],this}copyPosition(t){const e=this.elements,i=t.elements;return e[12]=i[12],e[13]=i[13],e[14]=i[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,i){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(t,e,i){return this.set(t.x,e.x,i.x,0,t.y,e.y,i.y,0,t.z,e.z,i.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,i=t.elements,n=1/cn.setFromMatrixColumn(t,0).length(),r=1/cn.setFromMatrixColumn(t,1).length(),a=1/cn.setFromMatrixColumn(t,2).length();return e[0]=i[0]*n,e[1]=i[1]*n,e[2]=i[2]*n,e[3]=0,e[4]=i[4]*r,e[5]=i[5]*r,e[6]=i[6]*r,e[7]=0,e[8]=i[8]*a,e[9]=i[9]*a,e[10]=i[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,i=t.x,n=t.y,r=t.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(n),c=Math.sin(n),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=a*h,f=a*u,m=o*h,v=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=f+m*c,e[5]=d-v*c,e[9]=-o*l,e[2]=v-d*c,e[6]=m+f*c,e[10]=a*l}else if(t.order==="YXZ"){const d=l*h,f=l*u,m=c*h,v=c*u;e[0]=d+v*o,e[4]=m*o-f,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=f*o-m,e[6]=v+d*o,e[10]=a*l}else if(t.order==="ZXY"){const d=l*h,f=l*u,m=c*h,v=c*u;e[0]=d-v*o,e[4]=-a*u,e[8]=m+f*o,e[1]=f+m*o,e[5]=a*h,e[9]=v-d*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const d=a*h,f=a*u,m=o*h,v=o*u;e[0]=l*h,e[4]=m*c-f,e[8]=d*c+v,e[1]=l*u,e[5]=v*c+d,e[9]=f*c-m,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const d=a*l,f=a*c,m=o*l,v=o*c;e[0]=l*h,e[4]=v-d*u,e[8]=m*u+f,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=f*u+m,e[10]=d-v*u}else if(t.order==="XZY"){const d=a*l,f=a*c,m=o*l,v=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+v,e[5]=a*h,e[9]=f*u-m,e[2]=m*u-f,e[6]=o*h,e[10]=v*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(wu,t,Tu)}lookAt(t,e,i){const n=this.elements;return Ie.subVectors(t,e),Ie.lengthSq()===0&&(Ie.z=1),Ie.normalize(),Ri.crossVectors(i,Ie),Ri.lengthSq()===0&&(Math.abs(i.z)===1?Ie.x+=1e-4:Ie.z+=1e-4,Ie.normalize(),Ri.crossVectors(i,Ie)),Ri.normalize(),As.crossVectors(Ie,Ri),n[0]=Ri.x,n[4]=As.x,n[8]=Ie.x,n[1]=Ri.y,n[5]=As.y,n[9]=Ie.y,n[2]=Ri.z,n[6]=As.z,n[10]=Ie.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const i=t.elements,n=e.elements,r=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],h=i[1],u=i[5],d=i[9],f=i[13],m=i[2],v=i[6],g=i[10],p=i[14],M=i[3],x=i[7],_=i[11],C=i[15],E=n[0],A=n[4],P=n[8],b=n[12],y=n[1],L=n[5],k=n[9],z=n[13],X=n[2],Y=n[6],W=n[10],V=n[14],O=n[3],J=n[7],it=n[11],dt=n[15];return r[0]=a*E+o*y+l*X+c*O,r[4]=a*A+o*L+l*Y+c*J,r[8]=a*P+o*k+l*W+c*it,r[12]=a*b+o*z+l*V+c*dt,r[1]=h*E+u*y+d*X+f*O,r[5]=h*A+u*L+d*Y+f*J,r[9]=h*P+u*k+d*W+f*it,r[13]=h*b+u*z+d*V+f*dt,r[2]=m*E+v*y+g*X+p*O,r[6]=m*A+v*L+g*Y+p*J,r[10]=m*P+v*k+g*W+p*it,r[14]=m*b+v*z+g*V+p*dt,r[3]=M*E+x*y+_*X+C*O,r[7]=M*A+x*L+_*Y+C*J,r[11]=M*P+x*k+_*W+C*it,r[15]=M*b+x*z+_*V+C*dt,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],i=t[4],n=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],f=t[14],m=t[3],v=t[7],g=t[11],p=t[15];return m*(+r*l*u-n*c*u-r*o*d+i*c*d+n*o*f-i*l*f)+v*(+e*l*f-e*c*d+r*a*d-n*a*f+n*c*h-r*l*h)+g*(+e*c*u-e*o*f-r*a*u+i*a*f+r*o*h-i*c*h)+p*(-n*o*h-e*l*u+e*o*d+n*a*u-i*a*d+i*l*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,i){const n=this.elements;return t.isVector3?(n[12]=t.x,n[13]=t.y,n[14]=t.z):(n[12]=t,n[13]=e,n[14]=i),this}invert(){const t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],f=t[11],m=t[12],v=t[13],g=t[14],p=t[15],M=u*g*c-v*d*c+v*l*f-o*g*f-u*l*p+o*d*p,x=m*d*c-h*g*c-m*l*f+a*g*f+h*l*p-a*d*p,_=h*v*c-m*u*c+m*o*f-a*v*f-h*o*p+a*u*p,C=m*u*l-h*v*l-m*o*d+a*v*d+h*o*g-a*u*g,E=e*M+i*x+n*_+r*C;if(E===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const A=1/E;return t[0]=M*A,t[1]=(v*d*r-u*g*r-v*n*f+i*g*f+u*n*p-i*d*p)*A,t[2]=(o*g*r-v*l*r+v*n*c-i*g*c-o*n*p+i*l*p)*A,t[3]=(u*l*r-o*d*r-u*n*c+i*d*c+o*n*f-i*l*f)*A,t[4]=x*A,t[5]=(h*g*r-m*d*r+m*n*f-e*g*f-h*n*p+e*d*p)*A,t[6]=(m*l*r-a*g*r-m*n*c+e*g*c+a*n*p-e*l*p)*A,t[7]=(a*d*r-h*l*r+h*n*c-e*d*c-a*n*f+e*l*f)*A,t[8]=_*A,t[9]=(m*u*r-h*v*r-m*i*f+e*v*f+h*i*p-e*u*p)*A,t[10]=(a*v*r-m*o*r+m*i*c-e*v*c-a*i*p+e*o*p)*A,t[11]=(h*o*r-a*u*r-h*i*c+e*u*c+a*i*f-e*o*f)*A,t[12]=C*A,t[13]=(h*v*n-m*u*n+m*i*d-e*v*d-h*i*g+e*u*g)*A,t[14]=(m*o*n-a*v*n-m*i*l+e*v*l+a*i*g-e*o*g)*A,t[15]=(a*u*n-h*o*n+h*i*l-e*u*l-a*i*d+e*o*d)*A,this}scale(t){const e=this.elements,i=t.x,n=t.y,r=t.z;return e[0]*=i,e[4]*=n,e[8]*=r,e[1]*=i,e[5]*=n,e[9]*=r,e[2]*=i,e[6]*=n,e[10]*=r,e[3]*=i,e[7]*=n,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],n=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,i,n))}makeTranslation(t,e,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,i,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,e,-i,0,0,i,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,0,i,0,0,1,0,0,-i,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,0,i,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const i=Math.cos(e),n=Math.sin(e),r=1-i,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+i,c*o-n*l,c*l+n*o,0,c*o+n*l,h*o+i,h*l-n*a,0,c*l-n*o,h*l+n*a,r*l*l+i,0,0,0,0,1),this}makeScale(t,e,i){return this.set(t,0,0,0,0,e,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,e,i,n,r,a){return this.set(1,i,r,0,t,1,a,0,e,n,1,0,0,0,0,1),this}compose(t,e,i){const n=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,u=o+o,d=r*c,f=r*h,m=r*u,v=a*h,g=a*u,p=o*u,M=l*c,x=l*h,_=l*u,C=i.x,E=i.y,A=i.z;return n[0]=(1-(v+p))*C,n[1]=(f+_)*C,n[2]=(m-x)*C,n[3]=0,n[4]=(f-_)*E,n[5]=(1-(d+p))*E,n[6]=(g+M)*E,n[7]=0,n[8]=(m+x)*A,n[9]=(g-M)*A,n[10]=(1-(d+v))*A,n[11]=0,n[12]=t.x,n[13]=t.y,n[14]=t.z,n[15]=1,this}decompose(t,e,i){const n=this.elements;let r=cn.set(n[0],n[1],n[2]).length();const a=cn.set(n[4],n[5],n[6]).length(),o=cn.set(n[8],n[9],n[10]).length();this.determinant()<0&&(r=-r),t.x=n[12],t.y=n[13],t.z=n[14],Ye.copy(this);const c=1/r,h=1/a,u=1/o;return Ye.elements[0]*=c,Ye.elements[1]*=c,Ye.elements[2]*=c,Ye.elements[4]*=h,Ye.elements[5]*=h,Ye.elements[6]*=h,Ye.elements[8]*=u,Ye.elements[9]*=u,Ye.elements[10]*=u,e.setFromRotationMatrix(Ye),i.x=r,i.y=a,i.z=o,this}makePerspective(t,e,i,n,r,a,o=xi){const l=this.elements,c=2*r/(e-t),h=2*r/(i-n),u=(e+t)/(e-t),d=(i+n)/(i-n);let f,m;if(o===xi)f=-(a+r)/(a-r),m=-2*a*r/(a-r);else if(o===dr)f=-a/(a-r),m=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=f,l[14]=m,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,i,n,r,a,o=xi){const l=this.elements,c=1/(e-t),h=1/(i-n),u=1/(a-r),d=(e+t)*c,f=(i+n)*h;let m,v;if(o===xi)m=(a+r)*u,v=-2*u;else if(o===dr)m=r*u,v=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-f,l[2]=0,l[6]=0,l[10]=v,l[14]=-m,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,i=t.elements;for(let n=0;n<16;n++)if(e[n]!==i[n])return!1;return!0}fromArray(t,e=0){for(let i=0;i<16;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){const i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t[e+9]=i[9],t[e+10]=i[10],t[e+11]=i[11],t[e+12]=i[12],t[e+13]=i[13],t[e+14]=i[14],t[e+15]=i[15],t}}const cn=new T,Ye=new Yt,wu=new T(0,0,0),Tu=new T(1,1,1),Ri=new T,As=new T,Ie=new T,fl=new Yt,pl=new Ze;class We{constructor(t=0,e=0,i=0,n=We.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=i,this._order=n}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,i,n=this._order){return this._x=t,this._y=e,this._z=i,this._order=n,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,i=!0){const n=t.elements,r=n[0],a=n[4],o=n[8],l=n[1],c=n[5],h=n[9],u=n[2],d=n[6],f=n[10];switch(e){case"XYZ":this._y=Math.asin(_e(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-_e(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(_e(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-_e(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(_e(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-_e(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,i){return fl.makeRotationFromQuaternion(t),this.setFromRotationMatrix(fl,e,i)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return pl.setFromEuler(this),this.setFromQuaternion(pl,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}We.DEFAULT_ORDER="XYZ";class Bc{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Eu=0;const ml=new T,hn=new Ze,pi=new Yt,Rs=new T,Yn=new T,Au=new T,Ru=new Ze,gl=new T(1,0,0),vl=new T(0,1,0),_l=new T(0,0,1),xl={type:"added"},Cu={type:"removed"},un={type:"childadded",child:null},qr={type:"childremoved",child:null};class de extends Hn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Eu++}),this.uuid=Fi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=de.DEFAULT_UP.clone();const t=new T,e=new We,i=new Ze,n=new T(1,1,1);function r(){i.setFromEuler(e,!1)}function a(){e.setFromQuaternion(i,void 0,!1)}e._onChange(r),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:n},modelViewMatrix:{value:new Yt},normalMatrix:{value:new Nt}}),this.matrix=new Yt,this.matrixWorld=new Yt,this.matrixAutoUpdate=de.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=de.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Bc,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return hn.setFromAxisAngle(t,e),this.quaternion.multiply(hn),this}rotateOnWorldAxis(t,e){return hn.setFromAxisAngle(t,e),this.quaternion.premultiply(hn),this}rotateX(t){return this.rotateOnAxis(gl,t)}rotateY(t){return this.rotateOnAxis(vl,t)}rotateZ(t){return this.rotateOnAxis(_l,t)}translateOnAxis(t,e){return ml.copy(t).applyQuaternion(this.quaternion),this.position.add(ml.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(gl,t)}translateY(t){return this.translateOnAxis(vl,t)}translateZ(t){return this.translateOnAxis(_l,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(pi.copy(this.matrixWorld).invert())}lookAt(t,e,i){t.isVector3?Rs.copy(t):Rs.set(t,e,i);const n=this.parent;this.updateWorldMatrix(!0,!1),Yn.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?pi.lookAt(Yn,Rs,this.up):pi.lookAt(Rs,Yn,this.up),this.quaternion.setFromRotationMatrix(pi),n&&(pi.extractRotation(n.matrixWorld),hn.setFromRotationMatrix(pi),this.quaternion.premultiply(hn.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(xl),un.child=t,this.dispatchEvent(un),un.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Cu),qr.child=t,this.dispatchEvent(qr),qr.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),pi.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),pi.multiply(t.parent.matrixWorld)),t.applyMatrix4(pi),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(xl),un.child=t,this.dispatchEvent(un),un.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let i=0,n=this.children.length;i<n;i++){const a=this.children[i].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,i=[]){this[t]===e&&i.push(this);const n=this.children;for(let r=0,a=n.length;r<a;r++)n[r].getObjectsByProperty(t,e,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Yn,t,Au),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Yn,Ru,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].updateMatrixWorld(t)}updateWorldMatrix(t,e){const i=this.parent;if(t===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const n=this.children;for(let r=0,a=n.length;r<a;r++)n[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",i={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const n={};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.castShadow===!0&&(n.castShadow=!0),this.receiveShadow===!0&&(n.receiveShadow=!0),this.visible===!1&&(n.visible=!1),this.frustumCulled===!1&&(n.frustumCulled=!1),this.renderOrder!==0&&(n.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(n.userData=this.userData),n.layers=this.layers.mask,n.matrix=this.matrix.toArray(),n.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(n.matrixAutoUpdate=!1),this.isInstancedMesh&&(n.type="InstancedMesh",n.count=this.count,n.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(n.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(n.type="BatchedMesh",n.perObjectFrustumCulled=this.perObjectFrustumCulled,n.sortObjects=this.sortObjects,n.drawRanges=this._drawRanges,n.reservedRanges=this._reservedRanges,n.visibility=this._visibility,n.active=this._active,n.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),n.maxInstanceCount=this._maxInstanceCount,n.maxVertexCount=this._maxVertexCount,n.maxIndexCount=this._maxIndexCount,n.geometryInitialized=this._geometryInitialized,n.geometryCount=this._geometryCount,n.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(n.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(n.boundingSphere={center:n.boundingSphere.center.toArray(),radius:n.boundingSphere.radius}),this.boundingBox!==null&&(n.boundingBox={min:n.boundingBox.min.toArray(),max:n.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?n.background=this.background.toJSON():this.background.isTexture&&(n.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(n.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){n.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(n.bindMode=this.bindMode,n.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),n.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));n.material=o}else n.material=r(t.materials,this.material);if(this.children.length>0){n.children=[];for(let o=0;o<this.children.length;o++)n.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){n.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];n.animations.push(r(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),f=a(t.animations),m=a(t.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),u.length>0&&(i.shapes=u),d.length>0&&(i.skeletons=d),f.length>0&&(i.animations=f),m.length>0&&(i.nodes=m)}return i.object=n,i;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let i=0;i<t.children.length;i++){const n=t.children[i];this.add(n.clone())}return this}}de.DEFAULT_UP=new T(0,1,0);de.DEFAULT_MATRIX_AUTO_UPDATE=!0;de.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Ke=new T,mi=new T,Yr=new T,gi=new T,dn=new T,fn=new T,Ml=new T,Kr=new T,jr=new T,Zr=new T,Jr=new te,Qr=new te,ta=new te;class He{constructor(t=new T,e=new T,i=new T){this.a=t,this.b=e,this.c=i}static getNormal(t,e,i,n){n.subVectors(i,e),Ke.subVectors(t,e),n.cross(Ke);const r=n.lengthSq();return r>0?n.multiplyScalar(1/Math.sqrt(r)):n.set(0,0,0)}static getBarycoord(t,e,i,n,r){Ke.subVectors(n,e),mi.subVectors(i,e),Yr.subVectors(t,e);const a=Ke.dot(Ke),o=Ke.dot(mi),l=Ke.dot(Yr),c=mi.dot(mi),h=mi.dot(Yr),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;const d=1/u,f=(c*l-o*h)*d,m=(a*h-o*l)*d;return r.set(1-f-m,m,f)}static containsPoint(t,e,i,n){return this.getBarycoord(t,e,i,n,gi)===null?!1:gi.x>=0&&gi.y>=0&&gi.x+gi.y<=1}static getInterpolation(t,e,i,n,r,a,o,l){return this.getBarycoord(t,e,i,n,gi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,gi.x),l.addScaledVector(a,gi.y),l.addScaledVector(o,gi.z),l)}static getInterpolatedAttribute(t,e,i,n,r,a){return Jr.setScalar(0),Qr.setScalar(0),ta.setScalar(0),Jr.fromBufferAttribute(t,e),Qr.fromBufferAttribute(t,i),ta.fromBufferAttribute(t,n),a.setScalar(0),a.addScaledVector(Jr,r.x),a.addScaledVector(Qr,r.y),a.addScaledVector(ta,r.z),a}static isFrontFacing(t,e,i,n){return Ke.subVectors(i,e),mi.subVectors(t,e),Ke.cross(mi).dot(n)<0}set(t,e,i){return this.a.copy(t),this.b.copy(e),this.c.copy(i),this}setFromPointsAndIndices(t,e,i,n){return this.a.copy(t[e]),this.b.copy(t[i]),this.c.copy(t[n]),this}setFromAttributeAndIndices(t,e,i,n){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,n),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Ke.subVectors(this.c,this.b),mi.subVectors(this.a,this.b),Ke.cross(mi).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return He.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return He.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,i,n,r){return He.getInterpolation(t,this.a,this.b,this.c,e,i,n,r)}containsPoint(t){return He.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return He.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const i=this.a,n=this.b,r=this.c;let a,o;dn.subVectors(n,i),fn.subVectors(r,i),Kr.subVectors(t,i);const l=dn.dot(Kr),c=fn.dot(Kr);if(l<=0&&c<=0)return e.copy(i);jr.subVectors(t,n);const h=dn.dot(jr),u=fn.dot(jr);if(h>=0&&u<=h)return e.copy(n);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(i).addScaledVector(dn,a);Zr.subVectors(t,r);const f=dn.dot(Zr),m=fn.dot(Zr);if(m>=0&&f<=m)return e.copy(r);const v=f*c-l*m;if(v<=0&&c>=0&&m<=0)return o=c/(c-m),e.copy(i).addScaledVector(fn,o);const g=h*m-f*u;if(g<=0&&u-h>=0&&f-m>=0)return Ml.subVectors(r,n),o=(u-h)/(u-h+(f-m)),e.copy(n).addScaledVector(Ml,o);const p=1/(g+v+d);return a=v*p,o=d*p,e.copy(i).addScaledVector(dn,a).addScaledVector(fn,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const Hc={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ci={h:0,s:0,l:0},Cs={h:0,s:0,l:0};function ea(s,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?s+(t-s)*6*e:e<1/2?t:e<2/3?s+(t-s)*6*(2/3-e):s}class bt{constructor(t,e,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,i)}set(t,e,i){if(e===void 0&&i===void 0){const n=t;n&&n.isColor?this.copy(n):typeof n=="number"?this.setHex(n):typeof n=="string"&&this.setStyle(n)}else this.setRGB(t,e,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Ce){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Xt.toWorkingColorSpace(this,e),this}setRGB(t,e,i,n=Xt.workingColorSpace){return this.r=t,this.g=e,this.b=i,Xt.toWorkingColorSpace(this,n),this}setHSL(t,e,i,n=Xt.workingColorSpace){if(t=fu(t,1),e=_e(e,0,1),i=_e(i,0,1),e===0)this.r=this.g=this.b=i;else{const r=i<=.5?i*(1+e):i+e-i*e,a=2*i-r;this.r=ea(a,r,t+1/3),this.g=ea(a,r,t),this.b=ea(a,r,t-1/3)}return Xt.toWorkingColorSpace(this,n),this}setStyle(t,e=Ce){function i(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let n;if(n=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=n[1],o=n[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(n=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=n[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Ce){const i=Hc[t.toLowerCase()];return i!==void 0?this.setHex(i,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Mi(t.r),this.g=Mi(t.g),this.b=Mi(t.b),this}copyLinearToSRGB(t){return this.r=Dn(t.r),this.g=Dn(t.g),this.b=Dn(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Ce){return Xt.fromWorkingColorSpace(Se.copy(this),t),Math.round(_e(Se.r*255,0,255))*65536+Math.round(_e(Se.g*255,0,255))*256+Math.round(_e(Se.b*255,0,255))}getHexString(t=Ce){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Xt.workingColorSpace){Xt.fromWorkingColorSpace(Se.copy(this),e);const i=Se.r,n=Se.g,r=Se.b,a=Math.max(i,n,r),o=Math.min(i,n,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case i:l=(n-r)/u+(n<r?6:0);break;case n:l=(r-i)/u+2;break;case r:l=(i-n)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Xt.workingColorSpace){return Xt.fromWorkingColorSpace(Se.copy(this),e),t.r=Se.r,t.g=Se.g,t.b=Se.b,t}getStyle(t=Ce){Xt.fromWorkingColorSpace(Se.copy(this),t);const e=Se.r,i=Se.g,n=Se.b;return t!==Ce?`color(${t} ${e.toFixed(3)} ${i.toFixed(3)} ${n.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(i*255)},${Math.round(n*255)})`}offsetHSL(t,e,i){return this.getHSL(Ci),this.setHSL(Ci.h+t,Ci.s+e,Ci.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,i){return this.r=t.r+(e.r-t.r)*i,this.g=t.g+(e.g-t.g)*i,this.b=t.b+(e.b-t.b)*i,this}lerpHSL(t,e){this.getHSL(Ci),t.getHSL(Cs);const i=zr(Ci.h,Cs.h,e),n=zr(Ci.s,Cs.s,e),r=zr(Ci.l,Cs.l,e);return this.setHSL(i,n,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,i=this.g,n=this.b,r=t.elements;return this.r=r[0]*e+r[3]*i+r[6]*n,this.g=r[1]*e+r[4]*i+r[7]*n,this.b=r[2]*e+r[5]*i+r[8]*n,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Se=new bt;bt.NAMES=Hc;let Pu=0;class ki extends Hn{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Pu++}),this.uuid=Fi(),this.name="",this.blending=Pn,this.side=Oi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ra,this.blendDst=Ca,this.blendEquation=Ki,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new bt(0,0,0),this.blendAlpha=0,this.depthFunc=In,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=sl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=sn,this.stencilZFail=sn,this.stencilZPass=sn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const i=t[e];if(i===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const n=this[e];if(n===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}n&&n.isColor?n.set(i):n&&n.isVector3&&i&&i.isVector3?n.copy(i):this[e]=i}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const i={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Pn&&(i.blending=this.blending),this.side!==Oi&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Ra&&(i.blendSrc=this.blendSrc),this.blendDst!==Ca&&(i.blendDst=this.blendDst),this.blendEquation!==Ki&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==In&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==sl&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==sn&&(i.stencilFail=this.stencilFail),this.stencilZFail!==sn&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==sn&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function n(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(e){const r=n(t.textures),a=n(t.images);r.length>0&&(i.textures=r),a.length>0&&(i.images=a)}return i}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let i=null;if(e!==null){const n=e.length;i=new Array(n);for(let r=0;r!==n;++r)i[r]=e[r].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class Ve extends ki{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new bt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new We,this.combine=Eo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const ue=new T,Ps=new ot;class Ge{constructor(t,e,i=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=i,this.usage=po,this.updateRanges=[],this.gpuType=li,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,i){t*=this.itemSize,i*=e.itemSize;for(let n=0,r=this.itemSize;n<r;n++)this.array[t+n]=e.array[i+n];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,i=this.count;e<i;e++)Ps.fromBufferAttribute(this,e),Ps.applyMatrix3(t),this.setXY(e,Ps.x,Ps.y);else if(this.itemSize===3)for(let e=0,i=this.count;e<i;e++)ue.fromBufferAttribute(this,e),ue.applyMatrix3(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}applyMatrix4(t){for(let e=0,i=this.count;e<i;e++)ue.fromBufferAttribute(this,e),ue.applyMatrix4(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)ue.fromBufferAttribute(this,e),ue.applyNormalMatrix(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)ue.fromBufferAttribute(this,e),ue.transformDirection(t),this.setXYZ(e,ue.x,ue.y,ue.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let i=this.array[t*this.itemSize+e];return this.normalized&&(i=ai(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=Qt(i,this.array)),this.array[t*this.itemSize+e]=i,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=ai(e,this.array)),e}setX(t,e){return this.normalized&&(e=Qt(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=ai(e,this.array)),e}setY(t,e){return this.normalized&&(e=Qt(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=ai(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Qt(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=ai(e,this.array)),e}setW(t,e){return this.normalized&&(e=Qt(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,i){return t*=this.itemSize,this.normalized&&(e=Qt(e,this.array),i=Qt(i,this.array)),this.array[t+0]=e,this.array[t+1]=i,this}setXYZ(t,e,i,n){return t*=this.itemSize,this.normalized&&(e=Qt(e,this.array),i=Qt(i,this.array),n=Qt(n,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=n,this}setXYZW(t,e,i,n,r){return t*=this.itemSize,this.normalized&&(e=Qt(e,this.array),i=Qt(i,this.array),n=Qt(n,this.array),r=Qt(r,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=n,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==po&&(t.usage=this.usage),t}}class Vc extends Ge{constructor(t,e,i){super(new Uint16Array(t),e,i)}}class Gc extends Ge{constructor(t,e,i){super(new Uint32Array(t),e,i)}}class ee extends Ge{constructor(t,e,i){super(new Float32Array(t),e,i)}}let Lu=0;const ze=new Yt,ia=new de,pn=new T,Ue=new en,Kn=new en,me=new T;class xe extends Hn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Lu++}),this.uuid=Fi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Fc(t)?Gc:Vc)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,i=0){this.groups.push({start:t,count:e,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const r=new Nt().getNormalMatrix(t);i.applyNormalMatrix(r),i.needsUpdate=!0}const n=this.attributes.tangent;return n!==void 0&&(n.transformDirection(t),n.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return ze.makeRotationFromQuaternion(t),this.applyMatrix4(ze),this}rotateX(t){return ze.makeRotationX(t),this.applyMatrix4(ze),this}rotateY(t){return ze.makeRotationY(t),this.applyMatrix4(ze),this}rotateZ(t){return ze.makeRotationZ(t),this.applyMatrix4(ze),this}translate(t,e,i){return ze.makeTranslation(t,e,i),this.applyMatrix4(ze),this}scale(t,e,i){return ze.makeScale(t,e,i),this.applyMatrix4(ze),this}lookAt(t){return ia.lookAt(t),ia.updateMatrix(),this.applyMatrix4(ia.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(pn).negate(),this.translate(pn.x,pn.y,pn.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const i=[];for(let n=0,r=t.length;n<r;n++){const a=t[n];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new ee(i,3))}else{for(let i=0,n=e.count;i<n;i++){const r=t[i];e.setXYZ(i,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new en);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new T(-1/0,-1/0,-1/0),new T(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let i=0,n=e.length;i<n;i++){const r=e[i];Ue.setFromBufferAttribute(r),this.morphTargetsRelative?(me.addVectors(this.boundingBox.min,Ue.min),this.boundingBox.expandByPoint(me),me.addVectors(this.boundingBox.max,Ue.max),this.boundingBox.expandByPoint(me)):(this.boundingBox.expandByPoint(Ue.min),this.boundingBox.expandByPoint(Ue.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Vn);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new T,1/0);return}if(t){const i=this.boundingSphere.center;if(Ue.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];Kn.setFromBufferAttribute(o),this.morphTargetsRelative?(me.addVectors(Ue.min,Kn.min),Ue.expandByPoint(me),me.addVectors(Ue.max,Kn.max),Ue.expandByPoint(me)):(Ue.expandByPoint(Kn.min),Ue.expandByPoint(Kn.max))}Ue.getCenter(i);let n=0;for(let r=0,a=t.count;r<a;r++)me.fromBufferAttribute(t,r),n=Math.max(n,i.distanceToSquared(me));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)me.fromBufferAttribute(o,c),l&&(pn.fromBufferAttribute(t,c),me.add(pn)),n=Math.max(n,i.distanceToSquared(me))}this.boundingSphere.radius=Math.sqrt(n),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=e.position,n=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Ge(new Float32Array(4*i.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let P=0;P<i.count;P++)o[P]=new T,l[P]=new T;const c=new T,h=new T,u=new T,d=new ot,f=new ot,m=new ot,v=new T,g=new T;function p(P,b,y){c.fromBufferAttribute(i,P),h.fromBufferAttribute(i,b),u.fromBufferAttribute(i,y),d.fromBufferAttribute(r,P),f.fromBufferAttribute(r,b),m.fromBufferAttribute(r,y),h.sub(c),u.sub(c),f.sub(d),m.sub(d);const L=1/(f.x*m.y-m.x*f.y);isFinite(L)&&(v.copy(h).multiplyScalar(m.y).addScaledVector(u,-f.y).multiplyScalar(L),g.copy(u).multiplyScalar(f.x).addScaledVector(h,-m.x).multiplyScalar(L),o[P].add(v),o[b].add(v),o[y].add(v),l[P].add(g),l[b].add(g),l[y].add(g))}let M=this.groups;M.length===0&&(M=[{start:0,count:t.count}]);for(let P=0,b=M.length;P<b;++P){const y=M[P],L=y.start,k=y.count;for(let z=L,X=L+k;z<X;z+=3)p(t.getX(z+0),t.getX(z+1),t.getX(z+2))}const x=new T,_=new T,C=new T,E=new T;function A(P){C.fromBufferAttribute(n,P),E.copy(C);const b=o[P];x.copy(b),x.sub(C.multiplyScalar(C.dot(b))).normalize(),_.crossVectors(E,b);const L=_.dot(l[P])<0?-1:1;a.setXYZW(P,x.x,x.y,x.z,L)}for(let P=0,b=M.length;P<b;++P){const y=M[P],L=y.start,k=y.count;for(let z=L,X=L+k;z<X;z+=3)A(t.getX(z+0)),A(t.getX(z+1)),A(t.getX(z+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new Ge(new Float32Array(e.count*3),3),this.setAttribute("normal",i);else for(let d=0,f=i.count;d<f;d++)i.setXYZ(d,0,0,0);const n=new T,r=new T,a=new T,o=new T,l=new T,c=new T,h=new T,u=new T;if(t)for(let d=0,f=t.count;d<f;d+=3){const m=t.getX(d+0),v=t.getX(d+1),g=t.getX(d+2);n.fromBufferAttribute(e,m),r.fromBufferAttribute(e,v),a.fromBufferAttribute(e,g),h.subVectors(a,r),u.subVectors(n,r),h.cross(u),o.fromBufferAttribute(i,m),l.fromBufferAttribute(i,v),c.fromBufferAttribute(i,g),o.add(h),l.add(h),c.add(h),i.setXYZ(m,o.x,o.y,o.z),i.setXYZ(v,l.x,l.y,l.z),i.setXYZ(g,c.x,c.y,c.z)}else for(let d=0,f=e.count;d<f;d+=3)n.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(n,r),h.cross(u),i.setXYZ(d+0,h.x,h.y,h.z),i.setXYZ(d+1,h.x,h.y,h.z),i.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,i=t.count;e<i;e++)me.fromBufferAttribute(t,e),me.normalize(),t.setXYZ(e,me.x,me.y,me.z)}toNonIndexed(){function t(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let f=0,m=0;for(let v=0,g=l.length;v<g;v++){o.isInterleavedBufferAttribute?f=l[v]*o.data.stride+o.offset:f=l[v]*h;for(let p=0;p<h;p++)d[m++]=c[f++]}return new Ge(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new xe,i=this.index.array,n=this.attributes;for(const o in n){const l=n[o],c=t(l,i);e.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){const d=c[h],f=t(d,i);l.push(f)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const i=this.attributes;for(const l in i){const c=i[l];t.data.attributes[l]=c.toJSON(t.data)}const n={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const f=c[u];h.push(f.toJSON(t.data))}h.length>0&&(n[l]=h,r=!0)}r&&(t.data.morphAttributes=n,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const i=t.index;i!==null&&this.setIndex(i.clone(e));const n=t.attributes;for(const c in n){const h=n[c];this.setAttribute(c,h.clone(e))}const r=t.morphAttributes;for(const c in r){const h=[],u=r[c];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const yl=new Yt,Gi=new kc,Ls=new Vn,Sl=new T,Ds=new T,Is=new T,Us=new T,na=new T,Ns=new T,bl=new T,Fs=new T;class st extends de{constructor(t=new xe,e=new Ve){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){const n=e[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){const o=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const i=this.geometry,n=i.attributes.position,r=i.morphAttributes.position,a=i.morphTargetsRelative;e.fromBufferAttribute(n,t);const o=this.morphTargetInfluences;if(r&&o){Ns.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],u=r[l];h!==0&&(na.fromBufferAttribute(u,t),a?Ns.addScaledVector(na,h):Ns.addScaledVector(na.sub(e),h))}e.add(Ns)}return e}raycast(t,e){const i=this.geometry,n=this.material,r=this.matrixWorld;n!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Ls.copy(i.boundingSphere),Ls.applyMatrix4(r),Gi.copy(t.ray).recast(t.near),!(Ls.containsPoint(Gi.origin)===!1&&(Gi.intersectSphere(Ls,Sl)===null||Gi.origin.distanceToSquared(Sl)>(t.far-t.near)**2))&&(yl.copy(r).invert(),Gi.copy(t.ray).applyMatrix4(yl),!(i.boundingBox!==null&&Gi.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,e,Gi)))}_computeIntersections(t,e,i){let n;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let m=0,v=d.length;m<v;m++){const g=d[m],p=a[g.materialIndex],M=Math.max(g.start,f.start),x=Math.min(o.count,Math.min(g.start+g.count,f.start+f.count));for(let _=M,C=x;_<C;_+=3){const E=o.getX(_),A=o.getX(_+1),P=o.getX(_+2);n=Os(this,p,t,i,c,h,u,E,A,P),n&&(n.faceIndex=Math.floor(_/3),n.face.materialIndex=g.materialIndex,e.push(n))}}else{const m=Math.max(0,f.start),v=Math.min(o.count,f.start+f.count);for(let g=m,p=v;g<p;g+=3){const M=o.getX(g),x=o.getX(g+1),_=o.getX(g+2);n=Os(this,a,t,i,c,h,u,M,x,_),n&&(n.faceIndex=Math.floor(g/3),e.push(n))}}else if(l!==void 0)if(Array.isArray(a))for(let m=0,v=d.length;m<v;m++){const g=d[m],p=a[g.materialIndex],M=Math.max(g.start,f.start),x=Math.min(l.count,Math.min(g.start+g.count,f.start+f.count));for(let _=M,C=x;_<C;_+=3){const E=_,A=_+1,P=_+2;n=Os(this,p,t,i,c,h,u,E,A,P),n&&(n.faceIndex=Math.floor(_/3),n.face.materialIndex=g.materialIndex,e.push(n))}}else{const m=Math.max(0,f.start),v=Math.min(l.count,f.start+f.count);for(let g=m,p=v;g<p;g+=3){const M=g,x=g+1,_=g+2;n=Os(this,a,t,i,c,h,u,M,x,_),n&&(n.faceIndex=Math.floor(g/3),e.push(n))}}}}function Du(s,t,e,i,n,r,a,o){let l;if(t.side===Te?l=i.intersectTriangle(a,r,n,!0,o):l=i.intersectTriangle(n,r,a,t.side===Oi,o),l===null)return null;Fs.copy(o),Fs.applyMatrix4(s.matrixWorld);const c=e.ray.origin.distanceTo(Fs);return c<e.near||c>e.far?null:{distance:c,point:Fs.clone(),object:s}}function Os(s,t,e,i,n,r,a,o,l,c){s.getVertexPosition(o,Ds),s.getVertexPosition(l,Is),s.getVertexPosition(c,Us);const h=Du(s,t,e,i,Ds,Is,Us,bl);if(h){const u=new T;He.getBarycoord(bl,Ds,Is,Us,u),n&&(h.uv=He.getInterpolatedAttribute(n,o,l,c,u,new ot)),r&&(h.uv1=He.getInterpolatedAttribute(r,o,l,c,u,new ot)),a&&(h.normal=He.getInterpolatedAttribute(a,o,l,c,u,new T),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new T,materialIndex:0};He.getNormal(Ds,Is,Us,d.normal),h.face=d,h.barycoord=u}return h}class kt extends xe{constructor(t=1,e=1,i=1,n=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:i,widthSegments:n,heightSegments:r,depthSegments:a};const o=this;n=Math.floor(n),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],u=[];let d=0,f=0;m("z","y","x",-1,-1,i,e,t,a,r,0),m("z","y","x",1,-1,i,e,-t,a,r,1),m("x","z","y",1,1,t,i,e,n,a,2),m("x","z","y",1,-1,t,i,-e,n,a,3),m("x","y","z",1,-1,t,e,i,n,r,4),m("x","y","z",-1,-1,t,e,-i,n,r,5),this.setIndex(l),this.setAttribute("position",new ee(c,3)),this.setAttribute("normal",new ee(h,3)),this.setAttribute("uv",new ee(u,2));function m(v,g,p,M,x,_,C,E,A,P,b){const y=_/A,L=C/P,k=_/2,z=C/2,X=E/2,Y=A+1,W=P+1;let V=0,O=0;const J=new T;for(let it=0;it<W;it++){const dt=it*L-z;for(let wt=0;wt<Y;wt++){const Bt=wt*y-k;J[v]=Bt*M,J[g]=dt*x,J[p]=X,c.push(J.x,J.y,J.z),J[v]=0,J[g]=0,J[p]=E>0?1:-1,h.push(J.x,J.y,J.z),u.push(wt/A),u.push(1-it/P),V+=1}}for(let it=0;it<P;it++)for(let dt=0;dt<A;dt++){const wt=d+dt+Y*it,Bt=d+dt+Y*(it+1),$=d+(dt+1)+Y*(it+1),Q=d+(dt+1)+Y*it;l.push(wt,Bt,Q),l.push(Bt,$,Q),O+=6}o.addGroup(f,O,b),f+=O,d+=V}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new kt(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function zn(s){const t={};for(const e in s){t[e]={};for(const i in s[e]){const n=s[e][i];n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)?n.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][i]=null):t[e][i]=n.clone():Array.isArray(n)?t[e][i]=n.slice():t[e][i]=n}}return t}function Re(s){const t={};for(let e=0;e<s.length;e++){const i=zn(s[e]);for(const n in i)t[n]=i[n]}return t}function Iu(s){const t=[];for(let e=0;e<s.length;e++)t.push(s[e].clone());return t}function Wc(s){const t=s.getRenderTarget();return t===null?s.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Xt.workingColorSpace}const Uu={clone:zn,merge:Re};var Nu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Fu=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class zi extends ki{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Nu,this.fragmentShader=Fu,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=zn(t.uniforms),this.uniformsGroups=Iu(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const n in this.uniforms){const a=this.uniforms[n].value;a&&a.isTexture?e.uniforms[n]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[n]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[n]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[n]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[n]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[n]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[n]={type:"m4",value:a.toArray()}:e.uniforms[n]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const i={};for(const n in this.extensions)this.extensions[n]===!0&&(i[n]=!0);return Object.keys(i).length>0&&(e.extensions=i),e}}class $c extends de{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Yt,this.projectionMatrix=new Yt,this.projectionMatrixInverse=new Yt,this.coordinateSystem=xi}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Pi=new T,wl=new ot,Tl=new ot;class Pe extends $c{constructor(t=50,e=1,i=.1,n=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=n,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=mo*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Or*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return mo*2*Math.atan(Math.tan(Or*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,i){Pi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(Pi.x,Pi.y).multiplyScalar(-t/Pi.z),Pi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Pi.x,Pi.y).multiplyScalar(-t/Pi.z)}getViewSize(t,e){return this.getViewBounds(t,wl,Tl),e.subVectors(Tl,wl)}setViewOffset(t,e,i,n,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Or*.5*this.fov)/this.zoom,i=2*e,n=this.aspect*i,r=-.5*n;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*n/l,e-=a.offsetY*i/c,n*=a.width/l,i*=a.height/c}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+n,e,e-i,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const mn=-90,gn=1;class Ou extends de{constructor(t,e,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const n=new Pe(mn,gn,t,e);n.layers=this.layers,this.add(n);const r=new Pe(mn,gn,t,e);r.layers=this.layers,this.add(r);const a=new Pe(mn,gn,t,e);a.layers=this.layers,this.add(a);const o=new Pe(mn,gn,t,e);o.layers=this.layers,this.add(o);const l=new Pe(mn,gn,t,e);l.layers=this.layers,this.add(l);const c=new Pe(mn,gn,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[i,n,r,a,o,l]=e;for(const c of e)this.remove(c);if(t===xi)i.up.set(0,1,0),i.lookAt(1,0,0),n.up.set(0,1,0),n.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===dr)i.up.set(0,-1,0),i.lookAt(-1,0,0),n.up.set(0,-1,0),n.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:n}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),m=t.xr.enabled;t.xr.enabled=!1;const v=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,t.setRenderTarget(i,0,n),t.render(e,r),t.setRenderTarget(i,1,n),t.render(e,a),t.setRenderTarget(i,2,n),t.render(e,o),t.setRenderTarget(i,3,n),t.render(e,l),t.setRenderTarget(i,4,n),t.render(e,c),i.texture.generateMipmaps=v,t.setRenderTarget(i,5,n),t.render(e,h),t.setRenderTarget(u,d,f),t.xr.enabled=m,i.texture.needsPMREMUpdate=!0}}class Xc extends Ee{constructor(t,e,i,n,r,a,o,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:Un,super(t,e,i,n,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class zu extends tn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const i={width:t,height:t,depth:1},n=[i,i,i,i,i,i];this.texture=new Xc(n,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:oi}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},n=new kt(5,5,5),r=new zi({name:"CubemapFromEquirect",uniforms:zn(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Te,blending:Ui});r.uniforms.tEquirect.value=e;const a=new st(n,r),o=e.minFilter;return e.minFilter===Ji&&(e.minFilter=oi),new Ou(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,i,n){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,i,n);t.setRenderTarget(r)}}const sa=new T,ku=new T,Bu=new Nt;class qi{constructor(t=new T(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,i,n){return this.normal.set(t,e,i),this.constant=n,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,i){const n=sa.subVectors(i,e).cross(ku.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(n,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const i=t.delta(sa),n=this.normal.dot(i);if(n===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/n;return r<0||r>1?null:e.copy(t.start).addScaledVector(i,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return e<0&&i>0||i<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const i=e||Bu.getNormalMatrix(t),n=this.coplanarPoint(sa).applyMatrix4(t),r=this.normal.applyMatrix3(i).normalize();return this.constant=-n.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Wi=new Vn,zs=new T;class Fo{constructor(t=new qi,e=new qi,i=new qi,n=new qi,r=new qi,a=new qi){this.planes=[t,e,i,n,r,a]}set(t,e,i,n,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(i),o[3].copy(n),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let i=0;i<6;i++)e[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,e=xi){const i=this.planes,n=t.elements,r=n[0],a=n[1],o=n[2],l=n[3],c=n[4],h=n[5],u=n[6],d=n[7],f=n[8],m=n[9],v=n[10],g=n[11],p=n[12],M=n[13],x=n[14],_=n[15];if(i[0].setComponents(l-r,d-c,g-f,_-p).normalize(),i[1].setComponents(l+r,d+c,g+f,_+p).normalize(),i[2].setComponents(l+a,d+h,g+m,_+M).normalize(),i[3].setComponents(l-a,d-h,g-m,_-M).normalize(),i[4].setComponents(l-o,d-u,g-v,_-x).normalize(),e===xi)i[5].setComponents(l+o,d+u,g+v,_+x).normalize();else if(e===dr)i[5].setComponents(o,u,v,x).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Wi.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Wi.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Wi)}intersectsSprite(t){return Wi.center.set(0,0,0),Wi.radius=.7071067811865476,Wi.applyMatrix4(t.matrixWorld),this.intersectsSphere(Wi)}intersectsSphere(t){const e=this.planes,i=t.center,n=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(i)<n)return!1;return!0}intersectsBox(t){const e=this.planes;for(let i=0;i<6;i++){const n=e[i];if(zs.x=n.normal.x>0?t.max.x:t.min.x,zs.y=n.normal.y>0?t.max.y:t.min.y,zs.z=n.normal.z>0?t.max.z:t.min.z,n.distanceToPoint(zs)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let i=0;i<6;i++)if(e[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function qc(){let s=null,t=!1,e=null,i=null;function n(r,a){e(r,a),i=s.requestAnimationFrame(n)}return{start:function(){t!==!0&&e!==null&&(i=s.requestAnimationFrame(n),t=!0)},stop:function(){s.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){s=r}}}function Hu(s){const t=new WeakMap;function e(o,l){const c=o.array,h=o.usage,u=c.byteLength,d=s.createBuffer();s.bindBuffer(l,d),s.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=s.FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=s.HALF_FLOAT:f=s.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=s.SHORT;else if(c instanceof Uint32Array)f=s.UNSIGNED_INT;else if(c instanceof Int32Array)f=s.INT;else if(c instanceof Int8Array)f=s.BYTE;else if(c instanceof Uint8Array)f=s.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function i(o,l,c){const h=l.array,u=l.updateRanges;if(s.bindBuffer(c,o),u.length===0)s.bufferSubData(c,0,h);else{u.sort((f,m)=>f.start-m.start);let d=0;for(let f=1;f<u.length;f++){const m=u[d],v=u[f];v.start<=m.start+m.count+1?m.count=Math.max(m.count,v.start+v.count-m.start):(++d,u[d]=v)}u.length=d+1;for(let f=0,m=u.length;f<m;f++){const v=u[f];s.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function n(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=t.get(o);l&&(s.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:n,remove:r,update:a}}class kn extends xe{constructor(t=1,e=1,i=1,n=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:i,heightSegments:n};const r=t/2,a=e/2,o=Math.floor(i),l=Math.floor(n),c=o+1,h=l+1,u=t/o,d=e/l,f=[],m=[],v=[],g=[];for(let p=0;p<h;p++){const M=p*d-a;for(let x=0;x<c;x++){const _=x*u-r;m.push(_,-M,0),v.push(0,0,1),g.push(x/o),g.push(1-p/l)}}for(let p=0;p<l;p++)for(let M=0;M<o;M++){const x=M+c*p,_=M+c*(p+1),C=M+1+c*(p+1),E=M+1+c*p;f.push(x,_,E),f.push(_,C,E)}this.setIndex(f),this.setAttribute("position",new ee(m,3)),this.setAttribute("normal",new ee(v,3)),this.setAttribute("uv",new ee(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new kn(t.width,t.height,t.widthSegments,t.heightSegments)}}var Vu=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Gu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Wu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,$u=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Xu=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,qu=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Yu=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Ku=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,ju=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Zu=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Ju=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Qu=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,td=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,ed=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,id=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,nd=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,sd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,rd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,ad=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,od=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,ld=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,cd=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,hd=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,ud=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,dd=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,fd=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,pd=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,md=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,gd=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,vd=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,_d="gl_FragColor = linearToOutputTexel( gl_FragColor );",xd=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Md=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,yd=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Sd=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,bd=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,wd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Td=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Ed=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Ad=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Rd=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Cd=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Pd=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Ld=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Dd=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Id=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Ud=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Nd=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Fd=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Od=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,zd=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,kd=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Bd=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Hd=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Vd=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Gd=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Wd=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,$d=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Xd=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,qd=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Yd=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Kd=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,jd=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Zd=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Jd=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Qd=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,tf=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,ef=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,nf=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,sf=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,rf=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,af=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,of=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,lf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,cf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,hf=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,uf=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,df=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,ff=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,pf=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,mf=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,gf=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,vf=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,_f=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,xf=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Mf=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,yf=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Sf=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,bf=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,wf=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Tf=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Ef=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Af=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Rf=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Cf=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Pf=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Lf=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Df=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,If=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Uf=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Nf=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Ff=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Of=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,zf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,kf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Bf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Hf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Vf=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Gf=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Wf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,$f=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Xf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,qf=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Yf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Kf=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,jf=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Zf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Jf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Qf=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,tp=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,ep=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,ip=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,np=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,sp=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,rp=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ap=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,op=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,lp=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,cp=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,hp=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,up=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,dp=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,fp=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,pp=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,mp=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gp=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,vp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,_p=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,xp=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Mp=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,yp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ot={alphahash_fragment:Vu,alphahash_pars_fragment:Gu,alphamap_fragment:Wu,alphamap_pars_fragment:$u,alphatest_fragment:Xu,alphatest_pars_fragment:qu,aomap_fragment:Yu,aomap_pars_fragment:Ku,batching_pars_vertex:ju,batching_vertex:Zu,begin_vertex:Ju,beginnormal_vertex:Qu,bsdfs:td,iridescence_fragment:ed,bumpmap_pars_fragment:id,clipping_planes_fragment:nd,clipping_planes_pars_fragment:sd,clipping_planes_pars_vertex:rd,clipping_planes_vertex:ad,color_fragment:od,color_pars_fragment:ld,color_pars_vertex:cd,color_vertex:hd,common:ud,cube_uv_reflection_fragment:dd,defaultnormal_vertex:fd,displacementmap_pars_vertex:pd,displacementmap_vertex:md,emissivemap_fragment:gd,emissivemap_pars_fragment:vd,colorspace_fragment:_d,colorspace_pars_fragment:xd,envmap_fragment:Md,envmap_common_pars_fragment:yd,envmap_pars_fragment:Sd,envmap_pars_vertex:bd,envmap_physical_pars_fragment:Ud,envmap_vertex:wd,fog_vertex:Td,fog_pars_vertex:Ed,fog_fragment:Ad,fog_pars_fragment:Rd,gradientmap_pars_fragment:Cd,lightmap_pars_fragment:Pd,lights_lambert_fragment:Ld,lights_lambert_pars_fragment:Dd,lights_pars_begin:Id,lights_toon_fragment:Nd,lights_toon_pars_fragment:Fd,lights_phong_fragment:Od,lights_phong_pars_fragment:zd,lights_physical_fragment:kd,lights_physical_pars_fragment:Bd,lights_fragment_begin:Hd,lights_fragment_maps:Vd,lights_fragment_end:Gd,logdepthbuf_fragment:Wd,logdepthbuf_pars_fragment:$d,logdepthbuf_pars_vertex:Xd,logdepthbuf_vertex:qd,map_fragment:Yd,map_pars_fragment:Kd,map_particle_fragment:jd,map_particle_pars_fragment:Zd,metalnessmap_fragment:Jd,metalnessmap_pars_fragment:Qd,morphinstance_vertex:tf,morphcolor_vertex:ef,morphnormal_vertex:nf,morphtarget_pars_vertex:sf,morphtarget_vertex:rf,normal_fragment_begin:af,normal_fragment_maps:of,normal_pars_fragment:lf,normal_pars_vertex:cf,normal_vertex:hf,normalmap_pars_fragment:uf,clearcoat_normal_fragment_begin:df,clearcoat_normal_fragment_maps:ff,clearcoat_pars_fragment:pf,iridescence_pars_fragment:mf,opaque_fragment:gf,packing:vf,premultiplied_alpha_fragment:_f,project_vertex:xf,dithering_fragment:Mf,dithering_pars_fragment:yf,roughnessmap_fragment:Sf,roughnessmap_pars_fragment:bf,shadowmap_pars_fragment:wf,shadowmap_pars_vertex:Tf,shadowmap_vertex:Ef,shadowmask_pars_fragment:Af,skinbase_vertex:Rf,skinning_pars_vertex:Cf,skinning_vertex:Pf,skinnormal_vertex:Lf,specularmap_fragment:Df,specularmap_pars_fragment:If,tonemapping_fragment:Uf,tonemapping_pars_fragment:Nf,transmission_fragment:Ff,transmission_pars_fragment:Of,uv_pars_fragment:zf,uv_pars_vertex:kf,uv_vertex:Bf,worldpos_vertex:Hf,background_vert:Vf,background_frag:Gf,backgroundCube_vert:Wf,backgroundCube_frag:$f,cube_vert:Xf,cube_frag:qf,depth_vert:Yf,depth_frag:Kf,distanceRGBA_vert:jf,distanceRGBA_frag:Zf,equirect_vert:Jf,equirect_frag:Qf,linedashed_vert:tp,linedashed_frag:ep,meshbasic_vert:ip,meshbasic_frag:np,meshlambert_vert:sp,meshlambert_frag:rp,meshmatcap_vert:ap,meshmatcap_frag:op,meshnormal_vert:lp,meshnormal_frag:cp,meshphong_vert:hp,meshphong_frag:up,meshphysical_vert:dp,meshphysical_frag:fp,meshtoon_vert:pp,meshtoon_frag:mp,points_vert:gp,points_frag:vp,shadow_vert:_p,shadow_frag:xp,sprite_vert:Mp,sprite_frag:yp},rt={common:{diffuse:{value:new bt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Nt},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Nt}},envmap:{envMap:{value:null},envMapRotation:{value:new Nt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Nt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Nt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Nt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Nt},normalScale:{value:new ot(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Nt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Nt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Nt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Nt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new bt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new bt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0},uvTransform:{value:new Nt}},sprite:{diffuse:{value:new bt(16777215)},opacity:{value:1},center:{value:new ot(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Nt},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0}}},ri={basic:{uniforms:Re([rt.common,rt.specularmap,rt.envmap,rt.aomap,rt.lightmap,rt.fog]),vertexShader:Ot.meshbasic_vert,fragmentShader:Ot.meshbasic_frag},lambert:{uniforms:Re([rt.common,rt.specularmap,rt.envmap,rt.aomap,rt.lightmap,rt.emissivemap,rt.bumpmap,rt.normalmap,rt.displacementmap,rt.fog,rt.lights,{emissive:{value:new bt(0)}}]),vertexShader:Ot.meshlambert_vert,fragmentShader:Ot.meshlambert_frag},phong:{uniforms:Re([rt.common,rt.specularmap,rt.envmap,rt.aomap,rt.lightmap,rt.emissivemap,rt.bumpmap,rt.normalmap,rt.displacementmap,rt.fog,rt.lights,{emissive:{value:new bt(0)},specular:{value:new bt(1118481)},shininess:{value:30}}]),vertexShader:Ot.meshphong_vert,fragmentShader:Ot.meshphong_frag},standard:{uniforms:Re([rt.common,rt.envmap,rt.aomap,rt.lightmap,rt.emissivemap,rt.bumpmap,rt.normalmap,rt.displacementmap,rt.roughnessmap,rt.metalnessmap,rt.fog,rt.lights,{emissive:{value:new bt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag},toon:{uniforms:Re([rt.common,rt.aomap,rt.lightmap,rt.emissivemap,rt.bumpmap,rt.normalmap,rt.displacementmap,rt.gradientmap,rt.fog,rt.lights,{emissive:{value:new bt(0)}}]),vertexShader:Ot.meshtoon_vert,fragmentShader:Ot.meshtoon_frag},matcap:{uniforms:Re([rt.common,rt.bumpmap,rt.normalmap,rt.displacementmap,rt.fog,{matcap:{value:null}}]),vertexShader:Ot.meshmatcap_vert,fragmentShader:Ot.meshmatcap_frag},points:{uniforms:Re([rt.points,rt.fog]),vertexShader:Ot.points_vert,fragmentShader:Ot.points_frag},dashed:{uniforms:Re([rt.common,rt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ot.linedashed_vert,fragmentShader:Ot.linedashed_frag},depth:{uniforms:Re([rt.common,rt.displacementmap]),vertexShader:Ot.depth_vert,fragmentShader:Ot.depth_frag},normal:{uniforms:Re([rt.common,rt.bumpmap,rt.normalmap,rt.displacementmap,{opacity:{value:1}}]),vertexShader:Ot.meshnormal_vert,fragmentShader:Ot.meshnormal_frag},sprite:{uniforms:Re([rt.sprite,rt.fog]),vertexShader:Ot.sprite_vert,fragmentShader:Ot.sprite_frag},background:{uniforms:{uvTransform:{value:new Nt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ot.background_vert,fragmentShader:Ot.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Nt}},vertexShader:Ot.backgroundCube_vert,fragmentShader:Ot.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ot.cube_vert,fragmentShader:Ot.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ot.equirect_vert,fragmentShader:Ot.equirect_frag},distanceRGBA:{uniforms:Re([rt.common,rt.displacementmap,{referencePosition:{value:new T},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ot.distanceRGBA_vert,fragmentShader:Ot.distanceRGBA_frag},shadow:{uniforms:Re([rt.lights,rt.fog,{color:{value:new bt(0)},opacity:{value:1}}]),vertexShader:Ot.shadow_vert,fragmentShader:Ot.shadow_frag}};ri.physical={uniforms:Re([ri.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Nt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Nt},clearcoatNormalScale:{value:new ot(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Nt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Nt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Nt},sheen:{value:0},sheenColor:{value:new bt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Nt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Nt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Nt},transmissionSamplerSize:{value:new ot},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Nt},attenuationDistance:{value:0},attenuationColor:{value:new bt(0)},specularColor:{value:new bt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Nt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Nt},anisotropyVector:{value:new ot},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Nt}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag};const ks={r:0,b:0,g:0},$i=new We,Sp=new Yt;function bp(s,t,e,i,n,r,a){const o=new bt(0);let l=r===!0?0:1,c,h,u=null,d=0,f=null;function m(M){let x=M.isScene===!0?M.background:null;return x&&x.isTexture&&(x=(M.backgroundBlurriness>0?e:t).get(x)),x}function v(M){let x=!1;const _=m(M);_===null?p(o,l):_&&_.isColor&&(p(_,1),x=!0);const C=s.xr.getEnvironmentBlendMode();C==="additive"?i.buffers.color.setClear(0,0,0,1,a):C==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,a),(s.autoClear||x)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function g(M,x){const _=m(x);_&&(_.isCubeTexture||_.mapping===Er)?(h===void 0&&(h=new st(new kt(1,1,1),new zi({name:"BackgroundCubeMaterial",uniforms:zn(ri.backgroundCube.uniforms),vertexShader:ri.backgroundCube.vertexShader,fragmentShader:ri.backgroundCube.fragmentShader,side:Te,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(C,E,A){this.matrixWorld.copyPosition(A.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(h)),$i.copy(x.backgroundRotation),$i.x*=-1,$i.y*=-1,$i.z*=-1,_.isCubeTexture&&_.isRenderTargetTexture===!1&&($i.y*=-1,$i.z*=-1),h.material.uniforms.envMap.value=_,h.material.uniforms.flipEnvMap.value=_.isCubeTexture&&_.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=x.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=x.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(Sp.makeRotationFromEuler($i)),h.material.toneMapped=Xt.getTransfer(_.colorSpace)!==Jt,(u!==_||d!==_.version||f!==s.toneMapping)&&(h.material.needsUpdate=!0,u=_,d=_.version,f=s.toneMapping),h.layers.enableAll(),M.unshift(h,h.geometry,h.material,0,0,null)):_&&_.isTexture&&(c===void 0&&(c=new st(new kn(2,2),new zi({name:"BackgroundMaterial",uniforms:zn(ri.background.uniforms),vertexShader:ri.background.vertexShader,fragmentShader:ri.background.fragmentShader,side:Oi,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(c)),c.material.uniforms.t2D.value=_,c.material.uniforms.backgroundIntensity.value=x.backgroundIntensity,c.material.toneMapped=Xt.getTransfer(_.colorSpace)!==Jt,_.matrixAutoUpdate===!0&&_.updateMatrix(),c.material.uniforms.uvTransform.value.copy(_.matrix),(u!==_||d!==_.version||f!==s.toneMapping)&&(c.material.needsUpdate=!0,u=_,d=_.version,f=s.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null))}function p(M,x){M.getRGB(ks,Wc(s)),i.buffers.color.setClear(ks.r,ks.g,ks.b,x,a)}return{getClearColor:function(){return o},setClearColor:function(M,x=1){o.set(M),l=x,p(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(M){l=M,p(o,l)},render:v,addToRenderList:g}}function wp(s,t){const e=s.getParameter(s.MAX_VERTEX_ATTRIBS),i={},n=d(null);let r=n,a=!1;function o(y,L,k,z,X){let Y=!1;const W=u(z,k,L);r!==W&&(r=W,c(r.object)),Y=f(y,z,k,X),Y&&m(y,z,k,X),X!==null&&t.update(X,s.ELEMENT_ARRAY_BUFFER),(Y||a)&&(a=!1,_(y,L,k,z),X!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,t.get(X).buffer))}function l(){return s.createVertexArray()}function c(y){return s.bindVertexArray(y)}function h(y){return s.deleteVertexArray(y)}function u(y,L,k){const z=k.wireframe===!0;let X=i[y.id];X===void 0&&(X={},i[y.id]=X);let Y=X[L.id];Y===void 0&&(Y={},X[L.id]=Y);let W=Y[z];return W===void 0&&(W=d(l()),Y[z]=W),W}function d(y){const L=[],k=[],z=[];for(let X=0;X<e;X++)L[X]=0,k[X]=0,z[X]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:k,attributeDivisors:z,object:y,attributes:{},index:null}}function f(y,L,k,z){const X=r.attributes,Y=L.attributes;let W=0;const V=k.getAttributes();for(const O in V)if(V[O].location>=0){const it=X[O];let dt=Y[O];if(dt===void 0&&(O==="instanceMatrix"&&y.instanceMatrix&&(dt=y.instanceMatrix),O==="instanceColor"&&y.instanceColor&&(dt=y.instanceColor)),it===void 0||it.attribute!==dt||dt&&it.data!==dt.data)return!0;W++}return r.attributesNum!==W||r.index!==z}function m(y,L,k,z){const X={},Y=L.attributes;let W=0;const V=k.getAttributes();for(const O in V)if(V[O].location>=0){let it=Y[O];it===void 0&&(O==="instanceMatrix"&&y.instanceMatrix&&(it=y.instanceMatrix),O==="instanceColor"&&y.instanceColor&&(it=y.instanceColor));const dt={};dt.attribute=it,it&&it.data&&(dt.data=it.data),X[O]=dt,W++}r.attributes=X,r.attributesNum=W,r.index=z}function v(){const y=r.newAttributes;for(let L=0,k=y.length;L<k;L++)y[L]=0}function g(y){p(y,0)}function p(y,L){const k=r.newAttributes,z=r.enabledAttributes,X=r.attributeDivisors;k[y]=1,z[y]===0&&(s.enableVertexAttribArray(y),z[y]=1),X[y]!==L&&(s.vertexAttribDivisor(y,L),X[y]=L)}function M(){const y=r.newAttributes,L=r.enabledAttributes;for(let k=0,z=L.length;k<z;k++)L[k]!==y[k]&&(s.disableVertexAttribArray(k),L[k]=0)}function x(y,L,k,z,X,Y,W){W===!0?s.vertexAttribIPointer(y,L,k,X,Y):s.vertexAttribPointer(y,L,k,z,X,Y)}function _(y,L,k,z){v();const X=z.attributes,Y=k.getAttributes(),W=L.defaultAttributeValues;for(const V in Y){const O=Y[V];if(O.location>=0){let J=X[V];if(J===void 0&&(V==="instanceMatrix"&&y.instanceMatrix&&(J=y.instanceMatrix),V==="instanceColor"&&y.instanceColor&&(J=y.instanceColor)),J!==void 0){const it=J.normalized,dt=J.itemSize,wt=t.get(J);if(wt===void 0)continue;const Bt=wt.buffer,$=wt.type,Q=wt.bytesPerElement,ft=$===s.INT||$===s.UNSIGNED_INT||J.gpuType===Ro;if(J.isInterleavedBufferAttribute){const nt=J.data,Rt=nt.stride,Lt=J.offset;if(nt.isInstancedInterleavedBuffer){for(let zt=0;zt<O.locationSize;zt++)p(O.location+zt,nt.meshPerAttribute);y.isInstancedMesh!==!0&&z._maxInstanceCount===void 0&&(z._maxInstanceCount=nt.meshPerAttribute*nt.count)}else for(let zt=0;zt<O.locationSize;zt++)g(O.location+zt);s.bindBuffer(s.ARRAY_BUFFER,Bt);for(let zt=0;zt<O.locationSize;zt++)x(O.location+zt,dt/O.locationSize,$,it,Rt*Q,(Lt+dt/O.locationSize*zt)*Q,ft)}else{if(J.isInstancedBufferAttribute){for(let nt=0;nt<O.locationSize;nt++)p(O.location+nt,J.meshPerAttribute);y.isInstancedMesh!==!0&&z._maxInstanceCount===void 0&&(z._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let nt=0;nt<O.locationSize;nt++)g(O.location+nt);s.bindBuffer(s.ARRAY_BUFFER,Bt);for(let nt=0;nt<O.locationSize;nt++)x(O.location+nt,dt/O.locationSize,$,it,dt*Q,dt/O.locationSize*nt*Q,ft)}}else if(W!==void 0){const it=W[V];if(it!==void 0)switch(it.length){case 2:s.vertexAttrib2fv(O.location,it);break;case 3:s.vertexAttrib3fv(O.location,it);break;case 4:s.vertexAttrib4fv(O.location,it);break;default:s.vertexAttrib1fv(O.location,it)}}}}M()}function C(){P();for(const y in i){const L=i[y];for(const k in L){const z=L[k];for(const X in z)h(z[X].object),delete z[X];delete L[k]}delete i[y]}}function E(y){if(i[y.id]===void 0)return;const L=i[y.id];for(const k in L){const z=L[k];for(const X in z)h(z[X].object),delete z[X];delete L[k]}delete i[y.id]}function A(y){for(const L in i){const k=i[L];if(k[y.id]===void 0)continue;const z=k[y.id];for(const X in z)h(z[X].object),delete z[X];delete k[y.id]}}function P(){b(),a=!0,r!==n&&(r=n,c(r.object))}function b(){n.geometry=null,n.program=null,n.wireframe=!1}return{setup:o,reset:P,resetDefaultState:b,dispose:C,releaseStatesOfGeometry:E,releaseStatesOfProgram:A,initAttributes:v,enableAttribute:g,disableUnusedAttributes:M}}function Tp(s,t,e){let i;function n(c){i=c}function r(c,h){s.drawArrays(i,c,h),e.update(h,i,1)}function a(c,h,u){u!==0&&(s.drawArraysInstanced(i,c,h,u),e.update(h,i,u))}function o(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,h,0,u);let f=0;for(let m=0;m<u;m++)f+=h[m];e.update(f,i,1)}function l(c,h,u,d){if(u===0)return;const f=t.get("WEBGL_multi_draw");if(f===null)for(let m=0;m<c.length;m++)a(c[m],h[m],d[m]);else{f.multiDrawArraysInstancedWEBGL(i,c,0,h,0,d,0,u);let m=0;for(let v=0;v<u;v++)m+=h[v]*d[v];e.update(m,i,1)}}this.setMode=n,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function Ep(s,t,e,i){let n;function r(){if(n!==void 0)return n;if(t.has("EXT_texture_filter_anisotropic")===!0){const A=t.get("EXT_texture_filter_anisotropic");n=s.getParameter(A.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function a(A){return!(A!==je&&i.convert(A)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(A){const P=A===gs&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(A!==Si&&i.convert(A)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE)&&A!==li&&!P)}function l(A){if(A==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";A="mediump"}return A==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),f=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),m=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=s.getParameter(s.MAX_TEXTURE_SIZE),g=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),p=s.getParameter(s.MAX_VERTEX_ATTRIBS),M=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),x=s.getParameter(s.MAX_VARYING_VECTORS),_=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),C=m>0,E=s.getParameter(s.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:f,maxVertexTextures:m,maxTextureSize:v,maxCubemapSize:g,maxAttributes:p,maxVertexUniforms:M,maxVaryings:x,maxFragmentUniforms:_,vertexTextures:C,maxSamples:E}}function Ap(s){const t=this;let e=null,i=0,n=!1,r=!1;const a=new qi,o=new Nt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const f=u.length!==0||d||i!==0||n;return n=d,i=u.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,f){const m=u.clippingPlanes,v=u.clipIntersection,g=u.clipShadows,p=s.get(u);if(!n||m===null||m.length===0||r&&!g)r?h(null):c();else{const M=r?0:i,x=M*4;let _=p.clippingState||null;l.value=_,_=h(m,d,x,f);for(let C=0;C!==x;++C)_[C]=e[C];p.clippingState=_,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(u,d,f,m){const v=u!==null?u.length:0;let g=null;if(v!==0){if(g=l.value,m!==!0||g===null){const p=f+v*4,M=d.matrixWorldInverse;o.getNormalMatrix(M),(g===null||g.length<p)&&(g=new Float32Array(p));for(let x=0,_=f;x!==v;++x,_+=4)a.copy(u[x]).applyMatrix4(M,o),a.normal.toArray(g,_),g[_+3]=a.constant}l.value=g,l.needsUpdate=!0}return t.numPlanes=v,t.numIntersection=0,g}}function Rp(s){let t=new WeakMap;function e(a,o){return o===Oa?a.mapping=Un:o===za&&(a.mapping=Nn),a}function i(a){if(a&&a.isTexture){const o=a.mapping;if(o===Oa||o===za)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new zu(l.height);return c.fromEquirectangularTexture(s,a),t.set(a,c),a.addEventListener("dispose",n),e(c.texture,a.mapping)}else return null}}return a}function n(a){const o=a.target;o.removeEventListener("dispose",n);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:i,dispose:r}}class Yc extends $c{constructor(t=-1,e=1,i=1,n=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=i,this.bottom=n,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,i,n,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,n=(this.top+this.bottom)/2;let r=i-t,a=i+t,o=n+e,l=n-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const En=4,El=[.125,.215,.35,.446,.526,.582],ji=20,ra=new Yc,Al=new bt;let aa=null,oa=0,la=0,ca=!1;const Yi=(1+Math.sqrt(5))/2,vn=1/Yi,Rl=[new T(-Yi,vn,0),new T(Yi,vn,0),new T(-vn,0,Yi),new T(vn,0,Yi),new T(0,Yi,-vn),new T(0,Yi,vn),new T(-1,1,-1),new T(1,1,-1),new T(-1,1,1),new T(1,1,1)];class pr{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,i=.1,n=100){aa=this._renderer.getRenderTarget(),oa=this._renderer.getActiveCubeFace(),la=this._renderer.getActiveMipmapLevel(),ca=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,i,n,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Ll(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Pl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(aa,oa,la),this._renderer.xr.enabled=ca,t.scissorTest=!1,Bs(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Un||t.mapping===Nn?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),aa=this._renderer.getRenderTarget(),oa=this._renderer.getActiveCubeFace(),la=this._renderer.getActiveMipmapLevel(),ca=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=e||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,i={magFilter:oi,minFilter:oi,generateMipmaps:!1,type:gs,format:je,colorSpace:Bn,depthBuffer:!1},n=Cl(t,e,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Cl(t,e,i);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Cp(r)),this._blurMaterial=Pp(r,t,e)}return n}_compileMaterial(t){const e=new st(this._lodPlanes[0],t);this._renderer.compile(e,ra)}_sceneToCubeUV(t,e,i,n){const o=new Pe(90,1,e,i),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(Al),h.toneMapping=Ni,h.autoClear=!1;const f=new Ve({name:"PMREM.Background",side:Te,depthWrite:!1,depthTest:!1}),m=new st(new kt,f);let v=!1;const g=t.background;g?g.isColor&&(f.color.copy(g),t.background=null,v=!0):(f.color.copy(Al),v=!0);for(let p=0;p<6;p++){const M=p%3;M===0?(o.up.set(0,l[p],0),o.lookAt(c[p],0,0)):M===1?(o.up.set(0,0,l[p]),o.lookAt(0,c[p],0)):(o.up.set(0,l[p],0),o.lookAt(0,0,c[p]));const x=this._cubeSize;Bs(n,M*x,p>2?x:0,x,x),h.setRenderTarget(n),v&&h.render(m,o),h.render(t,o)}m.geometry.dispose(),m.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=g}_textureToCubeUV(t,e){const i=this._renderer,n=t.mapping===Un||t.mapping===Nn;n?(this._cubemapMaterial===null&&(this._cubemapMaterial=Ll()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Pl());const r=n?this._cubemapMaterial:this._equirectMaterial,a=new st(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const l=this._cubeSize;Bs(e,0,0,3*l,2*l),i.setRenderTarget(e),i.render(a,ra)}_applyPMREM(t){const e=this._renderer,i=e.autoClear;e.autoClear=!1;const n=this._lodPlanes.length;for(let r=1;r<n;r++){const a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=Rl[(n-r-1)%Rl.length];this._blur(t,r-1,r,a,o)}e.autoClear=i}_blur(t,e,i,n,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,i,n,"latitudinal",r),this._halfBlur(a,t,i,i,n,"longitudinal",r)}_halfBlur(t,e,i,n,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new st(this._lodPlanes[n],c),d=c.uniforms,f=this._sizeLods[i]-1,m=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*ji-1),v=r/m,g=isFinite(r)?1+Math.floor(h*v):ji;g>ji&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${ji}`);const p=[];let M=0;for(let A=0;A<ji;++A){const P=A/v,b=Math.exp(-P*P/2);p.push(b),A===0?M+=b:A<g&&(M+=2*b)}for(let A=0;A<p.length;A++)p[A]=p[A]/M;d.envMap.value=t.texture,d.samples.value=g,d.weights.value=p,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:x}=this;d.dTheta.value=m,d.mipInt.value=x-i;const _=this._sizeLods[n],C=3*_*(n>x-En?n-x+En:0),E=4*(this._cubeSize-_);Bs(e,C,E,3*_,2*_),l.setRenderTarget(e),l.render(u,ra)}}function Cp(s){const t=[],e=[],i=[];let n=s;const r=s-En+1+El.length;for(let a=0;a<r;a++){const o=Math.pow(2,n);e.push(o);let l=1/o;a>s-En?l=El[a-s+En-1]:a===0&&(l=0),i.push(l);const c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],f=6,m=6,v=3,g=2,p=1,M=new Float32Array(v*m*f),x=new Float32Array(g*m*f),_=new Float32Array(p*m*f);for(let E=0;E<f;E++){const A=E%3*2/3-1,P=E>2?0:-1,b=[A,P,0,A+2/3,P,0,A+2/3,P+1,0,A,P,0,A+2/3,P+1,0,A,P+1,0];M.set(b,v*m*E),x.set(d,g*m*E);const y=[E,E,E,E,E,E];_.set(y,p*m*E)}const C=new xe;C.setAttribute("position",new Ge(M,v)),C.setAttribute("uv",new Ge(x,g)),C.setAttribute("faceIndex",new Ge(_,p)),t.push(C),n>En&&n--}return{lodPlanes:t,sizeLods:e,sigmas:i}}function Cl(s,t,e){const i=new tn(s,t,e);return i.texture.mapping=Er,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Bs(s,t,e,i,n){s.viewport.set(t,e,i,n),s.scissor.set(t,e,i,n)}function Pp(s,t,e){const i=new Float32Array(ji),n=new T(0,1,0);return new zi({name:"SphericalGaussianBlur",defines:{n:ji,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:n}},vertexShader:Oo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Ui,depthTest:!1,depthWrite:!1})}function Pl(){return new zi({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Oo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Ui,depthTest:!1,depthWrite:!1})}function Ll(){return new zi({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Oo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Ui,depthTest:!1,depthWrite:!1})}function Oo(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Lp(s){let t=new WeakMap,e=null;function i(o){if(o&&o.isTexture){const l=o.mapping,c=l===Oa||l===za,h=l===Un||l===Nn;if(c||h){let u=t.get(o);const d=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return e===null&&(e=new pr(s)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),u.texture;if(u!==void 0)return u.texture;{const f=o.image;return c&&f&&f.height>0||h&&f&&n(f)?(e===null&&(e=new pr(s)),u=c?e.fromEquirectangular(o):e.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),o.addEventListener("dispose",r),u.texture):null}}}return o}function n(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:i,dispose:a}}function Dp(s){const t={};function e(i){if(t[i]!==void 0)return t[i];let n;switch(i){case"WEBGL_depth_texture":n=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":n=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":n=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":n=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:n=s.getExtension(i)}return t[i]=n,n}return{has:function(i){return e(i)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(i){const n=e(i);return n===null&&as("THREE.WebGLRenderer: "+i+" extension not supported."),n}}}function Ip(s,t,e,i){const n={},r=new WeakMap;function a(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const m in d.attributes)t.remove(d.attributes[m]);for(const m in d.morphAttributes){const v=d.morphAttributes[m];for(let g=0,p=v.length;g<p;g++)t.remove(v[g])}d.removeEventListener("dispose",a),delete n[d.id];const f=r.get(d);f&&(t.remove(f),r.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return n[d.id]===!0||(d.addEventListener("dispose",a),n[d.id]=!0,e.memory.geometries++),d}function l(u){const d=u.attributes;for(const m in d)t.update(d[m],s.ARRAY_BUFFER);const f=u.morphAttributes;for(const m in f){const v=f[m];for(let g=0,p=v.length;g<p;g++)t.update(v[g],s.ARRAY_BUFFER)}}function c(u){const d=[],f=u.index,m=u.attributes.position;let v=0;if(f!==null){const M=f.array;v=f.version;for(let x=0,_=M.length;x<_;x+=3){const C=M[x+0],E=M[x+1],A=M[x+2];d.push(C,E,E,A,A,C)}}else if(m!==void 0){const M=m.array;v=m.version;for(let x=0,_=M.length/3-1;x<_;x+=3){const C=x+0,E=x+1,A=x+2;d.push(C,E,E,A,A,C)}}else return;const g=new(Fc(d)?Gc:Vc)(d,1);g.version=v;const p=r.get(u);p&&t.remove(p),r.set(u,g)}function h(u){const d=r.get(u);if(d){const f=u.index;f!==null&&d.version<f.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function Up(s,t,e){let i;function n(d){i=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,f){s.drawElements(i,f,r,d*a),e.update(f,i,1)}function c(d,f,m){m!==0&&(s.drawElementsInstanced(i,f,r,d*a,m),e.update(f,i,m))}function h(d,f,m){if(m===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,f,0,r,d,0,m);let g=0;for(let p=0;p<m;p++)g+=f[p];e.update(g,i,1)}function u(d,f,m,v){if(m===0)return;const g=t.get("WEBGL_multi_draw");if(g===null)for(let p=0;p<d.length;p++)c(d[p]/a,f[p],v[p]);else{g.multiDrawElementsInstancedWEBGL(i,f,0,r,d,0,v,0,m);let p=0;for(let M=0;M<m;M++)p+=f[M]*v[M];e.update(p,i,1)}}this.setMode=n,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function Np(s){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,a,o){switch(e.calls++,a){case s.TRIANGLES:e.triangles+=o*(r/3);break;case s.LINES:e.lines+=o*(r/2);break;case s.LINE_STRIP:e.lines+=o*(r-1);break;case s.LINE_LOOP:e.lines+=o*r;break;case s.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function n(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:n,update:i}}function Fp(s,t,e){const i=new WeakMap,n=new te;function r(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let d=i.get(o);if(d===void 0||d.count!==u){let y=function(){P.dispose(),i.delete(o),o.removeEventListener("dispose",y)};var f=y;d!==void 0&&d.texture.dispose();const m=o.morphAttributes.position!==void 0,v=o.morphAttributes.normal!==void 0,g=o.morphAttributes.color!==void 0,p=o.morphAttributes.position||[],M=o.morphAttributes.normal||[],x=o.morphAttributes.color||[];let _=0;m===!0&&(_=1),v===!0&&(_=2),g===!0&&(_=3);let C=o.attributes.position.count*_,E=1;C>t.maxTextureSize&&(E=Math.ceil(C/t.maxTextureSize),C=t.maxTextureSize);const A=new Float32Array(C*E*4*u),P=new zc(A,C,E,u);P.type=li,P.needsUpdate=!0;const b=_*4;for(let L=0;L<u;L++){const k=p[L],z=M[L],X=x[L],Y=C*E*4*L;for(let W=0;W<k.count;W++){const V=W*b;m===!0&&(n.fromBufferAttribute(k,W),A[Y+V+0]=n.x,A[Y+V+1]=n.y,A[Y+V+2]=n.z,A[Y+V+3]=0),v===!0&&(n.fromBufferAttribute(z,W),A[Y+V+4]=n.x,A[Y+V+5]=n.y,A[Y+V+6]=n.z,A[Y+V+7]=0),g===!0&&(n.fromBufferAttribute(X,W),A[Y+V+8]=n.x,A[Y+V+9]=n.y,A[Y+V+10]=n.z,A[Y+V+11]=X.itemSize===4?n.w:1)}}d={count:u,texture:P,size:new ot(C,E)},i.set(o,d),o.addEventListener("dispose",y)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(s,"morphTexture",a.morphTexture,e);else{let m=0;for(let g=0;g<c.length;g++)m+=c[g];const v=o.morphTargetsRelative?1:1-m;l.getUniforms().setValue(s,"morphTargetBaseInfluence",v),l.getUniforms().setValue(s,"morphTargetInfluences",c)}l.getUniforms().setValue(s,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(s,"morphTargetsTextureSize",d.size)}return{update:r}}function Op(s,t,e,i){let n=new WeakMap;function r(l){const c=i.render.frame,h=l.geometry,u=t.get(l,h);if(n.get(u)!==c&&(t.update(u),n.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),n.get(l)!==c&&(e.update(l.instanceMatrix,s.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,s.ARRAY_BUFFER),n.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;n.get(d)!==c&&(d.update(),n.set(d,c))}return u}function a(){n=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:a}}class Kc extends Ee{constructor(t,e,i,n,r,a,o,l,c,h=Ln){if(h!==Ln&&h!==On)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&h===Ln&&(i=Qi),i===void 0&&h===On&&(i=Fn),super(null,n,r,a,o,l,h,i,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:Ne,this.minFilter=l!==void 0?l:Ne,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const jc=new Ee,Dl=new Kc(1,1),Zc=new zc,Jc=new Su,Qc=new Xc,Il=[],Ul=[],Nl=new Float32Array(16),Fl=new Float32Array(9),Ol=new Float32Array(4);function Gn(s,t,e){const i=s[0];if(i<=0||i>0)return s;const n=t*e;let r=Il[n];if(r===void 0&&(r=new Float32Array(n),Il[n]=r),t!==0){i.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,s[a].toArray(r,o)}return r}function fe(s,t){if(s.length!==t.length)return!1;for(let e=0,i=s.length;e<i;e++)if(s[e]!==t[e])return!1;return!0}function pe(s,t){for(let e=0,i=t.length;e<i;e++)s[e]=t[e]}function Rr(s,t){let e=Ul[t];e===void 0&&(e=new Int32Array(t),Ul[t]=e);for(let i=0;i!==t;++i)e[i]=s.allocateTextureUnit();return e}function zp(s,t){const e=this.cache;e[0]!==t&&(s.uniform1f(this.addr,t),e[0]=t)}function kp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(fe(e,t))return;s.uniform2fv(this.addr,t),pe(e,t)}}function Bp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(s.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(fe(e,t))return;s.uniform3fv(this.addr,t),pe(e,t)}}function Hp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(fe(e,t))return;s.uniform4fv(this.addr,t),pe(e,t)}}function Vp(s,t){const e=this.cache,i=t.elements;if(i===void 0){if(fe(e,t))return;s.uniformMatrix2fv(this.addr,!1,t),pe(e,t)}else{if(fe(e,i))return;Ol.set(i),s.uniformMatrix2fv(this.addr,!1,Ol),pe(e,i)}}function Gp(s,t){const e=this.cache,i=t.elements;if(i===void 0){if(fe(e,t))return;s.uniformMatrix3fv(this.addr,!1,t),pe(e,t)}else{if(fe(e,i))return;Fl.set(i),s.uniformMatrix3fv(this.addr,!1,Fl),pe(e,i)}}function Wp(s,t){const e=this.cache,i=t.elements;if(i===void 0){if(fe(e,t))return;s.uniformMatrix4fv(this.addr,!1,t),pe(e,t)}else{if(fe(e,i))return;Nl.set(i),s.uniformMatrix4fv(this.addr,!1,Nl),pe(e,i)}}function $p(s,t){const e=this.cache;e[0]!==t&&(s.uniform1i(this.addr,t),e[0]=t)}function Xp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(fe(e,t))return;s.uniform2iv(this.addr,t),pe(e,t)}}function qp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(fe(e,t))return;s.uniform3iv(this.addr,t),pe(e,t)}}function Yp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(fe(e,t))return;s.uniform4iv(this.addr,t),pe(e,t)}}function Kp(s,t){const e=this.cache;e[0]!==t&&(s.uniform1ui(this.addr,t),e[0]=t)}function jp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(fe(e,t))return;s.uniform2uiv(this.addr,t),pe(e,t)}}function Zp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(fe(e,t))return;s.uniform3uiv(this.addr,t),pe(e,t)}}function Jp(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(fe(e,t))return;s.uniform4uiv(this.addr,t),pe(e,t)}}function Qp(s,t,e){const i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n);let r;this.type===s.SAMPLER_2D_SHADOW?(Dl.compareFunction=Nc,r=Dl):r=jc,e.setTexture2D(t||r,n)}function tm(s,t,e){const i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTexture3D(t||Jc,n)}function em(s,t,e){const i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTextureCube(t||Qc,n)}function im(s,t,e){const i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTexture2DArray(t||Zc,n)}function nm(s){switch(s){case 5126:return zp;case 35664:return kp;case 35665:return Bp;case 35666:return Hp;case 35674:return Vp;case 35675:return Gp;case 35676:return Wp;case 5124:case 35670:return $p;case 35667:case 35671:return Xp;case 35668:case 35672:return qp;case 35669:case 35673:return Yp;case 5125:return Kp;case 36294:return jp;case 36295:return Zp;case 36296:return Jp;case 35678:case 36198:case 36298:case 36306:case 35682:return Qp;case 35679:case 36299:case 36307:return tm;case 35680:case 36300:case 36308:case 36293:return em;case 36289:case 36303:case 36311:case 36292:return im}}function sm(s,t){s.uniform1fv(this.addr,t)}function rm(s,t){const e=Gn(t,this.size,2);s.uniform2fv(this.addr,e)}function am(s,t){const e=Gn(t,this.size,3);s.uniform3fv(this.addr,e)}function om(s,t){const e=Gn(t,this.size,4);s.uniform4fv(this.addr,e)}function lm(s,t){const e=Gn(t,this.size,4);s.uniformMatrix2fv(this.addr,!1,e)}function cm(s,t){const e=Gn(t,this.size,9);s.uniformMatrix3fv(this.addr,!1,e)}function hm(s,t){const e=Gn(t,this.size,16);s.uniformMatrix4fv(this.addr,!1,e)}function um(s,t){s.uniform1iv(this.addr,t)}function dm(s,t){s.uniform2iv(this.addr,t)}function fm(s,t){s.uniform3iv(this.addr,t)}function pm(s,t){s.uniform4iv(this.addr,t)}function mm(s,t){s.uniform1uiv(this.addr,t)}function gm(s,t){s.uniform2uiv(this.addr,t)}function vm(s,t){s.uniform3uiv(this.addr,t)}function _m(s,t){s.uniform4uiv(this.addr,t)}function xm(s,t,e){const i=this.cache,n=t.length,r=Rr(e,n);fe(i,r)||(s.uniform1iv(this.addr,r),pe(i,r));for(let a=0;a!==n;++a)e.setTexture2D(t[a]||jc,r[a])}function Mm(s,t,e){const i=this.cache,n=t.length,r=Rr(e,n);fe(i,r)||(s.uniform1iv(this.addr,r),pe(i,r));for(let a=0;a!==n;++a)e.setTexture3D(t[a]||Jc,r[a])}function ym(s,t,e){const i=this.cache,n=t.length,r=Rr(e,n);fe(i,r)||(s.uniform1iv(this.addr,r),pe(i,r));for(let a=0;a!==n;++a)e.setTextureCube(t[a]||Qc,r[a])}function Sm(s,t,e){const i=this.cache,n=t.length,r=Rr(e,n);fe(i,r)||(s.uniform1iv(this.addr,r),pe(i,r));for(let a=0;a!==n;++a)e.setTexture2DArray(t[a]||Zc,r[a])}function bm(s){switch(s){case 5126:return sm;case 35664:return rm;case 35665:return am;case 35666:return om;case 35674:return lm;case 35675:return cm;case 35676:return hm;case 5124:case 35670:return um;case 35667:case 35671:return dm;case 35668:case 35672:return fm;case 35669:case 35673:return pm;case 5125:return mm;case 36294:return gm;case 36295:return vm;case 36296:return _m;case 35678:case 36198:case 36298:case 36306:case 35682:return xm;case 35679:case 36299:case 36307:return Mm;case 35680:case 36300:case 36308:case 36293:return ym;case 36289:case 36303:case 36311:case 36292:return Sm}}class wm{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.setValue=nm(e.type)}}class Tm{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=bm(e.type)}}class Em{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,i){const n=this.seq;for(let r=0,a=n.length;r!==a;++r){const o=n[r];o.setValue(t,e[o.id],i)}}}const ha=/(\w+)(\])?(\[|\.)?/g;function zl(s,t){s.seq.push(t),s.map[t.id]=t}function Am(s,t,e){const i=s.name,n=i.length;for(ha.lastIndex=0;;){const r=ha.exec(i),a=ha.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===n){zl(e,c===void 0?new wm(o,s,t):new Tm(o,s,t));break}else{let u=e.map[o];u===void 0&&(u=new Em(o),zl(e,u)),e=u}}}class ar{constructor(t,e){this.seq=[],this.map={};const i=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let n=0;n<i;++n){const r=t.getActiveUniform(e,n),a=t.getUniformLocation(e,r.name);Am(r,a,this)}}setValue(t,e,i,n){const r=this.map[e];r!==void 0&&r.setValue(t,i,n)}setOptional(t,e,i){const n=e[i];n!==void 0&&this.setValue(t,i,n)}static upload(t,e,i,n){for(let r=0,a=e.length;r!==a;++r){const o=e[r],l=i[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,n)}}static seqWithValue(t,e){const i=[];for(let n=0,r=t.length;n!==r;++n){const a=t[n];a.id in e&&i.push(a)}return i}}function kl(s,t,e){const i=s.createShader(t);return s.shaderSource(i,e),s.compileShader(i),i}const Rm=37297;let Cm=0;function Pm(s,t){const e=s.split(`
`),i=[],n=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=n;a<r;a++){const o=a+1;i.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return i.join(`
`)}const Bl=new Nt;function Lm(s){Xt._getMatrix(Bl,Xt.workingColorSpace,s);const t=`mat3( ${Bl.elements.map(e=>e.toFixed(4))} )`;switch(Xt.getTransfer(s)){case Ar:return[t,"LinearTransferOETF"];case Jt:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",s),[t,"LinearTransferOETF"]}}function Hl(s,t,e){const i=s.getShaderParameter(t,s.COMPILE_STATUS),n=s.getShaderInfoLog(t).trim();if(i&&n==="")return"";const r=/ERROR: 0:(\d+)/.exec(n);if(r){const a=parseInt(r[1]);return e.toUpperCase()+`

`+n+`

`+Pm(s.getShaderSource(t),a)}else return n}function Dm(s,t){const e=Lm(t);return[`vec4 ${s}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function Im(s,t){let e;switch(t){case jh:e="Linear";break;case Zh:e="Reinhard";break;case Jh:e="Cineon";break;case Ao:e="ACESFilmic";break;case tu:e="AgX";break;case eu:e="Neutral";break;case Qh:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+s+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const Hs=new T;function Um(){Xt.getLuminanceCoefficients(Hs);const s=Hs.x.toFixed(4),t=Hs.y.toFixed(4),e=Hs.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Nm(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(os).join(`
`)}function Fm(s){const t=[];for(const e in s){const i=s[e];i!==!1&&t.push("#define "+e+" "+i)}return t.join(`
`)}function Om(s,t){const e={},i=s.getProgramParameter(t,s.ACTIVE_ATTRIBUTES);for(let n=0;n<i;n++){const r=s.getActiveAttrib(t,n),a=r.name;let o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:s.getAttribLocation(t,a),locationSize:o}}return e}function os(s){return s!==""}function Vl(s,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Gl(s,t){return s.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const zm=/^[ \t]*#include +<([\w\d./]+)>/gm;function go(s){return s.replace(zm,Bm)}const km=new Map;function Bm(s,t){let e=Ot[t];if(e===void 0){const i=km.get(t);if(i!==void 0)e=Ot[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("Can not resolve #include <"+t+">")}return go(e)}const Hm=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Wl(s){return s.replace(Hm,Vm)}function Vm(s,t,e,i){let n="";for(let r=parseInt(t);r<parseInt(e);r++)n+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return n}function $l(s){let t=`precision ${s.precision} float;
	precision ${s.precision} int;
	precision ${s.precision} sampler2D;
	precision ${s.precision} samplerCube;
	precision ${s.precision} sampler3D;
	precision ${s.precision} sampler2DArray;
	precision ${s.precision} sampler2DShadow;
	precision ${s.precision} samplerCubeShadow;
	precision ${s.precision} sampler2DArrayShadow;
	precision ${s.precision} isampler2D;
	precision ${s.precision} isampler3D;
	precision ${s.precision} isamplerCube;
	precision ${s.precision} isampler2DArray;
	precision ${s.precision} usampler2D;
	precision ${s.precision} usampler3D;
	precision ${s.precision} usamplerCube;
	precision ${s.precision} usampler2DArray;
	`;return s.precision==="highp"?t+=`
#define HIGH_PRECISION`:s.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Gm(s){let t="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===wc?t="SHADOWMAP_TYPE_PCF":s.shadowMapType===Ch?t="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===_i&&(t="SHADOWMAP_TYPE_VSM"),t}function Wm(s){let t="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case Un:case Nn:t="ENVMAP_TYPE_CUBE";break;case Er:t="ENVMAP_TYPE_CUBE_UV";break}return t}function $m(s){let t="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case Nn:t="ENVMAP_MODE_REFRACTION";break}return t}function Xm(s){let t="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case Eo:t="ENVMAP_BLENDING_MULTIPLY";break;case Yh:t="ENVMAP_BLENDING_MIX";break;case Kh:t="ENVMAP_BLENDING_ADD";break}return t}function qm(s){const t=s.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:i,maxMip:e}}function Ym(s,t,e,i){const n=s.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=Gm(e),c=Wm(e),h=$m(e),u=Xm(e),d=qm(e),f=Nm(e),m=Fm(r),v=n.createProgram();let g,p,M=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(g=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(os).join(`
`),g.length>0&&(g+=`
`),p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(os).join(`
`),p.length>0&&(p+=`
`)):(g=[$l(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(os).join(`
`),p=[$l(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Ni?"#define TONE_MAPPING":"",e.toneMapping!==Ni?Ot.tonemapping_pars_fragment:"",e.toneMapping!==Ni?Im("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Ot.colorspace_pars_fragment,Dm("linearToOutputTexel",e.outputColorSpace),Um(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(os).join(`
`)),a=go(a),a=Vl(a,e),a=Gl(a,e),o=go(o),o=Vl(o,e),o=Gl(o,e),a=Wl(a),o=Wl(o),e.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,g=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,p=["#define varying in",e.glslVersion===rl?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===rl?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const x=M+g+a,_=M+p+o,C=kl(n,n.VERTEX_SHADER,x),E=kl(n,n.FRAGMENT_SHADER,_);n.attachShader(v,C),n.attachShader(v,E),e.index0AttributeName!==void 0?n.bindAttribLocation(v,0,e.index0AttributeName):e.morphTargets===!0&&n.bindAttribLocation(v,0,"position"),n.linkProgram(v);function A(L){if(s.debug.checkShaderErrors){const k=n.getProgramInfoLog(v).trim(),z=n.getShaderInfoLog(C).trim(),X=n.getShaderInfoLog(E).trim();let Y=!0,W=!0;if(n.getProgramParameter(v,n.LINK_STATUS)===!1)if(Y=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(n,v,C,E);else{const V=Hl(n,C,"vertex"),O=Hl(n,E,"fragment");console.error("THREE.WebGLProgram: Shader Error "+n.getError()+" - VALIDATE_STATUS "+n.getProgramParameter(v,n.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+k+`
`+V+`
`+O)}else k!==""?console.warn("THREE.WebGLProgram: Program Info Log:",k):(z===""||X==="")&&(W=!1);W&&(L.diagnostics={runnable:Y,programLog:k,vertexShader:{log:z,prefix:g},fragmentShader:{log:X,prefix:p}})}n.deleteShader(C),n.deleteShader(E),P=new ar(n,v),b=Om(n,v)}let P;this.getUniforms=function(){return P===void 0&&A(this),P};let b;this.getAttributes=function(){return b===void 0&&A(this),b};let y=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return y===!1&&(y=n.getProgramParameter(v,Rm)),y},this.destroy=function(){i.releaseStatesOfProgram(this),n.deleteProgram(v),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=Cm++,this.cacheKey=t,this.usedTimes=1,this.program=v,this.vertexShader=C,this.fragmentShader=E,this}let Km=0;class jm{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,i=t.fragmentShader,n=this._getShaderStage(e),r=this._getShaderStage(i),a=this._getShaderCacheForMaterial(t);return a.has(n)===!1&&(a.add(n),n.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const i of e)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let i=e.get(t);return i===void 0&&(i=new Set,e.set(t,i)),i}_getShaderStage(t){const e=this.shaderCache;let i=e.get(t);return i===void 0&&(i=new Zm(t),e.set(t,i)),i}}class Zm{constructor(t){this.id=Km++,this.code=t,this.usedTimes=0}}function Jm(s,t,e,i,n,r,a){const o=new Bc,l=new jm,c=new Set,h=[],u=n.logarithmicDepthBuffer,d=n.vertexTextures;let f=n.precision;const m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function v(b){return c.add(b),b===0?"uv":`uv${b}`}function g(b,y,L,k,z){const X=k.fog,Y=z.geometry,W=b.isMeshStandardMaterial?k.environment:null,V=(b.isMeshStandardMaterial?e:t).get(b.envMap||W),O=V&&V.mapping===Er?V.image.height:null,J=m[b.type];b.precision!==null&&(f=n.getMaxPrecision(b.precision),f!==b.precision&&console.warn("THREE.WebGLProgram.getParameters:",b.precision,"not supported, using",f,"instead."));const it=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,dt=it!==void 0?it.length:0;let wt=0;Y.morphAttributes.position!==void 0&&(wt=1),Y.morphAttributes.normal!==void 0&&(wt=2),Y.morphAttributes.color!==void 0&&(wt=3);let Bt,$,Q,ft;if(J){const Zt=ri[J];Bt=Zt.vertexShader,$=Zt.fragmentShader}else Bt=b.vertexShader,$=b.fragmentShader,l.update(b),Q=l.getVertexShaderID(b),ft=l.getFragmentShaderID(b);const nt=s.getRenderTarget(),Rt=s.state.buffers.depth.getReversed(),Lt=z.isInstancedMesh===!0,zt=z.isBatchedMesh===!0,le=!!b.map,Wt=!!b.matcap,he=!!V,N=!!b.aoMap,Fe=!!b.lightMap,Ht=!!b.bumpMap,Vt=!!b.normalMap,Et=!!b.displacementMap,se=!!b.emissiveMap,Tt=!!b.metalnessMap,R=!!b.roughnessMap,S=b.anisotropy>0,F=b.clearcoat>0,K=b.dispersion>0,Z=b.iridescence>0,q=b.sheen>0,yt=b.transmission>0,lt=S&&!!b.anisotropyMap,pt=F&&!!b.clearcoatMap,$t=F&&!!b.clearcoatNormalMap,tt=F&&!!b.clearcoatRoughnessMap,mt=Z&&!!b.iridescenceMap,At=Z&&!!b.iridescenceThicknessMap,Ct=q&&!!b.sheenColorMap,gt=q&&!!b.sheenRoughnessMap,Gt=!!b.specularMap,Ft=!!b.specularColorMap,ie=!!b.specularIntensityMap,D=yt&&!!b.transmissionMap,at=yt&&!!b.thicknessMap,G=!!b.gradientMap,j=!!b.alphaMap,ut=b.alphaTest>0,ct=!!b.alphaHash,Dt=!!b.extensions;let ce=Ni;b.toneMapped&&(nt===null||nt.isXRRenderTarget===!0)&&(ce=s.toneMapping);const Me={shaderID:J,shaderType:b.type,shaderName:b.name,vertexShader:Bt,fragmentShader:$,defines:b.defines,customVertexShaderID:Q,customFragmentShaderID:ft,isRawShaderMaterial:b.isRawShaderMaterial===!0,glslVersion:b.glslVersion,precision:f,batching:zt,batchingColor:zt&&z._colorsTexture!==null,instancing:Lt,instancingColor:Lt&&z.instanceColor!==null,instancingMorph:Lt&&z.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:nt===null?s.outputColorSpace:nt.isXRRenderTarget===!0?nt.texture.colorSpace:Bn,alphaToCoverage:!!b.alphaToCoverage,map:le,matcap:Wt,envMap:he,envMapMode:he&&V.mapping,envMapCubeUVHeight:O,aoMap:N,lightMap:Fe,bumpMap:Ht,normalMap:Vt,displacementMap:d&&Et,emissiveMap:se,normalMapObjectSpace:Vt&&b.normalMapType===ru,normalMapTangentSpace:Vt&&b.normalMapType===No,metalnessMap:Tt,roughnessMap:R,anisotropy:S,anisotropyMap:lt,clearcoat:F,clearcoatMap:pt,clearcoatNormalMap:$t,clearcoatRoughnessMap:tt,dispersion:K,iridescence:Z,iridescenceMap:mt,iridescenceThicknessMap:At,sheen:q,sheenColorMap:Ct,sheenRoughnessMap:gt,specularMap:Gt,specularColorMap:Ft,specularIntensityMap:ie,transmission:yt,transmissionMap:D,thicknessMap:at,gradientMap:G,opaque:b.transparent===!1&&b.blending===Pn&&b.alphaToCoverage===!1,alphaMap:j,alphaTest:ut,alphaHash:ct,combine:b.combine,mapUv:le&&v(b.map.channel),aoMapUv:N&&v(b.aoMap.channel),lightMapUv:Fe&&v(b.lightMap.channel),bumpMapUv:Ht&&v(b.bumpMap.channel),normalMapUv:Vt&&v(b.normalMap.channel),displacementMapUv:Et&&v(b.displacementMap.channel),emissiveMapUv:se&&v(b.emissiveMap.channel),metalnessMapUv:Tt&&v(b.metalnessMap.channel),roughnessMapUv:R&&v(b.roughnessMap.channel),anisotropyMapUv:lt&&v(b.anisotropyMap.channel),clearcoatMapUv:pt&&v(b.clearcoatMap.channel),clearcoatNormalMapUv:$t&&v(b.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:tt&&v(b.clearcoatRoughnessMap.channel),iridescenceMapUv:mt&&v(b.iridescenceMap.channel),iridescenceThicknessMapUv:At&&v(b.iridescenceThicknessMap.channel),sheenColorMapUv:Ct&&v(b.sheenColorMap.channel),sheenRoughnessMapUv:gt&&v(b.sheenRoughnessMap.channel),specularMapUv:Gt&&v(b.specularMap.channel),specularColorMapUv:Ft&&v(b.specularColorMap.channel),specularIntensityMapUv:ie&&v(b.specularIntensityMap.channel),transmissionMapUv:D&&v(b.transmissionMap.channel),thicknessMapUv:at&&v(b.thicknessMap.channel),alphaMapUv:j&&v(b.alphaMap.channel),vertexTangents:!!Y.attributes.tangent&&(Vt||S),vertexColors:b.vertexColors,vertexAlphas:b.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,pointsUvs:z.isPoints===!0&&!!Y.attributes.uv&&(le||j),fog:!!X,useFog:b.fog===!0,fogExp2:!!X&&X.isFogExp2,flatShading:b.flatShading===!0,sizeAttenuation:b.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Rt,skinning:z.isSkinnedMesh===!0,morphTargets:Y.morphAttributes.position!==void 0,morphNormals:Y.morphAttributes.normal!==void 0,morphColors:Y.morphAttributes.color!==void 0,morphTargetsCount:dt,morphTextureStride:wt,numDirLights:y.directional.length,numPointLights:y.point.length,numSpotLights:y.spot.length,numSpotLightMaps:y.spotLightMap.length,numRectAreaLights:y.rectArea.length,numHemiLights:y.hemi.length,numDirLightShadows:y.directionalShadowMap.length,numPointLightShadows:y.pointShadowMap.length,numSpotLightShadows:y.spotShadowMap.length,numSpotLightShadowsWithMaps:y.numSpotLightShadowsWithMaps,numLightProbes:y.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:b.dithering,shadowMapEnabled:s.shadowMap.enabled&&L.length>0,shadowMapType:s.shadowMap.type,toneMapping:ce,decodeVideoTexture:le&&b.map.isVideoTexture===!0&&Xt.getTransfer(b.map.colorSpace)===Jt,decodeVideoTextureEmissive:se&&b.emissiveMap.isVideoTexture===!0&&Xt.getTransfer(b.emissiveMap.colorSpace)===Jt,premultipliedAlpha:b.premultipliedAlpha,doubleSided:b.side===Be,flipSided:b.side===Te,useDepthPacking:b.depthPacking>=0,depthPacking:b.depthPacking||0,index0AttributeName:b.index0AttributeName,extensionClipCullDistance:Dt&&b.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Dt&&b.extensions.multiDraw===!0||zt)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:b.customProgramCacheKey()};return Me.vertexUv1s=c.has(1),Me.vertexUv2s=c.has(2),Me.vertexUv3s=c.has(3),c.clear(),Me}function p(b){const y=[];if(b.shaderID?y.push(b.shaderID):(y.push(b.customVertexShaderID),y.push(b.customFragmentShaderID)),b.defines!==void 0)for(const L in b.defines)y.push(L),y.push(b.defines[L]);return b.isRawShaderMaterial===!1&&(M(y,b),x(y,b),y.push(s.outputColorSpace)),y.push(b.customProgramCacheKey),y.join()}function M(b,y){b.push(y.precision),b.push(y.outputColorSpace),b.push(y.envMapMode),b.push(y.envMapCubeUVHeight),b.push(y.mapUv),b.push(y.alphaMapUv),b.push(y.lightMapUv),b.push(y.aoMapUv),b.push(y.bumpMapUv),b.push(y.normalMapUv),b.push(y.displacementMapUv),b.push(y.emissiveMapUv),b.push(y.metalnessMapUv),b.push(y.roughnessMapUv),b.push(y.anisotropyMapUv),b.push(y.clearcoatMapUv),b.push(y.clearcoatNormalMapUv),b.push(y.clearcoatRoughnessMapUv),b.push(y.iridescenceMapUv),b.push(y.iridescenceThicknessMapUv),b.push(y.sheenColorMapUv),b.push(y.sheenRoughnessMapUv),b.push(y.specularMapUv),b.push(y.specularColorMapUv),b.push(y.specularIntensityMapUv),b.push(y.transmissionMapUv),b.push(y.thicknessMapUv),b.push(y.combine),b.push(y.fogExp2),b.push(y.sizeAttenuation),b.push(y.morphTargetsCount),b.push(y.morphAttributeCount),b.push(y.numDirLights),b.push(y.numPointLights),b.push(y.numSpotLights),b.push(y.numSpotLightMaps),b.push(y.numHemiLights),b.push(y.numRectAreaLights),b.push(y.numDirLightShadows),b.push(y.numPointLightShadows),b.push(y.numSpotLightShadows),b.push(y.numSpotLightShadowsWithMaps),b.push(y.numLightProbes),b.push(y.shadowMapType),b.push(y.toneMapping),b.push(y.numClippingPlanes),b.push(y.numClipIntersection),b.push(y.depthPacking)}function x(b,y){o.disableAll(),y.supportsVertexTextures&&o.enable(0),y.instancing&&o.enable(1),y.instancingColor&&o.enable(2),y.instancingMorph&&o.enable(3),y.matcap&&o.enable(4),y.envMap&&o.enable(5),y.normalMapObjectSpace&&o.enable(6),y.normalMapTangentSpace&&o.enable(7),y.clearcoat&&o.enable(8),y.iridescence&&o.enable(9),y.alphaTest&&o.enable(10),y.vertexColors&&o.enable(11),y.vertexAlphas&&o.enable(12),y.vertexUv1s&&o.enable(13),y.vertexUv2s&&o.enable(14),y.vertexUv3s&&o.enable(15),y.vertexTangents&&o.enable(16),y.anisotropy&&o.enable(17),y.alphaHash&&o.enable(18),y.batching&&o.enable(19),y.dispersion&&o.enable(20),y.batchingColor&&o.enable(21),b.push(o.mask),o.disableAll(),y.fog&&o.enable(0),y.useFog&&o.enable(1),y.flatShading&&o.enable(2),y.logarithmicDepthBuffer&&o.enable(3),y.reverseDepthBuffer&&o.enable(4),y.skinning&&o.enable(5),y.morphTargets&&o.enable(6),y.morphNormals&&o.enable(7),y.morphColors&&o.enable(8),y.premultipliedAlpha&&o.enable(9),y.shadowMapEnabled&&o.enable(10),y.doubleSided&&o.enable(11),y.flipSided&&o.enable(12),y.useDepthPacking&&o.enable(13),y.dithering&&o.enable(14),y.transmission&&o.enable(15),y.sheen&&o.enable(16),y.opaque&&o.enable(17),y.pointsUvs&&o.enable(18),y.decodeVideoTexture&&o.enable(19),y.decodeVideoTextureEmissive&&o.enable(20),y.alphaToCoverage&&o.enable(21),b.push(o.mask)}function _(b){const y=m[b.type];let L;if(y){const k=ri[y];L=Uu.clone(k.uniforms)}else L=b.uniforms;return L}function C(b,y){let L;for(let k=0,z=h.length;k<z;k++){const X=h[k];if(X.cacheKey===y){L=X,++L.usedTimes;break}}return L===void 0&&(L=new Ym(s,y,b,r),h.push(L)),L}function E(b){if(--b.usedTimes===0){const y=h.indexOf(b);h[y]=h[h.length-1],h.pop(),b.destroy()}}function A(b){l.remove(b)}function P(){l.dispose()}return{getParameters:g,getProgramCacheKey:p,getUniforms:_,acquireProgram:C,releaseProgram:E,releaseShaderCache:A,programs:h,dispose:P}}function Qm(){let s=new WeakMap;function t(a){return s.has(a)}function e(a){let o=s.get(a);return o===void 0&&(o={},s.set(a,o)),o}function i(a){s.delete(a)}function n(a,o,l){s.get(a)[o]=l}function r(){s=new WeakMap}return{has:t,get:e,remove:i,update:n,dispose:r}}function t0(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.material.id!==t.material.id?s.material.id-t.material.id:s.z!==t.z?s.z-t.z:s.id-t.id}function Xl(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.z!==t.z?t.z-s.z:s.id-t.id}function ql(){const s=[];let t=0;const e=[],i=[],n=[];function r(){t=0,e.length=0,i.length=0,n.length=0}function a(u,d,f,m,v,g){let p=s[t];return p===void 0?(p={id:u.id,object:u,geometry:d,material:f,groupOrder:m,renderOrder:u.renderOrder,z:v,group:g},s[t]=p):(p.id=u.id,p.object=u,p.geometry=d,p.material=f,p.groupOrder=m,p.renderOrder=u.renderOrder,p.z=v,p.group=g),t++,p}function o(u,d,f,m,v,g){const p=a(u,d,f,m,v,g);f.transmission>0?i.push(p):f.transparent===!0?n.push(p):e.push(p)}function l(u,d,f,m,v,g){const p=a(u,d,f,m,v,g);f.transmission>0?i.unshift(p):f.transparent===!0?n.unshift(p):e.unshift(p)}function c(u,d){e.length>1&&e.sort(u||t0),i.length>1&&i.sort(d||Xl),n.length>1&&n.sort(d||Xl)}function h(){for(let u=t,d=s.length;u<d;u++){const f=s[u];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:e,transmissive:i,transparent:n,init:r,push:o,unshift:l,finish:h,sort:c}}function e0(){let s=new WeakMap;function t(i,n){const r=s.get(i);let a;return r===void 0?(a=new ql,s.set(i,[a])):n>=r.length?(a=new ql,r.push(a)):a=r[n],a}function e(){s=new WeakMap}return{get:t,dispose:e}}function i0(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new T,color:new bt};break;case"SpotLight":e={position:new T,direction:new T,color:new bt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new T,color:new bt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new T,skyColor:new bt,groundColor:new bt};break;case"RectAreaLight":e={color:new bt,position:new T,halfWidth:new T,halfHeight:new T};break}return s[t.id]=e,e}}}function n0(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ot};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ot};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ot,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[t.id]=e,e}}}let s0=0;function r0(s,t){return(t.castShadow?2:0)-(s.castShadow?2:0)+(t.map?1:0)-(s.map?1:0)}function a0(s){const t=new i0,e=n0(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new T);const n=new T,r=new Yt,a=new Yt;function o(c){let h=0,u=0,d=0;for(let b=0;b<9;b++)i.probe[b].set(0,0,0);let f=0,m=0,v=0,g=0,p=0,M=0,x=0,_=0,C=0,E=0,A=0;c.sort(r0);for(let b=0,y=c.length;b<y;b++){const L=c[b],k=L.color,z=L.intensity,X=L.distance,Y=L.shadow&&L.shadow.map?L.shadow.map.texture:null;if(L.isAmbientLight)h+=k.r*z,u+=k.g*z,d+=k.b*z;else if(L.isLightProbe){for(let W=0;W<9;W++)i.probe[W].addScaledVector(L.sh.coefficients[W],z);A++}else if(L.isDirectionalLight){const W=t.get(L);if(W.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){const V=L.shadow,O=e.get(L);O.shadowIntensity=V.intensity,O.shadowBias=V.bias,O.shadowNormalBias=V.normalBias,O.shadowRadius=V.radius,O.shadowMapSize=V.mapSize,i.directionalShadow[f]=O,i.directionalShadowMap[f]=Y,i.directionalShadowMatrix[f]=L.shadow.matrix,M++}i.directional[f]=W,f++}else if(L.isSpotLight){const W=t.get(L);W.position.setFromMatrixPosition(L.matrixWorld),W.color.copy(k).multiplyScalar(z),W.distance=X,W.coneCos=Math.cos(L.angle),W.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),W.decay=L.decay,i.spot[v]=W;const V=L.shadow;if(L.map&&(i.spotLightMap[C]=L.map,C++,V.updateMatrices(L),L.castShadow&&E++),i.spotLightMatrix[v]=V.matrix,L.castShadow){const O=e.get(L);O.shadowIntensity=V.intensity,O.shadowBias=V.bias,O.shadowNormalBias=V.normalBias,O.shadowRadius=V.radius,O.shadowMapSize=V.mapSize,i.spotShadow[v]=O,i.spotShadowMap[v]=Y,_++}v++}else if(L.isRectAreaLight){const W=t.get(L);W.color.copy(k).multiplyScalar(z),W.halfWidth.set(L.width*.5,0,0),W.halfHeight.set(0,L.height*.5,0),i.rectArea[g]=W,g++}else if(L.isPointLight){const W=t.get(L);if(W.color.copy(L.color).multiplyScalar(L.intensity),W.distance=L.distance,W.decay=L.decay,L.castShadow){const V=L.shadow,O=e.get(L);O.shadowIntensity=V.intensity,O.shadowBias=V.bias,O.shadowNormalBias=V.normalBias,O.shadowRadius=V.radius,O.shadowMapSize=V.mapSize,O.shadowCameraNear=V.camera.near,O.shadowCameraFar=V.camera.far,i.pointShadow[m]=O,i.pointShadowMap[m]=Y,i.pointShadowMatrix[m]=L.shadow.matrix,x++}i.point[m]=W,m++}else if(L.isHemisphereLight){const W=t.get(L);W.skyColor.copy(L.color).multiplyScalar(z),W.groundColor.copy(L.groundColor).multiplyScalar(z),i.hemi[p]=W,p++}}g>0&&(s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=rt.LTC_FLOAT_1,i.rectAreaLTC2=rt.LTC_FLOAT_2):(i.rectAreaLTC1=rt.LTC_HALF_1,i.rectAreaLTC2=rt.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=u,i.ambient[2]=d;const P=i.hash;(P.directionalLength!==f||P.pointLength!==m||P.spotLength!==v||P.rectAreaLength!==g||P.hemiLength!==p||P.numDirectionalShadows!==M||P.numPointShadows!==x||P.numSpotShadows!==_||P.numSpotMaps!==C||P.numLightProbes!==A)&&(i.directional.length=f,i.spot.length=v,i.rectArea.length=g,i.point.length=m,i.hemi.length=p,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.pointShadow.length=x,i.pointShadowMap.length=x,i.spotShadow.length=_,i.spotShadowMap.length=_,i.directionalShadowMatrix.length=M,i.pointShadowMatrix.length=x,i.spotLightMatrix.length=_+C-E,i.spotLightMap.length=C,i.numSpotLightShadowsWithMaps=E,i.numLightProbes=A,P.directionalLength=f,P.pointLength=m,P.spotLength=v,P.rectAreaLength=g,P.hemiLength=p,P.numDirectionalShadows=M,P.numPointShadows=x,P.numSpotShadows=_,P.numSpotMaps=C,P.numLightProbes=A,i.version=s0++)}function l(c,h){let u=0,d=0,f=0,m=0,v=0;const g=h.matrixWorldInverse;for(let p=0,M=c.length;p<M;p++){const x=c[p];if(x.isDirectionalLight){const _=i.directional[u];_.direction.setFromMatrixPosition(x.matrixWorld),n.setFromMatrixPosition(x.target.matrixWorld),_.direction.sub(n),_.direction.transformDirection(g),u++}else if(x.isSpotLight){const _=i.spot[f];_.position.setFromMatrixPosition(x.matrixWorld),_.position.applyMatrix4(g),_.direction.setFromMatrixPosition(x.matrixWorld),n.setFromMatrixPosition(x.target.matrixWorld),_.direction.sub(n),_.direction.transformDirection(g),f++}else if(x.isRectAreaLight){const _=i.rectArea[m];_.position.setFromMatrixPosition(x.matrixWorld),_.position.applyMatrix4(g),a.identity(),r.copy(x.matrixWorld),r.premultiply(g),a.extractRotation(r),_.halfWidth.set(x.width*.5,0,0),_.halfHeight.set(0,x.height*.5,0),_.halfWidth.applyMatrix4(a),_.halfHeight.applyMatrix4(a),m++}else if(x.isPointLight){const _=i.point[d];_.position.setFromMatrixPosition(x.matrixWorld),_.position.applyMatrix4(g),d++}else if(x.isHemisphereLight){const _=i.hemi[v];_.direction.setFromMatrixPosition(x.matrixWorld),_.direction.transformDirection(g),v++}}}return{setup:o,setupView:l,state:i}}function Yl(s){const t=new a0(s),e=[],i=[];function n(h){c.camera=h,e.length=0,i.length=0}function r(h){e.push(h)}function a(h){i.push(h)}function o(){t.setup(e)}function l(h){t.setupView(e,h)}const c={lightsArray:e,shadowsArray:i,camera:null,lights:t,transmissionRenderTarget:{}};return{init:n,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function o0(s){let t=new WeakMap;function e(n,r=0){const a=t.get(n);let o;return a===void 0?(o=new Yl(s),t.set(n,[o])):r>=a.length?(o=new Yl(s),a.push(o)):o=a[r],o}function i(){t=new WeakMap}return{get:e,dispose:i}}class l0 extends ki{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=nu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class c0 extends ki{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const h0=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,u0=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function d0(s,t,e){let i=new Fo;const n=new ot,r=new ot,a=new te,o=new l0({depthPacking:su}),l=new c0,c={},h=e.maxTextureSize,u={[Oi]:Te,[Te]:Oi,[Be]:Be},d=new zi({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ot},radius:{value:4}},vertexShader:h0,fragmentShader:u0}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const m=new xe;m.setAttribute("position",new Ge(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new st(m,d),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=wc;let p=this.type;this.render=function(E,A,P){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||E.length===0)return;const b=s.getRenderTarget(),y=s.getActiveCubeFace(),L=s.getActiveMipmapLevel(),k=s.state;k.setBlending(Ui),k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);const z=p!==_i&&this.type===_i,X=p===_i&&this.type!==_i;for(let Y=0,W=E.length;Y<W;Y++){const V=E[Y],O=V.shadow;if(O===void 0){console.warn("THREE.WebGLShadowMap:",V,"has no shadow.");continue}if(O.autoUpdate===!1&&O.needsUpdate===!1)continue;n.copy(O.mapSize);const J=O.getFrameExtents();if(n.multiply(J),r.copy(O.mapSize),(n.x>h||n.y>h)&&(n.x>h&&(r.x=Math.floor(h/J.x),n.x=r.x*J.x,O.mapSize.x=r.x),n.y>h&&(r.y=Math.floor(h/J.y),n.y=r.y*J.y,O.mapSize.y=r.y)),O.map===null||z===!0||X===!0){const dt=this.type!==_i?{minFilter:Ne,magFilter:Ne}:{};O.map!==null&&O.map.dispose(),O.map=new tn(n.x,n.y,dt),O.map.texture.name=V.name+".shadowMap",O.camera.updateProjectionMatrix()}s.setRenderTarget(O.map),s.clear();const it=O.getViewportCount();for(let dt=0;dt<it;dt++){const wt=O.getViewport(dt);a.set(r.x*wt.x,r.y*wt.y,r.x*wt.z,r.y*wt.w),k.viewport(a),O.updateMatrices(V,dt),i=O.getFrustum(),_(A,P,O.camera,V,this.type)}O.isPointLightShadow!==!0&&this.type===_i&&M(O,P),O.needsUpdate=!1}p=this.type,g.needsUpdate=!1,s.setRenderTarget(b,y,L)};function M(E,A){const P=t.update(v);d.defines.VSM_SAMPLES!==E.blurSamples&&(d.defines.VSM_SAMPLES=E.blurSamples,f.defines.VSM_SAMPLES=E.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new tn(n.x,n.y)),d.uniforms.shadow_pass.value=E.map.texture,d.uniforms.resolution.value=E.mapSize,d.uniforms.radius.value=E.radius,s.setRenderTarget(E.mapPass),s.clear(),s.renderBufferDirect(A,null,P,d,v,null),f.uniforms.shadow_pass.value=E.mapPass.texture,f.uniforms.resolution.value=E.mapSize,f.uniforms.radius.value=E.radius,s.setRenderTarget(E.map),s.clear(),s.renderBufferDirect(A,null,P,f,v,null)}function x(E,A,P,b){let y=null;const L=P.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(L!==void 0)y=L;else if(y=P.isPointLight===!0?l:o,s.localClippingEnabled&&A.clipShadows===!0&&Array.isArray(A.clippingPlanes)&&A.clippingPlanes.length!==0||A.displacementMap&&A.displacementScale!==0||A.alphaMap&&A.alphaTest>0||A.map&&A.alphaTest>0){const k=y.uuid,z=A.uuid;let X=c[k];X===void 0&&(X={},c[k]=X);let Y=X[z];Y===void 0&&(Y=y.clone(),X[z]=Y,A.addEventListener("dispose",C)),y=Y}if(y.visible=A.visible,y.wireframe=A.wireframe,b===_i?y.side=A.shadowSide!==null?A.shadowSide:A.side:y.side=A.shadowSide!==null?A.shadowSide:u[A.side],y.alphaMap=A.alphaMap,y.alphaTest=A.alphaTest,y.map=A.map,y.clipShadows=A.clipShadows,y.clippingPlanes=A.clippingPlanes,y.clipIntersection=A.clipIntersection,y.displacementMap=A.displacementMap,y.displacementScale=A.displacementScale,y.displacementBias=A.displacementBias,y.wireframeLinewidth=A.wireframeLinewidth,y.linewidth=A.linewidth,P.isPointLight===!0&&y.isMeshDistanceMaterial===!0){const k=s.properties.get(y);k.light=P}return y}function _(E,A,P,b,y){if(E.visible===!1)return;if(E.layers.test(A.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&y===_i)&&(!E.frustumCulled||i.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(P.matrixWorldInverse,E.matrixWorld);const z=t.update(E),X=E.material;if(Array.isArray(X)){const Y=z.groups;for(let W=0,V=Y.length;W<V;W++){const O=Y[W],J=X[O.materialIndex];if(J&&J.visible){const it=x(E,J,b,y);E.onBeforeShadow(s,E,A,P,z,it,O),s.renderBufferDirect(P,null,z,it,E,O),E.onAfterShadow(s,E,A,P,z,it,O)}}}else if(X.visible){const Y=x(E,X,b,y);E.onBeforeShadow(s,E,A,P,z,Y,null),s.renderBufferDirect(P,null,z,Y,E,null),E.onAfterShadow(s,E,A,P,z,Y,null)}}const k=E.children;for(let z=0,X=k.length;z<X;z++)_(k[z],A,P,b,y)}function C(E){E.target.removeEventListener("dispose",C);for(const P in c){const b=c[P],y=E.target.uuid;y in b&&(b[y].dispose(),delete b[y])}}}const f0={[Pa]:La,[Da]:Na,[Ia]:Fa,[In]:Ua,[La]:Pa,[Na]:Da,[Fa]:Ia,[Ua]:In};function p0(s,t){function e(){let D=!1;const at=new te;let G=null;const j=new te(0,0,0,0);return{setMask:function(ut){G!==ut&&!D&&(s.colorMask(ut,ut,ut,ut),G=ut)},setLocked:function(ut){D=ut},setClear:function(ut,ct,Dt,ce,Me){Me===!0&&(ut*=ce,ct*=ce,Dt*=ce),at.set(ut,ct,Dt,ce),j.equals(at)===!1&&(s.clearColor(ut,ct,Dt,ce),j.copy(at))},reset:function(){D=!1,G=null,j.set(-1,0,0,0)}}}function i(){let D=!1,at=!1,G=null,j=null,ut=null;return{setReversed:function(ct){if(at!==ct){const Dt=t.get("EXT_clip_control");at?Dt.clipControlEXT(Dt.LOWER_LEFT_EXT,Dt.ZERO_TO_ONE_EXT):Dt.clipControlEXT(Dt.LOWER_LEFT_EXT,Dt.NEGATIVE_ONE_TO_ONE_EXT);const ce=ut;ut=null,this.setClear(ce)}at=ct},getReversed:function(){return at},setTest:function(ct){ct?nt(s.DEPTH_TEST):Rt(s.DEPTH_TEST)},setMask:function(ct){G!==ct&&!D&&(s.depthMask(ct),G=ct)},setFunc:function(ct){if(at&&(ct=f0[ct]),j!==ct){switch(ct){case Pa:s.depthFunc(s.NEVER);break;case La:s.depthFunc(s.ALWAYS);break;case Da:s.depthFunc(s.LESS);break;case In:s.depthFunc(s.LEQUAL);break;case Ia:s.depthFunc(s.EQUAL);break;case Ua:s.depthFunc(s.GEQUAL);break;case Na:s.depthFunc(s.GREATER);break;case Fa:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}j=ct}},setLocked:function(ct){D=ct},setClear:function(ct){ut!==ct&&(at&&(ct=1-ct),s.clearDepth(ct),ut=ct)},reset:function(){D=!1,G=null,j=null,ut=null,at=!1}}}function n(){let D=!1,at=null,G=null,j=null,ut=null,ct=null,Dt=null,ce=null,Me=null;return{setTest:function(Zt){D||(Zt?nt(s.STENCIL_TEST):Rt(s.STENCIL_TEST))},setMask:function(Zt){at!==Zt&&!D&&(s.stencilMask(Zt),at=Zt)},setFunc:function(Zt,$e,hi){(G!==Zt||j!==$e||ut!==hi)&&(s.stencilFunc(Zt,$e,hi),G=Zt,j=$e,ut=hi)},setOp:function(Zt,$e,hi){(ct!==Zt||Dt!==$e||ce!==hi)&&(s.stencilOp(Zt,$e,hi),ct=Zt,Dt=$e,ce=hi)},setLocked:function(Zt){D=Zt},setClear:function(Zt){Me!==Zt&&(s.clearStencil(Zt),Me=Zt)},reset:function(){D=!1,at=null,G=null,j=null,ut=null,ct=null,Dt=null,ce=null,Me=null}}}const r=new e,a=new i,o=new n,l=new WeakMap,c=new WeakMap;let h={},u={},d=new WeakMap,f=[],m=null,v=!1,g=null,p=null,M=null,x=null,_=null,C=null,E=null,A=new bt(0,0,0),P=0,b=!1,y=null,L=null,k=null,z=null,X=null;const Y=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let W=!1,V=0;const O=s.getParameter(s.VERSION);O.indexOf("WebGL")!==-1?(V=parseFloat(/^WebGL (\d)/.exec(O)[1]),W=V>=1):O.indexOf("OpenGL ES")!==-1&&(V=parseFloat(/^OpenGL ES (\d)/.exec(O)[1]),W=V>=2);let J=null,it={};const dt=s.getParameter(s.SCISSOR_BOX),wt=s.getParameter(s.VIEWPORT),Bt=new te().fromArray(dt),$=new te().fromArray(wt);function Q(D,at,G,j){const ut=new Uint8Array(4),ct=s.createTexture();s.bindTexture(D,ct),s.texParameteri(D,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(D,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Dt=0;Dt<G;Dt++)D===s.TEXTURE_3D||D===s.TEXTURE_2D_ARRAY?s.texImage3D(at,0,s.RGBA,1,1,j,0,s.RGBA,s.UNSIGNED_BYTE,ut):s.texImage2D(at+Dt,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,ut);return ct}const ft={};ft[s.TEXTURE_2D]=Q(s.TEXTURE_2D,s.TEXTURE_2D,1),ft[s.TEXTURE_CUBE_MAP]=Q(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),ft[s.TEXTURE_2D_ARRAY]=Q(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),ft[s.TEXTURE_3D]=Q(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),nt(s.DEPTH_TEST),a.setFunc(In),Ht(!1),Vt(el),nt(s.CULL_FACE),N(Ui);function nt(D){h[D]!==!0&&(s.enable(D),h[D]=!0)}function Rt(D){h[D]!==!1&&(s.disable(D),h[D]=!1)}function Lt(D,at){return u[D]!==at?(s.bindFramebuffer(D,at),u[D]=at,D===s.DRAW_FRAMEBUFFER&&(u[s.FRAMEBUFFER]=at),D===s.FRAMEBUFFER&&(u[s.DRAW_FRAMEBUFFER]=at),!0):!1}function zt(D,at){let G=f,j=!1;if(D){G=d.get(at),G===void 0&&(G=[],d.set(at,G));const ut=D.textures;if(G.length!==ut.length||G[0]!==s.COLOR_ATTACHMENT0){for(let ct=0,Dt=ut.length;ct<Dt;ct++)G[ct]=s.COLOR_ATTACHMENT0+ct;G.length=ut.length,j=!0}}else G[0]!==s.BACK&&(G[0]=s.BACK,j=!0);j&&s.drawBuffers(G)}function le(D){return m!==D?(s.useProgram(D),m=D,!0):!1}const Wt={[Ki]:s.FUNC_ADD,[Lh]:s.FUNC_SUBTRACT,[Dh]:s.FUNC_REVERSE_SUBTRACT};Wt[Ih]=s.MIN,Wt[Uh]=s.MAX;const he={[Nh]:s.ZERO,[Fh]:s.ONE,[Oh]:s.SRC_COLOR,[Ra]:s.SRC_ALPHA,[Gh]:s.SRC_ALPHA_SATURATE,[Hh]:s.DST_COLOR,[kh]:s.DST_ALPHA,[zh]:s.ONE_MINUS_SRC_COLOR,[Ca]:s.ONE_MINUS_SRC_ALPHA,[Vh]:s.ONE_MINUS_DST_COLOR,[Bh]:s.ONE_MINUS_DST_ALPHA,[Wh]:s.CONSTANT_COLOR,[$h]:s.ONE_MINUS_CONSTANT_COLOR,[Xh]:s.CONSTANT_ALPHA,[qh]:s.ONE_MINUS_CONSTANT_ALPHA};function N(D,at,G,j,ut,ct,Dt,ce,Me,Zt){if(D===Ui){v===!0&&(Rt(s.BLEND),v=!1);return}if(v===!1&&(nt(s.BLEND),v=!0),D!==Ph){if(D!==g||Zt!==b){if((p!==Ki||_!==Ki)&&(s.blendEquation(s.FUNC_ADD),p=Ki,_=Ki),Zt)switch(D){case Pn:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Aa:s.blendFunc(s.ONE,s.ONE);break;case il:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case nl:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case Pn:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Aa:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case il:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case nl:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}M=null,x=null,C=null,E=null,A.set(0,0,0),P=0,g=D,b=Zt}return}ut=ut||at,ct=ct||G,Dt=Dt||j,(at!==p||ut!==_)&&(s.blendEquationSeparate(Wt[at],Wt[ut]),p=at,_=ut),(G!==M||j!==x||ct!==C||Dt!==E)&&(s.blendFuncSeparate(he[G],he[j],he[ct],he[Dt]),M=G,x=j,C=ct,E=Dt),(ce.equals(A)===!1||Me!==P)&&(s.blendColor(ce.r,ce.g,ce.b,Me),A.copy(ce),P=Me),g=D,b=!1}function Fe(D,at){D.side===Be?Rt(s.CULL_FACE):nt(s.CULL_FACE);let G=D.side===Te;at&&(G=!G),Ht(G),D.blending===Pn&&D.transparent===!1?N(Ui):N(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),a.setFunc(D.depthFunc),a.setTest(D.depthTest),a.setMask(D.depthWrite),r.setMask(D.colorWrite);const j=D.stencilWrite;o.setTest(j),j&&(o.setMask(D.stencilWriteMask),o.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),o.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),se(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?nt(s.SAMPLE_ALPHA_TO_COVERAGE):Rt(s.SAMPLE_ALPHA_TO_COVERAGE)}function Ht(D){y!==D&&(D?s.frontFace(s.CW):s.frontFace(s.CCW),y=D)}function Vt(D){D!==Ah?(nt(s.CULL_FACE),D!==L&&(D===el?s.cullFace(s.BACK):D===Rh?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):Rt(s.CULL_FACE),L=D}function Et(D){D!==k&&(W&&s.lineWidth(D),k=D)}function se(D,at,G){D?(nt(s.POLYGON_OFFSET_FILL),(z!==at||X!==G)&&(s.polygonOffset(at,G),z=at,X=G)):Rt(s.POLYGON_OFFSET_FILL)}function Tt(D){D?nt(s.SCISSOR_TEST):Rt(s.SCISSOR_TEST)}function R(D){D===void 0&&(D=s.TEXTURE0+Y-1),J!==D&&(s.activeTexture(D),J=D)}function S(D,at,G){G===void 0&&(J===null?G=s.TEXTURE0+Y-1:G=J);let j=it[G];j===void 0&&(j={type:void 0,texture:void 0},it[G]=j),(j.type!==D||j.texture!==at)&&(J!==G&&(s.activeTexture(G),J=G),s.bindTexture(D,at||ft[D]),j.type=D,j.texture=at)}function F(){const D=it[J];D!==void 0&&D.type!==void 0&&(s.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function K(){try{s.compressedTexImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Z(){try{s.compressedTexImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function q(){try{s.texSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function yt(){try{s.texSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function lt(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function pt(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function $t(){try{s.texStorage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function tt(){try{s.texStorage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function mt(){try{s.texImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function At(){try{s.texImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ct(D){Bt.equals(D)===!1&&(s.scissor(D.x,D.y,D.z,D.w),Bt.copy(D))}function gt(D){$.equals(D)===!1&&(s.viewport(D.x,D.y,D.z,D.w),$.copy(D))}function Gt(D,at){let G=c.get(at);G===void 0&&(G=new WeakMap,c.set(at,G));let j=G.get(D);j===void 0&&(j=s.getUniformBlockIndex(at,D.name),G.set(D,j))}function Ft(D,at){const j=c.get(at).get(D);l.get(at)!==j&&(s.uniformBlockBinding(at,j,D.__bindingPointIndex),l.set(at,j))}function ie(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),a.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),h={},J=null,it={},u={},d=new WeakMap,f=[],m=null,v=!1,g=null,p=null,M=null,x=null,_=null,C=null,E=null,A=new bt(0,0,0),P=0,b=!1,y=null,L=null,k=null,z=null,X=null,Bt.set(0,0,s.canvas.width,s.canvas.height),$.set(0,0,s.canvas.width,s.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:nt,disable:Rt,bindFramebuffer:Lt,drawBuffers:zt,useProgram:le,setBlending:N,setMaterial:Fe,setFlipSided:Ht,setCullFace:Vt,setLineWidth:Et,setPolygonOffset:se,setScissorTest:Tt,activeTexture:R,bindTexture:S,unbindTexture:F,compressedTexImage2D:K,compressedTexImage3D:Z,texImage2D:mt,texImage3D:At,updateUBOMapping:Gt,uniformBlockBinding:Ft,texStorage2D:$t,texStorage3D:tt,texSubImage2D:q,texSubImage3D:yt,compressedTexSubImage2D:lt,compressedTexSubImage3D:pt,scissor:Ct,viewport:gt,reset:ie}}function Kl(s,t,e,i){const n=m0(i);switch(e){case Cc:return s*t;case Lc:return s*t;case Dc:return s*t*2;case Lo:return s*t/n.components*n.byteLength;case Do:return s*t/n.components*n.byteLength;case Ic:return s*t*2/n.components*n.byteLength;case Io:return s*t*2/n.components*n.byteLength;case Pc:return s*t*3/n.components*n.byteLength;case je:return s*t*4/n.components*n.byteLength;case Uo:return s*t*4/n.components*n.byteLength;case er:case ir:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*8;case nr:case sr:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case Va:case Wa:return Math.max(s,16)*Math.max(t,8)/4;case Ha:case Ga:return Math.max(s,8)*Math.max(t,8)/2;case $a:case Xa:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*8;case qa:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case Ya:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case Ka:return Math.floor((s+4)/5)*Math.floor((t+3)/4)*16;case ja:return Math.floor((s+4)/5)*Math.floor((t+4)/5)*16;case Za:return Math.floor((s+5)/6)*Math.floor((t+4)/5)*16;case Ja:return Math.floor((s+5)/6)*Math.floor((t+5)/6)*16;case Qa:return Math.floor((s+7)/8)*Math.floor((t+4)/5)*16;case to:return Math.floor((s+7)/8)*Math.floor((t+5)/6)*16;case eo:return Math.floor((s+7)/8)*Math.floor((t+7)/8)*16;case io:return Math.floor((s+9)/10)*Math.floor((t+4)/5)*16;case no:return Math.floor((s+9)/10)*Math.floor((t+5)/6)*16;case so:return Math.floor((s+9)/10)*Math.floor((t+7)/8)*16;case ro:return Math.floor((s+9)/10)*Math.floor((t+9)/10)*16;case ao:return Math.floor((s+11)/12)*Math.floor((t+9)/10)*16;case oo:return Math.floor((s+11)/12)*Math.floor((t+11)/12)*16;case rr:case lo:case co:return Math.ceil(s/4)*Math.ceil(t/4)*16;case Uc:case ho:return Math.ceil(s/4)*Math.ceil(t/4)*8;case uo:case fo:return Math.ceil(s/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function m0(s){switch(s){case Si:case Ec:return{byteLength:1,components:1};case ps:case Ac:case gs:return{byteLength:2,components:1};case Co:case Po:return{byteLength:2,components:4};case Qi:case Ro:case li:return{byteLength:4,components:1};case Rc:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${s}.`)}function g0(s,t,e,i,n,r,a){const o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ot,h=new WeakMap;let u;const d=new WeakMap;let f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(R,S){return f?new OffscreenCanvas(R,S):fr("canvas")}function v(R,S,F){let K=1;const Z=Tt(R);if((Z.width>F||Z.height>F)&&(K=F/Math.max(Z.width,Z.height)),K<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){const q=Math.floor(K*Z.width),yt=Math.floor(K*Z.height);u===void 0&&(u=m(q,yt));const lt=S?m(q,yt):u;return lt.width=q,lt.height=yt,lt.getContext("2d").drawImage(R,0,0,q,yt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+Z.width+"x"+Z.height+") to ("+q+"x"+yt+")."),lt}else return"data"in R&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+Z.width+"x"+Z.height+")."),R;return R}function g(R){return R.generateMipmaps}function p(R){s.generateMipmap(R)}function M(R){return R.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?s.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function x(R,S,F,K,Z=!1){if(R!==null){if(s[R]!==void 0)return s[R];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let q=S;if(S===s.RED&&(F===s.FLOAT&&(q=s.R32F),F===s.HALF_FLOAT&&(q=s.R16F),F===s.UNSIGNED_BYTE&&(q=s.R8)),S===s.RED_INTEGER&&(F===s.UNSIGNED_BYTE&&(q=s.R8UI),F===s.UNSIGNED_SHORT&&(q=s.R16UI),F===s.UNSIGNED_INT&&(q=s.R32UI),F===s.BYTE&&(q=s.R8I),F===s.SHORT&&(q=s.R16I),F===s.INT&&(q=s.R32I)),S===s.RG&&(F===s.FLOAT&&(q=s.RG32F),F===s.HALF_FLOAT&&(q=s.RG16F),F===s.UNSIGNED_BYTE&&(q=s.RG8)),S===s.RG_INTEGER&&(F===s.UNSIGNED_BYTE&&(q=s.RG8UI),F===s.UNSIGNED_SHORT&&(q=s.RG16UI),F===s.UNSIGNED_INT&&(q=s.RG32UI),F===s.BYTE&&(q=s.RG8I),F===s.SHORT&&(q=s.RG16I),F===s.INT&&(q=s.RG32I)),S===s.RGB_INTEGER&&(F===s.UNSIGNED_BYTE&&(q=s.RGB8UI),F===s.UNSIGNED_SHORT&&(q=s.RGB16UI),F===s.UNSIGNED_INT&&(q=s.RGB32UI),F===s.BYTE&&(q=s.RGB8I),F===s.SHORT&&(q=s.RGB16I),F===s.INT&&(q=s.RGB32I)),S===s.RGBA_INTEGER&&(F===s.UNSIGNED_BYTE&&(q=s.RGBA8UI),F===s.UNSIGNED_SHORT&&(q=s.RGBA16UI),F===s.UNSIGNED_INT&&(q=s.RGBA32UI),F===s.BYTE&&(q=s.RGBA8I),F===s.SHORT&&(q=s.RGBA16I),F===s.INT&&(q=s.RGBA32I)),S===s.RGB&&F===s.UNSIGNED_INT_5_9_9_9_REV&&(q=s.RGB9_E5),S===s.RGBA){const yt=Z?Ar:Xt.getTransfer(K);F===s.FLOAT&&(q=s.RGBA32F),F===s.HALF_FLOAT&&(q=s.RGBA16F),F===s.UNSIGNED_BYTE&&(q=yt===Jt?s.SRGB8_ALPHA8:s.RGBA8),F===s.UNSIGNED_SHORT_4_4_4_4&&(q=s.RGBA4),F===s.UNSIGNED_SHORT_5_5_5_1&&(q=s.RGB5_A1)}return(q===s.R16F||q===s.R32F||q===s.RG16F||q===s.RG32F||q===s.RGBA16F||q===s.RGBA32F)&&t.get("EXT_color_buffer_float"),q}function _(R,S){let F;return R?S===null||S===Qi||S===Fn?F=s.DEPTH24_STENCIL8:S===li?F=s.DEPTH32F_STENCIL8:S===ps&&(F=s.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===Qi||S===Fn?F=s.DEPTH_COMPONENT24:S===li?F=s.DEPTH_COMPONENT32F:S===ps&&(F=s.DEPTH_COMPONENT16),F}function C(R,S){return g(R)===!0||R.isFramebufferTexture&&R.minFilter!==Ne&&R.minFilter!==oi?Math.log2(Math.max(S.width,S.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?S.mipmaps.length:1}function E(R){const S=R.target;S.removeEventListener("dispose",E),P(S),S.isVideoTexture&&h.delete(S)}function A(R){const S=R.target;S.removeEventListener("dispose",A),y(S)}function P(R){const S=i.get(R);if(S.__webglInit===void 0)return;const F=R.source,K=d.get(F);if(K){const Z=K[S.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&b(R),Object.keys(K).length===0&&d.delete(F)}i.remove(R)}function b(R){const S=i.get(R);s.deleteTexture(S.__webglTexture);const F=R.source,K=d.get(F);delete K[S.__cacheKey],a.memory.textures--}function y(R){const S=i.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),i.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let K=0;K<6;K++){if(Array.isArray(S.__webglFramebuffer[K]))for(let Z=0;Z<S.__webglFramebuffer[K].length;Z++)s.deleteFramebuffer(S.__webglFramebuffer[K][Z]);else s.deleteFramebuffer(S.__webglFramebuffer[K]);S.__webglDepthbuffer&&s.deleteRenderbuffer(S.__webglDepthbuffer[K])}else{if(Array.isArray(S.__webglFramebuffer))for(let K=0;K<S.__webglFramebuffer.length;K++)s.deleteFramebuffer(S.__webglFramebuffer[K]);else s.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&s.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&s.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let K=0;K<S.__webglColorRenderbuffer.length;K++)S.__webglColorRenderbuffer[K]&&s.deleteRenderbuffer(S.__webglColorRenderbuffer[K]);S.__webglDepthRenderbuffer&&s.deleteRenderbuffer(S.__webglDepthRenderbuffer)}const F=R.textures;for(let K=0,Z=F.length;K<Z;K++){const q=i.get(F[K]);q.__webglTexture&&(s.deleteTexture(q.__webglTexture),a.memory.textures--),i.remove(F[K])}i.remove(R)}let L=0;function k(){L=0}function z(){const R=L;return R>=n.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+n.maxTextures),L+=1,R}function X(R){const S=[];return S.push(R.wrapS),S.push(R.wrapT),S.push(R.wrapR||0),S.push(R.magFilter),S.push(R.minFilter),S.push(R.anisotropy),S.push(R.internalFormat),S.push(R.format),S.push(R.type),S.push(R.generateMipmaps),S.push(R.premultiplyAlpha),S.push(R.flipY),S.push(R.unpackAlignment),S.push(R.colorSpace),S.join()}function Y(R,S){const F=i.get(R);if(R.isVideoTexture&&Et(R),R.isRenderTargetTexture===!1&&R.version>0&&F.__version!==R.version){const K=R.image;if(K===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(K.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{$(F,R,S);return}}e.bindTexture(s.TEXTURE_2D,F.__webglTexture,s.TEXTURE0+S)}function W(R,S){const F=i.get(R);if(R.version>0&&F.__version!==R.version){$(F,R,S);return}e.bindTexture(s.TEXTURE_2D_ARRAY,F.__webglTexture,s.TEXTURE0+S)}function V(R,S){const F=i.get(R);if(R.version>0&&F.__version!==R.version){$(F,R,S);return}e.bindTexture(s.TEXTURE_3D,F.__webglTexture,s.TEXTURE0+S)}function O(R,S){const F=i.get(R);if(R.version>0&&F.__version!==R.version){Q(F,R,S);return}e.bindTexture(s.TEXTURE_CUBE_MAP,F.__webglTexture,s.TEXTURE0+S)}const J={[ka]:s.REPEAT,[Zi]:s.CLAMP_TO_EDGE,[Ba]:s.MIRRORED_REPEAT},it={[Ne]:s.NEAREST,[iu]:s.NEAREST_MIPMAP_NEAREST,[ys]:s.NEAREST_MIPMAP_LINEAR,[oi]:s.LINEAR,[Fr]:s.LINEAR_MIPMAP_NEAREST,[Ji]:s.LINEAR_MIPMAP_LINEAR},dt={[au]:s.NEVER,[du]:s.ALWAYS,[ou]:s.LESS,[Nc]:s.LEQUAL,[lu]:s.EQUAL,[uu]:s.GEQUAL,[cu]:s.GREATER,[hu]:s.NOTEQUAL};function wt(R,S){if(S.type===li&&t.has("OES_texture_float_linear")===!1&&(S.magFilter===oi||S.magFilter===Fr||S.magFilter===ys||S.magFilter===Ji||S.minFilter===oi||S.minFilter===Fr||S.minFilter===ys||S.minFilter===Ji)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(R,s.TEXTURE_WRAP_S,J[S.wrapS]),s.texParameteri(R,s.TEXTURE_WRAP_T,J[S.wrapT]),(R===s.TEXTURE_3D||R===s.TEXTURE_2D_ARRAY)&&s.texParameteri(R,s.TEXTURE_WRAP_R,J[S.wrapR]),s.texParameteri(R,s.TEXTURE_MAG_FILTER,it[S.magFilter]),s.texParameteri(R,s.TEXTURE_MIN_FILTER,it[S.minFilter]),S.compareFunction&&(s.texParameteri(R,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(R,s.TEXTURE_COMPARE_FUNC,dt[S.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===Ne||S.minFilter!==ys&&S.minFilter!==Ji||S.type===li&&t.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||i.get(S).__currentAnisotropy){const F=t.get("EXT_texture_filter_anisotropic");s.texParameterf(R,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,n.getMaxAnisotropy())),i.get(S).__currentAnisotropy=S.anisotropy}}}function Bt(R,S){let F=!1;R.__webglInit===void 0&&(R.__webglInit=!0,S.addEventListener("dispose",E));const K=S.source;let Z=d.get(K);Z===void 0&&(Z={},d.set(K,Z));const q=X(S);if(q!==R.__cacheKey){Z[q]===void 0&&(Z[q]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,F=!0),Z[q].usedTimes++;const yt=Z[R.__cacheKey];yt!==void 0&&(Z[R.__cacheKey].usedTimes--,yt.usedTimes===0&&b(S)),R.__cacheKey=q,R.__webglTexture=Z[q].texture}return F}function $(R,S,F){let K=s.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(K=s.TEXTURE_2D_ARRAY),S.isData3DTexture&&(K=s.TEXTURE_3D);const Z=Bt(R,S),q=S.source;e.bindTexture(K,R.__webglTexture,s.TEXTURE0+F);const yt=i.get(q);if(q.version!==yt.__version||Z===!0){e.activeTexture(s.TEXTURE0+F);const lt=Xt.getPrimaries(Xt.workingColorSpace),pt=S.colorSpace===Ii?null:Xt.getPrimaries(S.colorSpace),$t=S.colorSpace===Ii||lt===pt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,S.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,S.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,$t);let tt=v(S.image,!1,n.maxTextureSize);tt=se(S,tt);const mt=r.convert(S.format,S.colorSpace),At=r.convert(S.type);let Ct=x(S.internalFormat,mt,At,S.colorSpace,S.isVideoTexture);wt(K,S);let gt;const Gt=S.mipmaps,Ft=S.isVideoTexture!==!0,ie=yt.__version===void 0||Z===!0,D=q.dataReady,at=C(S,tt);if(S.isDepthTexture)Ct=_(S.format===On,S.type),ie&&(Ft?e.texStorage2D(s.TEXTURE_2D,1,Ct,tt.width,tt.height):e.texImage2D(s.TEXTURE_2D,0,Ct,tt.width,tt.height,0,mt,At,null));else if(S.isDataTexture)if(Gt.length>0){Ft&&ie&&e.texStorage2D(s.TEXTURE_2D,at,Ct,Gt[0].width,Gt[0].height);for(let G=0,j=Gt.length;G<j;G++)gt=Gt[G],Ft?D&&e.texSubImage2D(s.TEXTURE_2D,G,0,0,gt.width,gt.height,mt,At,gt.data):e.texImage2D(s.TEXTURE_2D,G,Ct,gt.width,gt.height,0,mt,At,gt.data);S.generateMipmaps=!1}else Ft?(ie&&e.texStorage2D(s.TEXTURE_2D,at,Ct,tt.width,tt.height),D&&e.texSubImage2D(s.TEXTURE_2D,0,0,0,tt.width,tt.height,mt,At,tt.data)):e.texImage2D(s.TEXTURE_2D,0,Ct,tt.width,tt.height,0,mt,At,tt.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){Ft&&ie&&e.texStorage3D(s.TEXTURE_2D_ARRAY,at,Ct,Gt[0].width,Gt[0].height,tt.depth);for(let G=0,j=Gt.length;G<j;G++)if(gt=Gt[G],S.format!==je)if(mt!==null)if(Ft){if(D)if(S.layerUpdates.size>0){const ut=Kl(gt.width,gt.height,S.format,S.type);for(const ct of S.layerUpdates){const Dt=gt.data.subarray(ct*ut/gt.data.BYTES_PER_ELEMENT,(ct+1)*ut/gt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,G,0,0,ct,gt.width,gt.height,1,mt,Dt)}S.clearLayerUpdates()}else e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,G,0,0,0,gt.width,gt.height,tt.depth,mt,gt.data)}else e.compressedTexImage3D(s.TEXTURE_2D_ARRAY,G,Ct,gt.width,gt.height,tt.depth,0,gt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ft?D&&e.texSubImage3D(s.TEXTURE_2D_ARRAY,G,0,0,0,gt.width,gt.height,tt.depth,mt,At,gt.data):e.texImage3D(s.TEXTURE_2D_ARRAY,G,Ct,gt.width,gt.height,tt.depth,0,mt,At,gt.data)}else{Ft&&ie&&e.texStorage2D(s.TEXTURE_2D,at,Ct,Gt[0].width,Gt[0].height);for(let G=0,j=Gt.length;G<j;G++)gt=Gt[G],S.format!==je?mt!==null?Ft?D&&e.compressedTexSubImage2D(s.TEXTURE_2D,G,0,0,gt.width,gt.height,mt,gt.data):e.compressedTexImage2D(s.TEXTURE_2D,G,Ct,gt.width,gt.height,0,gt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ft?D&&e.texSubImage2D(s.TEXTURE_2D,G,0,0,gt.width,gt.height,mt,At,gt.data):e.texImage2D(s.TEXTURE_2D,G,Ct,gt.width,gt.height,0,mt,At,gt.data)}else if(S.isDataArrayTexture)if(Ft){if(ie&&e.texStorage3D(s.TEXTURE_2D_ARRAY,at,Ct,tt.width,tt.height,tt.depth),D)if(S.layerUpdates.size>0){const G=Kl(tt.width,tt.height,S.format,S.type);for(const j of S.layerUpdates){const ut=tt.data.subarray(j*G/tt.data.BYTES_PER_ELEMENT,(j+1)*G/tt.data.BYTES_PER_ELEMENT);e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,j,tt.width,tt.height,1,mt,At,ut)}S.clearLayerUpdates()}else e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,tt.width,tt.height,tt.depth,mt,At,tt.data)}else e.texImage3D(s.TEXTURE_2D_ARRAY,0,Ct,tt.width,tt.height,tt.depth,0,mt,At,tt.data);else if(S.isData3DTexture)Ft?(ie&&e.texStorage3D(s.TEXTURE_3D,at,Ct,tt.width,tt.height,tt.depth),D&&e.texSubImage3D(s.TEXTURE_3D,0,0,0,0,tt.width,tt.height,tt.depth,mt,At,tt.data)):e.texImage3D(s.TEXTURE_3D,0,Ct,tt.width,tt.height,tt.depth,0,mt,At,tt.data);else if(S.isFramebufferTexture){if(ie)if(Ft)e.texStorage2D(s.TEXTURE_2D,at,Ct,tt.width,tt.height);else{let G=tt.width,j=tt.height;for(let ut=0;ut<at;ut++)e.texImage2D(s.TEXTURE_2D,ut,Ct,G,j,0,mt,At,null),G>>=1,j>>=1}}else if(Gt.length>0){if(Ft&&ie){const G=Tt(Gt[0]);e.texStorage2D(s.TEXTURE_2D,at,Ct,G.width,G.height)}for(let G=0,j=Gt.length;G<j;G++)gt=Gt[G],Ft?D&&e.texSubImage2D(s.TEXTURE_2D,G,0,0,mt,At,gt):e.texImage2D(s.TEXTURE_2D,G,Ct,mt,At,gt);S.generateMipmaps=!1}else if(Ft){if(ie){const G=Tt(tt);e.texStorage2D(s.TEXTURE_2D,at,Ct,G.width,G.height)}D&&e.texSubImage2D(s.TEXTURE_2D,0,0,0,mt,At,tt)}else e.texImage2D(s.TEXTURE_2D,0,Ct,mt,At,tt);g(S)&&p(K),yt.__version=q.version,S.onUpdate&&S.onUpdate(S)}R.__version=S.version}function Q(R,S,F){if(S.image.length!==6)return;const K=Bt(R,S),Z=S.source;e.bindTexture(s.TEXTURE_CUBE_MAP,R.__webglTexture,s.TEXTURE0+F);const q=i.get(Z);if(Z.version!==q.__version||K===!0){e.activeTexture(s.TEXTURE0+F);const yt=Xt.getPrimaries(Xt.workingColorSpace),lt=S.colorSpace===Ii?null:Xt.getPrimaries(S.colorSpace),pt=S.colorSpace===Ii||yt===lt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,S.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,S.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,pt);const $t=S.isCompressedTexture||S.image[0].isCompressedTexture,tt=S.image[0]&&S.image[0].isDataTexture,mt=[];for(let j=0;j<6;j++)!$t&&!tt?mt[j]=v(S.image[j],!0,n.maxCubemapSize):mt[j]=tt?S.image[j].image:S.image[j],mt[j]=se(S,mt[j]);const At=mt[0],Ct=r.convert(S.format,S.colorSpace),gt=r.convert(S.type),Gt=x(S.internalFormat,Ct,gt,S.colorSpace),Ft=S.isVideoTexture!==!0,ie=q.__version===void 0||K===!0,D=Z.dataReady;let at=C(S,At);wt(s.TEXTURE_CUBE_MAP,S);let G;if($t){Ft&&ie&&e.texStorage2D(s.TEXTURE_CUBE_MAP,at,Gt,At.width,At.height);for(let j=0;j<6;j++){G=mt[j].mipmaps;for(let ut=0;ut<G.length;ut++){const ct=G[ut];S.format!==je?Ct!==null?Ft?D&&e.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut,0,0,ct.width,ct.height,Ct,ct.data):e.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut,Gt,ct.width,ct.height,0,ct.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ft?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut,0,0,ct.width,ct.height,Ct,gt,ct.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut,Gt,ct.width,ct.height,0,Ct,gt,ct.data)}}}else{if(G=S.mipmaps,Ft&&ie){G.length>0&&at++;const j=Tt(mt[0]);e.texStorage2D(s.TEXTURE_CUBE_MAP,at,Gt,j.width,j.height)}for(let j=0;j<6;j++)if(tt){Ft?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,mt[j].width,mt[j].height,Ct,gt,mt[j].data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Gt,mt[j].width,mt[j].height,0,Ct,gt,mt[j].data);for(let ut=0;ut<G.length;ut++){const Dt=G[ut].image[j].image;Ft?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut+1,0,0,Dt.width,Dt.height,Ct,gt,Dt.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut+1,Gt,Dt.width,Dt.height,0,Ct,gt,Dt.data)}}else{Ft?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,Ct,gt,mt[j]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Gt,Ct,gt,mt[j]);for(let ut=0;ut<G.length;ut++){const ct=G[ut];Ft?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut+1,0,0,Ct,gt,ct.image[j]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+j,ut+1,Gt,Ct,gt,ct.image[j])}}}g(S)&&p(s.TEXTURE_CUBE_MAP),q.__version=Z.version,S.onUpdate&&S.onUpdate(S)}R.__version=S.version}function ft(R,S,F,K,Z,q){const yt=r.convert(F.format,F.colorSpace),lt=r.convert(F.type),pt=x(F.internalFormat,yt,lt,F.colorSpace),$t=i.get(S),tt=i.get(F);if(tt.__renderTarget=S,!$t.__hasExternalTextures){const mt=Math.max(1,S.width>>q),At=Math.max(1,S.height>>q);Z===s.TEXTURE_3D||Z===s.TEXTURE_2D_ARRAY?e.texImage3D(Z,q,pt,mt,At,S.depth,0,yt,lt,null):e.texImage2D(Z,q,pt,mt,At,0,yt,lt,null)}e.bindFramebuffer(s.FRAMEBUFFER,R),Vt(S)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,K,Z,tt.__webglTexture,0,Ht(S)):(Z===s.TEXTURE_2D||Z>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,K,Z,tt.__webglTexture,q),e.bindFramebuffer(s.FRAMEBUFFER,null)}function nt(R,S,F){if(s.bindRenderbuffer(s.RENDERBUFFER,R),S.depthBuffer){const K=S.depthTexture,Z=K&&K.isDepthTexture?K.type:null,q=_(S.stencilBuffer,Z),yt=S.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,lt=Ht(S);Vt(S)?o.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,lt,q,S.width,S.height):F?s.renderbufferStorageMultisample(s.RENDERBUFFER,lt,q,S.width,S.height):s.renderbufferStorage(s.RENDERBUFFER,q,S.width,S.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,yt,s.RENDERBUFFER,R)}else{const K=S.textures;for(let Z=0;Z<K.length;Z++){const q=K[Z],yt=r.convert(q.format,q.colorSpace),lt=r.convert(q.type),pt=x(q.internalFormat,yt,lt,q.colorSpace),$t=Ht(S);F&&Vt(S)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,$t,pt,S.width,S.height):Vt(S)?o.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,$t,pt,S.width,S.height):s.renderbufferStorage(s.RENDERBUFFER,pt,S.width,S.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Rt(R,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(s.FRAMEBUFFER,R),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const K=i.get(S.depthTexture);K.__renderTarget=S,(!K.__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),Y(S.depthTexture,0);const Z=K.__webglTexture,q=Ht(S);if(S.depthTexture.format===Ln)Vt(S)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,Z,0,q):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,Z,0);else if(S.depthTexture.format===On)Vt(S)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,Z,0,q):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,Z,0);else throw new Error("Unknown depthTexture format")}function Lt(R){const S=i.get(R),F=R.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==R.depthTexture){const K=R.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),K){const Z=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,K.removeEventListener("dispose",Z)};K.addEventListener("dispose",Z),S.__depthDisposeCallback=Z}S.__boundDepthTexture=K}if(R.depthTexture&&!S.__autoAllocateDepthBuffer){if(F)throw new Error("target.depthTexture not supported in Cube render targets");Rt(S.__webglFramebuffer,R)}else if(F){S.__webglDepthbuffer=[];for(let K=0;K<6;K++)if(e.bindFramebuffer(s.FRAMEBUFFER,S.__webglFramebuffer[K]),S.__webglDepthbuffer[K]===void 0)S.__webglDepthbuffer[K]=s.createRenderbuffer(),nt(S.__webglDepthbuffer[K],R,!1);else{const Z=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,q=S.__webglDepthbuffer[K];s.bindRenderbuffer(s.RENDERBUFFER,q),s.framebufferRenderbuffer(s.FRAMEBUFFER,Z,s.RENDERBUFFER,q)}}else if(e.bindFramebuffer(s.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=s.createRenderbuffer(),nt(S.__webglDepthbuffer,R,!1);else{const K=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,Z=S.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,Z),s.framebufferRenderbuffer(s.FRAMEBUFFER,K,s.RENDERBUFFER,Z)}e.bindFramebuffer(s.FRAMEBUFFER,null)}function zt(R,S,F){const K=i.get(R);S!==void 0&&ft(K.__webglFramebuffer,R,R.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),F!==void 0&&Lt(R)}function le(R){const S=R.texture,F=i.get(R),K=i.get(S);R.addEventListener("dispose",A);const Z=R.textures,q=R.isWebGLCubeRenderTarget===!0,yt=Z.length>1;if(yt||(K.__webglTexture===void 0&&(K.__webglTexture=s.createTexture()),K.__version=S.version,a.memory.textures++),q){F.__webglFramebuffer=[];for(let lt=0;lt<6;lt++)if(S.mipmaps&&S.mipmaps.length>0){F.__webglFramebuffer[lt]=[];for(let pt=0;pt<S.mipmaps.length;pt++)F.__webglFramebuffer[lt][pt]=s.createFramebuffer()}else F.__webglFramebuffer[lt]=s.createFramebuffer()}else{if(S.mipmaps&&S.mipmaps.length>0){F.__webglFramebuffer=[];for(let lt=0;lt<S.mipmaps.length;lt++)F.__webglFramebuffer[lt]=s.createFramebuffer()}else F.__webglFramebuffer=s.createFramebuffer();if(yt)for(let lt=0,pt=Z.length;lt<pt;lt++){const $t=i.get(Z[lt]);$t.__webglTexture===void 0&&($t.__webglTexture=s.createTexture(),a.memory.textures++)}if(R.samples>0&&Vt(R)===!1){F.__webglMultisampledFramebuffer=s.createFramebuffer(),F.__webglColorRenderbuffer=[],e.bindFramebuffer(s.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let lt=0;lt<Z.length;lt++){const pt=Z[lt];F.__webglColorRenderbuffer[lt]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,F.__webglColorRenderbuffer[lt]);const $t=r.convert(pt.format,pt.colorSpace),tt=r.convert(pt.type),mt=x(pt.internalFormat,$t,tt,pt.colorSpace,R.isXRRenderTarget===!0),At=Ht(R);s.renderbufferStorageMultisample(s.RENDERBUFFER,At,mt,R.width,R.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+lt,s.RENDERBUFFER,F.__webglColorRenderbuffer[lt])}s.bindRenderbuffer(s.RENDERBUFFER,null),R.depthBuffer&&(F.__webglDepthRenderbuffer=s.createRenderbuffer(),nt(F.__webglDepthRenderbuffer,R,!0)),e.bindFramebuffer(s.FRAMEBUFFER,null)}}if(q){e.bindTexture(s.TEXTURE_CUBE_MAP,K.__webglTexture),wt(s.TEXTURE_CUBE_MAP,S);for(let lt=0;lt<6;lt++)if(S.mipmaps&&S.mipmaps.length>0)for(let pt=0;pt<S.mipmaps.length;pt++)ft(F.__webglFramebuffer[lt][pt],R,S,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,pt);else ft(F.__webglFramebuffer[lt],R,S,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0);g(S)&&p(s.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(yt){for(let lt=0,pt=Z.length;lt<pt;lt++){const $t=Z[lt],tt=i.get($t);e.bindTexture(s.TEXTURE_2D,tt.__webglTexture),wt(s.TEXTURE_2D,$t),ft(F.__webglFramebuffer,R,$t,s.COLOR_ATTACHMENT0+lt,s.TEXTURE_2D,0),g($t)&&p(s.TEXTURE_2D)}e.unbindTexture()}else{let lt=s.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(lt=R.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),e.bindTexture(lt,K.__webglTexture),wt(lt,S),S.mipmaps&&S.mipmaps.length>0)for(let pt=0;pt<S.mipmaps.length;pt++)ft(F.__webglFramebuffer[pt],R,S,s.COLOR_ATTACHMENT0,lt,pt);else ft(F.__webglFramebuffer,R,S,s.COLOR_ATTACHMENT0,lt,0);g(S)&&p(lt),e.unbindTexture()}R.depthBuffer&&Lt(R)}function Wt(R){const S=R.textures;for(let F=0,K=S.length;F<K;F++){const Z=S[F];if(g(Z)){const q=M(R),yt=i.get(Z).__webglTexture;e.bindTexture(q,yt),p(q),e.unbindTexture()}}}const he=[],N=[];function Fe(R){if(R.samples>0){if(Vt(R)===!1){const S=R.textures,F=R.width,K=R.height;let Z=s.COLOR_BUFFER_BIT;const q=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,yt=i.get(R),lt=S.length>1;if(lt)for(let pt=0;pt<S.length;pt++)e.bindFramebuffer(s.FRAMEBUFFER,yt.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+pt,s.RENDERBUFFER,null),e.bindFramebuffer(s.FRAMEBUFFER,yt.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+pt,s.TEXTURE_2D,null,0);e.bindFramebuffer(s.READ_FRAMEBUFFER,yt.__webglMultisampledFramebuffer),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,yt.__webglFramebuffer);for(let pt=0;pt<S.length;pt++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(Z|=s.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(Z|=s.STENCIL_BUFFER_BIT)),lt){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,yt.__webglColorRenderbuffer[pt]);const $t=i.get(S[pt]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,$t,0)}s.blitFramebuffer(0,0,F,K,0,0,F,K,Z,s.NEAREST),l===!0&&(he.length=0,N.length=0,he.push(s.COLOR_ATTACHMENT0+pt),R.depthBuffer&&R.resolveDepthBuffer===!1&&(he.push(q),N.push(q),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,N)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,he))}if(e.bindFramebuffer(s.READ_FRAMEBUFFER,null),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),lt)for(let pt=0;pt<S.length;pt++){e.bindFramebuffer(s.FRAMEBUFFER,yt.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+pt,s.RENDERBUFFER,yt.__webglColorRenderbuffer[pt]);const $t=i.get(S[pt]).__webglTexture;e.bindFramebuffer(s.FRAMEBUFFER,yt.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+pt,s.TEXTURE_2D,$t,0)}e.bindFramebuffer(s.DRAW_FRAMEBUFFER,yt.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.resolveDepthBuffer===!1&&l){const S=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[S])}}}function Ht(R){return Math.min(n.maxSamples,R.samples)}function Vt(R){const S=i.get(R);return R.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function Et(R){const S=a.render.frame;h.get(R)!==S&&(h.set(R,S),R.update())}function se(R,S){const F=R.colorSpace,K=R.format,Z=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||F!==Bn&&F!==Ii&&(Xt.getTransfer(F)===Jt?(K!==je||Z!==Si)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",F)),S}function Tt(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(c.width=R.naturalWidth||R.width,c.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(c.width=R.displayWidth,c.height=R.displayHeight):(c.width=R.width,c.height=R.height),c}this.allocateTextureUnit=z,this.resetTextureUnits=k,this.setTexture2D=Y,this.setTexture2DArray=W,this.setTexture3D=V,this.setTextureCube=O,this.rebindTextures=zt,this.setupRenderTarget=le,this.updateRenderTargetMipmap=Wt,this.updateMultisampleRenderTarget=Fe,this.setupDepthRenderbuffer=Lt,this.setupFrameBufferTexture=ft,this.useMultisampledRTT=Vt}function v0(s,t){function e(i,n=Ii){let r;const a=Xt.getTransfer(n);if(i===Si)return s.UNSIGNED_BYTE;if(i===Co)return s.UNSIGNED_SHORT_4_4_4_4;if(i===Po)return s.UNSIGNED_SHORT_5_5_5_1;if(i===Rc)return s.UNSIGNED_INT_5_9_9_9_REV;if(i===Ec)return s.BYTE;if(i===Ac)return s.SHORT;if(i===ps)return s.UNSIGNED_SHORT;if(i===Ro)return s.INT;if(i===Qi)return s.UNSIGNED_INT;if(i===li)return s.FLOAT;if(i===gs)return s.HALF_FLOAT;if(i===Cc)return s.ALPHA;if(i===Pc)return s.RGB;if(i===je)return s.RGBA;if(i===Lc)return s.LUMINANCE;if(i===Dc)return s.LUMINANCE_ALPHA;if(i===Ln)return s.DEPTH_COMPONENT;if(i===On)return s.DEPTH_STENCIL;if(i===Lo)return s.RED;if(i===Do)return s.RED_INTEGER;if(i===Ic)return s.RG;if(i===Io)return s.RG_INTEGER;if(i===Uo)return s.RGBA_INTEGER;if(i===er||i===ir||i===nr||i===sr)if(a===Jt)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===er)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===ir)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===nr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===sr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===er)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===ir)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===nr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===sr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Ha||i===Va||i===Ga||i===Wa)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===Ha)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Va)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Ga)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Wa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===$a||i===Xa||i===qa)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(i===$a||i===Xa)return a===Jt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===qa)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===Ya||i===Ka||i===ja||i===Za||i===Ja||i===Qa||i===to||i===eo||i===io||i===no||i===so||i===ro||i===ao||i===oo)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(i===Ya)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Ka)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===ja)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Za)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Ja)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Qa)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===to)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===eo)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===io)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===no)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===so)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===ro)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===ao)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===oo)return a===Jt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===rr||i===lo||i===co)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(i===rr)return a===Jt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===lo)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===co)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Uc||i===ho||i===uo||i===fo)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(i===rr)return r.COMPRESSED_RED_RGTC1_EXT;if(i===ho)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===uo)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===fo)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Fn?s.UNSIGNED_INT_24_8:s[i]!==void 0?s[i]:null}return{convert:e}}class _0 extends Pe{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class oe extends de{constructor(){super(),this.isGroup=!0,this.type="Group"}}const x0={type:"move"};class ua{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new oe,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new oe,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new T,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new T),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new oe,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new T,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new T),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const i of t.hand.values())this._getHandJoint(e,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,i){let n=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(const v of t.hand.values()){const g=e.getJointPose(v,i),p=this._getHandJoint(c,v);g!==null&&(p.matrix.fromArray(g.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=g.radius),p.visible=g!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,m=.005;c.inputState.pinching&&d>f+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=f-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(n=e.getPose(t.targetRaySpace,i),n===null&&r!==null&&(n=r),n!==null&&(o.matrix.fromArray(n.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,n.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(n.linearVelocity)):o.hasLinearVelocity=!1,n.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(n.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(x0)))}return o!==null&&(o.visible=n!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const i=new oe;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[e.jointName]=i,t.add(i)}return t.joints[e.jointName]}}const M0=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,y0=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class S0{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,i){if(this.texture===null){const n=new Ee,r=t.properties.get(n);r.__webglTexture=e.texture,(e.depthNear!=i.depthNear||e.depthFar!=i.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,i=new zi({vertexShader:M0,fragmentShader:y0,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new st(new kn(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class b0 extends Hn{constructor(t,e){super();const i=this;let n=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,f=null,m=null;const v=new S0,g=e.getContextAttributes();let p=null,M=null;const x=[],_=[],C=new ot;let E=null;const A=new Pe;A.viewport=new te;const P=new Pe;P.viewport=new te;const b=[A,P],y=new _0;let L=null,k=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let Q=x[$];return Q===void 0&&(Q=new ua,x[$]=Q),Q.getTargetRaySpace()},this.getControllerGrip=function($){let Q=x[$];return Q===void 0&&(Q=new ua,x[$]=Q),Q.getGripSpace()},this.getHand=function($){let Q=x[$];return Q===void 0&&(Q=new ua,x[$]=Q),Q.getHandSpace()};function z($){const Q=_.indexOf($.inputSource);if(Q===-1)return;const ft=x[Q];ft!==void 0&&(ft.update($.inputSource,$.frame,c||a),ft.dispatchEvent({type:$.type,data:$.inputSource}))}function X(){n.removeEventListener("select",z),n.removeEventListener("selectstart",z),n.removeEventListener("selectend",z),n.removeEventListener("squeeze",z),n.removeEventListener("squeezestart",z),n.removeEventListener("squeezeend",z),n.removeEventListener("end",X),n.removeEventListener("inputsourceschange",Y);for(let $=0;$<x.length;$++){const Q=_[$];Q!==null&&(_[$]=null,x[$].disconnect(Q))}L=null,k=null,v.reset(),t.setRenderTarget(p),f=null,d=null,u=null,n=null,M=null,Bt.stop(),i.isPresenting=!1,t.setPixelRatio(E),t.setSize(C.width,C.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){r=$,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){o=$,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function($){c=$},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u},this.getFrame=function(){return m},this.getSession=function(){return n},this.setSession=async function($){if(n=$,n!==null){if(p=t.getRenderTarget(),n.addEventListener("select",z),n.addEventListener("selectstart",z),n.addEventListener("selectend",z),n.addEventListener("squeeze",z),n.addEventListener("squeezestart",z),n.addEventListener("squeezeend",z),n.addEventListener("end",X),n.addEventListener("inputsourceschange",Y),g.xrCompatible!==!0&&await e.makeXRCompatible(),E=t.getPixelRatio(),t.getSize(C),n.renderState.layers===void 0){const Q={antialias:g.antialias,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(n,e,Q),n.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),M=new tn(f.framebufferWidth,f.framebufferHeight,{format:je,type:Si,colorSpace:t.outputColorSpace,stencilBuffer:g.stencil})}else{let Q=null,ft=null,nt=null;g.depth&&(nt=g.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,Q=g.stencil?On:Ln,ft=g.stencil?Fn:Qi);const Rt={colorFormat:e.RGBA8,depthFormat:nt,scaleFactor:r};u=new XRWebGLBinding(n,e),d=u.createProjectionLayer(Rt),n.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),M=new tn(d.textureWidth,d.textureHeight,{format:je,type:Si,depthTexture:new Kc(d.textureWidth,d.textureHeight,ft,void 0,void 0,void 0,void 0,void 0,void 0,Q),stencilBuffer:g.stencil,colorSpace:t.outputColorSpace,samples:g.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await n.requestReferenceSpace(o),Bt.setContext(n),Bt.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(n!==null)return n.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function Y($){for(let Q=0;Q<$.removed.length;Q++){const ft=$.removed[Q],nt=_.indexOf(ft);nt>=0&&(_[nt]=null,x[nt].disconnect(ft))}for(let Q=0;Q<$.added.length;Q++){const ft=$.added[Q];let nt=_.indexOf(ft);if(nt===-1){for(let Lt=0;Lt<x.length;Lt++)if(Lt>=_.length){_.push(ft),nt=Lt;break}else if(_[Lt]===null){_[Lt]=ft,nt=Lt;break}if(nt===-1)break}const Rt=x[nt];Rt&&Rt.connect(ft)}}const W=new T,V=new T;function O($,Q,ft){W.setFromMatrixPosition(Q.matrixWorld),V.setFromMatrixPosition(ft.matrixWorld);const nt=W.distanceTo(V),Rt=Q.projectionMatrix.elements,Lt=ft.projectionMatrix.elements,zt=Rt[14]/(Rt[10]-1),le=Rt[14]/(Rt[10]+1),Wt=(Rt[9]+1)/Rt[5],he=(Rt[9]-1)/Rt[5],N=(Rt[8]-1)/Rt[0],Fe=(Lt[8]+1)/Lt[0],Ht=zt*N,Vt=zt*Fe,Et=nt/(-N+Fe),se=Et*-N;if(Q.matrixWorld.decompose($.position,$.quaternion,$.scale),$.translateX(se),$.translateZ(Et),$.matrixWorld.compose($.position,$.quaternion,$.scale),$.matrixWorldInverse.copy($.matrixWorld).invert(),Rt[10]===-1)$.projectionMatrix.copy(Q.projectionMatrix),$.projectionMatrixInverse.copy(Q.projectionMatrixInverse);else{const Tt=zt+Et,R=le+Et,S=Ht-se,F=Vt+(nt-se),K=Wt*le/R*Tt,Z=he*le/R*Tt;$.projectionMatrix.makePerspective(S,F,K,Z,Tt,R),$.projectionMatrixInverse.copy($.projectionMatrix).invert()}}function J($,Q){Q===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(Q.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(n===null)return;let Q=$.near,ft=$.far;v.texture!==null&&(v.depthNear>0&&(Q=v.depthNear),v.depthFar>0&&(ft=v.depthFar)),y.near=P.near=A.near=Q,y.far=P.far=A.far=ft,(L!==y.near||k!==y.far)&&(n.updateRenderState({depthNear:y.near,depthFar:y.far}),L=y.near,k=y.far),A.layers.mask=$.layers.mask|2,P.layers.mask=$.layers.mask|4,y.layers.mask=A.layers.mask|P.layers.mask;const nt=$.parent,Rt=y.cameras;J(y,nt);for(let Lt=0;Lt<Rt.length;Lt++)J(Rt[Lt],nt);Rt.length===2?O(y,A,P):y.projectionMatrix.copy(A.projectionMatrix),it($,y,nt)};function it($,Q,ft){ft===null?$.matrix.copy(Q.matrixWorld):($.matrix.copy(ft.matrixWorld),$.matrix.invert(),$.matrix.multiply(Q.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(Q.projectionMatrix),$.projectionMatrixInverse.copy(Q.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=mo*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return y},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function($){l=$,d!==null&&(d.fixedFoveation=$),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=$)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(y)};let dt=null;function wt($,Q){if(h=Q.getViewerPose(c||a),m=Q,h!==null){const ft=h.views;f!==null&&(t.setRenderTargetFramebuffer(M,f.framebuffer),t.setRenderTarget(M));let nt=!1;ft.length!==y.cameras.length&&(y.cameras.length=0,nt=!0);for(let Lt=0;Lt<ft.length;Lt++){const zt=ft[Lt];let le=null;if(f!==null)le=f.getViewport(zt);else{const he=u.getViewSubImage(d,zt);le=he.viewport,Lt===0&&(t.setRenderTargetTextures(M,he.colorTexture,d.ignoreDepthValues?void 0:he.depthStencilTexture),t.setRenderTarget(M))}let Wt=b[Lt];Wt===void 0&&(Wt=new Pe,Wt.layers.enable(Lt),Wt.viewport=new te,b[Lt]=Wt),Wt.matrix.fromArray(zt.transform.matrix),Wt.matrix.decompose(Wt.position,Wt.quaternion,Wt.scale),Wt.projectionMatrix.fromArray(zt.projectionMatrix),Wt.projectionMatrixInverse.copy(Wt.projectionMatrix).invert(),Wt.viewport.set(le.x,le.y,le.width,le.height),Lt===0&&(y.matrix.copy(Wt.matrix),y.matrix.decompose(y.position,y.quaternion,y.scale)),nt===!0&&y.cameras.push(Wt)}const Rt=n.enabledFeatures;if(Rt&&Rt.includes("depth-sensing")){const Lt=u.getDepthInformation(ft[0]);Lt&&Lt.isValid&&Lt.texture&&v.init(t,Lt,n.renderState)}}for(let ft=0;ft<x.length;ft++){const nt=_[ft],Rt=x[ft];nt!==null&&Rt!==void 0&&Rt.update(nt,Q,c||a)}dt&&dt($,Q),Q.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:Q}),m=null}const Bt=new qc;Bt.setAnimationLoop(wt),this.setAnimationLoop=function($){dt=$},this.dispose=function(){}}}const Xi=new We,w0=new Yt;function T0(s,t){function e(g,p){g.matrixAutoUpdate===!0&&g.updateMatrix(),p.value.copy(g.matrix)}function i(g,p){p.color.getRGB(g.fogColor.value,Wc(s)),p.isFog?(g.fogNear.value=p.near,g.fogFar.value=p.far):p.isFogExp2&&(g.fogDensity.value=p.density)}function n(g,p,M,x,_){p.isMeshBasicMaterial||p.isMeshLambertMaterial?r(g,p):p.isMeshToonMaterial?(r(g,p),u(g,p)):p.isMeshPhongMaterial?(r(g,p),h(g,p)):p.isMeshStandardMaterial?(r(g,p),d(g,p),p.isMeshPhysicalMaterial&&f(g,p,_)):p.isMeshMatcapMaterial?(r(g,p),m(g,p)):p.isMeshDepthMaterial?r(g,p):p.isMeshDistanceMaterial?(r(g,p),v(g,p)):p.isMeshNormalMaterial?r(g,p):p.isLineBasicMaterial?(a(g,p),p.isLineDashedMaterial&&o(g,p)):p.isPointsMaterial?l(g,p,M,x):p.isSpriteMaterial?c(g,p):p.isShadowMaterial?(g.color.value.copy(p.color),g.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(g,p){g.opacity.value=p.opacity,p.color&&g.diffuse.value.copy(p.color),p.emissive&&g.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(g.map.value=p.map,e(p.map,g.mapTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,e(p.alphaMap,g.alphaMapTransform)),p.bumpMap&&(g.bumpMap.value=p.bumpMap,e(p.bumpMap,g.bumpMapTransform),g.bumpScale.value=p.bumpScale,p.side===Te&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,e(p.normalMap,g.normalMapTransform),g.normalScale.value.copy(p.normalScale),p.side===Te&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,e(p.displacementMap,g.displacementMapTransform),g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias),p.emissiveMap&&(g.emissiveMap.value=p.emissiveMap,e(p.emissiveMap,g.emissiveMapTransform)),p.specularMap&&(g.specularMap.value=p.specularMap,e(p.specularMap,g.specularMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest);const M=t.get(p),x=M.envMap,_=M.envMapRotation;x&&(g.envMap.value=x,Xi.copy(_),Xi.x*=-1,Xi.y*=-1,Xi.z*=-1,x.isCubeTexture&&x.isRenderTargetTexture===!1&&(Xi.y*=-1,Xi.z*=-1),g.envMapRotation.value.setFromMatrix4(w0.makeRotationFromEuler(Xi)),g.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,g.reflectivity.value=p.reflectivity,g.ior.value=p.ior,g.refractionRatio.value=p.refractionRatio),p.lightMap&&(g.lightMap.value=p.lightMap,g.lightMapIntensity.value=p.lightMapIntensity,e(p.lightMap,g.lightMapTransform)),p.aoMap&&(g.aoMap.value=p.aoMap,g.aoMapIntensity.value=p.aoMapIntensity,e(p.aoMap,g.aoMapTransform))}function a(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,p.map&&(g.map.value=p.map,e(p.map,g.mapTransform))}function o(g,p){g.dashSize.value=p.dashSize,g.totalSize.value=p.dashSize+p.gapSize,g.scale.value=p.scale}function l(g,p,M,x){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.size.value=p.size*M,g.scale.value=x*.5,p.map&&(g.map.value=p.map,e(p.map,g.uvTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,e(p.alphaMap,g.alphaMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest)}function c(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.rotation.value=p.rotation,p.map&&(g.map.value=p.map,e(p.map,g.mapTransform)),p.alphaMap&&(g.alphaMap.value=p.alphaMap,e(p.alphaMap,g.alphaMapTransform)),p.alphaTest>0&&(g.alphaTest.value=p.alphaTest)}function h(g,p){g.specular.value.copy(p.specular),g.shininess.value=Math.max(p.shininess,1e-4)}function u(g,p){p.gradientMap&&(g.gradientMap.value=p.gradientMap)}function d(g,p){g.metalness.value=p.metalness,p.metalnessMap&&(g.metalnessMap.value=p.metalnessMap,e(p.metalnessMap,g.metalnessMapTransform)),g.roughness.value=p.roughness,p.roughnessMap&&(g.roughnessMap.value=p.roughnessMap,e(p.roughnessMap,g.roughnessMapTransform)),p.envMap&&(g.envMapIntensity.value=p.envMapIntensity)}function f(g,p,M){g.ior.value=p.ior,p.sheen>0&&(g.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),g.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(g.sheenColorMap.value=p.sheenColorMap,e(p.sheenColorMap,g.sheenColorMapTransform)),p.sheenRoughnessMap&&(g.sheenRoughnessMap.value=p.sheenRoughnessMap,e(p.sheenRoughnessMap,g.sheenRoughnessMapTransform))),p.clearcoat>0&&(g.clearcoat.value=p.clearcoat,g.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(g.clearcoatMap.value=p.clearcoatMap,e(p.clearcoatMap,g.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,e(p.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(g.clearcoatNormalMap.value=p.clearcoatNormalMap,e(p.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Te&&g.clearcoatNormalScale.value.negate())),p.dispersion>0&&(g.dispersion.value=p.dispersion),p.iridescence>0&&(g.iridescence.value=p.iridescence,g.iridescenceIOR.value=p.iridescenceIOR,g.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(g.iridescenceMap.value=p.iridescenceMap,e(p.iridescenceMap,g.iridescenceMapTransform)),p.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=p.iridescenceThicknessMap,e(p.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),p.transmission>0&&(g.transmission.value=p.transmission,g.transmissionSamplerMap.value=M.texture,g.transmissionSamplerSize.value.set(M.width,M.height),p.transmissionMap&&(g.transmissionMap.value=p.transmissionMap,e(p.transmissionMap,g.transmissionMapTransform)),g.thickness.value=p.thickness,p.thicknessMap&&(g.thicknessMap.value=p.thicknessMap,e(p.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=p.attenuationDistance,g.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(g.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(g.anisotropyMap.value=p.anisotropyMap,e(p.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=p.specularIntensity,g.specularColor.value.copy(p.specularColor),p.specularColorMap&&(g.specularColorMap.value=p.specularColorMap,e(p.specularColorMap,g.specularColorMapTransform)),p.specularIntensityMap&&(g.specularIntensityMap.value=p.specularIntensityMap,e(p.specularIntensityMap,g.specularIntensityMapTransform))}function m(g,p){p.matcap&&(g.matcap.value=p.matcap)}function v(g,p){const M=t.get(p).light;g.referencePosition.value.setFromMatrixPosition(M.matrixWorld),g.nearDistance.value=M.shadow.camera.near,g.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:n}}function E0(s,t,e,i){let n={},r={},a=[];const o=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function l(M,x){const _=x.program;i.uniformBlockBinding(M,_)}function c(M,x){let _=n[M.id];_===void 0&&(m(M),_=h(M),n[M.id]=_,M.addEventListener("dispose",g));const C=x.program;i.updateUBOMapping(M,C);const E=t.render.frame;r[M.id]!==E&&(d(M),r[M.id]=E)}function h(M){const x=u();M.__bindingPointIndex=x;const _=s.createBuffer(),C=M.__size,E=M.usage;return s.bindBuffer(s.UNIFORM_BUFFER,_),s.bufferData(s.UNIFORM_BUFFER,C,E),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,x,_),_}function u(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(M){const x=n[M.id],_=M.uniforms,C=M.__cache;s.bindBuffer(s.UNIFORM_BUFFER,x);for(let E=0,A=_.length;E<A;E++){const P=Array.isArray(_[E])?_[E]:[_[E]];for(let b=0,y=P.length;b<y;b++){const L=P[b];if(f(L,E,b,C)===!0){const k=L.__offset,z=Array.isArray(L.value)?L.value:[L.value];let X=0;for(let Y=0;Y<z.length;Y++){const W=z[Y],V=v(W);typeof W=="number"||typeof W=="boolean"?(L.__data[0]=W,s.bufferSubData(s.UNIFORM_BUFFER,k+X,L.__data)):W.isMatrix3?(L.__data[0]=W.elements[0],L.__data[1]=W.elements[1],L.__data[2]=W.elements[2],L.__data[3]=0,L.__data[4]=W.elements[3],L.__data[5]=W.elements[4],L.__data[6]=W.elements[5],L.__data[7]=0,L.__data[8]=W.elements[6],L.__data[9]=W.elements[7],L.__data[10]=W.elements[8],L.__data[11]=0):(W.toArray(L.__data,X),X+=V.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,k,L.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function f(M,x,_,C){const E=M.value,A=x+"_"+_;if(C[A]===void 0)return typeof E=="number"||typeof E=="boolean"?C[A]=E:C[A]=E.clone(),!0;{const P=C[A];if(typeof E=="number"||typeof E=="boolean"){if(P!==E)return C[A]=E,!0}else if(P.equals(E)===!1)return P.copy(E),!0}return!1}function m(M){const x=M.uniforms;let _=0;const C=16;for(let A=0,P=x.length;A<P;A++){const b=Array.isArray(x[A])?x[A]:[x[A]];for(let y=0,L=b.length;y<L;y++){const k=b[y],z=Array.isArray(k.value)?k.value:[k.value];for(let X=0,Y=z.length;X<Y;X++){const W=z[X],V=v(W),O=_%C,J=O%V.boundary,it=O+J;_+=J,it!==0&&C-it<V.storage&&(_+=C-it),k.__data=new Float32Array(V.storage/Float32Array.BYTES_PER_ELEMENT),k.__offset=_,_+=V.storage}}}const E=_%C;return E>0&&(_+=C-E),M.__size=_,M.__cache={},this}function v(M){const x={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(x.boundary=4,x.storage=4):M.isVector2?(x.boundary=8,x.storage=8):M.isVector3||M.isColor?(x.boundary=16,x.storage=12):M.isVector4?(x.boundary=16,x.storage=16):M.isMatrix3?(x.boundary=48,x.storage=48):M.isMatrix4?(x.boundary=64,x.storage=64):M.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",M),x}function g(M){const x=M.target;x.removeEventListener("dispose",g);const _=a.indexOf(x.__bindingPointIndex);a.splice(_,1),s.deleteBuffer(n[x.id]),delete n[x.id],delete r[x.id]}function p(){for(const M in n)s.deleteBuffer(n[M]);a=[],n={},r={}}return{bind:l,update:c,dispose:p}}class th{constructor(t={}){const{canvas:e=pu(),context:i=null,depth:n=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let f;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=i.getContextAttributes().alpha}else f=a;const m=new Uint32Array(4),v=new Int32Array(4);let g=null,p=null;const M=[],x=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Ce,this.toneMapping=Ni,this.toneMappingExposure=1;const _=this;let C=!1,E=0,A=0,P=null,b=-1,y=null;const L=new te,k=new te;let z=null;const X=new bt(0);let Y=0,W=e.width,V=e.height,O=1,J=null,it=null;const dt=new te(0,0,W,V),wt=new te(0,0,W,V);let Bt=!1;const $=new Fo;let Q=!1,ft=!1;const nt=new Yt,Rt=new Yt,Lt=new T,zt=new te,le={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Wt=!1;function he(){return P===null?O:1}let N=i;function Fe(w,I){return e.getContext(w,I)}try{const w={alpha:!0,depth:n,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${To}`),e.addEventListener("webglcontextlost",j,!1),e.addEventListener("webglcontextrestored",ut,!1),e.addEventListener("webglcontextcreationerror",ct,!1),N===null){const I="webgl2";if(N=Fe(I,w),N===null)throw Fe(I)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(w){throw console.error("THREE.WebGLRenderer: "+w.message),w}let Ht,Vt,Et,se,Tt,R,S,F,K,Z,q,yt,lt,pt,$t,tt,mt,At,Ct,gt,Gt,Ft,ie,D;function at(){Ht=new Dp(N),Ht.init(),Ft=new v0(N,Ht),Vt=new Ep(N,Ht,t,Ft),Et=new p0(N,Ht),Vt.reverseDepthBuffer&&d&&Et.buffers.depth.setReversed(!0),se=new Np(N),Tt=new Qm,R=new g0(N,Ht,Et,Tt,Vt,Ft,se),S=new Rp(_),F=new Lp(_),K=new Hu(N),ie=new wp(N,K),Z=new Ip(N,K,se,ie),q=new Op(N,Z,K,se),Ct=new Fp(N,Vt,R),tt=new Ap(Tt),yt=new Jm(_,S,F,Ht,Vt,ie,tt),lt=new T0(_,Tt),pt=new e0,$t=new o0(Ht),At=new bp(_,S,F,Et,q,f,l),mt=new d0(_,q,Vt),D=new E0(N,se,Vt,Et),gt=new Tp(N,Ht,se),Gt=new Up(N,Ht,se),se.programs=yt.programs,_.capabilities=Vt,_.extensions=Ht,_.properties=Tt,_.renderLists=pt,_.shadowMap=mt,_.state=Et,_.info=se}at();const G=new b0(_,N);this.xr=G,this.getContext=function(){return N},this.getContextAttributes=function(){return N.getContextAttributes()},this.forceContextLoss=function(){const w=Ht.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){const w=Ht.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return O},this.setPixelRatio=function(w){w!==void 0&&(O=w,this.setSize(W,V,!1))},this.getSize=function(w){return w.set(W,V)},this.setSize=function(w,I,B=!0){if(G.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}W=w,V=I,e.width=Math.floor(w*O),e.height=Math.floor(I*O),B===!0&&(e.style.width=w+"px",e.style.height=I+"px"),this.setViewport(0,0,w,I)},this.getDrawingBufferSize=function(w){return w.set(W*O,V*O).floor()},this.setDrawingBufferSize=function(w,I,B){W=w,V=I,O=B,e.width=Math.floor(w*B),e.height=Math.floor(I*B),this.setViewport(0,0,w,I)},this.getCurrentViewport=function(w){return w.copy(L)},this.getViewport=function(w){return w.copy(dt)},this.setViewport=function(w,I,B,H){w.isVector4?dt.set(w.x,w.y,w.z,w.w):dt.set(w,I,B,H),Et.viewport(L.copy(dt).multiplyScalar(O).round())},this.getScissor=function(w){return w.copy(wt)},this.setScissor=function(w,I,B,H){w.isVector4?wt.set(w.x,w.y,w.z,w.w):wt.set(w,I,B,H),Et.scissor(k.copy(wt).multiplyScalar(O).round())},this.getScissorTest=function(){return Bt},this.setScissorTest=function(w){Et.setScissorTest(Bt=w)},this.setOpaqueSort=function(w){J=w},this.setTransparentSort=function(w){it=w},this.getClearColor=function(w){return w.copy(At.getClearColor())},this.setClearColor=function(){At.setClearColor.apply(At,arguments)},this.getClearAlpha=function(){return At.getClearAlpha()},this.setClearAlpha=function(){At.setClearAlpha.apply(At,arguments)},this.clear=function(w=!0,I=!0,B=!0){let H=0;if(w){let U=!1;if(P!==null){const et=P.texture.format;U=et===Uo||et===Io||et===Do}if(U){const et=P.texture.type,ht=et===Si||et===Qi||et===ps||et===Fn||et===Co||et===Po,_t=At.getClearColor(),xt=At.getClearAlpha(),Pt=_t.r,It=_t.g,Mt=_t.b;ht?(m[0]=Pt,m[1]=It,m[2]=Mt,m[3]=xt,N.clearBufferuiv(N.COLOR,0,m)):(v[0]=Pt,v[1]=It,v[2]=Mt,v[3]=xt,N.clearBufferiv(N.COLOR,0,v))}else H|=N.COLOR_BUFFER_BIT}I&&(H|=N.DEPTH_BUFFER_BIT),B&&(H|=N.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),N.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",j,!1),e.removeEventListener("webglcontextrestored",ut,!1),e.removeEventListener("webglcontextcreationerror",ct,!1),pt.dispose(),$t.dispose(),Tt.dispose(),S.dispose(),F.dispose(),q.dispose(),ie.dispose(),D.dispose(),yt.dispose(),G.dispose(),G.removeEventListener("sessionstart",$o),G.removeEventListener("sessionend",Xo),Bi.stop()};function j(w){w.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),C=!0}function ut(){console.log("THREE.WebGLRenderer: Context Restored."),C=!1;const w=se.autoReset,I=mt.enabled,B=mt.autoUpdate,H=mt.needsUpdate,U=mt.type;at(),se.autoReset=w,mt.enabled=I,mt.autoUpdate=B,mt.needsUpdate=H,mt.type=U}function ct(w){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function Dt(w){const I=w.target;I.removeEventListener("dispose",Dt),ce(I)}function ce(w){Me(w),Tt.remove(w)}function Me(w){const I=Tt.get(w).programs;I!==void 0&&(I.forEach(function(B){yt.releaseProgram(B)}),w.isShaderMaterial&&yt.releaseShaderCache(w))}this.renderBufferDirect=function(w,I,B,H,U,et){I===null&&(I=le);const ht=U.isMesh&&U.matrixWorld.determinant()<0,_t=gh(w,I,B,H,U);Et.setMaterial(H,ht);let xt=B.index,Pt=1;if(H.wireframe===!0){if(xt=Z.getWireframeAttribute(B),xt===void 0)return;Pt=2}const It=B.drawRange,Mt=B.attributes.position;let qt=It.start*Pt,ne=(It.start+It.count)*Pt;et!==null&&(qt=Math.max(qt,et.start*Pt),ne=Math.min(ne,(et.start+et.count)*Pt)),xt!==null?(qt=Math.max(qt,0),ne=Math.min(ne,xt.count)):Mt!=null&&(qt=Math.max(qt,0),ne=Math.min(ne,Mt.count));const re=ne-qt;if(re<0||re===1/0)return;ie.setup(U,H,_t,B,xt);let Le,Kt=gt;if(xt!==null&&(Le=K.get(xt),Kt=Gt,Kt.setIndex(Le)),U.isMesh)H.wireframe===!0?(Et.setLineWidth(H.wireframeLinewidth*he()),Kt.setMode(N.LINES)):Kt.setMode(N.TRIANGLES);else if(U.isLine){let St=H.linewidth;St===void 0&&(St=1),Et.setLineWidth(St*he()),U.isLineSegments?Kt.setMode(N.LINES):U.isLineLoop?Kt.setMode(N.LINE_LOOP):Kt.setMode(N.LINE_STRIP)}else U.isPoints?Kt.setMode(N.POINTS):U.isSprite&&Kt.setMode(N.TRIANGLES);if(U.isBatchedMesh)if(U._multiDrawInstances!==null)Kt.renderMultiDrawInstances(U._multiDrawStarts,U._multiDrawCounts,U._multiDrawCount,U._multiDrawInstances);else if(Ht.get("WEBGL_multi_draw"))Kt.renderMultiDraw(U._multiDrawStarts,U._multiDrawCounts,U._multiDrawCount);else{const St=U._multiDrawStarts,ui=U._multiDrawCounts,jt=U._multiDrawCount,Xe=xt?K.get(xt).bytesPerElement:1,nn=Tt.get(H).currentProgram.getUniforms();for(let De=0;De<jt;De++)nn.setValue(N,"_gl_DrawID",De),Kt.render(St[De]/Xe,ui[De])}else if(U.isInstancedMesh)Kt.renderInstances(qt,re,U.count);else if(B.isInstancedBufferGeometry){const St=B._maxInstanceCount!==void 0?B._maxInstanceCount:1/0,ui=Math.min(B.instanceCount,St);Kt.renderInstances(qt,re,ui)}else Kt.render(qt,re)};function Zt(w,I,B){w.transparent===!0&&w.side===Be&&w.forceSinglePass===!1?(w.side=Te,w.needsUpdate=!0,Ms(w,I,B),w.side=Oi,w.needsUpdate=!0,Ms(w,I,B),w.side=Be):Ms(w,I,B)}this.compile=function(w,I,B=null){B===null&&(B=w),p=$t.get(B),p.init(I),x.push(p),B.traverseVisible(function(U){U.isLight&&U.layers.test(I.layers)&&(p.pushLight(U),U.castShadow&&p.pushShadow(U))}),w!==B&&w.traverseVisible(function(U){U.isLight&&U.layers.test(I.layers)&&(p.pushLight(U),U.castShadow&&p.pushShadow(U))}),p.setupLights();const H=new Set;return w.traverse(function(U){if(!(U.isMesh||U.isPoints||U.isLine||U.isSprite))return;const et=U.material;if(et)if(Array.isArray(et))for(let ht=0;ht<et.length;ht++){const _t=et[ht];Zt(_t,B,U),H.add(_t)}else Zt(et,B,U),H.add(et)}),x.pop(),p=null,H},this.compileAsync=function(w,I,B=null){const H=this.compile(w,I,B);return new Promise(U=>{function et(){if(H.forEach(function(ht){Tt.get(ht).currentProgram.isReady()&&H.delete(ht)}),H.size===0){U(w);return}setTimeout(et,10)}Ht.get("KHR_parallel_shader_compile")!==null?et():setTimeout(et,10)})};let $e=null;function hi(w){$e&&$e(w)}function $o(){Bi.stop()}function Xo(){Bi.start()}const Bi=new qc;Bi.setAnimationLoop(hi),typeof self<"u"&&Bi.setContext(self),this.setAnimationLoop=function(w){$e=w,G.setAnimationLoop(w),w===null?Bi.stop():Bi.start()},G.addEventListener("sessionstart",$o),G.addEventListener("sessionend",Xo),this.render=function(w,I){if(I!==void 0&&I.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(C===!0)return;if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),I.parent===null&&I.matrixWorldAutoUpdate===!0&&I.updateMatrixWorld(),G.enabled===!0&&G.isPresenting===!0&&(G.cameraAutoUpdate===!0&&G.updateCamera(I),I=G.getCamera()),w.isScene===!0&&w.onBeforeRender(_,w,I,P),p=$t.get(w,x.length),p.init(I),x.push(p),Rt.multiplyMatrices(I.projectionMatrix,I.matrixWorldInverse),$.setFromProjectionMatrix(Rt),ft=this.localClippingEnabled,Q=tt.init(this.clippingPlanes,ft),g=pt.get(w,M.length),g.init(),M.push(g),G.enabled===!0&&G.isPresenting===!0){const et=_.xr.getDepthSensingMesh();et!==null&&Dr(et,I,-1/0,_.sortObjects)}Dr(w,I,0,_.sortObjects),g.finish(),_.sortObjects===!0&&g.sort(J,it),Wt=G.enabled===!1||G.isPresenting===!1||G.hasDepthSensing()===!1,Wt&&At.addToRenderList(g,w),this.info.render.frame++,Q===!0&&tt.beginShadows();const B=p.state.shadowsArray;mt.render(B,w,I),Q===!0&&tt.endShadows(),this.info.autoReset===!0&&this.info.reset();const H=g.opaque,U=g.transmissive;if(p.setupLights(),I.isArrayCamera){const et=I.cameras;if(U.length>0)for(let ht=0,_t=et.length;ht<_t;ht++){const xt=et[ht];Yo(H,U,w,xt)}Wt&&At.render(w);for(let ht=0,_t=et.length;ht<_t;ht++){const xt=et[ht];qo(g,w,xt,xt.viewport)}}else U.length>0&&Yo(H,U,w,I),Wt&&At.render(w),qo(g,w,I);P!==null&&(R.updateMultisampleRenderTarget(P),R.updateRenderTargetMipmap(P)),w.isScene===!0&&w.onAfterRender(_,w,I),ie.resetDefaultState(),b=-1,y=null,x.pop(),x.length>0?(p=x[x.length-1],Q===!0&&tt.setGlobalState(_.clippingPlanes,p.state.camera)):p=null,M.pop(),M.length>0?g=M[M.length-1]:g=null};function Dr(w,I,B,H){if(w.visible===!1)return;if(w.layers.test(I.layers)){if(w.isGroup)B=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(I);else if(w.isLight)p.pushLight(w),w.castShadow&&p.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||$.intersectsSprite(w)){H&&zt.setFromMatrixPosition(w.matrixWorld).applyMatrix4(Rt);const ht=q.update(w),_t=w.material;_t.visible&&g.push(w,ht,_t,B,zt.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||$.intersectsObject(w))){const ht=q.update(w),_t=w.material;if(H&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),zt.copy(w.boundingSphere.center)):(ht.boundingSphere===null&&ht.computeBoundingSphere(),zt.copy(ht.boundingSphere.center)),zt.applyMatrix4(w.matrixWorld).applyMatrix4(Rt)),Array.isArray(_t)){const xt=ht.groups;for(let Pt=0,It=xt.length;Pt<It;Pt++){const Mt=xt[Pt],qt=_t[Mt.materialIndex];qt&&qt.visible&&g.push(w,ht,qt,B,zt.z,Mt)}}else _t.visible&&g.push(w,ht,_t,B,zt.z,null)}}const et=w.children;for(let ht=0,_t=et.length;ht<_t;ht++)Dr(et[ht],I,B,H)}function qo(w,I,B,H){const U=w.opaque,et=w.transmissive,ht=w.transparent;p.setupLightsView(B),Q===!0&&tt.setGlobalState(_.clippingPlanes,B),H&&Et.viewport(L.copy(H)),U.length>0&&xs(U,I,B),et.length>0&&xs(et,I,B),ht.length>0&&xs(ht,I,B),Et.buffers.depth.setTest(!0),Et.buffers.depth.setMask(!0),Et.buffers.color.setMask(!0),Et.setPolygonOffset(!1)}function Yo(w,I,B,H){if((B.isScene===!0?B.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[H.id]===void 0&&(p.state.transmissionRenderTarget[H.id]=new tn(1,1,{generateMipmaps:!0,type:Ht.has("EXT_color_buffer_half_float")||Ht.has("EXT_color_buffer_float")?gs:Si,minFilter:Ji,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Xt.workingColorSpace}));const et=p.state.transmissionRenderTarget[H.id],ht=H.viewport||L;et.setSize(ht.z,ht.w);const _t=_.getRenderTarget();_.setRenderTarget(et),_.getClearColor(X),Y=_.getClearAlpha(),Y<1&&_.setClearColor(16777215,.5),_.clear(),Wt&&At.render(B);const xt=_.toneMapping;_.toneMapping=Ni;const Pt=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),p.setupLightsView(H),Q===!0&&tt.setGlobalState(_.clippingPlanes,H),xs(w,B,H),R.updateMultisampleRenderTarget(et),R.updateRenderTargetMipmap(et),Ht.has("WEBGL_multisampled_render_to_texture")===!1){let It=!1;for(let Mt=0,qt=I.length;Mt<qt;Mt++){const ne=I[Mt],re=ne.object,Le=ne.geometry,Kt=ne.material,St=ne.group;if(Kt.side===Be&&re.layers.test(H.layers)){const ui=Kt.side;Kt.side=Te,Kt.needsUpdate=!0,Ko(re,B,H,Le,Kt,St),Kt.side=ui,Kt.needsUpdate=!0,It=!0}}It===!0&&(R.updateMultisampleRenderTarget(et),R.updateRenderTargetMipmap(et))}_.setRenderTarget(_t),_.setClearColor(X,Y),Pt!==void 0&&(H.viewport=Pt),_.toneMapping=xt}function xs(w,I,B){const H=I.isScene===!0?I.overrideMaterial:null;for(let U=0,et=w.length;U<et;U++){const ht=w[U],_t=ht.object,xt=ht.geometry,Pt=H===null?ht.material:H,It=ht.group;_t.layers.test(B.layers)&&Ko(_t,I,B,xt,Pt,It)}}function Ko(w,I,B,H,U,et){w.onBeforeRender(_,I,B,H,U,et),w.modelViewMatrix.multiplyMatrices(B.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),U.onBeforeRender(_,I,B,H,w,et),U.transparent===!0&&U.side===Be&&U.forceSinglePass===!1?(U.side=Te,U.needsUpdate=!0,_.renderBufferDirect(B,I,H,U,w,et),U.side=Oi,U.needsUpdate=!0,_.renderBufferDirect(B,I,H,U,w,et),U.side=Be):_.renderBufferDirect(B,I,H,U,w,et),w.onAfterRender(_,I,B,H,U,et)}function Ms(w,I,B){I.isScene!==!0&&(I=le);const H=Tt.get(w),U=p.state.lights,et=p.state.shadowsArray,ht=U.state.version,_t=yt.getParameters(w,U.state,et,I,B),xt=yt.getProgramCacheKey(_t);let Pt=H.programs;H.environment=w.isMeshStandardMaterial?I.environment:null,H.fog=I.fog,H.envMap=(w.isMeshStandardMaterial?F:S).get(w.envMap||H.environment),H.envMapRotation=H.environment!==null&&w.envMap===null?I.environmentRotation:w.envMapRotation,Pt===void 0&&(w.addEventListener("dispose",Dt),Pt=new Map,H.programs=Pt);let It=Pt.get(xt);if(It!==void 0){if(H.currentProgram===It&&H.lightsStateVersion===ht)return Zo(w,_t),It}else _t.uniforms=yt.getUniforms(w),w.onBeforeCompile(_t,_),It=yt.acquireProgram(_t,xt),Pt.set(xt,It),H.uniforms=_t.uniforms;const Mt=H.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Mt.clippingPlanes=tt.uniform),Zo(w,_t),H.needsLights=_h(w),H.lightsStateVersion=ht,H.needsLights&&(Mt.ambientLightColor.value=U.state.ambient,Mt.lightProbe.value=U.state.probe,Mt.directionalLights.value=U.state.directional,Mt.directionalLightShadows.value=U.state.directionalShadow,Mt.spotLights.value=U.state.spot,Mt.spotLightShadows.value=U.state.spotShadow,Mt.rectAreaLights.value=U.state.rectArea,Mt.ltc_1.value=U.state.rectAreaLTC1,Mt.ltc_2.value=U.state.rectAreaLTC2,Mt.pointLights.value=U.state.point,Mt.pointLightShadows.value=U.state.pointShadow,Mt.hemisphereLights.value=U.state.hemi,Mt.directionalShadowMap.value=U.state.directionalShadowMap,Mt.directionalShadowMatrix.value=U.state.directionalShadowMatrix,Mt.spotShadowMap.value=U.state.spotShadowMap,Mt.spotLightMatrix.value=U.state.spotLightMatrix,Mt.spotLightMap.value=U.state.spotLightMap,Mt.pointShadowMap.value=U.state.pointShadowMap,Mt.pointShadowMatrix.value=U.state.pointShadowMatrix),H.currentProgram=It,H.uniformsList=null,It}function jo(w){if(w.uniformsList===null){const I=w.currentProgram.getUniforms();w.uniformsList=ar.seqWithValue(I.seq,w.uniforms)}return w.uniformsList}function Zo(w,I){const B=Tt.get(w);B.outputColorSpace=I.outputColorSpace,B.batching=I.batching,B.batchingColor=I.batchingColor,B.instancing=I.instancing,B.instancingColor=I.instancingColor,B.instancingMorph=I.instancingMorph,B.skinning=I.skinning,B.morphTargets=I.morphTargets,B.morphNormals=I.morphNormals,B.morphColors=I.morphColors,B.morphTargetsCount=I.morphTargetsCount,B.numClippingPlanes=I.numClippingPlanes,B.numIntersection=I.numClipIntersection,B.vertexAlphas=I.vertexAlphas,B.vertexTangents=I.vertexTangents,B.toneMapping=I.toneMapping}function gh(w,I,B,H,U){I.isScene!==!0&&(I=le),R.resetTextureUnits();const et=I.fog,ht=H.isMeshStandardMaterial?I.environment:null,_t=P===null?_.outputColorSpace:P.isXRRenderTarget===!0?P.texture.colorSpace:Bn,xt=(H.isMeshStandardMaterial?F:S).get(H.envMap||ht),Pt=H.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,It=!!B.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Mt=!!B.morphAttributes.position,qt=!!B.morphAttributes.normal,ne=!!B.morphAttributes.color;let re=Ni;H.toneMapped&&(P===null||P.isXRRenderTarget===!0)&&(re=_.toneMapping);const Le=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,Kt=Le!==void 0?Le.length:0,St=Tt.get(H),ui=p.state.lights;if(Q===!0&&(ft===!0||w!==y)){const Oe=w===y&&H.id===b;tt.setState(H,w,Oe)}let jt=!1;H.version===St.__version?(St.needsLights&&St.lightsStateVersion!==ui.state.version||St.outputColorSpace!==_t||U.isBatchedMesh&&St.batching===!1||!U.isBatchedMesh&&St.batching===!0||U.isBatchedMesh&&St.batchingColor===!0&&U.colorTexture===null||U.isBatchedMesh&&St.batchingColor===!1&&U.colorTexture!==null||U.isInstancedMesh&&St.instancing===!1||!U.isInstancedMesh&&St.instancing===!0||U.isSkinnedMesh&&St.skinning===!1||!U.isSkinnedMesh&&St.skinning===!0||U.isInstancedMesh&&St.instancingColor===!0&&U.instanceColor===null||U.isInstancedMesh&&St.instancingColor===!1&&U.instanceColor!==null||U.isInstancedMesh&&St.instancingMorph===!0&&U.morphTexture===null||U.isInstancedMesh&&St.instancingMorph===!1&&U.morphTexture!==null||St.envMap!==xt||H.fog===!0&&St.fog!==et||St.numClippingPlanes!==void 0&&(St.numClippingPlanes!==tt.numPlanes||St.numIntersection!==tt.numIntersection)||St.vertexAlphas!==Pt||St.vertexTangents!==It||St.morphTargets!==Mt||St.morphNormals!==qt||St.morphColors!==ne||St.toneMapping!==re||St.morphTargetsCount!==Kt)&&(jt=!0):(jt=!0,St.__version=H.version);let Xe=St.currentProgram;jt===!0&&(Xe=Ms(H,I,U));let nn=!1,De=!1,Wn=!1;const ae=Xe.getUniforms(),Je=St.uniforms;if(Et.useProgram(Xe.program)&&(nn=!0,De=!0,Wn=!0),H.id!==b&&(b=H.id,De=!0),nn||y!==w){Et.buffers.depth.getReversed()?(nt.copy(w.projectionMatrix),gu(nt),vu(nt),ae.setValue(N,"projectionMatrix",nt)):ae.setValue(N,"projectionMatrix",w.projectionMatrix),ae.setValue(N,"viewMatrix",w.matrixWorldInverse);const bi=ae.map.cameraPosition;bi!==void 0&&bi.setValue(N,Lt.setFromMatrixPosition(w.matrixWorld)),Vt.logarithmicDepthBuffer&&ae.setValue(N,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&ae.setValue(N,"isOrthographic",w.isOrthographicCamera===!0),y!==w&&(y=w,De=!0,Wn=!0)}if(U.isSkinnedMesh){ae.setOptional(N,U,"bindMatrix"),ae.setOptional(N,U,"bindMatrixInverse");const Oe=U.skeleton;Oe&&(Oe.boneTexture===null&&Oe.computeBoneTexture(),ae.setValue(N,"boneTexture",Oe.boneTexture,R))}U.isBatchedMesh&&(ae.setOptional(N,U,"batchingTexture"),ae.setValue(N,"batchingTexture",U._matricesTexture,R),ae.setOptional(N,U,"batchingIdTexture"),ae.setValue(N,"batchingIdTexture",U._indirectTexture,R),ae.setOptional(N,U,"batchingColorTexture"),U._colorsTexture!==null&&ae.setValue(N,"batchingColorTexture",U._colorsTexture,R));const $n=B.morphAttributes;if(($n.position!==void 0||$n.normal!==void 0||$n.color!==void 0)&&Ct.update(U,B,Xe),(De||St.receiveShadow!==U.receiveShadow)&&(St.receiveShadow=U.receiveShadow,ae.setValue(N,"receiveShadow",U.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(Je.envMap.value=xt,Je.flipEnvMap.value=xt.isCubeTexture&&xt.isRenderTargetTexture===!1?-1:1),H.isMeshStandardMaterial&&H.envMap===null&&I.environment!==null&&(Je.envMapIntensity.value=I.environmentIntensity),De&&(ae.setValue(N,"toneMappingExposure",_.toneMappingExposure),St.needsLights&&vh(Je,Wn),et&&H.fog===!0&&lt.refreshFogUniforms(Je,et),lt.refreshMaterialUniforms(Je,H,O,V,p.state.transmissionRenderTarget[w.id]),ar.upload(N,jo(St),Je,R)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(ar.upload(N,jo(St),Je,R),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&ae.setValue(N,"center",U.center),ae.setValue(N,"modelViewMatrix",U.modelViewMatrix),ae.setValue(N,"normalMatrix",U.normalMatrix),ae.setValue(N,"modelMatrix",U.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const Oe=H.uniformsGroups;for(let bi=0,wi=Oe.length;bi<wi;bi++){const Jo=Oe[bi];D.update(Jo,Xe),D.bind(Jo,Xe)}}return Xe}function vh(w,I){w.ambientLightColor.needsUpdate=I,w.lightProbe.needsUpdate=I,w.directionalLights.needsUpdate=I,w.directionalLightShadows.needsUpdate=I,w.pointLights.needsUpdate=I,w.pointLightShadows.needsUpdate=I,w.spotLights.needsUpdate=I,w.spotLightShadows.needsUpdate=I,w.rectAreaLights.needsUpdate=I,w.hemisphereLights.needsUpdate=I}function _h(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return E},this.getActiveMipmapLevel=function(){return A},this.getRenderTarget=function(){return P},this.setRenderTargetTextures=function(w,I,B){Tt.get(w.texture).__webglTexture=I,Tt.get(w.depthTexture).__webglTexture=B;const H=Tt.get(w);H.__hasExternalTextures=!0,H.__autoAllocateDepthBuffer=B===void 0,H.__autoAllocateDepthBuffer||Ht.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(w,I){const B=Tt.get(w);B.__webglFramebuffer=I,B.__useDefaultFramebuffer=I===void 0},this.setRenderTarget=function(w,I=0,B=0){P=w,E=I,A=B;let H=!0,U=null,et=!1,ht=!1;if(w){const xt=Tt.get(w);if(xt.__useDefaultFramebuffer!==void 0)Et.bindFramebuffer(N.FRAMEBUFFER,null),H=!1;else if(xt.__webglFramebuffer===void 0)R.setupRenderTarget(w);else if(xt.__hasExternalTextures)R.rebindTextures(w,Tt.get(w.texture).__webglTexture,Tt.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){const Mt=w.depthTexture;if(xt.__boundDepthTexture!==Mt){if(Mt!==null&&Tt.has(Mt)&&(w.width!==Mt.image.width||w.height!==Mt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");R.setupDepthRenderbuffer(w)}}const Pt=w.texture;(Pt.isData3DTexture||Pt.isDataArrayTexture||Pt.isCompressedArrayTexture)&&(ht=!0);const It=Tt.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(It[I])?U=It[I][B]:U=It[I],et=!0):w.samples>0&&R.useMultisampledRTT(w)===!1?U=Tt.get(w).__webglMultisampledFramebuffer:Array.isArray(It)?U=It[B]:U=It,L.copy(w.viewport),k.copy(w.scissor),z=w.scissorTest}else L.copy(dt).multiplyScalar(O).floor(),k.copy(wt).multiplyScalar(O).floor(),z=Bt;if(Et.bindFramebuffer(N.FRAMEBUFFER,U)&&H&&Et.drawBuffers(w,U),Et.viewport(L),Et.scissor(k),Et.setScissorTest(z),et){const xt=Tt.get(w.texture);N.framebufferTexture2D(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0,N.TEXTURE_CUBE_MAP_POSITIVE_X+I,xt.__webglTexture,B)}else if(ht){const xt=Tt.get(w.texture),Pt=I||0;N.framebufferTextureLayer(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0,xt.__webglTexture,B||0,Pt)}b=-1},this.readRenderTargetPixels=function(w,I,B,H,U,et,ht){if(!(w&&w.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let _t=Tt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&ht!==void 0&&(_t=_t[ht]),_t){Et.bindFramebuffer(N.FRAMEBUFFER,_t);try{const xt=w.texture,Pt=xt.format,It=xt.type;if(!Vt.textureFormatReadable(Pt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Vt.textureTypeReadable(It)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}I>=0&&I<=w.width-H&&B>=0&&B<=w.height-U&&N.readPixels(I,B,H,U,Ft.convert(Pt),Ft.convert(It),et)}finally{const xt=P!==null?Tt.get(P).__webglFramebuffer:null;Et.bindFramebuffer(N.FRAMEBUFFER,xt)}}},this.readRenderTargetPixelsAsync=async function(w,I,B,H,U,et,ht){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let _t=Tt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&ht!==void 0&&(_t=_t[ht]),_t){const xt=w.texture,Pt=xt.format,It=xt.type;if(!Vt.textureFormatReadable(Pt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Vt.textureTypeReadable(It))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(I>=0&&I<=w.width-H&&B>=0&&B<=w.height-U){Et.bindFramebuffer(N.FRAMEBUFFER,_t);const Mt=N.createBuffer();N.bindBuffer(N.PIXEL_PACK_BUFFER,Mt),N.bufferData(N.PIXEL_PACK_BUFFER,et.byteLength,N.STREAM_READ),N.readPixels(I,B,H,U,Ft.convert(Pt),Ft.convert(It),0);const qt=P!==null?Tt.get(P).__webglFramebuffer:null;Et.bindFramebuffer(N.FRAMEBUFFER,qt);const ne=N.fenceSync(N.SYNC_GPU_COMMANDS_COMPLETE,0);return N.flush(),await mu(N,ne,4),N.bindBuffer(N.PIXEL_PACK_BUFFER,Mt),N.getBufferSubData(N.PIXEL_PACK_BUFFER,0,et),N.deleteBuffer(Mt),N.deleteSync(ne),et}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(w,I=null,B=0){w.isTexture!==!0&&(as("WebGLRenderer: copyFramebufferToTexture function signature has changed."),I=arguments[0]||null,w=arguments[1]);const H=Math.pow(2,-B),U=Math.floor(w.image.width*H),et=Math.floor(w.image.height*H),ht=I!==null?I.x:0,_t=I!==null?I.y:0;R.setTexture2D(w,0),N.copyTexSubImage2D(N.TEXTURE_2D,B,0,0,ht,_t,U,et),Et.unbindTexture()},this.copyTextureToTexture=function(w,I,B=null,H=null,U=0){w.isTexture!==!0&&(as("WebGLRenderer: copyTextureToTexture function signature has changed."),H=arguments[0]||null,w=arguments[1],I=arguments[2],U=arguments[3]||0,B=null);let et,ht,_t,xt,Pt,It,Mt,qt,ne;const re=w.isCompressedTexture?w.mipmaps[U]:w.image;B!==null?(et=B.max.x-B.min.x,ht=B.max.y-B.min.y,_t=B.isBox3?B.max.z-B.min.z:1,xt=B.min.x,Pt=B.min.y,It=B.isBox3?B.min.z:0):(et=re.width,ht=re.height,_t=re.depth||1,xt=0,Pt=0,It=0),H!==null?(Mt=H.x,qt=H.y,ne=H.z):(Mt=0,qt=0,ne=0);const Le=Ft.convert(I.format),Kt=Ft.convert(I.type);let St;I.isData3DTexture?(R.setTexture3D(I,0),St=N.TEXTURE_3D):I.isDataArrayTexture||I.isCompressedArrayTexture?(R.setTexture2DArray(I,0),St=N.TEXTURE_2D_ARRAY):(R.setTexture2D(I,0),St=N.TEXTURE_2D),N.pixelStorei(N.UNPACK_FLIP_Y_WEBGL,I.flipY),N.pixelStorei(N.UNPACK_PREMULTIPLY_ALPHA_WEBGL,I.premultiplyAlpha),N.pixelStorei(N.UNPACK_ALIGNMENT,I.unpackAlignment);const ui=N.getParameter(N.UNPACK_ROW_LENGTH),jt=N.getParameter(N.UNPACK_IMAGE_HEIGHT),Xe=N.getParameter(N.UNPACK_SKIP_PIXELS),nn=N.getParameter(N.UNPACK_SKIP_ROWS),De=N.getParameter(N.UNPACK_SKIP_IMAGES);N.pixelStorei(N.UNPACK_ROW_LENGTH,re.width),N.pixelStorei(N.UNPACK_IMAGE_HEIGHT,re.height),N.pixelStorei(N.UNPACK_SKIP_PIXELS,xt),N.pixelStorei(N.UNPACK_SKIP_ROWS,Pt),N.pixelStorei(N.UNPACK_SKIP_IMAGES,It);const Wn=w.isDataArrayTexture||w.isData3DTexture,ae=I.isDataArrayTexture||I.isData3DTexture;if(w.isRenderTargetTexture||w.isDepthTexture){const Je=Tt.get(w),$n=Tt.get(I),Oe=Tt.get(Je.__renderTarget),bi=Tt.get($n.__renderTarget);Et.bindFramebuffer(N.READ_FRAMEBUFFER,Oe.__webglFramebuffer),Et.bindFramebuffer(N.DRAW_FRAMEBUFFER,bi.__webglFramebuffer);for(let wi=0;wi<_t;wi++)Wn&&N.framebufferTextureLayer(N.READ_FRAMEBUFFER,N.COLOR_ATTACHMENT0,Tt.get(w).__webglTexture,U,It+wi),w.isDepthTexture?(ae&&N.framebufferTextureLayer(N.DRAW_FRAMEBUFFER,N.COLOR_ATTACHMENT0,Tt.get(I).__webglTexture,U,ne+wi),N.blitFramebuffer(xt,Pt,et,ht,Mt,qt,et,ht,N.DEPTH_BUFFER_BIT,N.NEAREST)):ae?N.copyTexSubImage3D(St,U,Mt,qt,ne+wi,xt,Pt,et,ht):N.copyTexSubImage2D(St,U,Mt,qt,ne+wi,xt,Pt,et,ht);Et.bindFramebuffer(N.READ_FRAMEBUFFER,null),Et.bindFramebuffer(N.DRAW_FRAMEBUFFER,null)}else ae?w.isDataTexture||w.isData3DTexture?N.texSubImage3D(St,U,Mt,qt,ne,et,ht,_t,Le,Kt,re.data):I.isCompressedArrayTexture?N.compressedTexSubImage3D(St,U,Mt,qt,ne,et,ht,_t,Le,re.data):N.texSubImage3D(St,U,Mt,qt,ne,et,ht,_t,Le,Kt,re):w.isDataTexture?N.texSubImage2D(N.TEXTURE_2D,U,Mt,qt,et,ht,Le,Kt,re.data):w.isCompressedTexture?N.compressedTexSubImage2D(N.TEXTURE_2D,U,Mt,qt,re.width,re.height,Le,re.data):N.texSubImage2D(N.TEXTURE_2D,U,Mt,qt,et,ht,Le,Kt,re);N.pixelStorei(N.UNPACK_ROW_LENGTH,ui),N.pixelStorei(N.UNPACK_IMAGE_HEIGHT,jt),N.pixelStorei(N.UNPACK_SKIP_PIXELS,Xe),N.pixelStorei(N.UNPACK_SKIP_ROWS,nn),N.pixelStorei(N.UNPACK_SKIP_IMAGES,De),U===0&&I.generateMipmaps&&N.generateMipmap(St),Et.unbindTexture()},this.copyTextureToTexture3D=function(w,I,B=null,H=null,U=0){return w.isTexture!==!0&&(as("WebGLRenderer: copyTextureToTexture3D function signature has changed."),B=arguments[0]||null,H=arguments[1]||null,w=arguments[2],I=arguments[3],U=arguments[4]||0),as('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(w,I,B,H,U)},this.initRenderTarget=function(w){Tt.get(w).__webglFramebuffer===void 0&&R.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?R.setTextureCube(w,0):w.isData3DTexture?R.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?R.setTexture2DArray(w,0):R.setTexture2D(w,0),Et.unbindTexture()},this.resetState=function(){E=0,A=0,P=null,Et.reset(),ie.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return xi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=Xt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Xt._getUnpackColorSpace()}}class zo{constructor(t,e=1,i=1e3){this.isFog=!0,this.name="",this.color=new bt(t),this.near=e,this.far=i}clone(){return new zo(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class Cr extends de{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new We,this.environmentIntensity=1,this.environmentRotation=new We,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class A0{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=po,this.updateRanges=[],this.version=0,this.uuid=Fi()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,i){t*=this.stride,i*=e.stride;for(let n=0,r=this.stride;n<r;n++)this.array[t+n]=e.array[i+n];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Fi()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(e,this.stride);return i.setUsage(this.usage),i}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Fi()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Ae=new T;class mr{constructor(t,e,i,n=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=i,this.normalized=n}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,i=this.data.count;e<i;e++)Ae.fromBufferAttribute(this,e),Ae.applyMatrix4(t),this.setXYZ(e,Ae.x,Ae.y,Ae.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)Ae.fromBufferAttribute(this,e),Ae.applyNormalMatrix(t),this.setXYZ(e,Ae.x,Ae.y,Ae.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)Ae.fromBufferAttribute(this,e),Ae.transformDirection(t),this.setXYZ(e,Ae.x,Ae.y,Ae.z);return this}getComponent(t,e){let i=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(i=ai(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=Qt(i,this.array)),this.data.array[t*this.data.stride+this.offset+e]=i,this}setX(t,e){return this.normalized&&(e=Qt(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=Qt(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=Qt(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=Qt(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=ai(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=ai(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=ai(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=ai(e,this.array)),e}setXY(t,e,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=Qt(e,this.array),i=Qt(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this}setXYZ(t,e,i,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=Qt(e,this.array),i=Qt(i,this.array),n=Qt(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this.data.array[t+2]=n,this}setXYZW(t,e,i,n,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=Qt(e,this.array),i=Qt(i,this.array),n=Qt(n,this.array),r=Qt(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this.data.array[t+2]=n,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let i=0;i<this.count;i++){const n=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[n+r])}return new Ge(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new mr(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let i=0;i<this.count;i++){const n=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[n+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class or extends ki{static get type(){return"SpriteMaterial"}constructor(t){super(),this.isSpriteMaterial=!0,this.color=new bt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let _n;const jn=new T,xn=new T,Mn=new T,yn=new ot,Zn=new ot,eh=new Yt,Vs=new T,Jn=new T,Gs=new T,jl=new ot,da=new ot,Zl=new ot;class fa extends de{constructor(t=new or){if(super(),this.isSprite=!0,this.type="Sprite",_n===void 0){_n=new xe;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new A0(e,5);_n.setIndex([0,1,2,0,2,3]),_n.setAttribute("position",new mr(i,3,0,!1)),_n.setAttribute("uv",new mr(i,2,3,!1))}this.geometry=_n,this.material=t,this.center=new ot(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),xn.setFromMatrixScale(this.matrixWorld),eh.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),Mn.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&xn.multiplyScalar(-Mn.z);const i=this.material.rotation;let n,r;i!==0&&(r=Math.cos(i),n=Math.sin(i));const a=this.center;Ws(Vs.set(-.5,-.5,0),Mn,a,xn,n,r),Ws(Jn.set(.5,-.5,0),Mn,a,xn,n,r),Ws(Gs.set(.5,.5,0),Mn,a,xn,n,r),jl.set(0,0),da.set(1,0),Zl.set(1,1);let o=t.ray.intersectTriangle(Vs,Jn,Gs,!1,jn);if(o===null&&(Ws(Jn.set(-.5,.5,0),Mn,a,xn,n,r),da.set(0,1),o=t.ray.intersectTriangle(Vs,Gs,Jn,!1,jn),o===null))return;const l=t.ray.origin.distanceTo(jn);l<t.near||l>t.far||e.push({distance:l,point:jn.clone(),uv:He.getInterpolation(jn,Vs,Jn,Gs,jl,da,Zl,new ot),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function Ws(s,t,e,i,n,r){yn.subVectors(s,e).addScalar(.5).multiply(i),n!==void 0?(Zn.x=r*yn.x-n*yn.y,Zn.y=n*yn.x+r*yn.y):Zn.copy(yn),s.copy(t),s.x+=Zn.x,s.y+=Zn.y,s.applyMatrix4(eh)}class R0 extends Ee{constructor(t=null,e=1,i=1,n,r,a,o,l,c=Ne,h=Ne,u,d){super(null,a,o,l,c,h,n,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Jl extends Ge{constructor(t,e,i,n=1){super(t,e,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=n}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Sn=new Yt,Ql=new Yt,$s=[],tc=new en,C0=new Yt,Qn=new st,ts=new Vn;class lr extends st{constructor(t,e,i){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Jl(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let n=0;n<i;n++)this.setMatrixAt(n,C0)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new en),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<e;i++)this.getMatrixAt(i,Sn),tc.copy(t.boundingBox).applyMatrix4(Sn),this.boundingBox.union(tc)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Vn),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<e;i++)this.getMatrixAt(i,Sn),ts.copy(t.boundingSphere).applyMatrix4(Sn),this.boundingSphere.union(ts)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const i=e.morphTargetInfluences,n=this.morphTexture.source.data.data,r=i.length+1,a=t*r+1;for(let o=0;o<i.length;o++)i[o]=n[a+o]}raycast(t,e){const i=this.matrixWorld,n=this.count;if(Qn.geometry=this.geometry,Qn.material=this.material,Qn.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ts.copy(this.boundingSphere),ts.applyMatrix4(i),t.ray.intersectsSphere(ts)!==!1))for(let r=0;r<n;r++){this.getMatrixAt(r,Sn),Ql.multiplyMatrices(i,Sn),Qn.matrixWorld=Ql,Qn.raycast(t,$s);for(let a=0,o=$s.length;a<o;a++){const l=$s[a];l.instanceId=r,l.object=this,e.push(l)}$s.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new Jl(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const i=e.morphTargetInfluences,n=i.length+1;this.morphTexture===null&&(this.morphTexture=new R0(new Float32Array(n*this.count),n,this.count,Lo,li));const r=this.morphTexture.source.data.data;let a=0;for(let c=0;c<i.length;c++)a+=i[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=n*t;r[l]=o,r.set(i,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class ih extends ki{static get type(){return"LineBasicMaterial"}constructor(t){super(),this.isLineBasicMaterial=!0,this.color=new bt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const gr=new T,vr=new T,ec=new Yt,es=new kc,Xs=new Vn,pa=new T,ic=new T;class P0 extends de{constructor(t=new xe,e=new ih){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,i=[0];for(let n=1,r=e.count;n<r;n++)gr.fromBufferAttribute(e,n-1),vr.fromBufferAttribute(e,n),i[n]=i[n-1],i[n]+=gr.distanceTo(vr);t.setAttribute("lineDistance",new ee(i,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const i=this.geometry,n=this.matrixWorld,r=t.params.Line.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Xs.copy(i.boundingSphere),Xs.applyMatrix4(n),Xs.radius+=r,t.ray.intersectsSphere(Xs)===!1)return;ec.copy(n).invert(),es.copy(t.ray).applyMatrix4(ec);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=i.index,d=i.attributes.position;if(h!==null){const f=Math.max(0,a.start),m=Math.min(h.count,a.start+a.count);for(let v=f,g=m-1;v<g;v+=c){const p=h.getX(v),M=h.getX(v+1),x=qs(this,t,es,l,p,M);x&&e.push(x)}if(this.isLineLoop){const v=h.getX(m-1),g=h.getX(f),p=qs(this,t,es,l,v,g);p&&e.push(p)}}else{const f=Math.max(0,a.start),m=Math.min(d.count,a.start+a.count);for(let v=f,g=m-1;v<g;v+=c){const p=qs(this,t,es,l,v,v+1);p&&e.push(p)}if(this.isLineLoop){const v=qs(this,t,es,l,m-1,f);v&&e.push(v)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){const n=e[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){const o=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function qs(s,t,e,i,n,r){const a=s.geometry.attributes.position;if(gr.fromBufferAttribute(a,n),vr.fromBufferAttribute(a,r),e.distanceSqToSegment(gr,vr,pa,ic)>i)return;pa.applyMatrix4(s.matrixWorld);const l=t.ray.origin.distanceTo(pa);if(!(l<t.near||l>t.far))return{distance:l,point:ic.clone().applyMatrix4(s.matrixWorld),index:n,face:null,faceIndex:null,barycoord:null,object:s}}class L0 extends Ee{constructor(t,e,i,n,r,a,o,l,c){super(t,e,i,n,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class ci{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const i=this.getUtoTmapping(t);return this.getPoint(i,e)}getPoints(t=5){const e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return e}getSpacedPoints(t=5){const e=[];for(let i=0;i<=t;i++)e.push(this.getPointAt(i/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let i,n=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)i=this.getPoint(a/t),r+=i.distanceTo(n),e.push(r),n=i;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const i=this.getLengths();let n=0;const r=i.length;let a;e?a=e:a=t*i[r-1];let o=0,l=r-1,c;for(;o<=l;)if(n=Math.floor(o+(l-o)/2),c=i[n]-a,c<0)o=n+1;else if(c>0)l=n-1;else{l=n;break}if(n=l,i[n]===a)return n/(r-1);const h=i[n],d=i[n+1]-h,f=(a-h)/d;return(n+f)/(r-1)}getTangent(t,e){let n=t-1e-4,r=t+1e-4;n<0&&(n=0),r>1&&(r=1);const a=this.getPoint(n),o=this.getPoint(r),l=e||(a.isVector2?new ot:new T);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){const i=this.getUtoTmapping(t);return this.getTangent(i,e)}computeFrenetFrames(t,e){const i=new T,n=[],r=[],a=[],o=new T,l=new Yt;for(let f=0;f<=t;f++){const m=f/t;n[f]=this.getTangentAt(m,new T)}r[0]=new T,a[0]=new T;let c=Number.MAX_VALUE;const h=Math.abs(n[0].x),u=Math.abs(n[0].y),d=Math.abs(n[0].z);h<=c&&(c=h,i.set(1,0,0)),u<=c&&(c=u,i.set(0,1,0)),d<=c&&i.set(0,0,1),o.crossVectors(n[0],i).normalize(),r[0].crossVectors(n[0],o),a[0].crossVectors(n[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(n[f-1],n[f]),o.length()>Number.EPSILON){o.normalize();const m=Math.acos(_e(n[f-1].dot(n[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(o,m))}a[f].crossVectors(n[f],r[f])}if(e===!0){let f=Math.acos(_e(r[0].dot(r[t]),-1,1));f/=t,n[0].dot(o.crossVectors(r[0],r[t]))>0&&(f=-f);for(let m=1;m<=t;m++)r[m].applyMatrix4(l.makeRotationAxis(n[m],f*m)),a[m].crossVectors(n[m],r[m])}return{tangents:n,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class ko extends ci{constructor(t=0,e=0,i=1,n=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=i,this.yRadius=n,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e=new ot){const i=e,n=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=n;for(;r>n;)r-=n;r<Number.EPSILON&&(a?r=0:r=n),this.aClockwise===!0&&!a&&(r===n?r=-n:r=r-n);const o=this.aStartAngle+t*r;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*h-f*u+this.aX,c=d*u+f*h+this.aY}return i.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class D0 extends ko{constructor(t,e,i,n,r,a){super(t,e,i,i,n,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function Bo(){let s=0,t=0,e=0,i=0;function n(r,a,o,l){s=r,t=o,e=-3*r+3*a-2*o-l,i=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){n(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,u){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,f=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,f*=h,n(a,o,d,f)},calc:function(r){const a=r*r,o=a*r;return s+t*r+e*a+i*o}}}const Ys=new T,ma=new Bo,ga=new Bo,va=new Bo;class I0 extends ci{constructor(t=[],e=!1,i="centripetal",n=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=i,this.tension=n}getPoint(t,e=new T){const i=e,n=this.points,r=n.length,a=(r-(this.closed?0:1))*t;let o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=n[(o-1)%r]:(Ys.subVectors(n[0],n[1]).add(n[0]),c=Ys);const u=n[o%r],d=n[(o+1)%r];if(this.closed||o+2<r?h=n[(o+2)%r]:(Ys.subVectors(n[r-1],n[r-2]).add(n[r-1]),h=Ys),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let m=Math.pow(c.distanceToSquared(u),f),v=Math.pow(u.distanceToSquared(d),f),g=Math.pow(d.distanceToSquared(h),f);v<1e-4&&(v=1),m<1e-4&&(m=v),g<1e-4&&(g=v),ma.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,m,v,g),ga.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,m,v,g),va.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,m,v,g)}else this.curveType==="catmullrom"&&(ma.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),ga.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),va.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return i.set(ma.calc(l),ga.calc(l),va.calc(l)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const n=t.points[e];this.points.push(n.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){const n=this.points[e];t.points.push(n.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const n=t.points[e];this.points.push(new T().fromArray(n))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function nc(s,t,e,i,n){const r=(i-t)*.5,a=(n-e)*.5,o=s*s,l=s*o;return(2*e-2*i+r+a)*l+(-3*e+3*i-2*r-a)*o+r*s+e}function U0(s,t){const e=1-s;return e*e*t}function N0(s,t){return 2*(1-s)*s*t}function F0(s,t){return s*s*t}function cs(s,t,e,i){return U0(s,t)+N0(s,e)+F0(s,i)}function O0(s,t){const e=1-s;return e*e*e*t}function z0(s,t){const e=1-s;return 3*e*e*s*t}function k0(s,t){return 3*(1-s)*s*s*t}function B0(s,t){return s*s*s*t}function hs(s,t,e,i,n){return O0(s,t)+z0(s,e)+k0(s,i)+B0(s,n)}class nh extends ci{constructor(t=new ot,e=new ot,i=new ot,n=new ot){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=i,this.v3=n}getPoint(t,e=new ot){const i=e,n=this.v0,r=this.v1,a=this.v2,o=this.v3;return i.set(hs(t,n.x,r.x,a.x,o.x),hs(t,n.y,r.y,a.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class H0 extends ci{constructor(t=new T,e=new T,i=new T,n=new T){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=i,this.v3=n}getPoint(t,e=new T){const i=e,n=this.v0,r=this.v1,a=this.v2,o=this.v3;return i.set(hs(t,n.x,r.x,a.x,o.x),hs(t,n.y,r.y,a.y,o.y),hs(t,n.z,r.z,a.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class sh extends ci{constructor(t=new ot,e=new ot){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new ot){const i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new ot){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class V0 extends ci{constructor(t=new T,e=new T){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new T){const i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new T){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class rh extends ci{constructor(t=new ot,e=new ot,i=new ot){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new ot){const i=e,n=this.v0,r=this.v1,a=this.v2;return i.set(cs(t,n.x,r.x,a.x),cs(t,n.y,r.y,a.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class G0 extends ci{constructor(t=new T,e=new T,i=new T){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new T){const i=e,n=this.v0,r=this.v1,a=this.v2;return i.set(cs(t,n.x,r.x,a.x),cs(t,n.y,r.y,a.y),cs(t,n.z,r.z,a.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class ah extends ci{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new ot){const i=e,n=this.points,r=(n.length-1)*t,a=Math.floor(r),o=r-a,l=n[a===0?a:a-1],c=n[a],h=n[a>n.length-2?n.length-1:a+1],u=n[a>n.length-3?n.length-1:a+2];return i.set(nc(o,l.x,c.x,h.x,u.x),nc(o,l.y,c.y,h.y,u.y)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const n=t.points[e];this.points.push(n.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){const n=this.points[e];t.points.push(n.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const n=t.points[e];this.points.push(new ot().fromArray(n))}return this}}var sc=Object.freeze({__proto__:null,ArcCurve:D0,CatmullRomCurve3:I0,CubicBezierCurve:nh,CubicBezierCurve3:H0,EllipseCurve:ko,LineCurve:sh,LineCurve3:V0,QuadraticBezierCurve:rh,QuadraticBezierCurve3:G0,SplineCurve:ah});class W0 extends ci{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const i=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new sc[i](e,t))}return this}getPoint(t,e){const i=t*this.getLength(),n=this.getCurveLengths();let r=0;for(;r<n.length;){if(n[r]>=i){const a=n[r]-i,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let i=0,n=this.curves.length;i<n;i++)e+=this.curves[i].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let i;for(let n=0,r=this.curves;n<r.length;n++){const a=r[n],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];i&&i.equals(h)||(e.push(h),i=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){const n=t.curves[e];this.curves.push(n.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,i=this.curves.length;e<i;e++){const n=this.curves[e];t.curves.push(n.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){const n=t.curves[e];this.curves.push(new sc[n.type]().fromJSON(n))}return this}}class $0 extends W0{constructor(t){super(),this.type="Path",this.currentPoint=new ot,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,i=t.length;e<i;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const i=new sh(this.currentPoint.clone(),new ot(t,e));return this.curves.push(i),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,i,n){const r=new rh(this.currentPoint.clone(),new ot(t,e),new ot(i,n));return this.curves.push(r),this.currentPoint.set(i,n),this}bezierCurveTo(t,e,i,n,r,a){const o=new nh(this.currentPoint.clone(),new ot(t,e),new ot(i,n),new ot(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),i=new ah(e);return this.curves.push(i),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,i,n,r,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,i,n,r,a),this}absarc(t,e,i,n,r,a){return this.absellipse(t,e,i,i,n,r,a),this}ellipse(t,e,i,n,r,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,i,n,r,a,o,l),this}absellipse(t,e,i,n,r,a,o,l){const c=new ko(t,e,i,n,r,a,o,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class Ho extends xe{constructor(t=[new ot(0,-.5),new ot(.5,0),new ot(0,.5)],e=12,i=0,n=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:i,phiLength:n},e=Math.floor(e),n=_e(n,0,Math.PI*2);const r=[],a=[],o=[],l=[],c=[],h=1/e,u=new T,d=new ot,f=new T,m=new T,v=new T;let g=0,p=0;for(let M=0;M<=t.length-1;M++)switch(M){case 0:g=t[M+1].x-t[M].x,p=t[M+1].y-t[M].y,f.x=p*1,f.y=-g,f.z=p*0,v.copy(f),f.normalize(),l.push(f.x,f.y,f.z);break;case t.length-1:l.push(v.x,v.y,v.z);break;default:g=t[M+1].x-t[M].x,p=t[M+1].y-t[M].y,f.x=p*1,f.y=-g,f.z=p*0,m.copy(f),f.x+=v.x,f.y+=v.y,f.z+=v.z,f.normalize(),l.push(f.x,f.y,f.z),v.copy(m)}for(let M=0;M<=e;M++){const x=i+M*h*n,_=Math.sin(x),C=Math.cos(x);for(let E=0;E<=t.length-1;E++){u.x=t[E].x*_,u.y=t[E].y,u.z=t[E].x*C,a.push(u.x,u.y,u.z),d.x=M/e,d.y=E/(t.length-1),o.push(d.x,d.y);const A=l[3*E+0]*_,P=l[3*E+1],b=l[3*E+0]*C;c.push(A,P,b)}}for(let M=0;M<e;M++)for(let x=0;x<t.length-1;x++){const _=x+M*t.length,C=_,E=_+t.length,A=_+t.length+1,P=_+1;r.push(C,E,P),r.push(A,P,E)}this.setIndex(r),this.setAttribute("position",new ee(a,3)),this.setAttribute("uv",new ee(o,2)),this.setAttribute("normal",new ee(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ho(t.points,t.segments,t.phiStart,t.phiLength)}}class _r extends Ho{constructor(t=1,e=1,i=4,n=8){const r=new $0;r.absarc(0,-e/2,t,Math.PI*1.5,0),r.absarc(0,e/2,t,0,Math.PI*.5),super(r.getPoints(i),n),this.type="CapsuleGeometry",this.parameters={radius:t,length:e,capSegments:i,radialSegments:n}}static fromJSON(t){return new _r(t.radius,t.length,t.capSegments,t.radialSegments)}}class Pr extends xe{constructor(t=1,e=32,i=0,n=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:i,thetaLength:n},e=Math.max(3,e);const r=[],a=[],o=[],l=[],c=new T,h=new ot;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=e;u++,d+=3){const f=i+u/e*n;c.x=t*Math.cos(f),c.y=t*Math.sin(f),a.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(a[d]/t+1)/2,h.y=(a[d+1]/t+1)/2,l.push(h.x,h.y)}for(let u=1;u<=e;u++)r.push(u,u+1,0);this.setIndex(r),this.setAttribute("position",new ee(a,3)),this.setAttribute("normal",new ee(o,3)),this.setAttribute("uv",new ee(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Pr(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class ve extends xe{constructor(t=1,e=1,i=1,n=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:i,radialSegments:n,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;n=Math.floor(n),r=Math.floor(r);const h=[],u=[],d=[],f=[];let m=0;const v=[],g=i/2;let p=0;M(),a===!1&&(t>0&&x(!0),e>0&&x(!1)),this.setIndex(h),this.setAttribute("position",new ee(u,3)),this.setAttribute("normal",new ee(d,3)),this.setAttribute("uv",new ee(f,2));function M(){const _=new T,C=new T;let E=0;const A=(e-t)/i;for(let P=0;P<=r;P++){const b=[],y=P/r,L=y*(e-t)+t;for(let k=0;k<=n;k++){const z=k/n,X=z*l+o,Y=Math.sin(X),W=Math.cos(X);C.x=L*Y,C.y=-y*i+g,C.z=L*W,u.push(C.x,C.y,C.z),_.set(Y,A,W).normalize(),d.push(_.x,_.y,_.z),f.push(z,1-y),b.push(m++)}v.push(b)}for(let P=0;P<n;P++)for(let b=0;b<r;b++){const y=v[b][P],L=v[b+1][P],k=v[b+1][P+1],z=v[b][P+1];(t>0||b!==0)&&(h.push(y,L,z),E+=3),(e>0||b!==r-1)&&(h.push(L,k,z),E+=3)}c.addGroup(p,E,0),p+=E}function x(_){const C=m,E=new ot,A=new T;let P=0;const b=_===!0?t:e,y=_===!0?1:-1;for(let k=1;k<=n;k++)u.push(0,g*y,0),d.push(0,y,0),f.push(.5,.5),m++;const L=m;for(let k=0;k<=n;k++){const X=k/n*l+o,Y=Math.cos(X),W=Math.sin(X);A.x=b*W,A.y=g*y,A.z=b*Y,u.push(A.x,A.y,A.z),d.push(0,y,0),E.x=Y*.5+.5,E.y=W*.5*y+.5,f.push(E.x,E.y),m++}for(let k=0;k<n;k++){const z=C+k,X=L+k;_===!0?h.push(X,X+1,z):h.push(X+1,X,z),P+=3}c.addGroup(p,P,_===!0?1:2),p+=P}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ve(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class An extends ve{constructor(t=1,e=1,i=32,n=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,i,n,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:i,heightSegments:n,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new An(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class vs extends xe{constructor(t=[],e=[],i=1,n=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:i,detail:n};const r=[],a=[];o(n),c(i),h(),this.setAttribute("position",new ee(r,3)),this.setAttribute("normal",new ee(r.slice(),3)),this.setAttribute("uv",new ee(a,2)),n===0?this.computeVertexNormals():this.normalizeNormals();function o(M){const x=new T,_=new T,C=new T;for(let E=0;E<e.length;E+=3)f(e[E+0],x),f(e[E+1],_),f(e[E+2],C),l(x,_,C,M)}function l(M,x,_,C){const E=C+1,A=[];for(let P=0;P<=E;P++){A[P]=[];const b=M.clone().lerp(_,P/E),y=x.clone().lerp(_,P/E),L=E-P;for(let k=0;k<=L;k++)k===0&&P===E?A[P][k]=b:A[P][k]=b.clone().lerp(y,k/L)}for(let P=0;P<E;P++)for(let b=0;b<2*(E-P)-1;b++){const y=Math.floor(b/2);b%2===0?(d(A[P][y+1]),d(A[P+1][y]),d(A[P][y])):(d(A[P][y+1]),d(A[P+1][y+1]),d(A[P+1][y]))}}function c(M){const x=new T;for(let _=0;_<r.length;_+=3)x.x=r[_+0],x.y=r[_+1],x.z=r[_+2],x.normalize().multiplyScalar(M),r[_+0]=x.x,r[_+1]=x.y,r[_+2]=x.z}function h(){const M=new T;for(let x=0;x<r.length;x+=3){M.x=r[x+0],M.y=r[x+1],M.z=r[x+2];const _=g(M)/2/Math.PI+.5,C=p(M)/Math.PI+.5;a.push(_,1-C)}m(),u()}function u(){for(let M=0;M<a.length;M+=6){const x=a[M+0],_=a[M+2],C=a[M+4],E=Math.max(x,_,C),A=Math.min(x,_,C);E>.9&&A<.1&&(x<.2&&(a[M+0]+=1),_<.2&&(a[M+2]+=1),C<.2&&(a[M+4]+=1))}}function d(M){r.push(M.x,M.y,M.z)}function f(M,x){const _=M*3;x.x=t[_+0],x.y=t[_+1],x.z=t[_+2]}function m(){const M=new T,x=new T,_=new T,C=new T,E=new ot,A=new ot,P=new ot;for(let b=0,y=0;b<r.length;b+=9,y+=6){M.set(r[b+0],r[b+1],r[b+2]),x.set(r[b+3],r[b+4],r[b+5]),_.set(r[b+6],r[b+7],r[b+8]),E.set(a[y+0],a[y+1]),A.set(a[y+2],a[y+3]),P.set(a[y+4],a[y+5]),C.copy(M).add(x).add(_).divideScalar(3);const L=g(C);v(E,y+0,M,L),v(A,y+2,x,L),v(P,y+4,_,L)}}function v(M,x,_,C){C<0&&M.x===1&&(a[x]=M.x-1),_.x===0&&_.z===0&&(a[x]=C/2/Math.PI+.5)}function g(M){return Math.atan2(M.z,-M.x)}function p(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new vs(t.vertices,t.indices,t.radius,t.details)}}class xr extends vs{constructor(t=1,e=0){const i=(1+Math.sqrt(5))/2,n=1/i,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-n,-i,0,-n,i,0,n,-i,0,n,i,-n,-i,0,-n,i,0,n,-i,0,n,i,0,-i,0,-n,i,0,-n,-i,0,n,i,0,n],a=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,a,t,e),this.type="DodecahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new xr(t.radius,t.detail)}}class _s extends vs{constructor(t=1,e=0){const i=(1+Math.sqrt(5))/2,n=[-1,i,0,1,i,0,-1,-i,0,1,-i,0,0,-1,i,0,1,i,0,-1,-i,0,1,-i,i,0,-1,i,0,1,-i,0,-1,-i,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(n,r,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new _s(t.radius,t.detail)}}class yi extends xe{constructor(t=1,e=32,i=16,n=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:i,phiStart:n,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),i=Math.max(2,Math.floor(i));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new T,d=new T,f=[],m=[],v=[],g=[];for(let p=0;p<=i;p++){const M=[],x=p/i;let _=0;p===0&&a===0?_=.5/e:p===i&&l===Math.PI&&(_=-.5/e);for(let C=0;C<=e;C++){const E=C/e;u.x=-t*Math.cos(n+E*r)*Math.sin(a+x*o),u.y=t*Math.cos(a+x*o),u.z=t*Math.sin(n+E*r)*Math.sin(a+x*o),m.push(u.x,u.y,u.z),d.copy(u).normalize(),v.push(d.x,d.y,d.z),g.push(E+_,1-x),M.push(c++)}h.push(M)}for(let p=0;p<i;p++)for(let M=0;M<e;M++){const x=h[p][M+1],_=h[p][M],C=h[p+1][M],E=h[p+1][M+1];(p!==0||a>0)&&f.push(x,_,E),(p!==i-1||l<Math.PI)&&f.push(_,C,E)}this.setIndex(f),this.setAttribute("position",new ee(m,3)),this.setAttribute("normal",new ee(v,3)),this.setAttribute("uv",new ee(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new yi(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class Vo extends vs{constructor(t=1,e=0){const i=[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],n=[2,1,0,0,3,2,1,3,0,2,3,1];super(i,n,t,e),this.type="TetrahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new Vo(t.radius,t.detail)}}class Mr extends ki{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new bt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new bt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=No,this.normalScale=new ot(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new We,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class we extends ki{static get type(){return"MeshLambertMaterial"}constructor(t){super(),this.isMeshLambertMaterial=!0,this.color=new bt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new bt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=No,this.normalScale=new ot(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new We,this.combine=Eo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Go extends de{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new bt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class Wo extends Go{constructor(t,e,i){super(t,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(de.DEFAULT_UP),this.updateMatrix(),this.groundColor=new bt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const _a=new Yt,rc=new T,ac=new T;class oh{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ot(512,512),this.map=null,this.mapPass=null,this.matrix=new Yt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Fo,this._frameExtents=new ot(1,1),this._viewportCount=1,this._viewports=[new te(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,i=this.matrix;rc.setFromMatrixPosition(t.matrixWorld),e.position.copy(rc),ac.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(ac),e.updateMatrixWorld(),_a.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(_a),i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(_a)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}const oc=new Yt,is=new T,xa=new T;class X0 extends oh{constructor(){super(new Pe(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new ot(4,2),this._viewportCount=6,this._viewports=[new te(2,1,1,1),new te(0,1,1,1),new te(3,1,1,1),new te(1,1,1,1),new te(3,0,1,1),new te(1,0,1,1)],this._cubeDirections=[new T(1,0,0),new T(-1,0,0),new T(0,0,1),new T(0,0,-1),new T(0,1,0),new T(0,-1,0)],this._cubeUps=[new T(0,1,0),new T(0,1,0),new T(0,1,0),new T(0,1,0),new T(0,0,1),new T(0,0,-1)]}updateMatrices(t,e=0){const i=this.camera,n=this.matrix,r=t.distance||i.far;r!==i.far&&(i.far=r,i.updateProjectionMatrix()),is.setFromMatrixPosition(t.matrixWorld),i.position.copy(is),xa.copy(i.position),xa.add(this._cubeDirections[e]),i.up.copy(this._cubeUps[e]),i.lookAt(xa),i.updateMatrixWorld(),n.makeTranslation(-is.x,-is.y,-is.z),oc.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(oc)}}class lh extends Go{constructor(t,e,i=0,n=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=n,this.shadow=new X0}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}}class q0 extends oh{constructor(){super(new Yc(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class yr extends Go{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(de.DEFAULT_UP),this.updateMatrix(),this.target=new de,this.shadow=new q0}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:To}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=To);const vt={sim:{fixedStep:1/120,maxFrameTime:.1,bulletSubStep:.001,bulletMaxLife:6,gravity:9.80665},camera:{baseFov:55,scopeBaseFov:28,yawLimit:70*Math.PI/180,pitchMin:-20*Math.PI/180,pitchMax:15*Math.PI/180,eyeHeight:.45,scopeTransition:.18},input:{mouseSensitivity:.0012,touchSensitivity:.0028,scopedSensitivityScale:1,fireBufferTime:.15,restartHoldTime:.5,zoomStep:1.15},shooter:{swayAmplitude:.35,swayFreqX:.31,swayFreqY:.47,breathPeriod:4.2,breathAmplitude:.45,holdSwayMul:.2,exhaustedSwayMul:2.6,breathRecoverRate:.25,breathMinToHold:.3,heartRateRest:68,heartRateExhausted:118,heartRatePerShot:4,heartRateRecoverPerSec:3,heartKick:.06,triggerJerkPerRadPerSec:2,triggerJerkMax:.6},ballisticsAssist:{predictInterval:.1},targets:{walkSpeed:1.4,runSpeed:3.6,reactionMin:.5,reactionMax:.9,subsonicImpactHearRadius:20,witnessRadius:25,witnessDelay:1,legHitSpeedMul:.5,headHitboxScale:1.05,speedOfSound:343,hearRadius:{std:1/0,stdSuppressed:400,sub:250,subSuppressed:0},suppressedReactionMul:1.8,bodyDiscoveryRadius:14,bodyDiscoveryDelay:.8,tagObserveTime:.7,tagObserveMil:2.5},feedback:{hitStop:.06,headshotHitStop:.12,hitMarkerTime:2.5,bulletCamDuration:2.4,bulletCamFinalSlow:.08,bulletCamFinalWindow:.12},scoring:{killBase:100,perMeter:.1,headshotBonus:50,missPenalty:20,timeBonusPerSec:2,timeBonusWindow:90},unlocks:{k65:6,l338:14,expert:8}},Rn={recruit:{id:"recruit",name:"훈련병",description:"예상 탄착점과 정확한 풍속을 보여줍니다. 처음이라면 여기서 시작하세요.",rangefinder:!0,windMeter:"path",predictedImpact:!0,swayMul:.6,breathHold:8,escapeSpeedMul:.75,escapeDistanceMul:1.4},marksman:{id:"marksman",name:"저격수",description:"거리측정기와 사수 위치의 풍속만 제공됩니다. 바람은 깃발로 읽어야 합니다.",rangefinder:!0,windMeter:"local",predictedImpact:!1,swayMul:1,breathHold:6,escapeSpeedMul:1,escapeDistanceMul:1},expert:{id:"expert",name:"현실",description:"보조 장비 없음. 레티클로 거리를 재고 깃발로 바람을 읽으세요.",rangefinder:!1,windMeter:"none",predictedImpact:!1,swayMul:1.2,breathHold:5,escapeSpeedMul:1.1,escapeDistanceMul:.9,unlockKey:"expert"}},Sr=[{id:"r308",name:"R-308",caliber:".308 Win",description:"균형 잡힌 기본 저격총. 아음속탄을 쓸 수 있는 유일한 총.",ammo:[{id:"std",name:"표준탄 175gr",muzzleVelocity:792,bcG7:.243,mass:.01134,subsonic:!1,dispersionMoa:.6},{id:"sub",name:"아음속탄 200gr",muzzleVelocity:320,bcG7:.29,mass:.01296,subsonic:!0,dispersionMoa:.9}],magazine:5,boltTime:1,reloadTime:2.4,recoilKick:14,recoilRecover:.55,zoomMin:3,zoomMax:18,sightHeight:.045,zeroRange:100,stability:1.8,loudness:1,swayMul:1,color:4872764},{id:"k65",name:"K-6.5",caliber:"6.5 Creedmoor",description:"반동이 작아 자기 탄착을 직접 확인할 수 있다. 볼트가 가장 빠르다.",ammo:[{id:"std",name:"표준탄 140gr",muzzleVelocity:826,bcG7:.3,mass:.00907,subsonic:!1,dispersionMoa:.5}],magazine:7,boltTime:.75,reloadTime:2,recoilKick:6,recoilRecover:.3,zoomMin:4,zoomMax:20,sightHeight:.045,zeroRange:100,stability:1.7,loudness:.85,swayMul:1.05,color:3951194,unlockKey:"k65"},{id:"l338",name:"L-338",caliber:".338 Lapua Mag",description:"1000m 이상 장거리 전용. 반동과 총성이 크고 볼트가 느리다.",ammo:[{id:"std",name:"표준탄 300gr",muzzleVelocity:838,bcG7:.381,mass:.01944,subsonic:!1,dispersionMoa:.5}],magazine:5,boltTime:1.35,reloadTime:2.8,recoilKick:26,recoilRecover:.85,zoomMin:5,zoomMax:25,sightHeight:.05,zeroRange:100,stability:2,loudness:1.4,swayMul:.85,color:5917244,unlockKey:"l338"}],ch={velocityMul:.985,recoilMul:.8};function br(s){return Sr.find(t=>t.id===s)??Sr[0]}function vo(s,t){const e=101325*Math.pow(1-225577e-10*s,5.25588),i=t+273.15;return e/(287.05*i)}function _o(s){return 331.3*Math.sqrt(1+s/273.15)}const Li=[[0,.1198],[.05,.1197],[.1,.1196],[.15,.1194],[.2,.1193],[.25,.1194],[.3,.1194],[.35,.1194],[.4,.1193],[.45,.1193],[.5,.1194],[.55,.1193],[.6,.1194],[.65,.1197],[.7,.1202],[.725,.1207],[.75,.1215],[.775,.1226],[.8,.1242],[.825,.1266],[.85,.1306],[.875,.1368],[.9,.1464],[.925,.166],[.95,.2054],[.975,.2993],[1,.3803],[1.025,.4015],[1.05,.4043],[1.075,.4034],[1.1,.4014],[1.125,.3987],[1.15,.3955],[1.2,.3884],[1.25,.381],[1.3,.3732],[1.35,.3657],[1.4,.358],[1.5,.344],[1.55,.3376],[1.6,.3315],[1.65,.326],[1.7,.3209],[1.75,.316],[1.8,.3117],[1.85,.3078],[1.9,.3042],[1.95,.301],[2,.298],[2.05,.2951],[2.1,.2922],[2.15,.2892],[2.2,.2864],[2.25,.2835],[2.3,.2807],[2.35,.2779],[2.4,.2752],[2.45,.2725],[2.5,.2697],[2.6,.2643],[2.7,.2588],[2.8,.2533],[2.9,.2479],[3,.2424],[3.5,.2172],[4,.1964]];function Y0(s){if(s<=Li[0][0])return Li[0][1];const t=Li[Li.length-1];if(s>=t[0])return t[1];let e=0,i=Li.length-1;for(;i-e>1;){const l=e+i>>1;Li[l][0]<=s?e=l:i=l}const[n,r]=Li[e],[a,o]=Li[i];return r+(o-r)*(s-n)/(a-n)}const K0=703.0696,wr=(s,t,e,i,n)=>(n.x=0,n.y=0,n.z=0,n);function Tr(s,t,e){const i=Math.hypot(e.x,e.y,e.z)||1,n=s.muzzleVelocity/i,r=-e.z,a=e.x,o=Math.hypot(r,a)||1;return{pos:{...t},vel:{x:e.x*n,y:e.y*n,z:e.z*n},t:0,right:{x:r/o,y:0,z:a/o},spinDrift:0,stability:s.stability,dragK:Math.PI/(8*s.bcG7*K0)}}const Ks={x:0,y:0,z:0};function js(s,t,e,i,n,r,a,o,l,c){t.windAt(e,i,n,l,Ks);const h=r-Ks.x,u=a-Ks.y,d=o-Ks.z,f=Math.hypot(h,u,d),m=Y0(f/t.soundSpeed),v=t.density*m*s.dragK*f;c.x=-v*h,c.y=-v*u-t.gravity,c.z=-v*d}const Qe={x:0,y:0,z:0},ti={x:0,y:0,z:0},ei={x:0,y:0,z:0},Zs={x:0,y:0,z:0};function hh(s,t){return s<=0?0:.0254*1.25*(s+1.2)*Math.pow(t,1.83)}function us(s,t,e){const{pos:i,vel:n,t:r}=s;js(s,t,i.x,i.y,i.z,n.x,n.y,n.z,r,Qe);const a=e/2;js(s,t,i.x+n.x*a,i.y+n.y*a,i.z+n.z*a,n.x+Qe.x*a,n.y+Qe.y*a,n.z+Qe.z*a,r+a,ti);const o=n.x+Qe.x*a,l=n.y+Qe.y*a,c=n.z+Qe.z*a;js(s,t,i.x+o*a,i.y+l*a,i.z+c*a,n.x+ti.x*a,n.y+ti.y*a,n.z+ti.z*a,r+a,ei);const h=n.x+ti.x*a,u=n.y+ti.y*a,d=n.z+ti.z*a;js(s,t,i.x+h*e,i.y+u*e,i.z+d*e,n.x+ei.x*e,n.y+ei.y*e,n.z+ei.z*e,r+e,Zs);const f=n.x+ei.x*e,m=n.y+ei.y*e,v=n.z+ei.z*e;i.x+=e/6*(n.x+2*o+2*h+f),i.y+=e/6*(n.y+2*l+2*u+m),i.z+=e/6*(n.z+2*c+2*d+v),n.x+=e/6*(Qe.x+2*ti.x+2*ei.x+Zs.x),n.y+=e/6*(Qe.y+2*ti.y+2*ei.y+Zs.y),n.z+=e/6*(Qe.z+2*ti.z+2*ei.z+Zs.z),s.t=r+e;const g=hh(s.stability,s.t),p=g-s.spinDrift;s.spinDrift=g,i.x+=s.right.x*p,i.z+=s.right.z*p}function ds(s){return Math.hypot(s.vel.x,s.vel.y,s.vel.z)}function ms(s,t,e,i,n,r,a=5e-4){const o={x:Math.sin(n)*Math.cos(i),y:Math.sin(i),z:-Math.cos(n)*Math.cos(i)},l=Tr(s,{x:0,y:-e,z:0},o),c=[],h=[...r].sort((p,M)=>p-M);let u=0,d=l.pos.x,f=l.pos.y,m=l.pos.z,v=0,g=ds(l);for(;u<h.length&&l.t<10;){us(l,t,a);const p=-l.pos.z;for(;u<h.length&&p>=h[u];){const M=h[u],x=-m,_=p===x?1:(M-x)/(p-x),C=ds(l);c.push({range:M,drop:f+(l.pos.y-f)*_,lateral:d+(l.pos.x-d)*_,time:v+(l.t-v)*_,velocity:g+(C-g)*_}),u++}d=l.pos.x,f=l.pos.y,m=l.pos.z,v=l.t,g=ds(l)}return c}function j0(s,t,e,i){const n={...s,stability:0},r={...t,windAt:wr};let a=-.01,o=.05;for(let l=0;l<40;l++){const c=(a+o)/2,[h]=ms(n,r,e,c,0,[i],.001);!h||h.drop<0?a=c:o=c}return(a+o)/2}function Z0(s,t,e,i,n,r){const a={...e,windAt:wr},o={...s,stability:0},l=ms(o,a,i,n,0,r),c={...e,windAt:(u,d,f,m,v)=>(v.x=1,v.y=0,v.z=0,v)},h=ms(o,c,i,n,0,r);return l.map((u,d)=>{const f=h[d],m=hh(s.stability,u.time);return{range:u.range,elevationMil:-u.drop/u.range*1e3,windPerMpsMil:f?f.lateral/u.range*1e3:0,spinMil:m/u.range*1e3,time:u.time,velocity:u.velocity,energy:.5*t*u.velocity*u.velocity}})}const Js=40;class lc{spec;gusts=[];phase;constructor(t,e){this.spec=t;const i=ur(e);this.phase=[i()*100,i()*100,i()*100];const n=t.gusts;if(n){let r=6+i()*(n.intervalMax-n.intervalMin);for(;r<1800;)this.gusts.push({start:r,rise:n.rise,hold:n.hold,fall:n.fall,strength:n.strength*(.75+i()*.5)}),r+=n.rise+n.hold+n.fall+n.intervalMin+i()*(n.intervalMax-n.intervalMin)}}gustAt(t){for(const e of this.gusts){if(t<e.start)break;const i=t-e.start,n=e.rise+e.hold+e.fall;if(i>n)continue;let r;return i<e.rise?r=i/e.rise:i<e.rise+e.hold?r=1:r=1-(i-e.rise-e.hold)/e.fall,e.strength*(r*r*(3-2*r))}return 0}nextGustIn(t){for(const e of this.gusts)if(e.start>t)return e.start-t;return 1/0}zoneAt(t){const e=this.spec.zones;let i=0;for(;i+1<e.length&&t>=e[i+1].from;)i++;const n=e[i],r=e[i+1];if(r&&t>r.from-Js){const o=(t-(r.from-Js))/Js;return{speed:n.speed+(r.speed-n.speed)*o,dir:J0(n.dir,r.dir,o)}}return e[i-1]&&t<n.from+Js&&i>0?{speed:n.speed,dir:n.dir}:{speed:n.speed,dir:n.dir}}sample(t,e){const i=this.zoneAt(Math.max(0,t)),n=this.spec.variability,r=this.phase,a=Math.sin(e*.21+r[0]+t*.004)*.6+Math.sin(e*.53+r[1])*.4,o=Math.max(0,i.speed*(1+n*a)+(i.speed>0?this.gustAt(e):0)),l=i.dir+n*25*Math.sin(e*.17+r[2]);return{speed:o,dir:l}}windAt(t,e,i,n,r){const a=this.sample(-i,n),o=a.dir*Math.PI/180;return r.x=Math.sin(o)*a.speed,r.y=0,r.z=-Math.cos(o)*a.speed,r}}function J0(s,t,e){let i=(t-s+540)%360-180;return s+i*e}function cr(s){const t=((s+180)%360+360)%360,e=Math.round(t/30)%12;return e===0?12:e}class Q0{current;transitions;listeners=[];constructor(t,e){this.current=t,this.transitions=e}get state(){return this.current}is(...t){return t.includes(this.current)}can(t){return this.transitions[this.current].includes(t)}go(t){if(!this.can(t))return!1;const e=this.current;this.current=t;for(const i of this.listeners)i(t,e);return!0}onChange(t){return this.listeners.push(t),()=>{const e=this.listeners.indexOf(t);e>=0&&this.listeners.splice(e,1)}}}const tg={loading:["menu"],menu:["briefing"],briefing:["playing","menu"],playing:["paused","result","playing"],paused:["playing","menu","briefing"],result:["playing","briefing","menu"]};function uh(s,t){let e=t.x-s.x,i=t.y-s.y,n=t.z-s.z;const r=Math.hypot(e,i,n)||1;e/=r,i/=r,n/=r;let a=-n,o=e;const l=Math.hypot(a,o)||1;a/=l,o/=l;const c=-o*i,h=o*e-a*n,u=a*i;return{f:{x:e,y:i,z:n},r:{x:a,y:0,z:o},u:{x:c,y:h,z:u}}}function xo(s,t,e){const i=Math.tan(t),n=Math.tan(e),r=s.f.x+s.u.x*i+s.r.x*n,a=s.f.y+s.u.y*i+s.r.y*n,o=s.f.z+s.u.z*i+s.r.z*n,l=Math.hypot(r,a,o);return{x:r/l,y:a/l,z:o/l}}function Mo(s,t,e){return{x:s.x-t.u.x*e,y:s.y-t.u.y*e,z:s.z-t.u.z*e}}function Ma(s,t=5){const e=uh(s.eye,s.target),i=Mo(s.eye,e,s.sightHeight),n=Math.hypot(s.target.x-s.eye.x,s.target.y-s.eye.y,s.target.z-s.eye.z);let r=0,a=0,o=0;for(let l=0;l<t;l++){const c=eg(s,e,i,s.zeroAngle+r/1e3,a/1e3,n);if(!c||(o=c.t,r-=c.v,a-=c.h,Math.abs(c.v)<.005&&Math.abs(c.h)<.005))break}return{elevMil:r,windMil:a,tof:o,range:n}}function eg(s,t,e,i,n,r){const a=Tr(s.params,e,xo(t,i,n)),o=.002;let l=0,c={...a.pos},h=0;const u=(d,f,m)=>(d-s.eye.x)*t.f.x+(f-s.eye.y)*t.f.y+(m-s.eye.z)*t.f.z;for(;a.t<8;){us(a,s.env,o);const d=u(a.pos.x,a.pos.y,a.pos.z),f=s.target.x+s.targetVel.x*a.t,m=s.target.y+s.targetVel.y*a.t,v=s.target.z+s.targetVel.z*a.t,g=u(f,m,v);if(d>=g){const p=(g-l)/(d-l||1),M=c.x+(a.pos.x-c.x)*p,x=c.y+(a.pos.y-c.y)*p,_=c.z+(a.pos.z-c.z)*p,C=h+(a.t-h)*p,E=M-(s.target.x+s.targetVel.x*C),A=x-(s.target.y+s.targetVel.y*C),P=_-(s.target.z+s.targetVel.z*C),b=(E*t.u.x+A*t.u.y+P*t.u.z)/r*1e3,y=(E*t.r.x+A*t.r.y+P*t.r.z)/r*1e3;return{v:b,h:y,t:C}}l=d,c={...a.pos},h=a.t}return null}const ke=s=>(Math.round(s*10)/10).toFixed(1),Di=s=>Math.abs(s)<.05?"0.0":`${ke(Math.abs(s))}${s>0?"R":"L"}`;function ig(s){const t=s.elevDial+s.losOffsetV,e=s.windDial+s.losOffsetH,i=t-s.needed.elevMil,n=e-s.needed.windMil,r=s.needed.range,a=g=>Math.round(Math.abs(g)*r/10),o=[],l=i>0?"높음":"낮음",c=n>0?"오른쪽":"왼쪽";o.push(`탄착: ${Math.abs(i)>=.05?`${ke(Math.abs(i))}mil ${l}(${a(i)}cm)`:"높이 정확"} · ${Math.abs(n)>=.05?`${ke(Math.abs(n))}mil ${c}(${a(n)}cm)`:"좌우 정확"}`),o.push(`고각: 필요 ${ke(s.needed.elevMil)} / 실제 ${ke(t)} (터렛 ${ke(s.elevDial)} + 조준 ${ke(s.losOffsetV)})`);const h=s.needed.windMil-s.neededStatic.windMil;s.moving&&Math.abs(h)>.1?o.push(`좌우: 필요 ${Di(s.needed.windMil)} = 바람 ${Di(s.neededStatic.windMil)} + 리드 ${Di(h)} / 실제 ${Di(e)}`):o.push(`좌우: 필요 ${Di(s.needed.windMil)} / 실제 ${Di(e)} (터렛 ${Di(s.windDial)} + 조준 ${Di(s.losOffsetH)})`),o.push(`거리 ${Math.round(r)}m · 비행시간 ${s.needed.tof.toFixed(2)}초`);const u=Math.hypot(s.swayV,s.swayH),d=i-s.swayV,f=n-s.swayH,m=[];if(u>.15&&m.push({score:u,tip:`흔들림이 ${ke(u)}mil이었습니다. 숨을 참고(흔들림 80%↓) 레티클이 멈춘 순간 쏘세요.`}),Math.abs(d)>.15){const g=d<0?`고각을 ${ke(-d)}mil(${Math.round(-d*10)}클릭) 더 올리세요`:`고각을 ${ke(d)}mil(${Math.round(d*10)}클릭) 내리세요`;m.push({score:Math.abs(d),tip:`${g}. 거리를 다시 확인하고 탄도표 값을 쓰세요.`})}if(Math.abs(f)>.15){const g=e-s.swayH;s.moving&&Math.abs(h)>.3&&Math.sign(f)!==Math.sign(h)&&Math.abs(g-s.neededStatic.windMil)<Math.abs(h)?m.push({score:Math.abs(f),tip:`리드가 부족합니다. 표적 진행 방향으로 ${ke(Math.abs(h))}mil 앞을 겨누세요.`}):m.push({score:Math.abs(f),tip:`바람 보정이 ${f>0?"너무 오른쪽":"너무 왼쪽"}입니다. ${ke(Math.abs(f))}mil(${Math.round(Math.abs(f)*10)}클릭) ${f>0?"왼쪽":"오른쪽"}으로 옮기세요.`})}m.sort((g,p)=>p.score-g.score);const v=m[0]?.tip??"아주 근소한 차이입니다. 같은 보정으로 한 번 더!";return{errV:i,errH:n,range:r,lines:o,tip:v}}class ya{mesh;particles=[];next=0;fade;m=new Yt;q=new Ze;s=new T;axis=new T(.3,1,.2).normalize();groundAt;constructor(t,e,i,n,r){this.mesh=new lr(t,e,i),this.mesh.frustumCulled=!1,this.fade=n,this.groundAt=r;for(let a=0;a<i;a++)this.particles.push({alive:!1,pos:new T,vel:new T,life:0,maxLife:1,size:1,grow:0,gravity:0,rot:0,rotV:0,bounce:!1,color:new bt}),this.m.makeScale(0,0,0),this.mesh.setMatrixAt(a,this.m),this.mesh.setColorAt(a,new bt(1,1,1))}spawn(t,e,i,n,r,a,o,l=!1){const c=this.particles[this.next];this.next=(this.next+1)%this.particles.length,c.alive=!0,c.pos.copy(t),c.vel.copy(e),c.life=i,c.maxLife=i,c.size=n,c.grow=r,c.gravity=a,c.rot=Math.random()*6,c.rotV=(Math.random()-.5)*12,c.bounce=l,typeof o=="number"?c.color.setHex(o):c.color.copy(o)}get aliveCount(){return this.particles.filter(t=>t.alive).length}update(t){let e=!1;for(let i=0;i<this.particles.length;i++){const n=this.particles[i];if(!n.alive)continue;if(e=!0,n.life-=t,n.life<=0){n.alive=!1,this.m.makeScale(0,0,0),this.mesh.setMatrixAt(i,this.m);continue}if(n.vel.y-=n.gravity*t,n.vel.multiplyScalar(Math.max(0,1-t*(n.bounce?.2:1.6))),n.pos.addScaledVector(n.vel,t),n.bounce){const o=this.groundAt(n.pos.x,n.pos.z)+.05;n.pos.y<o&&(n.pos.y=o,n.vel.y=Math.abs(n.vel.y)*.35,n.vel.x*=.6,n.vel.z*=.6,n.rotV*=.5)}n.rot+=n.rotV*t,n.size+=n.grow*t;const r=n.life/n.maxLife,a=this.fade?n.size*(.4+.6*r):n.size*(n.bounce&&r<.2?r*5:1);this.q.setFromAxisAngle(this.axis,n.rot),this.s.set(a,a,a),this.m.compose(n.pos,this.q,this.s),this.mesh.setMatrixAt(i,this.m),this.mesh.setColorAt(i,n.color)}e&&(this.mesh.instanceMatrix.needsUpdate=!0,this.mesh.instanceColor&&(this.mesh.instanceColor.needsUpdate=!0))}clear(){for(let t=0;t<this.particles.length;t++)this.particles[t].alive=!1,this.m.makeScale(0,0,0),this.mesh.setMatrixAt(t,this.m);this.mesh.instanceMatrix.needsUpdate=!0}}class Cn{items=[];group=new oe;lineMat=new ih({color:16773824,transparent:!0,opacity:.55,fog:!1});headMat=new Ve({color:16774872,fog:!1});headGeo=new yi(.06,6,4);static TRAIL=24;constructor(t){for(let e=0;e<t;e++){const i=new xe;i.setAttribute("position",new ee(new Float32Array(Cn.TRAIL*3),3));const n=new P0(i,this.lineMat);n.frustumCulled=!1;const r=new st(this.headGeo,this.headMat);n.visible=!1,r.visible=!1,this.group.add(n,r),this.items.push({line:n,head:r,points:[],life:0,active:!1})}}start(){let t=this.items.findIndex(i=>!i.active&&i.life<=0);t<0&&(t=0);const e=this.items[t];return e.active=!0,e.points=[],e.life=0,e.line.visible=!0,e.head.visible=!0,t}push(t,e,i){const n=this.items[t];if(!n?.active)return;n.points.push(e.clone()),n.points.length>Cn.TRAIL&&n.points.shift(),n.head.position.copy(e);const r=e.distanceTo(i);n.head.scale.setScalar(Math.max(1,r*.004));const a=n.line.geometry.attributes.position.array;for(let o=0;o<Cn.TRAIL;o++){const l=n.points[Math.max(0,n.points.length-Cn.TRAIL+o)]??e;a[o*3]=l.x,a[o*3+1]=l.y,a[o*3+2]=l.z}n.line.geometry.attributes.position.needsUpdate=!0}end(t){const e=this.items[t];e&&(e.active=!1,e.life=.25,e.head.visible=!1)}update(t){for(const e of this.items)!e.active&&e.life>0&&(e.life-=t,e.life<=0&&(e.line.visible=!1))}clear(){for(const t of this.items)t.active=!1,t.life=0,t.line.visible=!1,t.head.visible=!1}dispose(){for(const t of this.items)t.line.geometry.dispose();this.lineMat.dispose(),this.headMat.dispose(),this.headGeo.dispose()}}class ng{group=new oe;dust;sparks;frags;tracers;disposables=[];dustColor=new bt(10127978);constructor(t,e){this.dustColor.setHex(e);const i=new _s(1,0),n=new we({color:16777215,flatShading:!0,transparent:!0,opacity:.85}),r=new kt(.06,.06,.06),a=new Ve({color:16777215,fog:!1}),o=new Vo(1,0),l=new we({color:16777215,flatShading:!0});this.disposables.push(i,n,r,a,o,l),this.dust=new ya(i,n,160,!0,t),this.sparks=new ya(r,a,120,!0,t),this.frags=new ya(o,l,90,!1,t),this.tracers=new Cn(6),this.group.add(this.dust.mesh,this.sparks.mesh,this.frags.mesh,this.tracers.group)}impactGround(t,e){const i=.5+e*.0012,n=new T;for(let r=0;r<10;r++){n.set((Math.random()-.5)*2,2+Math.random()*3,(Math.random()-.5)*2).multiplyScalar(i);const a=this.dustColor.clone().offsetHSL(0,0,(Math.random()-.5)*.1);this.dust.spawn(t,n,.9+Math.random()*.8,.15*i,.6*i,2,a)}}impactSteel(t,e){const i=.5+e*.0012,n=new T;for(let r=0;r<14;r++)n.set((Math.random()-.5)*6,Math.random()*5,Math.random()*4).multiplyScalar(i),this.sparks.spawn(t,n,.25+Math.random()*.3,1.2*i,-1,6,16765802);for(let r=0;r<3;r++)n.set(Math.random()-.5,.5+Math.random(),.5).multiplyScalar(i),this.dust.spawn(t,n,.6,.08*i,.4*i,0,14211280)}personDown(t,e,i,n){const r=.5+n*8e-4,a=new T;for(let l=0;l<6;l++)a.set((Math.random()-.5)*.8,Math.random()*.6,(Math.random()-.5)*.8).addScaledVector(i,1.5),this.dust.spawn(t,a,.5+Math.random()*.3,.06*r,.35*r,0,9209462);const o=e.clone().addScaledVector(i,.9);o.y+=.1;for(let l=0;l<8;l++){a.set((Math.random()-.5)*2,.5+Math.random()*1.2,(Math.random()-.5)*2);const c=this.dustColor.clone().offsetHSL(0,0,(Math.random()-.5)*.08);this.dust.spawn(o,a,1+Math.random()*.6,.12*r,.5*r,1,c)}}update(t){this.dust.update(t),this.sparks.update(t),this.frags.update(t),this.tracers.update(t)}clear(){this.dust.clear(),this.sparks.clear(),this.frags.clear(),this.tracers.clear()}stats(){return{dust:this.dust.aliveCount,sparks:this.sparks.aliveCount,frags:this.frags.aliveCount}}dispose(){for(const t of this.disposables)t.dispose();this.tracers.dispose(),this.group.removeFromParent()}}const cc=.1,sg=30,hc=10;class yo{weapon;ammoIndex=0;inMag=0;reserve=0;chambered=!1;boltTimer=0;reloadTimer=0;boltDelay=0;elevMil=0;windMil=0;zeroAngles=[];dopeCache=new Map;suppressor;constructor(t,e=!1){this.weapon=t,this.suppressor=e;const i={density:vo(0,15),soundSpeed:_o(15),gravity:vt.sim.gravity,windAt:wr};this.zeroAngles=t.ammo.map(n=>j0(this.params(n),i,t.sightHeight,t.zeroRange))}get ammo(){return this.weapon.ammo[this.ammoIndex]}get zeroAngle(){return this.zeroAngles[this.ammoIndex]}params(t=this.ammo){return{muzzleVelocity:t.muzzleVelocity*(this.suppressor?ch.velocityMul:1),bcG7:t.bcG7,stability:this.weapon.stability}}reset(t){const e=t<=0?1/0:t;this.ammoIndex=0,this.inMag=Math.min(this.weapon.magazine,e),this.reserve=e-this.inMag,this.chambered=this.inMag>0,this.boltTimer=0,this.reloadTimer=0,this.boltDelay=0,this.elevMil=0,this.windMil=0}get busy(){return this.boltTimer>0||this.reloadTimer>0||this.boltDelay>0}canFire(){return this.chambered&&!this.busy}get totalRounds(){return this.inMag+this.reserve}fire(){this.chambered=!1,this.inMag--,this.boltDelay=.12}switchAmmo(){return this.weapon.ammo.length<2||this.reloadTimer>0?!1:(this.ammoIndex=(this.ammoIndex+1)%this.weapon.ammo.length,this.reserve+=this.inMag,this.inMag=0,this.chambered=!1,this.boltTimer=0,this.boltDelay=0,this.reloadTimer=this.weapon.reloadTime,!0)}update(t){if(this.boltDelay>0)return this.boltDelay-=t,this.boltDelay<=0?(this.boltDelay=0,this.inMag>0?(this.boltTimer=this.weapon.boltTime,"boltStart"):this.reserve>0?(this.reloadTimer=this.weapon.reloadTime,"reloadStart"):"empty"):null;if(this.boltTimer>0&&(this.boltTimer-=t,this.boltTimer<=0))return this.boltTimer=0,this.chambered=!0,"boltDone";if(this.reloadTimer>0&&(this.reloadTimer-=t,this.reloadTimer<=0)){this.reloadTimer=0;const e=Math.min(this.weapon.magazine,this.reserve);return this.inMag=e,this.reserve-=e,this.chambered=e>0,"reloadDone"}return null}dialElev(t){const e=Math.round((this.elevMil+t*cc)*10)/10,i=Math.min(sg,Math.max(0,e)),n=i!==this.elevMil;return this.elevMil=i,n}dialWind(t){const e=Math.round((this.windMil+t*cc)*10)/10,i=Math.min(hc,Math.max(-hc,e)),n=i!==this.windMil;return this.windMil=i,n}resetTurrets(){this.elevMil=0,this.windMil=0}dope(t,e,i){const n=`${this.weapon.id}:${this.suppressor}:${this.ammoIndex}:${t}:${e}:${i}`,r=this.dopeCache.get(n);if(r)return r;const a={density:vo(t,e),soundSpeed:_o(e),gravity:vt.sim.gravity,windAt:wr},o=[];for(let c=100;c<=i;c+=c<600?50:100)o.push(c);const l=Z0(this.params(),this.ammo.mass,a,this.weapon.sightHeight,this.zeroAngle,o);return this.dopeCache.set(n,l),l}}class rg{breath=1;holding=!1;exhausted=!1;heartRate=vt.shooter.heartRateRest;offset={x:0,y:0};t=0;heartPhase=0;heartKick=0;stateMul=1;breathAmp=1;seedPhase;constructor(t=0){this.seedPhase=t}reset(){this.breath=1,this.holding=!1,this.exhausted=!1,this.heartRate=vt.shooter.heartRateRest,this.heartPhase=0,this.heartKick=0,this.stateMul=1,this.breathAmp=1,this.t=0,this.offset.x=0,this.offset.y=0}canHold(){return!this.exhausted&&this.breath>=vt.shooter.breathMinToHold}onShot(){this.heartRate+=vt.shooter.heartRatePerShot}update(t,e,i,n){const r=vt.shooter,a={heartbeat:!1,holdStarted:!1,holdEnded:!1,exhausted:!1};this.t+=t,e&&!this.holding&&this.canHold()?(this.holding=!0,a.holdStarted=!0):!e&&this.holding&&(this.holding=!1,a.holdEnded=!0),this.holding?(this.breath-=t/i,this.breath<=0&&(this.breath=0,this.holding=!1,this.exhausted=!0,a.exhausted=!0,a.holdEnded=!0)):(this.breath=Math.min(1,this.breath+t*r.breathRecoverRate*(this.exhausted?.6:1)),this.exhausted&&this.breath>=.6&&(this.exhausted=!1));const o=this.exhausted?r.heartRateExhausted:r.heartRateRest;this.heartRate>o?this.heartRate=Math.max(o,this.heartRate-r.heartRateRecoverPerSec*t):this.heartRate=Math.min(o,this.heartRate+12*t),this.heartPhase+=this.heartRate/60*t,this.heartPhase>=1&&(this.heartPhase-=1,this.heartKick=r.heartKick*(this.heartRate/r.heartRateRest),a.heartbeat=!0),this.heartKick*=Math.exp(-14*t);const l=this.holding?r.holdSwayMul:this.exhausted?r.exhaustedSwayMul:1;this.stateMul+=(l-this.stateMul)*Math.min(1,t*5),this.breathAmp+=((this.holding?0:this.exhausted?1.6:1)-this.breathAmp)*Math.min(1,t*4);const c=r.swayAmplitude*n*this.stateMul,h=this.t+this.seedPhase,u=r.swayFreqX*Math.PI*2,d=r.swayFreqY*Math.PI*2;return this.offset.x=c*(Math.sin(h*u)+.5*Math.sin(h*u*2.3+1.3))/1.5,this.offset.y=c*(Math.sin(h*d+.7)+.4*Math.sin(h*d*1.9+2.1))/1.4+r.breathAmplitude*n*this.breathAmp*Math.sin(h*Math.PI*2/r.breathPeriod)+this.heartKick,a}}const ag={guard:{top:5200442,bottom:4607796,skin:13081208,boots:2236444,head:"helmet",headColor:4015664,vest:3027750,rifle:!0},guardDesert:{top:11770476,bottom:10521184,skin:12093282,boots:5917238,head:"helmet",headColor:10258016,vest:7233348,rifle:!0},guardSnow:{top:14673128,bottom:13226198,skin:13805188,boots:3815994,head:"hood",headColor:15265007,vest:9082012,rifle:!0},hvtSuit:{top:15921386,bottom:15263454,skin:14199944,boots:2760216,head:"none",headColor:2761760,tie:12591146,glasses:!0},hvtOfficer:{top:1974822,bottom:1711392,skin:13145978,boots:1118481,head:"beret",headColor:11735580,tie:1118481},courier:{top:7029798,bottom:3487548,skin:12882546,boots:2761760,head:"none",headColor:2760730,backpack:1842204},civilian:{top:3829416,bottom:3819096,skin:13935490,boots:4864554,head:"cap",headColor:13152378},civilianRed:{top:11549234,bottom:4868688,skin:12882546,boots:3812900,head:"cap",headColor:14209216},scientist:{top:9085112,bottom:4080458,skin:14727318,boots:2236962,head:"none",headColor:6969928,coat:16054008,glasses:!0}};class dh{cache=new Map;geoCache=new Map;ledOff=new Ve({color:2767392});ledOn=new Ve({color:16722458});mat(t){let e=this.cache.get(t);return e||(e=new we({color:t,flatShading:!0}),this.cache.set(t,e)),e}box(t,e,i){const n=`b${t},${e},${i}`;let r=this.geoCache.get(n);return r||(r=new kt(t,e,i),this.geoCache.set(n,r)),r}geo(t,e){let i=this.geoCache.get(t);return i||(i=e(),this.geoCache.set(t,i)),i}dispose(){for(const t of this.cache.values())t.dispose();for(const t of this.geoCache.values())t.dispose();this.ledOff.dispose(),this.ledOn.dispose(),this.cache.clear(),this.geoCache.clear()}}function fh(s,t){const e=ag[s],i=new oe,n=new oe;i.add(n);const r=(m,v,g,p,M,x=n)=>{const _=new st(m,t.mat(v));return _.position.set(g,p,M),x.add(_),_},a=new oe;if(a.position.set(0,1.62,0),n.add(a),r(t.geo("head",()=>new _s(.115,1)),e.skin,0,.04,0,a),r(t.box(.2,.06,.2),e.headColor,0,.13,-.01,a),e.head==="helmet")r(t.geo("helmet",()=>new yi(.14,8,5,0,Math.PI*2,0,Math.PI/2)),e.headColor,0,.07,0,a);else if(e.head==="beret"){const m=r(t.geo("beret",()=>new ve(.13,.12,.05,8)),e.headColor,-.02,.15,0,a);m.rotation.z=.2}else e.head==="cap"?(r(t.geo("cap",()=>new ve(.12,.12,.07,8)),e.headColor,0,.14,0,a),r(t.box(.16,.015,.1),e.headColor,0,.11,.1,a)):e.head==="hood"&&r(t.geo("hood",()=>new yi(.145,8,6)),e.headColor,0,.05,-.02,a);if(e.glasses&&r(t.box(.17,.035,.03),1053204,0,.06,.105,a),r(t.box(.1,.08,.1),e.skin,0,1.5,0),r(t.box(.42,.36,.24),e.top,0,1.33,0),r(t.box(.36,.28,.21),e.top,0,1.03,0),r(t.box(.36,.12,.22),e.bottom,0,.86,0),e.vest){r(t.box(.45,.42,.28),e.vest,0,1.25,0);for(const m of[-.12,0,.12])r(t.box(.08,.1,.05),e.vest,m,1.16,.15)}e.coat&&(r(t.box(.44,.7,.26),e.coat,0,1.13,0),r(t.box(.4,.3,.24),e.coat,0,.66,0)),e.tie&&r(t.box(.05,.28,.02),e.tie,0,1.33,.125),e.backpack&&r(t.box(.34,.44,.16),e.backpack,0,1.25,-.2);const o=new st(t.box(.04,.04,.02),t.ledOff);o.position.set(.12,1.42,.13+(e.vest?.03:0)),n.add(o);const l=(m,v,g,p,M,x,_)=>{const C=new oe;return C.position.set(m,v,0),n.add(C),r(t.box(p,g,p*1.05),M,0,-g/2,0,C),r(t.box(p*.95,_,p*(_>.1?1.6:1)),x,0,-g-_/2+.02,_>.1?.04:0,C),C},c=l(-.29,1.49,.52,.11,e.coat??e.top,e.skin,.09),h=l(.29,1.49,.52,.11,e.coat??e.top,e.skin,.09),u=l(-.1,.84,.74,.15,e.bottom,e.boots,.12),d=l(.1,.84,.74,.15,e.bottom,e.boots,.12);if(e.rifle){const m=new oe;m.position.set(.02,1.18,.2),m.rotation.set(0,Math.PI/2,.6,"ZYX"),r(t.box(.05,.08,.7),1776927,0,0,0,m),r(t.box(.04,.12,.06),1776927,0,-.08,.05,m),r(t.box(.05,.07,.2),3813926,0,-.02,-.38,m),n.add(m)}const f=new st(t.geo("shadow",()=>new Pr(.42,12)),og());return f.rotation.x=-Math.PI/2,f.position.y=.03,i.add(f),{root:i,body:n,head:a,armL:c,armR:h,legL:u,legR:d,alertLight:o}}let Sa=null;function og(){return Sa||(Sa=new Ve({color:0,transparent:!0,opacity:.28,depthWrite:!1})),Sa}const uc={hvt:"핵심 표적",guard:"경비병",civilian:"민간인"},dc={head:"머리",chest:"흉부",abdomen:"복부",arm:"팔",leg:"다리",plate:"강철판"},fc=[{zone:"head",type:"sphere",c:new T(0,1.66,0),r:.125*vt.targets.headHitboxScale},{zone:"chest",type:"box",c:new T(0,1.34,0),half:new T(.21,.18,.13)},{zone:"abdomen",type:"box",c:new T(0,1,0),half:new T(.18,.16,.12)},{zone:"arm",type:"box",c:new T(-.3,1.24,0),half:new T(.065,.28,.07)},{zone:"arm",type:"box",c:new T(.3,1.24,0),half:new T(.065,.28,.07)},{zone:"leg",type:"box",c:new T(-.1,.42,0),half:new T(.085,.42,.09)},{zone:"leg",type:"box",c:new T(.1,.42,0),half:new T(.085,.42,.09)}],pc=new T,vi=new T,bn=new T;function ba(s,t,e,i){bn.subVectors(t,s);const n=s.x-e.x,r=s.y-e.y,a=s.z-e.z,o=bn.dot(bn),l=2*(n*bn.x+r*bn.y+a*bn.z),c=n*n+r*r+a*a-i*i,h=l*l-4*o*c;if(h<0||o===0)return null;const u=Math.sqrt(h),d=(-l-u)/(2*o);if(d>=0&&d<=1)return d;const f=(-l+u)/(2*o);return d<0&&f>=0?0:null}function mc(s,t,e,i){let n=0,r=1;for(const a of["x","y","z"]){const o=t[a]-s[a],l=e[a]-i[a],c=e[a]+i[a];if(Math.abs(o)<1e-12){if(s[a]<l||s[a]>c)return null}else{let h=(l-s[a])/o,u=(c-s[a])/o;if(h>u&&([h,u]=[u,h]),n=Math.max(n,h),r=Math.min(r,u),n>r)return null}}return n}class lg{plate=new we({color:16053488,flatShading:!0});plateHit=new we({color:5690212,flatShading:!0});stand=new we({color:4866104,flatShading:!0});decal=new Ve({color:3815994,polygonOffset:!0,polygonOffsetFactor:-2});human=new dh;geos={decal:new Pr(.018,6),post:new kt(.06,1,.06)};dispose(){for(const t of[this.plate,this.plateHit,this.stand,this.decal])t.dispose();for(const t of Object.values(this.geos))t.dispose();this.human.dispose()}}class gc{def;group=new oe;position=new T;velocity=new T;yaw=0;state="idle";alerted=!1;hitCount=0;plateHit=!1;wounded=!1;tagged=!1;observe=0;fallT=0;fallSign=1;rig=null;ownGeos=[];alertTimer=-1;pathIndex=1;pauseTimer=0;idleTimer=0;idleYawTarget=0;animT=Math.random()*10;swing=0;terrain;mats;parts={};plateMesh=null;plateSwing=0;plateSwingV=0;decals=[];escapeSpeedMul;escapeDistMul;reaction;escapePoint=null;constructor(t,e,i,n,r,a){this.def=t,this.terrain=e,this.mats=i,this.escapeSpeedMul=n,this.escapeDistMul=r,this.reaction=a,t.kind==="plate"?this.buildPlate():this.buildPerson(),this.reset()}get isPerson(){return this.def.kind==="person"}get role(){return this.isPerson?this.def.role??"guard":null}get isCivilian(){return this.role==="civilian"}get isDown(){return this.state==="down"}get done(){return this.isPerson?this.state==="down":this.plateHit}get active(){return this.isPerson?this.state!=="down"&&this.state!=="escaped":!0}reset(){const t=this.def;this.position.set(t.x,0,-t.dist),this.position.y=this.terrain.height(this.position.x,this.position.z),this.velocity.set(0,0,0),this.yaw=(t.facing??0)*Math.PI/180,this.state=t.behavior==="patrol"?"patrol":"idle",this.alerted=!1,this.alertTimer=-1,this.hitCount=0,this.plateHit=!1,this.wounded=!1,this.tagged=!this.isPerson,this.observe=0,this.fallT=0,this.rig&&(this.rig.body.rotation.set(0,0,0),this.rig.body.position.set(0,0,0),this.rig.alertLight.material=this.mats.human.ledOff),this.pathIndex=1,this.pauseTimer=0,this.idleTimer=1+Math.random()*3,this.idleYawTarget=this.yaw,this.plateSwing=0,this.plateSwingV=0,this.group.visible=!0;for(const i of this.decals)i.visible=!1;this.plateMesh&&(this.plateMesh.material=this.mats.plate);const e=t.escape??(this.isCivilian?[t.x+(t.x<0?-35:35),t.dist+12]:void 0);if(e){const i=e[0],n=-e[1],r=t.x,a=-t.dist;this.escapePoint=new T(r+(i-r)*this.escapeDistMul,0,a+(n-a)*this.escapeDistMul)}this.syncGroup()}buildPlate(){const t=this.def,e=t.w??.6,i=t.h??.6,n=t.shape==="rect"?new kt(e,i,.03):new ve(e/2,e/2,.03,18);t.shape!=="rect"&&n.rotateX(Math.PI/2),this.ownGeos.push(n),n.translate(0,-i/2,0);const r=new oe;r.position.y=.7+i;const a=new st(n,this.mats.plate);r.add(a),this.plateMesh=a,this.parts.hinge=r,this.group.add(r);for(const c of[-1,1]){const h=new st(this.mats.geos.post,this.mats.stand);h.scale.y=.75+i,h.position.set(c*e/2+c*.05,(.75+i)/2,-.03),this.group.add(h)}const o=new kt(e+.2,.05,.05);this.ownGeos.push(o);const l=new st(o,this.mats.stand);l.position.set(0,.72+i,-.03),this.group.add(l);for(let c=0;c<12;c++){const h=new st(this.mats.geos.decal,this.mats.decal);h.visible=!1,a.add(h),this.decals.push(h)}}buildPerson(){const t=this.def.outfit??(this.role==="civilian"?"civilian":this.role==="hvt"?"hvtSuit":"guard"),e=fh(t,this.mats.human);this.rig=e,this.group.add(e.root),this.parts.head=e.head,this.parts.armL=e.armL,this.parts.armR=e.armR,this.parts.legL=e.legL,this.parts.legR=e.legR}syncGroup(){this.group.position.copy(this.position),this.group.rotation.set(0,this.yaw,0),this.parts.hinge&&(this.parts.hinge.rotation.x=this.plateSwing)}get alertPending(){return this.alertTimer>=0}alert(t){!this.isPerson||this.state==="down"||this.state==="escaped"||!this.escapePoint||this.alerted||(this.alertTimer<0||t<this.alertTimer)&&(this.alertTimer=t)}update(t){let e=!1,i=!1;if(!this.isPerson)return this.plateSwingV+=(-this.plateSwing*40-this.plateSwingV*2.2)*t,this.plateSwing+=this.plateSwingV*t,this.syncGroup(),{becameAlert:e,escaped:i};if(this.state==="down"){if(this.fallT<1&&this.rig){this.fallT=Math.min(1,this.fallT+t/.7);const h=this.fallT,u=h<.35?h/.35*.25:.25+(1-Math.pow(1-(h-.35)/.65,2))*.75;this.rig.body.rotation.x=this.fallSign*u*(Math.PI/2-.08),this.rig.body.position.y=-Math.sin(Math.min(1,h*2)*Math.PI*.5)*.12,this.rig.legL.rotation.x=-u*.5,this.rig.legR.rotation.x=-u*.3,this.rig.armL.rotation.x=this.fallSign*u*1.2,this.rig.armR.rotation.x=this.fallSign*u*.9}return{becameAlert:e,escaped:i}}if(this.state==="escaped")return{becameAlert:e,escaped:i};this.alertTimer>=0&&(this.alertTimer-=t,this.alertTimer<0&&!this.alerted&&(this.alerted=!0,e=!0,this.state="fleeing",this.rig&&(this.rig.alertLight.material=this.mats.human.ledOn)));const n=vt.targets;let r=0,a=null;if(this.state==="fleeing"&&this.escapePoint)a=this.escapePoint,r=n.runSpeed*this.escapeSpeedMul;else if(this.state==="patrol"&&this.def.path){const h=this.def.path[this.pathIndex];a=pc.set(h[0],0,-h[1]),r=n.walkSpeed}else this.state==="pausing"?(this.pauseTimer-=t,this.pauseTimer<=0&&(this.state="patrol")):this.state==="idle"&&(this.idleTimer-=t,this.idleTimer<=0&&(this.idleTimer=2+Math.random()*3,this.idleYawTarget=(Math.random()-.5)*2.2),this.yaw+=(this.idleYawTarget-this.yaw)*Math.min(1,t*2));if(this.wounded&&(r*=n.legHitSpeedMul),a&&r>0){vi.set(a.x-this.position.x,0,a.z-this.position.z);const h=vi.length(),u=r*t;if(h<=u)this.position.x=a.x,this.position.z=a.z,this.velocity.set(0,0,0),this.state==="fleeing"?(this.state="escaped",this.group.visible=!1,i=!0):this.def.path&&(this.pathIndex=(this.pathIndex+1)%this.def.path.length,this.state="pausing",this.pauseTimer=this.def.pause??1);else{vi.multiplyScalar(1/h),this.velocity.set(vi.x*r,0,vi.z*r),this.position.x+=vi.x*u,this.position.z+=vi.z*u;let f=Math.atan2(vi.x,vi.z)-this.yaw;f=Math.atan2(Math.sin(f),Math.cos(f)),this.yaw+=f*Math.min(1,t*8)}this.position.y=this.terrain.height(this.position.x,this.position.z)}else this.velocity.set(0,0,0);const o=this.velocity.lengthSq()>.01,l=Math.sqrt(this.velocity.lengthSq());this.animT+=t*(o?2.2+l*1.6:1),this.swing+=((o?Math.min(.9,.35+l*.15):0)-this.swing)*Math.min(1,t*6);const c=Math.sin(this.animT*2)*this.swing;return this.parts.legL.rotation.x=c,this.parts.legR.rotation.x=-c,this.parts.armL.rotation.x=-c*.8,this.parts.armR.rotation.x=c*.8,o||(this.parts.head.rotation.y=Math.sin(this.animT*.7)*.4),this.syncGroup(),{becameAlert:e,escaped:i}}intersect(t,e){if(!this.group.visible||this.isPerson&&this.state==="down")return null;const i=pc.copy(this.position);if(i.y+=1,ba(t,e,i,1.6)===null)return null;const n=Math.cos(-this.yaw),r=Math.sin(-this.yaw),a=(u,d)=>{const f=u.x-this.position.x,m=u.z-this.position.z;return d.set(f*n+m*r,u.y-this.position.y,-f*r+m*n),d},o=a(t,new T),l=a(e,new T);if(!this.isPerson){const u=this.def.w??.6,d=this.def.h??.6,f=.7+d,m=this.plateSwing,v=-Math.sin(m),g=Math.cos(m),p=(o.y-f)*v+o.z*g,M=(l.y-f)*v+l.z*g;if(p>0&&M>0||p<0&&M<0)return null;const x=p/(p-M),_=new T().lerpVectors(o,l,x),C=(_.y-f)*Math.cos(m)+_.z*Math.sin(m),E=_.x;return(this.def.shape==="rect"?Math.abs(E)<=u/2&&C<=0&&C>=-d:E*E+(C+d/2)*(C+d/2)<=u/2*(u/2))?{target:this,zone:"plate",t:x,point:new T().lerpVectors(t,e,x),local:new T(E,C,.02)}:null}let c=null,h=null;for(const u of fc){const d=u.type==="sphere"?ba(o,l,u.c,u.r):mc(o,l,u.c,u.half);if(d===null)continue;const f={target:this,zone:u.zone,t:d,point:new T().lerpVectors(t,e,d)};(!c||d<c.t)&&(c=f),(u.zone==="head"||u.zone==="chest"||u.zone==="abdomen")&&(!h||d<h.t)&&(h=f)}if(c&&c.zone==="arm"){if(!h){const u=Math.max(1e-6,o.distanceTo(l)),d=new T().subVectors(l,o).multiplyScalar(1+.6/u).add(o);for(const f of fc){if(f.zone!=="head"&&f.zone!=="chest"&&f.zone!=="abdomen")continue;const m=f.type==="sphere"?ba(o,d,f.c,f.r):mc(o,d,f.c,f.half);m!==null&&(!h||m<h.t)&&(h={target:this,zone:f.zone,t:m,point:c.point})}}if(h)return{...h,t:c.t,point:c.point}}return c}applyHit(t,e){if(this.hitCount++,!this.isPerson){this.plateHit=!0,this.plateMesh&&(this.plateMesh.material=this.mats.plateHit),this.plateSwingV+=Math.min(6,e.length()*.004);const i=this.decals.find(n=>!n.visible)??this.decals[(this.hitCount-1)%this.decals.length];return t.local&&(i.visible=!0,i.position.set(t.local.x,t.local.y,.017)),!0}return t.zone==="arm"||t.zone==="leg"?(t.zone==="leg"&&(this.wounded=!0),this.wounded&&this.hitCount>=2?(this.down(e),!0):(this.alert(.15),!1)):(this.down(e),!0)}down(t){if(this.state="down",this.velocity.set(0,0,0),this.fallT=0,t){const e=Math.sin(this.yaw),i=Math.cos(this.yaw);this.fallSign=e*t.x+i*t.z>=0?1:-1}this.rig&&(this.rig.alertLight.material=this.mats.human.ledOff)}dispose(){for(const t of this.ownGeos)t.dispose();this.ownGeos.length=0,this.group.removeFromParent()}}function Qs(s,t,e){let i=s*374761393+t*668265263+e*2147483647|0;return i=Math.imul(i^i>>>13,1274126177),i^=i>>>16,(i>>>0)/4294967296}function fs(s){return s*s*(3-2*s)}function cg(s,t,e){const i=Math.floor(s),n=Math.floor(t),r=fs(s-i),a=fs(t-n),o=Qs(i,n,e),l=Qs(i+1,n,e),c=Qs(i,n+1,e),h=Qs(i+1,n+1,e);return(o+(l-o)*r+(c-o)*a+(o-l-c+h)*r*a)*2-1}function wa(s,t,e,i){let n=0,r=1,a=1,o=0;for(let l=0;l<i;l++)n+=cg(s*a,t*a,e+l*17)*r,o+=r,r*=.5,a*=2.03;return n/o}const So=6;class hg{hillHeight;backdropStart;p;constructor(t){this.p=t,this.hillHeight=t.theme==="mountain"?70:t.theme==="desert"?22:t.theme==="snow"?40:30,this.backdropStart=Math.max(500,t.maxDist+140)}corridorHalfWidth(t){return 45+Math.max(0,t)*.08}height(t,e){const i=-e,n=this.p.seed;let r;if(i<60){const m=Math.max(0,i)/60;r=So*(1-fs(Math.min(1,m))),i<0&&(r=So+Math.min(8,-i*.15))}else r=0;const a=wa(t*.004,e*.004,n,3)*1.1*Math.min(1,Math.max(0,(i-40)/80)),o=this.corridorHalfWidth(i),l=Math.max(0,Math.abs(t)-o),c=fs(Math.min(1,l/160)),h=(wa(t*.0035,e*.0035,n+5,4)*.5+.55)*this.hillHeight*c,u=Math.max(0,i-this.backdropStart),d=fs(Math.min(1,u/400)),f=(wa(t*.002,e*.002,n+11,4)*.4+.8)*this.hillHeight*1.6*d;return r+a+h+f}normal(t,e){const n=this.height(t+.5,e)-this.height(t-.5,e),r=this.height(t,e+.5)-this.height(t,e-.5),a=-n,o=2*.5,l=-r,c=Math.hypot(a,o,l);return{x:a/c,y:o/c,z:l/c}}}class ph extends Cr{constructor(){super();const t=new kt;t.deleteAttribute("uv");const e=new Mr({side:Te}),i=new Mr,n=new lh(16777215,900,28,2);n.position.set(.418,16.199,.3),this.add(n);const r=new st(t,e);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);const a=new st(t,i);a.position.set(-10.906,2.009,1.846),a.rotation.set(0,-.195,0),a.scale.set(2.328,7.905,4.651),this.add(a);const o=new st(t,i);o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),this.add(o);const l=new st(t,i);l.position.set(6.167,.857,7.803),l.rotation.set(0,.561,0),l.scale.set(3.927,6.285,3.687),this.add(l);const c=new st(t,i);c.position.set(-2.017,.018,6.124),c.rotation.set(0,.333,0),c.scale.set(2.002,4.566,2.064),this.add(c);const h=new st(t,i);h.position.set(2.291,-.756,-2.621),h.rotation.set(0,-.286,0),h.scale.set(1.546,1.552,1.496),this.add(h);const u=new st(t,i);u.position.set(-2.193,-.369,-5.547),u.rotation.set(0,.516,0),u.scale.set(3.875,3.487,2.986),this.add(u);const d=new st(t,wn(50));d.position.set(-16.116,14.37,8.208),d.scale.set(.1,2.428,2.739),this.add(d);const f=new st(t,wn(50));f.position.set(-16.109,18.021,-8.207),f.scale.set(.1,2.425,2.751),this.add(f);const m=new st(t,wn(17));m.position.set(14.904,12.198,-1.832),m.scale.set(.15,4.265,6.331),this.add(m);const v=new st(t,wn(43));v.position.set(-.462,8.89,14.52),v.scale.set(4.38,5.441,.088),this.add(v);const g=new st(t,wn(20));g.position.set(3.235,11.486,-12.541),g.scale.set(2.5,2,.1),this.add(g);const p=new st(t,wn(100));p.position.set(0,20,0),p.scale.set(1,.1,1),this.add(p)}dispose(){const t=new Set;this.traverse(e=>{e.isMesh&&(t.add(e.geometry),t.add(e.material))});for(const e of t)e.dispose()}}function wn(s){const t=new Ve;return t.color.setScalar(s),t}const vc={r308:{chassis:10257765,accent:2763565,barrelScale:1,slim:1,brake:"compact"},k65:{chassis:2895409,accent:7172984,barrelScale:.95,slim:.92,brake:"compact"},l338:{chassis:5003067,accent:2500393,barrelScale:1.22,slim:1.12,brake:"large"}};function mh(s,t){const e=vc[s.id]??vc.r308,i=[],n=(V,O,J)=>{const it=new Mr({color:V,metalness:O,roughness:J,flatShading:!1});return i.push(it),it},r=n(e.chassis,.35,.55),a=n(2434859,.85,.32),o=n(1381914,.55,.42),l=n(e.accent,.7,.38),c=n(1052946,0,.92),h=new Mr({color:662060,metalness:1,roughness:.05,emissive:797252,emissiveIntensity:.6});i.push(h);const u=new oe,d=new oe,f=new oe,m=new oe,v=new oe,g=(V,O,J,it,dt,wt,Bt,$=u,Q=0)=>{const ft=new kt(V,O,J);i.push(ft);const nt=new st(ft,it);return nt.position.set(dt,wt,Bt),nt.rotation.x=Q,$.add(nt),nt},p=(V,O,J,it,dt,wt,Bt,$=u,Q=16)=>{const ft=new ve(V,O,J,Q);ft.rotateX(Math.PI/2),i.push(ft);const nt=new st(ft,it);return nt.position.set(dt,wt,Bt),$.add(nt),nt},M=(V,O,J,it,dt=0,wt=18)=>{const Bt=new ve(V,V,O,wt);i.push(Bt);const $=new st(Bt,J);return $.position.y=dt,it.add($),$},x=e.slim,_=e.barrelScale;p(.021*x,.021*x,.24,a,0,.002,-.07),g(.062*x,.07,.44,r,0,-.03,-.08),g(.058*x,.062,.36*_,r,0,-.012,-.47*_+.03);for(let V=0;V<5;V++)for(const O of[-1,1])g(.004,.012,.034,o,O*.03*x,-.012,-.32-V*.055*_);g(.022,.012,.36,o,0,.03,-.1);for(let V=0;V<16;V++)g(.024,.005,.006,a,0,.038,.06-V*.021);const C=.46*_,E=-.62*_+.05;p(.0115*x,.0145*x,C,a,0,.002,E-C/2+.23);const A=E-C+.23;let P;if(t)p(.024,.024,.24,o,0,.002,A-.24/2,u,20),p(.025,.025,.02,a,0,.002,A-.01,u,20),p(.025,.022,.015,a,0,.002,A-.24,u,20),P=A-.24;else{const V=e.brake==="large"?.04:.032,O=e.brake==="large"?.1:.07;g(V,V*.85,O,a,0,.002,A-O/2);for(let J=0;J<3;J++)for(const it of[-1,1])g(.004,V*.55,.012,c,it*V/2,.002,A-.015-J*(O/3.3));P=A-O}const b=.086;p(.0172,.0172,.27,o,0,b,-.09,u,20),p(.029,.0172,.06,o,0,b,-.255,u,20),p(.029,.029,.075,o,0,b,-.322,u,20),p(.026,.026,.002,h,0,b,-.358,u,20),p(.0205,.0172,.05,o,0,b,.07,u,20),p(.022,.022,.06,o,0,b,.12,u,20),p(.0225,.0225,.014,c,0,b,.155,u,20),p(.019,.019,.002,h,0,b,.163,u,20);for(const V of[-.19,0])p(.021,.021,.018,a,0,b,V),g(.03,.04,.018,a,0,.058,V);f.position.set(0,b+.03,-.085),M(.0165,.028,l,f,0,24),M(.0175,.008,a,f,-.01,24),g(.003,.03,.006,n(15921906,0,.5),0,0,.016,f),u.add(f),m.position.set(.03,b,-.085),m.rotation.z=-Math.PI/2,M(.015,.022,l,m,0,24),g(.003,.024,.006,n(15921906,0,.5),0,0,.014,m),u.add(m);const y=new oe;y.position.set(-.028,b,-.085),y.rotation.z=Math.PI/2,M(.019,.016,o,y,0,24),u.add(y),p(.024,.024,.02,l,0,b,.035,u,24),d.position.set(.024*x,.006,.03);const L=p(.005,.005,.06,a,.03,0,0,d);L.rotation.y=Math.PI/2;const k=new yi(.013,12,8);i.push(k);const z=new st(k,c);z.position.set(.06,-.004,.006),d.add(z),u.add(d),g(.012,.03,.06,a,0,-.07,.02);const X=g(.034,.11,.048,c,0,-.105,.075,u,.32);X.castShadow=!1,g(.042,.085,.09,o,0,-.085,-.075,v),g(.044,.012,.094,a,0,-.125,-.075,v),u.add(v),g(.05,.1,.07,r,0,-.035,.155),g(.038*x,.03,.3,r,0,.005,.3);const Y=g(.034*x,.03,.28,r,0,-.085,.31,u,-.06);Y.rotation.x=-.08,g(.036,.04,.13,l,0,.034,.27),g(.046,.15,.03,c,0,-.04,.455),g(.02,.08,.02,a,0,-.12,.38);const W=-.5*_;g(.04,.02,.03,a,0,-.07,W);for(const V of[-1,1]){const O=new oe;O.position.set(V*.016,-.075,W),O.rotation.set(-.55,0,V*.22);const J=new ve(.0055,.0055,.2,8);i.push(J);const it=new st(J,a);it.position.y=-.1,O.add(it);const dt=new kt(.018,.012,.03);i.push(dt);const wt=new st(dt,c);wt.position.y=-.205,O.add(wt),u.add(O)}return{group:u,bolt:d,elevKnob:f,windKnob:m,mag:v,muzzle:new T(0,.002,P),dispose(){for(const V of i)V.dispose()}}}class ug{scene=new Cr;root=new oe;rig=null;recoil=0;recoilV=0;t=0;hemi;key;flash;flashT=0;envTex=null;constructor(t){this.hemi=new Wo(16777215,4478276,.9),this.key=new yr(16777215,2.2),this.key.position.set(-1,2,1.2),this.flash=new lh(16756832,0,1.5,2),this.scene.add(this.hemi,this.key,this.flash,this.root);try{const e=new pr(t);this.envTex=e.fromScene(new ph,.04).texture,this.scene.environment=this.envTex,this.scene.environmentIntensity=.55,e.dispose()}catch{}}build(t,e){this.rig&&(this.root.remove(this.rig.group),this.rig.dispose()),this.rig=mh(t,e),this.rig.group.scale.setScalar(.72),this.root.add(this.rig.group)}setLighting(t,e,i,n){this.key.color.setHex(t),this.key.intensity=1.2+n*.5,this.hemi.color.setHex(e),this.hemi.groundColor.setHex(i)}kick(t,e){this.recoilV+=t,e&&(this.flashT=.06)}update(t,e,i,n,r,a,o){const l=this.rig;if(!l)return;this.t+=t;let c=Math.min(t,.25);for(;c>0;){const _=Math.min(c,.004166666666666667);this.recoilV+=(-this.recoil*260-this.recoilV*24)*_,this.recoil+=this.recoilV*_,c-=_}this.flashT=Math.max(0,this.flashT-t),this.flash.intensity=this.flashT>0?6:0,this.flash.position.copy(l.muzzle).applyMatrix4(l.group.matrixWorld);const h=e*e*(3-2*e),u=.16,d=-.15,f=-.36,m=0,v=-.062,g=-.14,p=Math.sin(this.t*1.4)*.0025*(1-h);this.root.position.set(u+(m-u)*h+o.x*.002,d+(v-d)*h+o.y*.002+p,f+(g-f)*h+this.recoil*.06),this.root.rotation.set(this.recoil*.25,(1-h)*.05,(1-h)*-.03);let M=0,x=0;if(i>=0){const _=i;M=_<.2?_/.2:_<.8?1:1-(_-.8)/.2,x=_<.2?0:_<.5?(_-.2)/.3:_<.8?1-(_-.5)/.3:0,this.root.rotation.z+=-.14*Math.sin(Math.PI*_)}if(l.bolt.rotation.z=M*1.2,l.bolt.position.z=.03+x*.085,n>=0){const _=n;this.root.rotation.z+=.38*Math.sin(Math.PI*Math.min(1,_*1.1)),l.mag.position.y=_<.5?-_*.4:-(1-_)*.4}else l.mag.position.y=0;l.elevKnob.rotation.y=-r*.6,l.windKnob.rotation.y=a*.6}dispose(){this.rig?.dispose(),this.envTex?.dispose()}}const hr={plains:{name:"초원",skyTop:6131657,skyHorizon:13622758,fog:12965084,groundLow:8098896,groundHigh:6257215,rock:9276032,treeTrunk:5981746,treeLeaf:[5208634,6064708,4615732],treeDensity:1,treeShape:"round",sun:16773590,sunIntensity:2.2,hemiSky:12375792,hemiGround:6978120},desert:{name:"사막",skyTop:7315408,skyHorizon:15654854,fog:15128251,groundLow:13611130,groundHigh:12160860,rock:11038284,treeTrunk:7047754,treeLeaf:[7047754,6192450],treeDensity:.25,treeShape:"cactus",sun:16773328,sunIntensity:2.6,hemiSky:14083314,hemiGround:11569754},forest:{name:"숲",skyTop:5932728,skyHorizon:12899286,fog:11978436,groundLow:6257728,groundHigh:4875572,rock:8158324,treeTrunk:5061160,treeLeaf:[3103282,3828282,2641452],treeDensity:2.2,treeShape:"pine",sun:16772300,sunIntensity:2,hemiSky:11585756,hemiGround:4872756},snow:{name:"설원",skyTop:8232126,skyHorizon:14673902,fog:14213608,groundLow:15331058,groundHigh:13818850,rock:7304056,treeTrunk:4864556,treeLeaf:[3033658,3495236],treeDensity:1.3,treeShape:"pine",sun:16774890,sunIntensity:1.8,hemiSky:14214384,hemiGround:12109004},mountain:{name:"산악",skyTop:5210040,skyHorizon:13227744,fog:12570072,groundLow:8029782,groundHigh:9078392,rock:8815226,treeTrunk:5061160,treeLeaf:[3430970,4089410],treeDensity:.8,treeShape:"pine",sun:16773340,sunIntensity:2.3,hemiSky:12374246,hemiGround:7236186}},ii=(s,t,e)=>new bt(s).lerp(new bt(t),e).getHex(),dg={day:null,dawn:{name:"새벽",skyTop:4086406,skyHorizon:15776138,tint:15976354,tintAmount:.18,sun:16761994,sunIntensity:1.7,sunDir:[.75,.12,-.65],glow:16754784,glowStrength:.9,cloud:16173232,cloudOpacity:.85,exposure:1,fogNear:500,fogFar:3800,hemiScale:.8},dusk:{name:"황혼",skyTop:2897240,skyHorizon:15242346,tint:14916210,tintAmount:.2,sun:16752222,sunIntensity:1.6,sunDir:[-.8,.09,-.6],glow:16742970,glowStrength:1,cloud:14191220,cloudOpacity:.85,exposure:.95,fogNear:450,fogFar:3600,hemiScale:.7},overcast:{name:"흐림",skyTop:8226706,skyHorizon:12107460,tint:10134186,tintAmount:.22,sun:15133164,sunIntensity:1.1,sunDir:[-.3,.6,-.4],glow:16777215,glowStrength:.15,cloud:10791858,cloudOpacity:.95,exposure:1.05,fogNear:350,fogFar:3e3,hemiScale:1.15}};function bo(s,t){const e=dg[t];if(!e)return{...s,timeName:"주간",sunDir:[-.45,.62,-.35],sunDisc:16774880,glow:16773320,glowStrength:.45,cloud:16777215,cloudOpacity:.8,ridges:[ii(s.groundHigh,s.fog,.55),ii(s.rock,s.fog,.7),ii(s.skyTop,s.fog,.75)],exposure:1.1,fogNear:700,fogFar:4800};const i=r=>ii(r,e.tint,e.tintAmount),n=ii(e.skyHorizon,s.fog,.35);return{...s,name:s.name,timeName:e.name,skyTop:e.skyTop,skyHorizon:e.skyHorizon,fog:n,groundLow:i(s.groundLow),groundHigh:i(s.groundHigh),rock:i(s.rock),treeLeaf:s.treeLeaf.map(i),sun:e.sun,sunIntensity:e.sunIntensity,hemiSky:ii(s.hemiSky,e.skyHorizon,.5),hemiGround:i(s.hemiGround),sunDir:e.sunDir,sunDisc:ii(e.sun,16777215,.4),glow:e.glow,glowStrength:e.glowStrength,cloud:e.cloud,cloudOpacity:e.cloudOpacity,ridges:[ii(i(s.groundHigh),n,.5),ii(i(s.rock),n,.68),ii(e.skyTop,n,.72)],exposure:e.exposure,fogNear:e.fogNear,fogFar:e.fogFar}}class fg{scene=new Cr;terrain;colliders=[];theme;spinners=[];blinkers=[];flags=[];disposables=[];sun;maxDist;constructor(t,e,i){this.theme=bo(hr[t.theme],t.timeOfDay),this.maxDist=Math.max(...t.targets.map(h=>h.dist),300),this.terrain=new hg({theme:t.theme,seed:i,maxDist:this.maxDist});const n=this.theme;this.scene.background=new bt(n.skyHorizon),this.scene.fog=new zo(n.fog,n.fogNear,n.fogFar);const r=new Wo(n.hemiSky,n.hemiGround,1.05);this.scene.add(r),this.sun=new yr(n.sun,n.sunIntensity);const[a,o,l]=n.sunDir;this.sun.position.set(a*1e3,o*1e3,l*1e3),this.scene.add(this.sun);const c=ur(i+99);this.buildSky(c),this.buildRidges(c),this.buildTerrain(e);for(const h of t.props)this.addProp(h,c);this.buildTrees(t,e,c),this.buildFlags(t,c),this.buildHide(),e!=="low"&&this.buildGrass(e,c)}track(t){return this.disposables.push(t),t}softTexture(t,e){const i=t==="glow"?128:256,n=document.createElement("canvas");n.width=i,n.height=t==="glow"?i:i/2;const r=n.getContext("2d");if(t==="glow"){const o=r.createRadialGradient(i/2,i/2,0,i/2,i/2,i/2);o.addColorStop(0,"rgba(255,255,255,1)"),o.addColorStop(.15,"rgba(255,255,255,0.55)"),o.addColorStop(.45,"rgba(255,255,255,0.12)"),o.addColorStop(1,"rgba(255,255,255,0)"),r.fillStyle=o,r.fillRect(0,0,i,i)}else for(let o=0;o<14;o++){const l=i*(.2+e()*.6),c=n.height*(.45+e()*.25),h=n.height*(.18+e()*.22),u=r.createRadialGradient(l,c,0,l,c,h);u.addColorStop(0,"rgba(255,255,255,0.55)"),u.addColorStop(1,"rgba(255,255,255,0)"),r.fillStyle=u,r.beginPath(),r.arc(l,c,h,0,Math.PI*2),r.fill()}const a=new L0(n);return a.colorSpace=Ce,this.track(a)}buildSky(t){const e=this.theme,i=5800,n=this.track(new yi(i,48,24)),r=[],a=new bt(e.skyTop),o=new bt(e.skyHorizon),l=new bt(e.glow),c=new T(...e.sunDir).normalize(),h=n.attributes.position,u=new bt,d=new T;for(let C=0;C<h.count;C++){d.set(h.getX(C),h.getY(C),h.getZ(C)).normalize();const E=Math.pow(Math.max(0,d.y),.5);u.copy(o).lerp(a,E);const A=Math.max(0,d.dot(c));u.lerp(l,Math.pow(A,6)*e.glowStrength*.8),d.y<0&&u.lerp(new bt(e.fog),Math.min(1,-d.y*4)),r.push(u.r,u.g,u.b)}n.setAttribute("color",new ee(r,3));const f=this.track(new Ve({vertexColors:!0,side:Te,fog:!1,depthWrite:!1})),m=new st(n,f);m.renderOrder=-2,m.frustumCulled=!1,this.scene.add(m);const v=c.clone().multiplyScalar(5200),g=this.softTexture("glow",t),p=new fa(this.track(new or({map:g,color:e.sunDisc,fog:!1,depthWrite:!1,transparent:!0})));p.scale.setScalar(380),p.position.copy(v),p.renderOrder=-1;const M=new fa(this.track(new or({map:g,color:e.glow,fog:!1,depthWrite:!1,transparent:!0,opacity:.55*e.glowStrength+.1,blending:Aa})));M.scale.setScalar(2600),M.position.copy(v),M.renderOrder=-1,this.scene.add(M,p);const x=this.softTexture("cloud",t),_=this.track(new or({map:x,color:e.cloud,fog:!1,depthWrite:!1,transparent:!0,opacity:e.cloudOpacity}));for(let C=0;C<16;C++){const E=(t()-.5)*Math.PI*1.6,A=2600+t()*2400,P=new fa(_);P.position.set(Math.sin(E)*A,650+t()*900,-Math.cos(E)*A);const b=700+t()*900;P.scale.set(b,b*(.32+t()*.12),1),P.renderOrder=-1,this.scene.add(P)}}buildRidges(t){const e=this.theme;[{r:3300,h:this.terrain.hillHeight*2.6+90,amp:.55,color:e.ridges[0]},{r:4200,h:this.terrain.hillHeight*3.4+160,amp:.65,color:e.ridges[1]},{r:5100,h:this.terrain.hillHeight*4.2+280,amp:.75,color:e.ridges[2]}].forEach((n,r)=>{const o=[],l=t()*100,c=d=>{const f=Math.sin(d*3+l)*.35+Math.sin(d*7.3+l*2)*.25+Math.sin(d*17.1+l*3)*.12+Math.sin(d*41+r)*.05;return n.h*(1-n.amp+n.amp*(.5+f))};for(let d=0;d<160;d++){const f=d/160*Math.PI*2,m=(d+1)/160*Math.PI*2,v=(_,C)=>[Math.sin(_)*n.r,C,-Math.cos(_)*n.r],g=v(f,-80),p=v(m,-80),M=v(f,c(f)),x=v(m,c(m));o.push(...g,...M,...p,...p,...M,...x)}const h=this.track(new xe);h.setAttribute("position",new ee(o,3));const u=new st(h,this.track(new Ve({color:n.color,fog:!1,side:Be})));u.renderOrder=-1+r*0,u.frustumCulled=!1,this.scene.add(u)})}buildHide(){const e=this.terrain.height(0,0)+.45,i=this.track(new we({color:10522218,flatShading:!0})),n=this.track(new _r(.11,.38,3,6));n.rotateZ(Math.PI/2);const r=[{y:e-.62,n:5,z:-1.5}];for(const l of r)for(let c=0;c<l.n;c++){const h=new st(n,i);h.position.set((c-(l.n-1)/2)*.6+(l.n===4,0),l.y,l.z+Math.sin(c*2.1)*.04),h.rotation.y=Math.sin(c*1.7)*.12,h.scale.set(1,.8,1),this.scene.add(h)}const a=this.track(new xr(.9,0)),o=this.track(new we({color:this.theme.rock,flatShading:!0}));for(const[l,c,h]of[[-2.4,-1.4,1.1],[2.6,-1.8,.9]]){const u=new st(a,o);u.position.set(l,this.terrain.height(l,c)-.25,c),u.scale.set(h,h*.7,h),this.scene.add(u)}}buildTerrain(t){const e=this.terrain,i=this.theme,n=[{x0:-260,x1:260,d0:-40,d1:this.maxDist+300,step:t==="low"?10:6}],r=t==="low"?60:40;n.push({x0:-2600,x1:-260,d0:-600,d1:3600,step:r}),n.push({x0:260,x1:2600,d0:-600,d1:3600,step:r}),n.push({x0:-260,x1:260,d0:this.maxDist+300,d1:3600,step:r}),n.push({x0:-260,x1:260,d0:-600,d1:-40,step:r/2});const a=new bt(i.groundLow),o=new bt(i.groundHigh),l=new bt(i.rock),c=this.track(new we({vertexColors:!0,flatShading:!0})),h=ur(this.terrain.p.seed+3);for(const u of n){const d=Math.max(1,Math.round((u.x1-u.x0)/u.step)),f=Math.max(1,Math.round((u.d1-u.d0)/u.step)),m=[],v=[],g=new bt,p=(_,C)=>{const E=u.x0+(u.x1-u.x0)*_/d,A=-(u.d0+(u.d1-u.d0)*C/f);return[E,e.height(E,A),A]};for(let _=0;_<f;_++)for(let C=0;C<d;C++){const E=p(C,_),A=p(C+1,_),P=p(C,_+1),b=p(C+1,_+1);for(const y of[[E,A,P],[A,b,P]]){const L=(y[0][1]+y[1][1]+y[2][1])/3,k=y[1][0]-y[0][0],z=y[1][1]-y[0][1],X=y[1][2]-y[0][2],Y=y[2][0]-y[0][0],W=y[2][1]-y[0][1],V=y[2][2]-y[0][2],O=X*Y-k*V,J=Math.hypot(z*V-X*W,O,k*W-z*Y)||1,it=1-Math.abs(O/J);g.copy(a).lerp(o,Math.min(1,Math.max(0,L/(this.terrain.hillHeight*.8)))),it>.35&&g.lerp(l,Math.min(1,(it-.35)*2.5));const dt=(h()-.5)*.06;g.offsetHSL(0,0,dt);for(const wt of y)m.push(wt[0],wt[1],wt[2]),v.push(g.r,g.g,g.b)}}const M=this.track(new xe);M.setAttribute("position",new ee(m,3)),M.setAttribute("color",new ee(v,3)),M.computeVertexNormals();const x=new st(M,c);this.scene.add(x)}}addProp(t,e){const i=-t.dist,n=this.terrain.height(t.x,i),r=this.theme,a=new oe;a.position.set(t.x,n,i),a.rotation.y=(t.rot??0)*Math.PI/180;const o=c=>this.track(new we({color:c,flatShading:!0}));let l=!0;switch(t.kind){case"building":{const c=new st(this.track(new kt(t.w,t.h,t.d)),o(12168600));c.position.y=t.h/2,a.add(c);const h=new st(this.track(new An(Math.max(t.w,t.d)*.75,2.2,4)),o(8014394));h.position.y=t.h+1.1,h.rotation.y=Math.PI/4,a.add(h);const u=o(2304563),d=o(14867663),f=this.track(new kt(1.1,1.3,.1)),m=this.track(new kt(1.3,.12,.18));for(let x=0;x<Math.floor(t.h/3);x++)for(let _=-1;_<=1;_++){if(x===0&&_===0)continue;const C=new st(f,u);C.position.set(_*(t.w/3.2),1.8+x*3,t.d/2+.05);const E=new st(m,d);E.position.set(_*(t.w/3.2),1.1+x*3,t.d/2+.09),a.add(C,E)}const v=new st(this.track(new kt(1.2,2.2,.12)),o(4863014));v.position.set(0,1.1,t.d/2+.06);const g=new st(this.track(new kt(2.2,.08,1)),o(8014394));g.position.set(0,2.5,t.d/2+.5),g.rotation.x=.18;const p=new st(this.track(new kt(t.w+.3,.3,t.d+.3)),d);p.position.y=t.h-.15;const M=new st(this.track(new kt(.9,.6,.45)),o(13158592));M.position.set(t.w/2-1,4.2,t.d/2+.25),a.add(v,g,p,M);break}case"rock":{const c=this.track(new xr(1,0)),h=c.attributes.position;for(let d=0;d<h.count;d++)h.setXYZ(d,h.getX(d)*(.85+e()*.3),h.getY(d)*(.85+e()*.3),h.getZ(d)*(.85+e()*.3));c.computeVertexNormals();const u=new st(c,o(r.rock));u.scale.set(t.w/2,t.h/1.6,t.d/2),u.position.y=t.h*.35,a.add(u);break}case"crate":{const c=new st(this.track(new kt(t.w,t.h,t.d)),o(9071170));c.position.y=t.h/2,a.add(c);break}case"tent":{const c=new st(this.track(new An(t.w/1.4,t.h,4)),o(6978138));c.position.y=t.h/2,c.rotation.y=Math.PI/4,a.add(c);break}case"wall":{const c=new st(this.track(new kt(t.w,t.h,t.d)),o(10130570));c.position.y=t.h/2,a.add(c);break}case"tower":{const c=this.track(new kt(.2,t.h,.2)),h=o(5917242);for(const[d,f]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const m=new st(c,h);m.position.set(d*t.w/2.4,t.h/2,f*t.d/2.4),a.add(m)}const u=new st(this.track(new kt(t.w,1.2,t.d)),o(6969926));u.position.y=t.h,a.add(u),l=!1,this.colliders.push({min:new T(t.x-t.w/2,n+t.h-.6,i-t.d/2),max:new T(t.x+t.w/2,n+t.h+.6,i+t.d/2),kind:"tower"});break}case"road":{const c=this.track(new kn(t.w,t.d,Math.max(1,Math.round(t.w/6)),1));c.rotateX(-Math.PI/2);const h=c.attributes.position;for(let d=0;d<h.count;d++)h.setY(d,this.terrain.height(t.x+h.getX(d),i+h.getZ(d))-n+.05);const u=new st(c,o(9075298));a.add(u),l=!1;break}case"fence":{const c=new st(this.track(new kt(t.w,t.h,.1)),o(8022610));c.position.y=t.h/2,a.add(c);break}case"truck":case"jeep":{const c=t.kind==="truck",h=o(c?5199416:5922628),u=o(1842463),d=o(2766404),f=t.d,m=t.w,v=new st(this.track(new kt(m*.95,.35,f)),u);v.position.y=.6;const g=new st(this.track(new kt(m,c?1.3:.9,c?f*.3:f*.55)),h);g.position.set(0,c?1.4:1.15,c?f*.33:.05);const p=new st(this.track(new kt(m*.85,c?.55:.4,.06)),d);if(p.position.set(0,c?1.7:1.35,(c?f*.48:f*.33)+.02),a.add(v,g,p),c){const x=new st(this.track(new kt(m,1.5,f*.62)),o(6120519));x.position.set(0,1.55,-f*.18),a.add(x)}else{const x=new st(this.track(new kt(m*.95,.35,f*.3)),h);x.position.set(0,.95,f*.33);const _=new st(this.track(new kt(m*.9,.08,.08)),u);_.position.set(0,1.75,-.4),a.add(x,_)}const M=this.track(new ve(.42,.42,.3,10));M.rotateZ(Math.PI/2);for(const x of c?[f*.33,-f*.15,-f*.36]:[f*.32,-f*.3])for(const _ of[-1,1]){const C=new st(M,u);C.position.set(_*m/2,.42,x),a.add(C)}break}case"barrel":{const c=[3099242,8008486,4872750,6974056],h=new st(this.track(new ve(t.w/2,t.w/2,t.h,12)),o(c[Math.floor(e()*c.length)]));h.position.y=t.h/2;const u=this.track(new ve(t.w/2+.015,t.w/2+.015,.04,12)),d=o(2236962);for(const f of[.25,.75]){const m=new st(u,d);m.position.y=t.h*f,a.add(m)}a.add(h);break}case"sandbag":{const c=this.track(new _r(.16,.45,3,6));c.rotateZ(Math.PI/2);const h=o(9404255),u=Math.max(2,Math.round(t.w/.62)),d=Math.max(1,Math.round(t.h/.26));for(let f=0;f<d;f++)for(let m=0;m<u-f%2;m++){const v=new st(c,h);v.position.set(-t.w/2+.31+m*.62+f%2*.31,.14+f*.25,0),v.scale.set(1,.75,1),a.add(v)}break}case"radar":{const c=new st(this.track(new kt(t.w,2.6,t.d)),o(9080710));c.position.y=1.3;const h=new st(this.track(new ve(.25,.35,t.h-3,8)),o(7238508));h.position.y=2.6+(t.h-3)/2;const u=new oe;u.position.y=t.h;const d=this.track(new yi(2.4,16,8,0,Math.PI*2,0,Math.PI/3.2)),f=new st(d,this.track(new we({color:15132384,side:Be,flatShading:!0})));f.rotation.x=Math.PI/2.4,u.add(f),a.add(c,h,u),this.spinners.push(u),l=!1,this.colliders.push({min:new T(t.x-t.w/2,n-1,i-t.d/2),max:new T(t.x+t.w/2,n+2.6,i+t.d/2),kind:"radar"});break}case"antenna":{const c=o(10132118),h=this.track(new ve(.05,.08,t.h,5));for(const[f,m]of[[-.3,-.3],[.3,-.3],[0,.35]]){const v=new st(h,c);v.position.set(f,t.h/2,m),a.add(v)}const u=this.track(new kt(.7,.04,.04));for(let f=1.5;f<t.h;f+=1.6){const m=new st(u,c);m.position.y=f,m.rotation.y=f*1.3,a.add(m)}const d=new st(this.track(new yi(.15,6,4)),this.track(new Ve({color:16722458})));d.position.y=t.h+.15,a.add(d),this.blinkers.push(d),l=!1;break}case"container":{const c=[8010284,3034990,5004858,9071146],h=o(c[Math.floor(e()*c.length)]),u=new st(this.track(new kt(t.w,t.h,t.d)),h);u.position.y=t.h/2,a.add(u);const d=this.track(new kt(.06,t.h*.92,t.d+.06)),f=o(new bt(h.color).multiplyScalar(.75).getHex());for(let m=-t.w/2+.3;m<t.w/2;m+=.45){const v=new st(d,f);v.position.set(m,t.h/2,0),a.add(v)}break}}if(this.scene.add(a),l){const c=t.kind==="rock"?.8:1,h=t.kind==="rock"?t.h*.85:t.h+(t.kind==="building"?2:0),u=(t.rot??0)*Math.PI/180,d=t.w/2*c,f=t.d/2*c,m=Math.abs(Math.cos(u))*d+Math.abs(Math.sin(u))*f,v=Math.abs(Math.sin(u))*d+Math.abs(Math.cos(u))*f;this.colliders.push({min:new T(t.x-m,n-1,i-v),max:new T(t.x+m,n+h,i+v),kind:t.kind})}}buildTrees(t,e,i){const n=this.theme,a=Math.round((e==="high"?1400:e==="medium"?850:450)*n.treeDensity),o=this.track(n.treeShape==="cactus"?new ve(.25,.3,3,6):new ve(.18,.28,2.2,5));o.translate(0,n.treeShape==="cactus"?1.5:1.1,0);let l;n.treeShape==="pine"?(l=new An(1.6,5.5,6),l.translate(0,4.6,0)):n.treeShape==="round"?(l=new _s(2.2,0),l.translate(0,3.8,0)):(l=new ve(.18,.2,1.4,6),l.rotateZ(Math.PI/2),l.translate(0,1.8,0)),this.track(l);const c=new lr(o,this.track(new we({color:n.treeTrunk,flatShading:!0})),a),h=new lr(l,this.track(new we({color:16777215,flatShading:!0})),a),u=new Yt,d=new Ze,f=new T,m=new T,v=new bt,g=t.targets.map(x=>({x:x.x,z:-x.dist}));let p=0,M=0;for(;p<a&&M<a*6;){M++;const x=-80+i()*(this.maxDist+900),_=(i()-.5)*1400,C=this.terrain.corridorHalfWidth(x);if(Math.abs(_)<C*.9&&x>-10||Math.abs(_)<25&&x<30||g.some(b=>Math.hypot(b.x-_,b.z+x)<15))continue;const E=-x,A=this.terrain.height(_,E),P=.8+i()*.7;m.set(_,A-.2,E),d.setFromAxisAngle(new T(0,1,0),i()*Math.PI*2),f.set(P,P*(.85+i()*.4),P),u.compose(m,d,f),c.setMatrixAt(p,u),h.setMatrixAt(p,u),v.setHex(n.treeLeaf[Math.floor(i()*n.treeLeaf.length)]).offsetHSL(0,0,(i()-.5)*.06),h.setColorAt(p,v),Math.abs(_)<C+120&&x>0&&x<this.maxDist+100&&this.colliders.push({min:new T(_-1.4*P,A,E-1.4*P),max:new T(_+1.4*P,A+7*P,E+1.4*P),kind:"tree"}),p++}c.count=p,h.count=p,c.instanceMatrix.needsUpdate=!0,h.instanceMatrix.needsUpdate=!0,h.instanceColor&&(h.instanceColor.needsUpdate=!0),this.scene.add(c,h)}buildGrass(t,e){if(this.theme.treeShape==="cactus")return;const i=t==="high"?900:400,n=this.track(new An(.05,.28,3));n.translate(0,.14,0);const r=this.track(new we({color:16777215,flatShading:!0})),a=new lr(n,r,i),o=new Yt,l=new bt,c=new bt(this.theme.groundHigh);for(let h=0;h<i;h++){const u=(e()-.5)*Math.PI*1.2,d=10+e()*70,f=Math.sin(u)*d,m=-Math.cos(u)*d,v=.6+e()*.8;o.makeScale(v,v*(.7+e()*.6),v),o.setPosition(f,this.terrain.height(f,m)-.05,m),a.setMatrixAt(h,o),l.copy(c).offsetHSL((e()-.5)*.04,0,(e()-.4)*.1),a.setColorAt(h,l)}this.scene.add(a)}buildFlags(t,e){const i=t.flagSpacing??150,n=this.track(new ve(.05,.06,6,5));n.translate(0,3,0);const r=this.track(new we({color:14540253})),a=this.track(new we({color:16734751,side:Be,flatShading:!0}));let o=1;for(let l=60;l<=this.maxDist+40;l+=i){const c=o*(16+e()*10);o=-o;const h=-l,u=this.terrain.height(c,h),d=new st(n,r);d.position.set(c,u,h);const f=this.track(new kn(2.4,1.3,8,3));f.translate(1.2,0,0);const m=new st(f,a);m.position.set(c,u+5.3,h),this.scene.add(d,m),this.flags.push({pole:d,cloth:m,base:new Float32Array(f.attributes.position.array),dist:l,x:c,phase:e()*10,dir:0,speed:0}),this.colliders.push({min:new T(c-.08,u,h-.08),max:new T(c+.08,u+6,h+.08),kind:"fence"})}}updateFlags(t,e){for(const i of this.spinners)i.rotation.y=e*.9;for(const i of this.blinkers)i.visible=Math.sin(e*4)>0;for(const i of this.flags){const n=t.sample(i.dist,e);i.dir+=(n.dir-i.dir)*.08,i.speed+=(n.speed-i.speed)*.08;const r=i.dir*Math.PI/180;i.cloth.rotation.y=Math.atan2(Math.cos(r),Math.sin(r));const a=Math.min(1,i.speed/8);i.cloth.rotation.z=-(1-a)*1.35;const o=i.cloth.geometry.attributes.position,l=o.array,c=.08+a*.25,h=2+i.speed*.9;for(let u=0;u<l.length;u+=3){const d=i.base[u],f=i.base[u+1],m=d/2.4;l[u+2]=Math.sin(e*h+d*2.2+i.phase)*c*m+Math.sin(e*h*1.7+f*3)*c*.3*m,l[u+1]=f-m*m*.08*(1-a)}o.needsUpdate=!0,i.cloth.geometry.computeVertexNormals()}}dispose(){for(const t of this.disposables)t.dispose();this.disposables.length=0,this.scene.clear()}}function _c(s,t,e){let i=0,n=1;for(const r of["x","y","z"]){const a=t[r]-s[r];if(Math.abs(a)<1e-9){if(s[r]<e.min[r]||s[r]>e.max[r])return null}else{let o=(e.min[r]-s[r])/a,l=(e.max[r]-s[r])/a;if(o>l&&([o,l]=[l,o]),i=Math.max(i,o),n=Math.min(n,l),i>n)return null}}return i}const tr=new T(0,1,0);class pg{renderer;camera;vmCamera;fsm=new Q0("loading",tg);input;audio;save;hooks=null;world=null;worldKey="";mission=null;targets=[];mats=new lg;fx=null;viewModel;rifle;shooter=new rg(1.7);wind=null;env=null;difficulty=Rn.recruit;quality="high";yaw=0;pitch=0;lookSpeed=0;scoped=!1;scopeT=0;zoom=6;recoil=0;recoilV=0;shake=0;dopeOpen=!1;breathToggle=!1;missionTime=0;timeScale=1;hitStop=0;bullets=[];stats={shots:0,hits:0,kills:0,headshots:0,misses:0,longest:0,alerts:0,windDialOnHit:!1};endTimer=-1;ended=!1;hintIndex=0;fireBuffer=0;repeatTimers=new Map;restartHold=0;lastAnalysis=null;predicted=null;predictTimer=0;windText=null;windTimer=0;lastRange=500;camBullet=null;camHold=0;camPos=new T;camLook=new T;menuT=0;frameTimes=[];qualityChecked=!1;eye=new T(0,So+vt.camera.eyeHeight,0);accumulator=0;rafId=0;lastFrame=0;disposers=[];testSteady=!1;constructor(t,e,i,n){this.save=e,this.audio=i,this.input=n;const r=e.data.settings;this.quality=r.quality==="auto"?n.isTouch?"medium":"high":r.quality,this.renderer=new th({antialias:this.quality!=="low",logarithmicDepthBuffer:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(this.pixelRatio()),this.renderer.autoClear=!1,this.renderer.outputColorSpace=Ce,this.renderer.toneMapping=Ao,this.renderer.toneMappingExposure=1.1,t.appendChild(this.renderer.domElement),this.renderer.domElement.id="game-canvas",this.camera=new Pe(vt.camera.baseFov,1,.1,7e3),this.vmCamera=new Pe(vt.camera.baseFov,1,.01,10),this.rifle=new yo(br(r.weapon),r.suppressor),this.viewModel=new ug(this.renderer),this.viewModel.build(this.rifle.weapon,r.suppressor),this.fsm.onChange((o,l)=>this.hooks?.onStateChange(o,l));const a=()=>this.resize();window.addEventListener("resize",a),this.disposers.push(()=>window.removeEventListener("resize",a)),this.resize()}pixelRatio(){const t=this.quality==="high"?2:this.quality==="medium"?1.25:1;return Math.min(window.devicePixelRatio||1,t)}setQuality(t){this.quality=t,this.renderer.setPixelRatio(this.pixelRatio()),this.resize()}get qualityLevel(){return this.quality}resize(){const t=this.renderer.domElement.parentElement,e=t?.clientWidth||window.innerWidth,i=t?.clientHeight||window.innerHeight;this.renderer.setSize(e,i,!1),this.renderer.domElement.style.width="100%",this.renderer.domElement.style.height="100%",this.camera.aspect=e/Math.max(1,i),this.camera.updateProjectionMatrix(),this.vmCamera.aspect=this.camera.aspect,this.vmCamera.updateProjectionMatrix()}start(){this.lastFrame=performance.now();const t=e=>{this.rafId=requestAnimationFrame(t);const i=Math.min(vt.sim.maxFrameTime,Math.max(0,(e-this.lastFrame)/1e3));this.lastFrame=e,this.frame(i)};this.rafId=requestAnimationFrame(t)}frame(t){const e=this.fsm.is("playing");let i=!0;if(e){this.handleFrameInput(t);let n=this.timeScale;this.hitStop>0&&(this.hitStop-=t,n=0),this.accumulator+=t*n;const r=vt.sim.fixedStep;let a=0;for(;this.accumulator>=r&&a<30;)this.update(r),this.accumulator-=r,a++;a>=30&&(this.accumulator=0),i=a>0||!this.fsm.is("playing"),this.updateBulletCamScale(t),this.trackPerformance(t)}else this.fsm.is("menu","briefing","loading")&&(this.menuT+=t);this.input.endFrame(i),this.updateCamera(t),this.render()}trackPerformance(t){if(this.qualityChecked||this.save.data.settings.quality!=="auto")return;if(this.frameTimes.push(t),this.frameTimes.reduce((i,n)=>i+n,0)>=2.5&&this.frameTimes.length>=20){const i=[...this.frameTimes].sort((r,a)=>r-a),n=i[Math.floor(i.length/2)];this.qualityChecked=!0,n>.028&&this.quality!=="low"&&(this.setQuality(this.quality==="high"?"medium":"low"),this.hooks?.onToast("프레임이 낮아 그래픽 품질을 자동으로 낮췄습니다. (설정에서 변경 가능)"))}}render(){this.renderer.clear(),this.world&&this.renderer.render(this.world.scene,this.camera),this.fsm.is("playing","paused")&&this.scopeT<.9&&!this.camBullet&&(this.renderer.clearDepth(),this.renderer.render(this.viewModel.scene,this.vmCamera))}loadBackdrop(t){this.prepareWorld(t,7),this.mission=null;for(const e of this.targets)e.dispose();this.targets=[];for(const e of t.targets){const i=new gc(e,this.world.terrain,this.mats,1,1,.7);this.world.scene.add(i.group),this.targets.push(i)}this.wind=new lc(t.wind,7)}prepareWorld(t,e){const i=`${t.id}:${t.theme}:${t.timeOfDay}:${e}:${this.quality}`;if(i!==this.worldKey||!this.world){this.fx?.dispose(),this.world?.dispose(),this.world=new fg(t,this.quality,e),this.fx=new ng((r,a)=>this.world.terrain.height(r,a),this.world.theme.groundLow),this.world.scene.add(this.fx.group),this.worldKey=i;const n=this.world.theme;this.renderer.toneMappingExposure=n.exposure,this.viewModel.setLighting(n.sun,n.hemiSky,n.hemiGround,n.sunIntensity)}}loadMission(t){const e=this.save.data.settings;this.mission=t;const i=t.id.split("").reduce((a,o)=>a+o.charCodeAt(0)*31,17);this.prepareWorld(t,i);const n=t.weaponLock??e.weapon;(this.rifle.weapon.id!==n||this.rifle.suppressor!==e.suppressor)&&(this.rifle=new yo(br(n),e.suppressor),this.viewModel.build(this.rifle.weapon,e.suppressor)),this.difficulty=Rn[e.difficulty];for(const a of this.targets)a.dispose();this.targets=[];const r=a=>vt.targets.reactionMin+(Math.sin(i*13.7+a*7.1)+1)/2*(vt.targets.reactionMax-vt.targets.reactionMin);t.targets.forEach((a,o)=>{const l=new gc(a,this.world.terrain,this.mats,this.difficulty.escapeSpeedMul,this.difficulty.escapeDistanceMul,r(o));this.world.scene.add(l.group),this.targets.push(l)}),this.wind=new lc(t.wind,i),this.env={density:vo(t.atmosphere.altitude,t.atmosphere.temperature),soundSpeed:_o(t.atmosphere.temperature),gravity:vt.sim.gravity,windAt:(a,o,l,c,h)=>this.wind.windAt(a,o,l,c,h)},this.eye.set(0,this.world.terrain.height(0,0)+vt.camera.eyeHeight,0)}begin(){return!this.mission||!this.fsm.can("playing")?!1:(this.resetRun(),this.fsm.go("playing"),this.enterPlay(),!0)}restart(){!this.mission||!this.fsm.is("playing","paused","result")||(this.resetRun(),this.fsm.go("playing"),this.enterPlay())}enterPlay(){this.input.enabled=!0,this.input.requestPointerLock(),this.audio.stopMusic(),this.audio.setWind(0,!0),this.audio.resume(),this.showHint()}resetRun(){const t=this.mission;for(const i of this.targets)i.reset();this.fx?.clear(),this.rifle.reset(t.ammoTotal),this.shooter.reset(),this.bullets=[],this.camBullet=null,this.camHold=0,this.stats={shots:0,hits:0,kills:0,headshots:0,misses:0,longest:0,alerts:0,windDialOnHit:!1},this.missionTime=0,this.timeScale=1,this.hitStop=0,this.endTimer=-1,this.ended=!1,this.hintIndex=0,this.fireBuffer=0,this.restartHold=0,this.recoil=0,this.recoilV=0,this.shake=0,this.scoped=!1,this.scopeT=0,this.dopeOpen=!1,this.breathToggle=!1,this.lastAnalysis=null,this.predicted=null,this.accumulator=0,this.zoom=Math.max(this.rifle.weapon.zoomMin,Math.min(8,this.rifle.weapon.zoomMax));const e=t.targets[0];this.yaw=e?Math.atan2(-e.x,e.dist)*.6:0,this.pitch=-.004,this.lastRange=e?e.dist:500,this.hooks?.onAnalysis(null),this.hooks?.onRangefinder(null,!0)}pause(){this.fsm.is("playing")&&(this.fsm.go("paused"),this.input.enabled=!1,this.input.releaseAll(),this.input.exitPointerLock(),this.audio.setWind(0,!1))}resume(){this.fsm.is("paused")&&(this.fsm.go("playing"),this.input.enabled=!0,this.input.releaseAll(),this.input.requestPointerLock(),this.audio.setWind(0,!0),this.lastFrame=performance.now())}toMenu(){this.fsm.is("paused","result","briefing")&&(this.fsm.go("menu"),this.input.enabled=!1,this.input.exitPointerLock(),this.audio.setWind(0,!1),this.audio.startMusic(),this.camBullet=null)}toBriefing(){this.fsm.go("briefing")&&(this.input.enabled=!1,this.input.exitPointerLock(),this.audio.setWind(0,!1))}handleFrameInput(t){const e=this.save.data.settings,i=this.input;if(i.consumePressed("pause")){this.pause();return}if(this.camBullet&&(i.consumePressed("fire")||i.consumePressed("scope"))){this.endBulletCam();return}const n=this.currentFov()/vt.camera.baseFov,a=(i.isTouch?vt.input.touchSensitivity*e.touchSensitivity:vt.input.mouseSensitivity*e.mouseSensitivity)*(this.scopeT>.5?n*vt.input.scopedSensitivityScale*e.scopedSensitivity:1),o=i.lookX*a,l=i.lookY*a*(e.invertY?-1:1);this.camBullet||(this.yaw=Math.max(-vt.camera.yawLimit,Math.min(vt.camera.yawLimit,this.yaw-o)),this.pitch=Math.max(vt.camera.pitchMin,Math.min(vt.camera.pitchMax,this.pitch-l)));const c=Math.hypot(o,l)/Math.max(t,.001);if(this.lookSpeed+=(c-this.lookSpeed)*Math.min(1,t*20),i.isDown("restart")){if(this.restartHold+=t,this.restartHold>=vt.input.restartHoldTime){this.restartHold=0,this.restart();return}}else this.restartHold=0}repeat(t,e){const i=this.input;if(i.consumePressed(t))return this.repeatTimers.set(t,.35),1;if(!i.isDown(t))return this.repeatTimers.delete(t),0;let n=(this.repeatTimers.get(t)??.35)-e,r=0;for(;n<=0;)r++,n+=1/14;return this.repeatTimers.set(t,n),r}update(t){if(!this.mission||!this.wind)return;const i=this.input,n=this.save.data.settings;this.missionTime+=t,this.camBullet||(n.scopeMode==="toggle"?i.consumePressed("scope")&&(this.scoped=!this.scoped):(i.consumePressed("scope"),this.scoped=i.isDown("scope")));const r=this.scopeT;this.scopeT=Math.max(0,Math.min(1,this.scopeT+(this.scoped?t:-t)/vt.camera.scopeTransition)),r<1&&this.scopeT>=1&&this.trigger("scope");let a=i.zoomSteps;i.consumePressed("zoomIn")&&a++,i.consumePressed("zoomOut")&&a--,i.zoomSteps=0;const o=i.zoomFactor;if(i.zoomFactor=1,a!==0||o!==1){const v=this.rifle.weapon,g=this.zoom;this.zoom=Math.max(v.zoomMin,Math.min(v.zoomMax,this.zoom*Math.pow(vt.input.zoomStep,a)*o)),Math.abs(g-this.zoom)>.01&&(this.audio.play("zoom"),this.trigger("zoom"))}let l;n.breathMode==="toggle"?(i.consumePressed("breath")&&(this.breathToggle=!this.breathToggle),l=this.breathToggle):(i.consumePressed("breath"),l=i.isDown("breath"));const c=this.shooter.update(t,l,this.difficulty.breathHold,this.difficulty.swayMul*this.rifle.weapon.swayMul);c.holdStarted&&(this.audio.play("breathIn"),this.trigger("breath")),c.holdEnded&&(this.audio.play("breathOut"),this.breathToggle=!1),c.exhausted&&this.hooks?.onToast("숨이 찼습니다! 흔들림이 커집니다"),c.heartbeat&&(this.shooter.holding||this.shooter.exhausted)&&this.scopeT>.5&&this.audio.play("heartbeat",{volume:this.shooter.exhausted?1:.6});const h=this.repeat("elevUp",t)-this.repeat("elevDown",t);h!==0&&this.rifle.dialElev(h)&&(this.audio.play("turret"),this.trigger("turretElev"));const u=this.repeat("windRight",t)-this.repeat("windLeft",t);u!==0&&this.rifle.dialWind(u)&&(this.audio.play("turret",{pitch:.9}),this.trigger("turretWind")),i.consumePressed("turretReset")&&(this.rifle.resetTurrets(),this.audio.play("turret"),this.audio.play("turret",{delay:.05}),this.hooks?.onToast("터렛을 0으로 되돌렸습니다")),i.consumePressed("rangefinder")&&this.useRangefinder(),i.consumePressed("dope")&&(this.dopeOpen=!this.dopeOpen,this.dopeOpen&&this.trigger("dope"),this.audio.play("uiClick")),i.consumePressed("ammo")&&(this.rifle.switchAmmo()?(this.audio.play("reload",{weight:this.rifle.weapon.reloadTime/2.4}),this.hooks?.onToast(`탄종 변경: ${this.rifle.ammo.name}`),this.trigger("ammo")):this.rifle.weapon.ammo.length<2&&this.hooks?.onToast("이 총은 탄종이 하나뿐입니다"));const d=this.rifle.update(t);d==="boltStart"&&this.audio.play("bolt",{weight:this.rifle.weapon.boltTime}),d==="reloadStart"&&this.audio.play("reload",{weight:this.rifle.weapon.reloadTime/2.4}),this.fireBuffer>0&&(this.fireBuffer-=t);const f=i.consumePressed("fire");(f||this.fireBuffer>0&&this.rifle.canFire())&&(this.rifle.canFire()&&!this.camBullet?(this.fireBuffer=0,this.fire()):f&&(this.rifle.totalRounds<=0?(this.audio.play("dry"),this.hooks?.onToast("탄약이 없습니다")):this.fireBuffer=vt.input.fireBufferTime));const m=2*Math.PI/(this.rifle.weapon.recoilRecover*2.2);this.recoilV+=(-this.recoil*m*m-this.recoilV*2*m)*t,this.recoil+=this.recoilV*t,this.shake=Math.max(0,this.shake-t*3),this.updateBullets(t),this.updateTagging(t),this.checkBodies();for(const v of this.targets){const g=v.update(t);g.becameAlert&&(v.isCivilian?this.hooks?.onAlert("민간인이 놀라 달아납니다"):(this.stats.alerts++,this.audio.play("alert"),this.hooks?.onAlert(`${v.def.label??"표적"} 경계! 도주 중`))),g.escaped&&v.def.required&&!this.ended&&this.fail(`${v.def.label??"표적"}이(가) 엄폐물 뒤로 탈출했습니다.`,"첫 발 이후 나머지 표적은 약 2~3초 뒤 도주합니다. 도주 거리가 긴 표적을 나중에 쏘세요.")}this.world?.updateFlags(this.wind,this.missionTime),this.fx?.update(t),this.audio.setWind(this.wind.sample(0,this.missionTime).speed,!0),this.predictTimer-=t,this.predictTimer<=0&&(this.predictTimer=vt.ballisticsAssist.predictInterval,this.updatePredicted()),this.windTimer-=t,this.windTimer<=0&&(this.windTimer=.25,this.updateWindText()),this.checkEnd(t)}updateTagging(t){if(this.scopeT<.9||this.camBullet){for(const a of this.targets)a.observe=Math.max(0,a.observe-t*2);return}const e=this.losQuaternion(new Ze),i=new T(0,0,-1).applyQuaternion(e),n=new T,r=vt.targets;for(const a of this.targets){if(!a.isPerson||a.tagged||!a.active||a.isDown)continue;n.copy(a.position),n.y+=1.2,n.sub(this.eye).normalize().angleTo(i)*1e3<r.tagObserveMil?(a.observe+=t,a.observe>=r.tagObserveTime&&this.tag(a)):a.observe=Math.max(0,a.observe-t)}}tag(t){t.tagged||(t.tagged=!0,this.audio.play("tag",{pitch:t.isCivilian?.8:t.role==="hvt"?1.25:1}),this.hooks?.onTag({label:t.def.label??uc[t.role??"guard"],role:t.role,distance:t.position.distanceTo(this.eye)}),this.trigger("tag"))}checkBodies(){const t=vt.targets.bodyDiscoveryRadius;for(const e of this.targets)if(!(!e.isPerson||!e.isDown))for(const i of this.targets)i===e||!i.isPerson||!i.active||i.alerted||i.isDown||i.position.distanceTo(e.position)<t&&!i.alertPending&&(i.alert(vt.targets.bodyDiscoveryDelay),i.isCivilian||this.hooks?.onAlert(`${i.def.label??"경비"}이(가) 시신을 발견했습니다!`))}checkEnd(t){const e=this.mission;if(this.ended||e.isRange)return;const i=this.targets.filter(r=>r.def.required);if(i.length>0&&i.every(r=>r.done)){this.endTimer<0&&(this.endTimer=1.4),this.camBullet||(this.endTimer-=t),this.endTimer<=0&&this.finish(!0);return}if(e.timeLimit>0&&this.missionTime>e.timeLimit){this.fail("제한 시간이 끝났습니다.","표적이 노출되는 순간을 미리 계산해 두고, 보정은 노출 전에 끝내세요.");return}this.rifle.totalRounds<=0&&this.bullets.length===0&&!this.rifle.busy&&this.fail("탄약을 모두 썼습니다.",this.lastAnalysis?.tip??"탄도표로 보정량을 계산한 뒤 쏘세요.")}trigger(t){const e=this.mission?.hints;if(!e||!this.save.data.settings.showHints)return;const i=e[this.hintIndex];i&&i.until===t&&(this.hintIndex++,this.audio.play("hint"),this.showHint())}showHint(){const t=this.mission?.hints;if(!t||!this.save.data.settings.showHints){this.hooks?.onHint(null);return}const e=t[this.hintIndex];if(!e){this.hooks?.onHint(null);return}const i=this.input.isTouch&&e.touchText?e.touchText:e.text;this.hooks?.onHint(i.replace(/\{(\w+)\}/g,(n,r)=>`[${this.input.keyLabel(r)}]`))}losQuaternion(t){const e=this.testSteady?{x:0,y:0}:this.shooter.offset,i=.001,n=.35+.65*this.scopeT,r=new We(this.pitch+(e.y*n+this.recoil)*i+Math.sin(this.missionTime*70)*this.shake*.004,this.yaw-e.x*n*i,0,"YXZ");return t.setFromEuler(r)}fire(){const t=this.rifle.weapon,e=this.rifle.ammo,i=this.losQuaternion(new Ze),n=new T(0,0,-1).applyQuaternion(i),r=new T().crossVectors(n,tr).normalize(),a=new T().crossVectors(r,n),o={f:n,r,u:a},l=this.testSteady,c=l?0:Math.min(vt.shooter.triggerJerkMax,this.lookSpeed*vt.shooter.triggerJerkPerRadPerSec),h=Math.random()*Math.PI*2,u=l?0:e.dispersionMoa*.2909/2*Math.sqrt(Math.random()),d=Math.random()*Math.PI*2,f=Math.sin(h)*c+Math.sin(d)*u,m=Math.cos(h)*c+Math.cos(d)*u,v=Mo(this.eye,o,t.sightHeight),g=xo(o,this.rifle.zeroAngle+(this.rifle.elevMil+f)/1e3,(this.rifle.windMil+m)/1e3),p=Tr(this.rifle.params(),v,g);p.t=0;const M=this.buildRecord(n,f,m);this.stats.shots++,this.save.data.progress.stats.shots++,this.rifle.fire(),this.shooter.onShot();const x=this.rifle.suppressor,_=t.recoilKick*(x?ch.recoilMul:1);this.recoilV+=_*9;const C=!x&&!e.subsonic;this.viewModel.kick(_*.35,C&&!this.save.data.settings.reduceFlashes),this.save.data.settings.screenShake&&(this.shake=Math.min(1,_/14)),this.audio.play(x?"shotSup":e.subsonic?"shotSub":"shot",{weight:t.loudness,volume:x&&e.subsonic?.6:1}),C&&this.hooks?.onMuzzleFlash(),this.trigger("fire");const E=vt.targets.hearRadius,A=e.subsonic?x?E.subSuppressed:E.sub:x?E.stdSuppressed:E.std,P=x&&!e.subsonic?vt.targets.suppressedReactionMul:1;for(const y of this.targets){if(!y.isPerson||!y.active)continue;const L=y.position.distanceTo(this.eye);L>A||y.alert(L/vt.targets.speedOfSound+y.reaction*P/t.loudness)}const b={proj:p,tracer:this.fx.tracers.start(),prev:new T(v.x,v.y,v.z),record:M,subsonic:e.subsonic,mass:e.mass,cam:!1,done:!1,hitTarget:!1,doneTimer:0};this.bullets.push(b),this.shouldBulletCam(p)&&(b.cam=!0,this.camBullet=b,this.camHold=0,this.scoped=!1)}buildRecord(t,e,i){if(!this.env)return null;let n=null;const r=new T;for(const g of this.targets){if(!g.active||g.done)continue;const p=g.isPerson?[new T(0,1.66,0),new T(0,1.3,0)]:[new T(0,.7+(g.def.h??.6)/2,0)];for(const M of p){const x=M.add(g.position);r.subVectors(x,this.eye).normalize();const _=r.angleTo(t);_<.03&&(!n||_<n.ang)&&(n={t:g,point:x.clone(),ang:_})}}if(!n)return null;const o={params:this.rifle.params(),env:this.envAt(this.missionTime),sightHeight:this.rifle.weapon.sightHeight,zeroAngle:this.rifle.zeroAngle,eye:this.eye,target:n.point},l=n.t.velocity.clone(),c=Ma({...o,targetVel:l}),h=l.lengthSq()>.05,u=h?Ma({...o,targetVel:{x:0,y:0,z:0}}):c,d=uh(this.eye,n.point),f=Math.asin(Math.max(-1,Math.min(1,t.x*d.u.x+t.y*d.u.y+t.z*d.u.z)))*1e3,m=Math.asin(Math.max(-1,Math.min(1,t.x*d.r.x+t.y*d.r.y+t.z*d.r.z)))*1e3,v=.35+.65*this.scopeT;return{losOffsetV:f+e,losOffsetH:m+i,swayV:this.shooter.offset.y*v+e,swayH:this.shooter.offset.x*v+i,elevDial:this.rifle.elevMil,windDial:this.rifle.windMil,needed:c,neededStatic:u,targetLabel:n.t.def.label??"표적",moving:h}}envAt(t){const e=this.env;return{...e,windAt:(i,n,r,a,o)=>e.windAt(i,n,r,t+a,o)}}shouldBulletCam(t){const e=this.save.data.settings.bulletCam;if(e==="off"||!this.mission||this.mission.isRange)return!1;const i=this.predictHit(t);if(!i||!i.target.isPerson||i.target.isCivilian||i.zone==="arm"||i.zone==="leg"||i.target.position.distanceTo(this.eye)<250)return!1;if(e==="always")return!0;const n=this.targets.filter(r=>r.def.required&&!r.done);return n.length===1&&n[0]===i.target}predictHit(t){const e={...t,pos:{...t.pos},vel:{...t.vel},right:{...t.right}},i=this.envAt(this.missionTime),n=new T,r=new T,a=this.targets.map(c=>c.position.clone());let o=null;const l=.002;for(;e.t<vt.sim.bulletMaxLife&&(n.set(e.pos.x,e.pos.y,e.pos.z),us(e,i,l),r.set(e.pos.x,e.pos.y,e.pos.z),!(r.y<this.world.terrain.height(r.x,r.z)));){for(let c=0;c<this.targets.length;c++){const h=this.targets[c];h.position.copy(a[c]).addScaledVector(h.velocity,e.t),h.group.position.copy(h.position)}for(const c of this.targets){const h=c.intersect(n,r);if(h){o=h;break}}if(o||-r.z>this.world.maxDist+200)break}return this.targets.forEach((c,h)=>{c.position.copy(a[h]),c.group.position.copy(a[h])}),o}updateBullets(t){const e=vt.sim.bulletSubStep,i=Math.max(1,Math.round(t/e)),n=t/i,r=new T,a=this.env,o=this.world.terrain,l=this.world.colliders;for(const c of this.bullets){if(c.done){c.doneTimer+=t;continue}for(let h=0;h<i&&!c.done;h++){const u=this.missionTime-t+h*n-c.proj.t;us(c.proj,{...a,windAt:(d,f,m,v,g)=>a.windAt(d,f,m,u+v,g)},n),r.set(c.proj.pos.x,c.proj.pos.y,c.proj.pos.z),this.collide(c,c.prev,r,o,l),c.prev.copy(r),(c.proj.t>vt.sim.bulletMaxLife||r.y<-100||-r.z>4e3)&&this.bulletMissed(c,null)}this.fx.tracers.push(c.tracer,c.prev,this.eye)}this.bullets=this.bullets.filter(c=>!c.done||c===this.camBullet&&c.doneTimer<1)}collide(t,e,i,n,r){let a=null;for(const g of this.targets){const p=g.intersect(e,i);p&&(!a||p.t<a.t)&&(a=p)}let o=null;const l=Math.min(e.x,i.x)-1,c=Math.max(e.x,i.x)+1,h=Math.min(e.z,i.z)-1,u=Math.max(e.z,i.z)+1;for(const g of r){if(g.max.x<l||g.min.x>c||g.max.z<h||g.min.z>u)continue;const p=_c(e,i,g);p!==null&&(o===null||p<o)&&(o=p)}let d=null;if(i.y<n.height(i.x,i.z)){let g=0,p=1;const M=new T;for(let x=0;x<12;x++){const _=(g+p)/2;M.lerpVectors(e,i,_),M.y<n.height(M.x,M.z)?p=_:g=_}d=p}const f=a?a.t:1/0,m=o??1/0,v=d??1/0;if(!(f===1/0&&m===1/0&&v===1/0))if(f<=m&&f<=v&&a)this.bulletHitTarget(t,a);else{const g=Math.min(m,v),p=new T().lerpVectors(e,i,g);this.bulletMissed(t,p)}}finishBullet(t,e){t.done=!0,t.proj.pos.x=e.x,t.proj.pos.y=e.y,t.proj.pos.z=e.z,t.prev.copy(e),this.fx.tracers.push(t.tracer,e,this.eye),this.fx.tracers.end(t.tracer)}bulletHitTarget(t,e){const i=e.target;this.finishBullet(t,e.point),t.hitTarget=!0;const n=Math.hypot(e.point.x-this.eye.x,e.point.z-this.eye.z),r=ds(t.proj),a=.5*t.mass*r*r,o=new T(t.proj.vel.x,t.proj.vel.y,t.proj.vel.z),l=i.applyHit(e,o.clone().multiplyScalar(t.mass*140)),c=n/vt.targets.speedOfSound,h=Math.max(-1,Math.min(1,(e.point.x-this.eye.x)/Math.max(50,n)*3));this.stats.hits++,this.save.data.progress.stats.hits++,this.stats.longest=Math.max(this.stats.longest,n),this.save.data.progress.stats.longestHit=Math.max(this.save.data.progress.stats.longestHit,Math.round(n)),(this.rifle.windMil!==0||t.record&&t.record.windDial!==0)&&(this.stats.windDialOnHit=!0);const u=vt.feedback;if(!i.isPerson)this.fx.impactSteel(e.point,n),this.audio.play("impactSteel",{delay:c,volume:Math.max(.35,1-n/2e3),pan:h}),this.hooks?.onHit({kind:"plate",title:"명중!",detail:`${i.def.label??"강철판"} · ${Math.round(n)}m · 비행 ${t.proj.t.toFixed(2)}초`}),t.cam||(this.hitStop=u.hitStop);else if(l){const d=e.zone==="head";if(this.fx.personDown(e.point,i.position,o.clone().normalize(),n),this.audio.play("botHit",{delay:c,volume:Math.max(.4,1-n/2e3),pan:h}),i.isCivilian){this.hooks?.onHit({kind:"civilian",title:"민간인 사살",detail:`${i.def.label??"민간인"} · 작전이 중단됩니다`}),this.fail("민간인을 사살했습니다. 작전이 중단됐습니다.","쏘기 전에 스코프로 1초 관측해 식별 태그를 확인하세요. 브리핑의 표적 특징(옷 색)과 비교하세요."),this.trigger("hit");return}this.stats.kills++,this.save.data.progress.stats.kills++,d&&(this.stats.headshots++,this.save.data.progress.stats.headshots++),d&&this.audio.play("headshot",{delay:.05});const f=i.role==="hvt";this.hooks?.onHit({kind:d?"headshot":"kill",title:d?"헤드샷":f?"표적 제거":"제거",detail:`${i.def.label??"표적"} · ${dc[e.zone]} · ${Math.round(n)}m · ${Math.round(a)}J`}),t.cam||(this.hitStop=d?u.headshotHitStop:u.hitStop);for(const m of this.targets)m===i||!m.isPerson||!m.active||m.position.distanceTo(i.position)<vt.targets.witnessRadius&&m.alert(vt.targets.witnessDelay)}else this.fx.impactSteel(e.point,n),this.audio.play("botHit",{delay:c,volume:.5,pan:h,pitch:1.3}),this.hooks?.onHit({kind:"wound",title:"부상 – 무력화 실패",detail:`${dc[e.zone]} 명중. 몸통이나 머리를 노리세요.`});t.subsonic&&this.alertNear(e.point),this.trigger("hit")}bulletMissed(t,e){if(e){this.finishBullet(t,e);const i=Math.hypot(e.x-this.eye.x,e.z-this.eye.z);this.fx.impactGround(e,i),this.audio.play("impactGround",{delay:i/vt.targets.speedOfSound,volume:Math.max(.2,.8-i/2500)}),t.subsonic&&this.alertNear(e)}else t.done=!0,this.fx.tracers.end(t.tracer);this.stats.misses++,t.record?(this.lastAnalysis=ig(t.record),this.hooks?.onAnalysis(this.lastAnalysis)):(this.hooks?.onAnalysis(null),this.hooks?.onHit({kind:"wound",title:"빗나감",detail:"조준선 근처에 표적이 없었습니다."}))}alertNear(t){for(const e of this.targets){if(!e.isPerson||!e.active)continue;e.position.distanceTo(t)<vt.targets.subsonicImpactHearRadius&&e.alert(e.reaction)}}updateBulletCamScale(t){const e=this.camBullet;if(!e){this.timeScale=1;return}if(e.done){this.camHold+=t,this.timeScale=.25,this.camHold>1&&this.endBulletCam();return}const i=vt.feedback,n=this.estimateRemaining(e);this.timeScale=n<i.bulletCamFinalWindow?i.bulletCamFinalSlow:Math.max(.15,Math.min(1,1.6/i.bulletCamDuration))}estimateRemaining(t){let e=1/0;const i=ds(t.proj);for(const n of this.targets){if(!n.active||n.done)continue;const r=Math.hypot(n.position.x-t.proj.pos.x,n.position.z-t.proj.pos.z);e=Math.min(e,r/i)}return e}endBulletCam(){this.camBullet=null,this.timeScale=1,this.camHold=0}rangefinderAllowed(){return!!this.mission&&this.difficulty.rangefinder&&!this.mission.noRangefinder}useRangefinder(){if(this.trigger("rangefinder"),!this.rangefinderAllowed()){this.audio.play("dry"),this.hooks?.onRangefinder(null,!1);return}const t=this.losQuaternion(new Ze),e=new T(0,0,-1).applyQuaternion(t),i=this.raycast(this.eye,e,2500);if(this.audio.play("beep"),this.hooks?.onRangefinder(i,!0),i!==null){this.lastRange=i;const n=this.eye.clone().addScaledVector(e,i+.5);for(const r of this.targets)r.isPerson&&!r.tagged&&r.intersect(this.eye,n)&&this.tag(r)}}raycast(t,e,i){const n=t.clone().addScaledVector(e,i);let r=1/0;for(const c of this.targets){const h=c.intersect(t,n);h&&(r=Math.min(r,h.t*i))}for(const c of this.world.colliders){const h=_c(t,n,c);h!==null&&(r=Math.min(r,h*i))}const a=this.world.terrain,o=new T;let l=0;for(let c=2;c<=Math.min(i,r);c+=c<300?2:4){if(o.copy(t).addScaledVector(e,c),o.y<a.height(o.x,o.z)){let h=l,u=c;for(let d=0;d<10;d++){const f=(h+u)/2;o.copy(t).addScaledVector(e,f),o.y<a.height(o.x,o.z)?u=f:h=f}r=Math.min(r,u);break}l=c}return r===1/0?null:r}updatePredicted(){if(!this.difficulty.predictedImpact||this.scopeT<.5||!this.env){this.predicted=null;return}const t=this.losQuaternion(new Ze),e=new T(0,0,-1).applyQuaternion(t),i=this.raycast(this.eye,e,2500)??this.lastRange,n=new T().crossVectors(e,tr).normalize(),r=new T().crossVectors(n,e),a={f:e,r:n,u:r},o=Mo(this.eye,a,this.rifle.weapon.sightHeight),l=Tr(this.rifle.params(),o,xo(a,this.rifle.zeroAngle+this.rifle.elevMil/1e3,this.rifle.windMil/1e3)),c=this.envAt(this.missionTime),h=f=>(f.x-this.eye.x)*e.x+(f.y-this.eye.y)*e.y+(f.z-this.eye.z)*e.z;for(;l.t<6&&h(l.pos)<i;)us(l,c,.003);const u=new T(l.pos.x-this.eye.x,l.pos.y-this.eye.y,l.pos.z-this.eye.z),d=Math.max(1,u.dot(e));this.predicted={x:u.dot(n)/d*1e3,y:u.dot(r)/d*1e3,dist:i}}updateWindText(){const t=this.difficulty.windMeter;if(!this.wind||t==="none"){this.windText=null;return}if(t==="local"){const c=this.wind.sample(0,this.missionTime);this.windText=`사수 위치 ${c.speed.toFixed(1)}m/s · ${cr(c.dir)}시 방향`;return}const e=Math.max(100,Math.min(1500,this.lastRange)),i={...this.rifle.params(),stability:0},n=this.envAt(this.missionTime),[r]=ms(i,n,this.rifle.weapon.sightHeight,this.rifle.zeroAngle,0,[e],.002),a=ms(i,{...n,windAt:(c,h,u,d,f)=>(f.x=1,f.y=0,f.z=0,f)},this.rifle.weapon.sightHeight,this.rifle.zeroAngle,0,[e],.002)[0];if(!r||!a||Math.abs(a.lateral)<1e-6)return;const o=r.lateral/a.lateral,l=Math.abs(o)<.15?"":o>0?" →":" ←";this.windText=`${Math.round(e)}m 유효 횡풍 ${Math.abs(o).toFixed(1)}m/s${l}`}currentFov(){return this.scopeT<.5?vt.camera.baseFov:vt.camera.scopeBaseFov/this.zoom}updateCamera(t){const e=this.camera;if(this.fsm.is("menu","briefing","loading")||!this.mission){const a=this.menuT*.04,o=this.world?this.world.terrain.height(0,0)+1.6:8;e.position.set(Math.sin(a)*3,o,2),e.fov=40,e.lookAt(Math.sin(a*.7)*120,o-6,-500),e.updateProjectionMatrix();return}if(this.camBullet){const a=this.camBullet,o=new T(a.proj.pos.x,a.proj.pos.y,a.proj.pos.z),l=new T(a.proj.vel.x,a.proj.vel.y,a.proj.vel.z).normalize();if(a.done){const c=new T().crossVectors(l,tr).normalize(),h=this.camHold*.8,u=o.clone().addScaledVector(l,-3.5).addScaledVector(c,1.5+Math.sin(h)).add(new T(0,.6,0));this.camPos.lerp(u,Math.min(1,t*3)),this.camLook.lerp(o,Math.min(1,t*5))}else{const c=new T().crossVectors(l,tr).normalize();this.camPos.copy(o).addScaledVector(l,-.9).addScaledVector(c,.25).add(new T(0,.12,0)),this.camLook.copy(o).addScaledVector(l,6)}e.position.copy(this.camPos),e.fov=50,e.lookAt(this.camLook),e.updateProjectionMatrix();return}e.position.copy(this.eye),this.losQuaternion(e.quaternion);const i=this.currentFov();Math.abs(e.fov-i)>1e-4&&(e.fov=i,e.updateProjectionMatrix());const n=this.rifle.boltTimer>0?1-this.rifle.boltTimer/this.rifle.weapon.boltTime:-1,r=this.rifle.reloadTimer>0?1-this.rifle.reloadTimer/this.rifle.weapon.reloadTime:-1;this.fsm.is("playing")&&this.viewModel.update(t,this.scopeT,n,r,this.rifle.elevMil,this.rifle.windMil,this.shooter.offset)}fail(t,e){this.ended||(this.ended=!0,this.audio.play("fail"),this.endWith(!1,t,e))}finish(t){this.ended||(this.ended=!0,this.audio.play("success"),this.endWith(t))}evalObjective(t,e){if(!e)return!1;const i=this.stats;switch(t.type){case"clear":return e;case"accuracy":return i.misses===0;case"time":return this.missionTime<=(t.value??0);case"headshots":return i.headshots>=(t.value??1);case"noAlert":return i.alerts===0;case"holdOnly":return!i.windDialOnHit;case"maxShots":return i.shots<=(t.value??1)}}endWith(t,e,i){const n=this.mission,r=this.save.data.progress,a=r.missions[n.id]??{stars:[!1,!1,!1],bestTime:null,cleared:!1},o=[...a.stars],l=n.objectives.map(M=>({label:M.label,done:this.evalObjective(M,t)})),c=l.map(M=>M.done),h=this.save.totalStars();let u=!1;if(!n.id.startsWith("daily-")){const M=a.stars.map((x,_)=>x||c[_]);t&&(a.bestTime===null||this.missionTime<a.bestTime)&&(u=a.bestTime!==null,a.bestTime=this.missionTime),r.missions[n.id]={stars:M,bestTime:a.bestTime,cleared:a.cleared||t}}let d,f;if(n.id.startsWith("daily-")){const M=vt.scoring;d=0,t&&(d+=this.stats.kills*M.killBase+Math.round(this.stats.longest*M.perMeter)*this.stats.kills,d+=this.stats.headshots*M.headshotBonus,d+=Math.round(Math.max(0,M.timeBonusWindow-this.missionTime)*M.timeBonusPerSec)),d-=this.stats.misses*M.missPenalty,d=Math.max(0,d);const x=n.id.slice(6),_=r.daily[x]??0;f=Math.max(_,d),r.daily[x]=f}r.stats.playSeconds+=Math.round(this.missionTime),r.firstRun=!1;const m=this.save.totalStars(),v=[],g=vt.unlocks;h<g.k65&&m>=g.k65&&v.push("새 총기 해금: K-6.5"),h<g.expert&&m>=g.expert&&v.push("새 난이도 해금: 현실"),h<g.l338&&m>=g.l338&&v.push("새 총기 해금: L-338"),this.save.save(),this.input.enabled=!1,this.input.releaseAll(),this.input.exitPointerLock(),this.audio.setWind(0,!1),this.camBullet=null,this.timeScale=1;const p={mission:n,success:t,failReason:e,tip:i??this.lastAnalysis?.tip,time:this.missionTime,shots:this.stats.shots,hits:this.stats.hits,kills:this.stats.kills,headshots:this.stats.headshots,longest:this.stats.longest,objectives:l,stars:c,prevStars:o,newBestTime:u,score:d,bestScore:f,unlocked:v,lastAnalysis:this.lastAnalysis};this.fsm.go("result"),this.hooks?.onMissionEnd(p)}abandon(){this.save.save(),this.toMenu()}hud(){const t=this.mission,e=this.rifle,i=this.targets.filter(o=>o.def.required);let n="";e.reloadTimer>0?n="재장전 중":e.boltTimer>0?n="볼트 조작 중":e.totalRounds<=0&&!e.chambered?n="탄약 없음":e.chambered&&(n="장전됨");const r=this.renderer.domElement.clientHeight||720,a=this.camera.fov*Math.PI/180;return{missionName:t?.name??"",time:this.missionTime,timeLimit:t?.timeLimit??0,targetsLeft:i.filter(o=>!o.done).length,targetsTotal:i.length,shots:this.stats.shots,inMag:e.inMag,reserve:e.reserve,ammoName:e.ammo.name,subsonic:e.ammo.subsonic,status:n,elev:e.elevMil,wind:e.windMil,zoom:this.zoom,zoomMin:e.weapon.zoomMin,zoomMax:e.weapon.zoomMax,breath:this.shooter.breath,holding:this.shooter.holding,exhausted:this.shooter.exhausted,heartRate:this.shooter.heartRate,windText:this.windText,scopeT:this.camBullet?0:this.scopeT,pxPerMil:r/2/Math.tan(a/2)*.001,predicted:this.predicted,restartProgress:this.restartHold/vt.input.restartHoldTime,busy:e.busy,dopeOpen:this.dopeOpen,bulletCam:!!this.camBullet,isRange:!!t?.isRange,rangefinderAllowed:this.rangefinderAllowed(),canSwitchAmmo:e.weapon.ammo.length>1,weaponName:e.weapon.name,suppressor:e.suppressor,heading:(-this.yaw*180/Math.PI+360)%360,bearings:this.targets.filter(o=>o.isPerson&&o.tagged&&o.state!=="escaped").map(o=>({bearing:(Math.atan2(o.position.x-this.eye.x,-(o.position.z-this.eye.z))*180/Math.PI+360)%360,role:o.role,down:o.isDown})),windNow:this.wind&&this.difficulty.windMeter!=="none"?(()=>{const o=this.wind.sample(0,this.missionTime);return{speed:o.speed,fromDeg:(o.dir+180)%360}})():null,pitchDeg:this.pitch*180/Math.PI}}markers(){if(!this.fsm.is("playing")||this.scopeT>.3||this.camBullet)return[];const t=[],e=this.renderer.domElement,i=new T,n=this.difficulty.id==="expert",r=this.rangefinderAllowed();for(const a of this.targets){if(!a.isPerson&&(a.done||n)||a.isPerson&&(a.state==="escaped"||a.isDown)||!a.isPerson&&!a.def.required&&!this.mission?.isRange)continue;const o=a.isPerson&&!a.tagged&&a.def.required&&this.difficulty.id==="recruit";if(a.isPerson&&!a.tagged&&!o||(i.copy(a.position),i.y+=a.isPerson?2.25:1.6+(a.def.h??.6),i.project(this.camera),i.z>1||Math.abs(i.x)>1.1||Math.abs(i.y)>1.1))continue;const l=`${Math.round(a.position.distanceTo(this.eye))}m`,c=a.isPerson?o?"unknown":a.role:"plate",h=c==="plate"?"":c==="unknown"?"?":c==="civilian"?"민간인":a.def.label??uc[c];t.push({x:(i.x+1)/2*e.clientWidth,y:(1-i.y)/2*e.clientHeight,label:[h,r?l:""].filter(Boolean).join(" · "),role:c,alert:a.alerted})}return t}closeDope(){this.dopeOpen=!1}dopeRows(){const t=this.mission;return t?this.rifle.dope(t.atmosphere.altitude,t.atmosphere.temperature,Math.max(600,Math.ceil((this.world?.maxDist??800)/100)*100+200)):[]}testAimAt(t){const e=this.targets[t];if(!e||!this.env)return!1;const i=e.position.clone();i.y+=e.isPerson?1.3:.7+(e.def.h??.6)/2;const n=Ma({params:this.rifle.params(),env:this.envAt(this.missionTime),sightHeight:this.rifle.weapon.sightHeight,zeroAngle:this.rifle.zeroAngle,eye:this.eye,target:i,targetVel:e.velocity}),r=i.clone().sub(this.eye);return this.yaw=Math.atan2(-r.x,-r.z),this.pitch=Math.atan2(r.y,Math.hypot(r.x,r.z)),this.rifle.elevMil=Math.round(n.elevMil*1e3)/1e3,this.rifle.windMil=Math.round(n.windMil*1e3)/1e3,this.testSteady=!0,this.shooter.offset.x=0,this.shooter.offset.y=0,!0}debugStats(){return{state:this.fsm.state,bullets:this.bullets.length,fx:this.fx?.stats()??null,sceneChildren:this.world?.scene.children.length??0,targets:this.targets.map(t=>({id:t.def.id,done:t.done,state:t.state})),stats:{...this.stats},time:this.missionTime,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures}}dispose(){cancelAnimationFrame(this.rafId);for(const t of this.disposers)t();for(const t of this.targets)t.dispose();this.fx?.dispose(),this.world?.dispose(),this.viewModel.dispose(),this.mats.dispose(),this.renderer.dispose()}}class xc{renderer;scene=new Cr;camera;pivot=new oe;raf=0;t=0;last=0;disposeObj=null;canvas;env=null;alive=!0;spin;constructor(t,e){this.canvas=t,this.spin=e.spin??.35,this.renderer=new th({canvas:t,antialias:!0,alpha:!0,powerPreference:"low-power"}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),this.renderer.outputColorSpace=Ce,this.renderer.toneMapping=Ao,this.renderer.toneMappingExposure=1.15,this.camera=new Pe(e.fov??30,1,.01,50),this.camera.position.set(0,e.height,e.distance),this.camera.lookAt(0,e.lookY,0),this.scene.add(this.pivot),this.scene.add(new Wo(14674160,2764328,1.1));const i=new yr(16770760,2.4);i.position.set(2,3,2);const n=new yr(10471679,1.6);n.position.set(-2,1.5,-2.5),this.scene.add(i,n);try{const a=new pr(this.renderer);this.env=a.fromScene(new ph,.04).texture,this.scene.environment=this.env,this.scene.environmentIntensity=.6,a.dispose()}catch{}this.resize(),this.last=performance.now();const r=a=>{if(!this.alive)return;this.raf=requestAnimationFrame(r);const o=Math.min(.1,(a-this.last)/1e3);this.last=a,this.t+=o,this.pivot.rotation.y=this.t*this.spin+.6,this.resize(),this.renderer.render(this.scene,this.camera)};this.raf=requestAnimationFrame(r)}resize(){const t=this.canvas.clientWidth||300,e=this.canvas.clientHeight||200;(this.canvas.width!==Math.round(t*this.renderer.getPixelRatio())||this.canvas.height!==Math.round(e*this.renderer.getPixelRatio()))&&(this.renderer.setSize(t,e,!1),this.camera.aspect=t/e,this.camera.updateProjectionMatrix())}show(t,e){this.disposeObj?.(),this.pivot.clear(),this.pivot.add(t),this.disposeObj=e??null}dispose(){this.alive=!1,cancelAnimationFrame(this.raf),this.disposeObj?.(),this.env?.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss()}}const be={bg:"#0c1114",grid:"rgba(160, 190, 170, 0.08)",ring:"rgba(200, 220, 200, 0.22)",text:"rgba(214, 226, 218, 0.75)",amber:"#e8a33d",red:"#ff5a4a",blue:"#6cb4ff",prop:"rgba(170, 180, 175, 0.5)",wind:"#7fd3c8"};function Ta(s,t){const e=Math.min(window.devicePixelRatio||1,2),i=s.clientWidth||300,n=s.clientHeight||300;s.width=Math.round(i*e),s.height=Math.round(n*e);const r=s.getContext("2d");if(!r)return;r.setTransform(e,0,0,e,0,0),r.fillStyle=be.bg,r.fillRect(0,0,i,n),r.strokeStyle=be.grid,r.lineWidth=1;for(let m=0;m<i;m+=20)r.beginPath(),r.moveTo(m+.5,0),r.lineTo(m+.5,n),r.stroke();for(let m=0;m<n;m+=20)r.beginPath(),r.moveTo(0,m+.5),r.lineTo(i,m+.5),r.stroke();const a=Math.max(...t.targets.map(m=>m.dist))*1.12,o=n-26,l=(o-22)/a,c=i/2,h=(m,v)=>[c+m*l*2.2,o-v*l];r.fillStyle="rgba(232, 163, 61, 0.05)",r.beginPath(),r.moveTo(c,o),r.lineTo(c-i*.5,0),r.lineTo(c+i*.5,0),r.closePath(),r.fill(),r.font='600 10px "Share Tech Mono", ui-monospace, monospace',r.textAlign="left";const u=a>900?250:a>500?200:100;for(let m=u;m<a;m+=u){const v=m*l;r.strokeStyle=be.ring,r.setLineDash([3,4]),r.beginPath(),r.ellipse(c,o,v*2.2,v,0,Math.PI,Math.PI*2),r.stroke(),r.setLineDash([]),r.fillStyle=be.text,r.fillText(`${m}m`,c+4,o-v-3)}r.fillStyle=be.prop;for(const m of t.props){if(m.kind==="road"){const[x,_]=h(m.x-m.w/2,m.dist),[C]=h(m.x+m.w/2,m.dist);r.fillStyle="rgba(180, 160, 120, 0.25)",r.fillRect(x,_-2,C-x,4),r.fillStyle=be.prop;continue}const[v,g]=h(m.x,m.dist),p=Math.max(3,m.w*l*2.2),M=Math.max(3,m.d*l);r.fillRect(v-p/2,g-M/2,p,M)}t.wind.zones.forEach((m,v)=>{const g=t.wind.zones[v+1]?.from??a,p=Math.min(a*.95,(m.from+g)/2),[M,x]=h(-(i/2/(l*2.2))*.78,p),_=m.dir*Math.PI/180,C=8+m.speed*3,E=Math.sin(_)*C,A=Math.cos(_)*C;r.strokeStyle=be.wind,r.fillStyle=be.wind,r.lineWidth=2,r.beginPath(),r.moveTo(M-E/2,x+A/2),r.lineTo(M+E/2,x-A/2),r.stroke();const P=Math.atan2(-A,E);r.beginPath(),r.moveTo(M+E/2,x-A/2),r.lineTo(M+E/2-Math.cos(P-.5)*6,x-A/2-Math.sin(P-.5)*6),r.lineTo(M+E/2-Math.cos(P+.5)*6,x-A/2-Math.sin(P+.5)*6),r.fill(),r.font='600 10px "Share Tech Mono", ui-monospace, monospace',r.fillText(m.speed>0?`${m.speed.toFixed(1)}`:"0",M+10,x+4)});const d=t.category==="operation"||t.category==="contract";for(const m of t.targets){const[v,g]=h(m.x,m.dist);if(m.kind==="plate"){r.fillStyle="#e9ece6",r.beginPath(),r.arc(v,g,3.5,0,Math.PI*2),r.fill();continue}const p=m.role??"guard",M=p==="hvt"?be.red:p==="civilian"?be.blue:be.amber;d&&(r.strokeStyle=M,r.globalAlpha=.55,r.setLineDash([2,3]),r.beginPath(),r.arc(v+Math.sin(m.dist)*2,g+Math.cos(m.x)*2,7,0,Math.PI*2),r.stroke(),r.setLineDash([]),r.globalAlpha=1),r.fillStyle=M,r.beginPath(),p==="hvt"?(r.moveTo(v,g-5),r.lineTo(v+5,g),r.lineTo(v,g+5),r.lineTo(v-5,g),r.closePath()):r.arc(v,g,p==="civilian"?2.6:3,0,Math.PI*2),r.fill()}r.fillStyle="#d6e2da",r.beginPath(),r.moveTo(c,o-8),r.lineTo(c+6,o+4),r.lineTo(c-6,o+4),r.closePath(),r.fill(),r.fillStyle=be.text,r.textAlign="center",r.fillText("SNIPER",c,o+17),r.textAlign="right",[["◆ 핵심 표적",be.red],["● 경비",be.amber],["● 민간인",be.blue],["→ 바람 m/s",be.wind]].forEach(([m,v],g)=>{r.fillStyle=v,r.fillText(m,i-8,14+g*13)})}const mg={black:{line:"#0b0b0b",glow:"rgba(255,255,255,0.35)",text:"#0b0b0b"},red:{line:"#ff2a2a",glow:"rgba(0,0,0,0.5)",text:"#ff4a4a"},lime:{line:"#c8ff3a",glow:"rgba(0,0,0,0.55)",text:"#d8ff6a"},white:{line:"#ffffff",glow:"rgba(0,0,0,0.6)",text:"#ffffff"}};class gg{el;canvas;ctx;status;color="black";lastKey="";constructor(t){this.el=document.createElement("div"),this.el.className="scope",this.el.innerHTML='<canvas class="scope-reticle"></canvas><div class="scope-mask"></div><div class="scope-status"></div>',t.appendChild(this.el),this.canvas=this.el.querySelector("canvas"),this.ctx=this.canvas.getContext("2d"),this.status=this.el.querySelector(".scope-status")}setColor(t){this.color=t,this.lastKey=""}update(t){const e=t.scopeT,i=e>.5;if(this.el.style.display=e>.01?"block":"none",this.el.style.opacity=String(Math.min(1,Math.max(0,(e-.4)/.6))),!i)return;this.el.classList.toggle("busy",t.busy),this.status.textContent=t.status==="재장전 중"||t.status==="볼트 조작 중"?t.status:"";const n=Math.min(window.devicePixelRatio||1,2),r=this.el.clientWidth,a=this.el.clientHeight,o=`${r}x${a}@${n}:${t.pxPerMil.toFixed(3)}:${this.color}:${t.elev}:${t.wind}:${t.predicted?`${t.predicted.x.toFixed(2)},${t.predicted.y.toFixed(2)}`:""}`;if(o===this.lastKey)return;this.lastKey=o,(this.canvas.width!==Math.round(r*n)||this.canvas.height!==Math.round(a*n))&&(this.canvas.width=Math.round(r*n),this.canvas.height=Math.round(a*n));const l=this.ctx;l.setTransform(n,0,0,n,0,0),l.clearRect(0,0,r,a);const c=r/2,h=a/2,u=t.pxPerMil,d=Math.min(r,a)*.46,f=mg[this.color];l.save(),l.beginPath(),l.arc(c,h,d,0,Math.PI*2),l.clip();const m=(M,x)=>{l.strokeStyle=M,l.lineCap="butt";const _=10*u;l.lineWidth=4+x,l.beginPath(),l.moveTo(c-d,h),l.lineTo(c-_,h),l.moveTo(c+_,h),l.lineTo(c+d,h),l.moveTo(c,h+_),l.lineTo(c,h+d),l.moveTo(c,h-_),l.lineTo(c,h-d),l.stroke(),l.lineWidth=1.2+x,l.beginPath(),l.moveTo(c-_,h),l.lineTo(c+_,h),l.moveTo(c,h-_),l.lineTo(c,h+_),l.stroke(),l.lineWidth=1+x,l.beginPath();for(let C=-10;C<=10;C+=.5){if(C===0||!Number.isInteger(C)&&u<8)continue;const E=Number.isInteger(C)?C%2===0?7:5:3,A=C*u;l.moveTo(c+A,h-E),l.lineTo(c+A,h+E),l.moveTo(c-E,h+A),l.lineTo(c+E,h+A)}if(l.stroke(),u>6)for(let C=2;C<=10;C+=1){const E=h+C*u,A=Math.min(5,Math.floor(C/2)+1);for(let P=-A;P<=A;P++)P!==0&&(l.beginPath(),l.arc(c+P*u,E,Math.max(.9,1+x/2),0,Math.PI*2),l.stroke())}};if(m(f.glow,1.6),m(f.line,0),l.fillStyle=f.text,l.font="600 11px system-ui, sans-serif",l.textAlign="center",l.textBaseline="middle",u>9)for(let M=2;M<=10;M+=2){const x=M*u;l.fillText(String(M),c+x,h-14),l.fillText(String(M),c-x,h-14),l.fillText(String(M),c+16,h+x)}if(l.fillStyle="rgba(255, 60, 40, 0.95)",l.shadowColor="rgba(255, 60, 40, 0.8)",l.shadowBlur=4,l.beginPath(),l.arc(c,h,1.6,0,Math.PI*2),l.fill(),l.shadowBlur=0,t.predicted){const M=c+t.predicted.x*u,x=h-t.predicted.y*u;l.strokeStyle="rgba(0,0,0,0.6)",l.lineWidth=3,l.beginPath(),l.arc(M,x,5,0,Math.PI*2),l.stroke(),l.strokeStyle="#3cf0ff",l.lineWidth=1.6,l.beginPath(),l.arc(M,x,5,0,Math.PI*2),l.stroke(),l.fillStyle="#3cf0ff",l.font="600 11px system-ui, sans-serif",l.textAlign="left",l.fillText(`예상 탄착 ${Math.round(t.predicted.dist)}m`,M+9,x)}l.restore(),l.font='13px "Share Tech Mono", ui-monospace, monospace',l.textAlign="left",l.fillStyle="rgba(232, 163, 61, 0.9)";const v=t.wind===0?"0.0":`${Math.abs(t.wind).toFixed(1)}${t.wind>0?"R":"L"}`,g=c-d*.66,p=h+d*.6;l.fillText(`${t.zoom.toFixed(1)}×`,g,p),l.fillText(`E ${t.elev.toFixed(1)}`,g,p+16),l.fillText(`W ${v}`,g,p+32)}}const Mc=[{action:"fire",label:"발사",cls:"t-fire",hold:!0,aria:"발사"},{action:"scope",label:"스코프",cls:"t-scope",aria:"스코프 전환"},{action:"breath",label:"숨",cls:"t-breath",hold:!0,aria:"숨 참기"},{action:"zoomIn",label:"+",cls:"t-zoomin",aria:"배율 올리기"},{action:"zoomOut",label:"−",cls:"t-zoomout",aria:"배율 내리기"},{action:"elevUp",label:"▲",cls:"t-up",hold:!0,aria:"고각 올리기"},{action:"elevDown",label:"▼",cls:"t-down",hold:!0,aria:"고각 내리기"},{action:"windLeft",label:"◀",cls:"t-left",hold:!0,aria:"좌우 왼쪽"},{action:"windRight",label:"▶",cls:"t-right",hold:!0,aria:"좌우 오른쪽"},{action:"turretReset",label:"0",cls:"t-reset",aria:"터렛 초기화"},{action:"dope",label:"표",cls:"t-dope",aria:"탄도표"},{action:"rangefinder",label:"거리",cls:"t-range",aria:"거리측정기"},{action:"ammo",label:"탄",cls:"t-ammo",aria:"탄종 변경"}];class vg{el;input;aimTouches=new Map;pinchDist=0;disposers=[];onPause=null;constructor(t,e){this.input=e,this.el=document.createElement("div"),this.el.className="touch",this.el.innerHTML='<div class="touch-aim" aria-hidden="true"></div>'+Mc.map(r=>`<button class="tbtn ${r.cls}" data-action="${r.action}" aria-label="${r.aria}">${r.label}</button>`).join("")+'<button class="tbtn t-pause" aria-label="일시정지">II</button>',t.appendChild(this.el);for(const r of Mc){const a=this.el.querySelector(`[data-action="${r.action}"]`),o=c=>{c.preventDefault(),c.stopPropagation(),a.setPointerCapture?.(c.pointerId),a.classList.add("pressed"),this.input.setVirtual(r.action,!0)},l=c=>{c.preventDefault(),a.classList.remove("pressed"),this.input.setVirtual(r.action,!1)};this.on(a,"pointerdown",o),this.on(a,"pointerup",l),this.on(a,"pointercancel",l),this.on(a,"contextmenu",c=>c.preventDefault())}const i=this.el.querySelector(".t-pause");this.on(i,"click",()=>this.onPause?.());const n=this.el.querySelector(".touch-aim");this.on(n,"touchstart",r=>this.touchStart(r),{passive:!1}),this.on(n,"touchmove",r=>this.touchMove(r),{passive:!1}),this.on(n,"touchend",r=>this.touchEnd(r),{passive:!1}),this.on(n,"touchcancel",r=>this.touchEnd(r),{passive:!1})}on(t,e,i,n){t.addEventListener(e,i,n),this.disposers.push(()=>t.removeEventListener(e,i,n))}setVisible(t){this.el.style.display=t?"block":"none",t||(this.aimTouches.clear(),this.el.querySelectorAll(".pressed").forEach(e=>e.classList.remove("pressed")))}touchStart(t){t.preventDefault();for(const e of Array.from(t.changedTouches))this.aimTouches.set(e.identifier,{x:e.clientX,y:e.clientY});this.aimTouches.size===2&&(this.pinchDist=this.currentPinch())}currentPinch(){const t=Array.from(this.aimTouches.values());return t.length>=2?Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y):0}touchMove(t){if(t.preventDefault(),this.aimTouches.size>=2){for(const i of Array.from(t.changedTouches))this.aimTouches.has(i.identifier)&&this.aimTouches.set(i.identifier,{x:i.clientX,y:i.clientY});const e=this.currentPinch();this.pinchDist>0&&e>0&&(this.input.zoomFactor*=e/this.pinchDist),this.pinchDist=e;return}for(const e of Array.from(t.changedTouches)){const i=this.aimTouches.get(e.identifier);i&&(this.input.addLook(e.clientX-i.x,e.clientY-i.y),this.aimTouches.set(e.identifier,{x:e.clientX,y:e.clientY}))}}touchEnd(t){t.preventDefault();for(const e of Array.from(t.changedTouches))this.aimTouches.delete(e.identifier);this.aimTouches.size<2&&(this.pinchDist=0)}setAmmoVisible(t){const e=this.el.querySelector(".t-ammo");e&&(e.style.display=t?"":"none")}setRangeVisible(t){const e=this.el.querySelector(".t-range");e&&(e.style.display=t?"":"none")}dispose(){for(const t of this.disposers)t();this.el.remove()}}const Ut=s=>s.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]);function Tn(s){const t=Math.max(0,s),e=Math.floor(t/60),i=Math.floor(t%60);return`${e}:${String(i).padStart(2,"0")}`}function _g(s){return s.map(t=>`<span class="star ${t?"on":""}" aria-hidden="true">★</span>`).join("")}class xg{root;game;save;audio;input;screens;hudEl;scope;touch;toastEl;fadeEl;flashEl;rotateEl;screen="none";settingsReturn="menu";controlsReturn="menu";briefingMission=null;lastResult=null;transitioning=!1;pausedAt=0;hudCache=new Map;hitTimer=0;analysisTimer=0;rangeTimer=0;alertTimer=0;rangeWind={speed:3,dir:90};lastHover=0;dopeKey="";toastTimer=null;constructor(t,e,i,n,r){this.root=t,this.game=e,this.save=i,this.audio=n,this.input=r,r.isTouch&&document.body.classList.add("is-touch"),this.hudEl=this.div("hud"),this.hudEl.innerHTML=this.hudTemplate(),this.scope=new gg(t),this.scope.setColor(i.data.settings.reticleColor),this.flashEl=this.div("flash"),this.touch=r.isTouch?new vg(t,r):null,this.touch&&(this.touch.onPause=()=>this.pauseGame()),this.screens=this.div("screens"),this.toastEl=this.div("toast"),this.toastEl.setAttribute("role","status"),this.toastEl.setAttribute("aria-live","polite"),this.fadeEl=this.div("fade"),this.rotateEl=this.div("rotate"),this.rotateEl.innerHTML='<div class="rotate-icon" aria-hidden="true">⟳</div><p>화면을 가로로 돌려주세요</p><p class="muted">저격 조준을 위해 가로 화면이 필요합니다.</p>',this.setHudVisible(!1),this.screens.addEventListener("click",l=>{this.audio.unlock(),l.target.closest("button")&&this.audio.play("uiClick")}),this.screens.addEventListener("pointerover",l=>{const c=l.target.closest("button");c&&!c.disabled&&performance.now()-this.lastHover>60&&(this.lastHover=performance.now(),this.audio.play("uiHover"))}),window.addEventListener("pointerdown",()=>this.audio.unlock(),{capture:!0}),window.addEventListener("keydown",()=>this.audio.unlock(),{capture:!0}),document.getElementById("game").addEventListener("mousedown",l=>{this.game.fsm.is("playing")&&!this.input.pointerLocked&&!this.input.isTouch&&l.button===0&&this.lockWanted&&(this.input.requestPointerLock(),this.lockWanted=!1,l.stopPropagation())},{capture:!0}),r.onPointerLockChange=l=>{!l&&this.game.fsm.is("playing")&&this.pauseGame(),l&&(this.lockWanted=!1)},r.onKeyDown=(l,c)=>this.onKey(l,c),document.addEventListener("visibilitychange",()=>{document.hidden?(this.pauseGame(),this.audio.suspend()):this.audio.resume()}),window.addEventListener("blur",()=>this.pauseGame()),window.addEventListener("resize",()=>this.checkOrientation()),this.checkOrientation(),e.hooks={onHint:l=>this.setHint(l),onHit:l=>this.showHit(l),onAnalysis:l=>this.showAnalysis(l),onRangefinder:(l,c)=>this.showRange(l,c),onAlert:l=>this.showAlert(l),onToast:l=>this.toast(l),onMissionEnd:l=>this.onMissionEnd(l),onStateChange:(l,c)=>this.onState(l,c),onMuzzleFlash:()=>this.muzzleFlash(),onTag:l=>this.showTag(l)},this.applySettings();const o=()=>{requestAnimationFrame(o),this.frame()};requestAnimationFrame(o)}lockWanted=!1;div(t){const e=document.createElement("div");return e.className=t,this.root.appendChild(e),e}fade(t){this.transitioning||(this.transitioning=!0,this.fadeEl.classList.add("on"),window.setTimeout(()=>{t(),this.fadeEl.classList.remove("on"),window.setTimeout(()=>this.transitioning=!1,180)},180))}show(t,e=""){this.disposePreviews(),this.screen=t,this.screens.innerHTML=e,this.screens.className=`screens screen-${t}`,this.screens.style.display=t==="none"?"none":"flex";const i=this.screens.querySelector("[data-primary]");i&&!this.input.isTouch&&i.focus({preventScroll:!0})}bind(t,e){this.screens.querySelectorAll(t).forEach(i=>i.addEventListener("click",()=>e(i)))}showMenu(){const t=this.save.data.progress,e=this.save.totalStars(),i=this.nextMission(),n=ge.filter(h=>t.missions[h.id]?.cleared).length,r=t.firstRun?"자격 심사 시작":i?"이어하기":"작전 목록",a=t.firstRun?"처음이라면 여기서 시작하세요":i?`${i.codename} · ${i.name}`:"모든 작전 완료",o=t.stats.shots?Math.round(t.stats.hits/t.stats.shots*100):0,l=Sr.filter(h=>this.weaponUnlocked(h)).map(h=>h.name),c=["[무전] 본부: 고스트-7, 다음 계약이 대기 중이다.","[무전] 관측수: 오늘 계곡 바람이 심상치 않다. 깃발을 잘 봐라.","[무전] 본부: 민간인 피해는 용납하지 않는다. 쏘기 전에 식별하라.","[무전] 정비반: 소음기는 총성을 줄이지만 탄속이 조금 떨어진다."];this.show("menu",`<div class="menu-layout">
        <div class="menu-left">
          <div class="brand">
            <span class="brand-tag">GHOST PROTOCOL <i>//</i> CONTRACT SNIPER</span>
            <h1>LONG SHOT</h1>
            <p class="tagline">바람을 읽고, 숨을 멈추고, 한 발로 끝낸다.</p>
          </div>
          <nav class="menu-list" aria-label="메인 메뉴">
            <button class="menu-item primary" data-primary data-go="next"><span class="mi-idx">01</span><span class="mi-text"><b>${Ut(r)}</b><small>${Ut(a)}</small></span><span class="mi-arrow" aria-hidden="true">›</span></button>
            <button class="menu-item" data-go="missions"><span class="mi-idx">02</span><span class="mi-text"><b>작전 목록</b><small>자격 심사 3 · 실전 작전 5</small></span><span class="mi-arrow" aria-hidden="true">›</span></button>
            <button class="menu-item" data-go="daily"><span class="mi-idx">03</span><span class="mi-text"><b>일일 계약</b><small>${Ut(tl())} · 매일 바뀌는 표적</small></span><span class="mi-arrow" aria-hidden="true">›</span></button>
            <button class="menu-item" data-go="range"><span class="mi-idx">04</span><span class="mi-text"><b>사격장</b><small>100~1500m 자유 연습</small></span><span class="mi-arrow" aria-hidden="true">›</span></button>
            <div class="menu-row">
              <button class="btn ghost small" data-go="settings">설정</button>
              <button class="btn ghost small" data-go="controls">조작법</button>
              <button class="btn ghost small" data-go="credits">크레딧</button>
            </div>
          </nav>
        </div>
        <aside class="operator frame" aria-label="요원 기록">
          <header><span>OPERATOR FILE</span><span class="mono">GHOST-7</span></header>
          <div class="op-grid">
            <div><small>작전 진행</small><b class="mono">${n}<i>/${ge.length}</i></b></div>
            <div><small>확인 제거</small><b class="mono">${t.stats.kills}</b></div>
            <div><small>최장 명중</small><b class="mono">${t.stats.longestHit}<i>m</i></b></div>
            <div><small>명중률</small><b class="mono">${o}<i>%</i></b></div>
          </div>
          <div class="op-bar"><i style="--v:${Math.round(n/ge.length*100)}%"></i></div>
          <div class="menu-foot"><span>★ ${e} / ${ge.length*3}</span><span>헤드샷 ${t.stats.headshots}</span><span>플레이 ${Math.round(t.stats.playSeconds/60)}분</span></div>
          <div class="op-gear"><small>지급 장비</small>${l.map(h=>`<span class="chip">${Ut(h)}</span>`).join("")}<span class="chip">소음기</span></div>
        </aside>
        <div class="radio" aria-hidden="true"><span>${Ut(c[Math.floor(Date.now()/6e4)%c.length])}</span></div>
      </div>`),this.bind("[data-go]",h=>{const u=h.dataset.go;u==="next"?this.openBriefing(i??ge[0]):u==="missions"?this.showMissions():u==="range"?this.openBriefing(Qo(this.rangeWind.speed,this.rangeWind.dir)):u==="daily"?this.openBriefing(bh(tl())):u==="settings"?this.showSettings("menu"):u==="controls"?this.showControls("menu"):u==="credits"&&this.showCredits()})}missionUnlocked(t){return t===0?!0:!!this.save.data.progress.missions[ge[t-1].id]?.cleared}nextMission(){for(let t=0;t<ge.length;t++){if(!this.missionUnlocked(t))return ge[Math.max(0,t-1)];if(!this.save.data.progress.missions[ge[t].id]?.cleared)return ge[t]}return null}showMissions(){const t=this.save.data.progress.missions,e=(o,l)=>{const c=this.missionUnlocked(l),h=t[o.id],u=o.targets.filter(f=>f.required).map(f=>f.dist),d=`${Math.min(...u)}${Math.max(...u)!==Math.min(...u)?`~${Math.max(...u)}`:""}m`;return`<button class="mission-card ${c?"":"locked"} ${h?.cleared?"cleared":""}" data-mission="${l}" ${c?"":'disabled aria-disabled="true"'}>
        <span class="mc-num mono">${o.category==="qualification"?"QUAL":"OP"}-${String(l+1).padStart(2,"0")}</span>
        <span class="mc-code">${Ut(o.codename)}</span>
        <span class="mc-name">${Ut(o.name)}</span>
        <span class="mc-sub">${Ut(o.subtitle)} · ${d}</span>
        <span class="mc-stars">${c?_g(h?.stars??[!1,!1,!1]):"🔒 이전 작전 완료 필요"}</span>
        ${h?.bestTime?`<span class="mc-best mono">BEST ${Tn(h.bestTime)}</span>`:""}
        ${h?.cleared?'<span class="mc-stamp">완료</span>':""}
      </button>`};this.show("missions",`<div class="panel wide frame">
        <div class="panel-head"><h2><span class="h-tag">OPERATIONS</span>작전 목록</h2><button class="btn small" data-back>뒤로 (Esc)</button></div>
        <div class="missions-cols">
          <div>
            <h3 class="sec">자격 심사 <small>강철판 · 기본기</small></h3>
            <div class="mission-grid">${ge.map((o,l)=>o.category==="qualification"?e(o,l):"").join("")}</div>
            <h3 class="sec">실전 작전 <small>표적 식별 · 암살</small></h3>
            <div class="mission-grid">${ge.map((o,l)=>o.category==="operation"?e(o,l):"").join("")}</div>
          </div>
          <aside class="mission-preview frame">
            <canvas class="tacmap" aria-label="전술 지도"></canvas>
            <div class="mp-info"></div>
          </aside>
        </div>
      </div>`),this.bind("[data-back]",()=>this.showMenu()),this.bind("[data-mission]",o=>this.openBriefing(ge[Number(o.dataset.mission)]));const i=this.screens.querySelector(".tacmap"),n=this.screens.querySelector(".mp-info"),r=o=>{const l=ge[o];Ta(i,l),n.innerHTML=`<b>${Ut(l.codename)}</b><p>${Ut(l.briefing[0])}</p><small>${Ut(hr[l.theme].name)} · ${Ut(bo(hr[l.theme],l.timeOfDay).timeName)} · 배울 것: ${Ut(l.newSkill)}</small>`};this.screens.querySelectorAll("[data-mission]").forEach(o=>{const l=Number(o.dataset.mission);o.addEventListener("pointerenter",()=>r(l)),o.addEventListener("focus",()=>r(l))});const a=this.screens.querySelector(".mission-card:not(.locked):not(.cleared)")??this.screens.querySelector(".mission-card:not(.locked)");r(Number(a?.dataset.mission??0)),a&&!this.input.isTouch&&a.focus({preventScroll:!0})}openBriefing(t){this.briefingMission=t,this.game.loadMission(t),this.game.fsm.is("menu")?this.game.fsm.go("briefing"):this.game.fsm.is("result","paused")&&this.game.toBriefing(),this.renderBriefing()}windDesc(t){const e=t.wind.zones[0];if(e.speed===0&&t.wind.zones.length===1)return"무풍";const i=e.speed<2?"약함":e.speed<4?"보통":"강함",n=t.wind.zones.length>1?" · 구간별 상이":"",r=t.wind.gusts?" · 돌풍":"";return`${i} · ${cr(e.dir)}시 방향${n}${r}`}weaponUnlocked(t){return!t.unlockKey||this.save.totalStars()>=vt.unlocks[t.unlockKey]}weaponStats(t){const i=new yo(t).dope(100,15,800).find(r=>r.range===800),n=i?i.energy:0;return{acc:Math.max(.1,1-(t.ammo[0].dispersionMoa-.3)/.8),power:Math.min(1,n/4e3),bolt:Math.max(.1,1-(t.boltTime-.5)/1),recoil:Math.min(1,t.recoilKick/28),e800:n}}renderBriefing(){const t=this.briefingMission,e=this.save.data.settings,i=this.save.totalStars(),n=this.save.data.progress.missions[t.id],r=bo(hr[t.theme],t.timeOfDay),a=t.targets.filter(x=>x.required||t.isRange),o=a.map(x=>x.dist),l=t.noRangefinder?"알 수 없음 (직접 측정)":`약 ${Math.round(Math.min(...o)/10)*10}${Math.max(...o)-Math.min(...o)>20?`~${Math.round(Math.max(...o)/10)*10}`:""}m`,c=t.targets.filter(x=>x.kind==="person"),h=x=>c.filter(_=>(_.role??"guard")===x).length,u=t.isRange?"100~1500m 강철판 15개":c.length?[h("hvt")?`핵심 ${h("hvt")}`:"",h("guard")?`경비 ${h("guard")}`:"",h("civilian")?`민간인 ${h("civilian")}`:""].filter(Boolean).join(" · ")+` · ${l}`:`강철판 ${a.length}개 · ${l}`,d=Object.keys(Rn).map(x=>{const _=Rn[x],C=_.unlockKey&&i<vt.unlocks[_.unlockKey];return`<button class="diff-btn ${e.difficulty===x&&!C?"selected":""}" data-diff="${x}" ${C?'disabled aria-disabled="true"':""} aria-pressed="${e.difficulty===x}">${_.name}${C?` <small>🔒★${vt.unlocks[_.unlockKey]}</small>`:""}</button>`}).join(""),f=Sr.map(x=>{const _=this.weaponUnlocked(x),C=!_||t.weaponLock&&t.weaponLock!==x.id;return`<button class="wtab" data-weapon="${x.id}" ${C?'disabled aria-disabled="true"':""} title="${!_&&x.unlockKey?`★ ${vt.unlocks[x.unlockKey]}개 필요`:Ut(x.description)}">${x.name}${_?"":" 🔒"}</button>`}).join(""),m=t.isRange?`<div class="range-wind">
          <label>풍속 <output id="rw-s">${this.rangeWind.speed.toFixed(1)}</output> m/s<input type="range" id="rw-speed" min="0" max="10" step="0.5" value="${this.rangeWind.speed}"></label>
          <label>방향 <output id="rw-d">${cr(this.rangeWind.dir)}시에서</output><input type="range" id="rw-dir" min="0" max="345" step="15" value="${this.rangeWind.dir}"></label>
        </div>`:"",v=t.isRange?"<li>목표 없음 – 자유롭게 연습하세요. 일시정지 메뉴에서 나갈 수 있습니다.</li>":t.objectives.map((x,_)=>`<li><span class="star ${n?.stars[_]?"on":""}">★</span> ${Ut(x.label)}</li>`).join(""),g=t.dossier?`<div class="dossier frame">
          <header><span>TARGET DOSSIER</span><span class="stamp-red">CLASSIFIED</span></header>
          <div class="dossier-body">
            <canvas class="dossier-3d" aria-label="표적 외형"></canvas>
            <div class="dossier-info">
              <b>${Ut(t.dossier.name)}</b><small>${Ut(t.dossier.alias)}</small>
              <p>${Ut(t.dossier.summary)}</p>
              <ul>${t.dossier.features.map(x=>`<li>${Ut(x)}</li>`).join("")}</ul>
            </div>
          </div>
        </div>`:`<div class="dossier frame mini"><header><span>TARGET</span></header><p class="muted">${t.category==="qualification"||t.isRange?"강철판 표적 – 명중 시 초록색으로 바뀌고 탄흔이 남습니다.":"경계병 – 소총과 조끼를 착용했습니다. 스코프로 관측해 식별하세요."}</p></div>`;this.show("briefing",`<div class="panel wide frame briefing">
        <div class="panel-head">
          <h2><span class="h-tag">${t.category==="qualification"?"QUALIFICATION":t.isRange?"RANGE":t.category==="contract"?"CONTRACT":"OPERATION"}</span>${Ut(t.codename)} <small>${Ut(t.name)}</small></h2>
          <div class="head-actions"><button class="btn small" data-back>뒤로 (Esc)</button><button class="btn primary start-btn" data-primary data-start>${this.input.isTouch?"작전 개시":"작전 개시 (Enter)"}</button></div>
        </div>
        <div class="brief-cols">
          <section class="brief-info">
            <h3 class="sec">INTEL</h3>
            ${t.briefing.map(x=>`<p class="brief-text">${Ut(x.replace("{ammo}",`[${this.input.keyLabel("ammo")}]`))}</p>`).join("")}
            <div class="brief-new"><b>배울 것</b> ${Ut(t.newSkill)}</div>
            <dl class="brief-env">
              <dt>지형</dt><dd>${r.name} · ${r.timeName}</dd>
              <dt>대기</dt><dd class="mono">ALT ${t.atmosphere.altitude}m · ${t.atmosphere.temperature}°C</dd>
              <dt>바람</dt><dd>${t.isRange?"직접 설정":this.windDesc(t)}</dd>
              <dt>표적</dt><dd>${u}</dd>
              <dt>탄약</dt><dd>${t.ammoTotal>0?`${t.ammoTotal}발`:"무제한"}${t.timeLimit?` · 제한 ${Tn(t.timeLimit)}`:""}</dd>
            </dl>
            ${t.intel?.length?`<ul class="intel">${t.intel.map(x=>`<li>${Ut(x)}</li>`).join("")}</ul>`:""}
            ${m}
            <h3 class="sec">목표</h3>
            <ul class="objectives">${v}</ul>
          </section>
          <section class="brief-mid">
            <canvas class="tacmap" aria-label="전술 지도"></canvas>
            ${g}
          </section>
          <section class="brief-loadout">
            <h3 class="sec">LOADOUT</h3>
            <div class="weapon-stage frame"><canvas class="weapon-3d" aria-label="총기 미리보기"></canvas><div class="ws-name"></div></div>
            <div class="wtabs" role="group" aria-label="총기 선택">${f}</div>
            <div class="wstats"></div>
            <button class="toggle ${e.suppressor?"on":""}" data-suppressor aria-pressed="${e.suppressor}"><span>소음기</span><small></small><i aria-hidden="true"></i></button>
            <h3 class="sec">난이도</h3>
            <div class="diff-row">${d}</div>
            <p class="muted diff-desc">${Ut(Rn[e.difficulty].description)}</p>
          </section>
        </div>
      </div>`),Ta(this.screens.querySelector(".tacmap"),t),this.bind("[data-back]",()=>this.backFromBriefing()),this.bind("[data-start]",()=>this.startMission()),this.bind("[data-weapon]",x=>{e.weapon=x.dataset.weapon,this.save.save(),this.game.loadMission(t),this.refreshLoadout()}),this.bind("[data-suppressor]",()=>{e.suppressor=!e.suppressor,this.save.save(),this.game.loadMission(t),this.refreshLoadout()}),this.bind("[data-diff]",x=>{e.difficulty=x.dataset.diff,this.save.save(),this.game.loadMission(t),this.screens.querySelectorAll("[data-diff]").forEach(_=>{const C=_.dataset.diff===e.difficulty;_.classList.toggle("selected",C),_.setAttribute("aria-pressed",String(C))}),this.screens.querySelector(".diff-desc").textContent=Rn[e.difficulty].description});const p=this.screens.querySelector("#rw-speed"),M=this.screens.querySelector("#rw-dir");if(p&&M){const x=()=>{this.rangeWind={speed:Number(p.value),dir:Number(M.value)},this.screens.querySelector("#rw-s").textContent=this.rangeWind.speed.toFixed(1),this.screens.querySelector("#rw-d").textContent=`${cr(this.rangeWind.dir)}시에서`};p.addEventListener("input",x),M.addEventListener("input",x);const _=()=>{this.briefingMission=Qo(this.rangeWind.speed,this.rangeWind.dir),this.game.loadMission(this.briefingMission),Ta(this.screens.querySelector(".tacmap"),this.briefingMission)};p.addEventListener("change",_),M.addEventListener("change",_)}try{const x=this.screens.querySelector(".weapon-3d");x&&(this.weaponStage=new xc(x,{fov:26,distance:2.4,height:.35,lookY:0,spin:.3}));const _=this.screens.querySelector(".dossier-3d");if(_&&t.dossier){this.dossierStage=new xc(_,{fov:28,distance:4.2,height:1.3,lookY:1,spin:.5});const C=new dh,E=fh(t.dossier.outfit,C);this.dossierStage.show(E.root,()=>C.dispose())}}catch{}this.refreshLoadout()}weaponStage=null;dossierStage=null;disposePreviews(){this.weaponStage?.dispose(),this.dossierStage?.dispose(),this.weaponStage=null,this.dossierStage=null}refreshLoadout(){const t=this.briefingMission,e=this.save.data.settings,i=t.weaponLock??(this.weaponUnlocked(br(e.weapon))?e.weapon:"r308"),n=br(i);this.screens.querySelectorAll("[data-weapon]").forEach(h=>{const u=h.dataset.weapon===n.id;h.classList.toggle("selected",u),h.setAttribute("aria-pressed",String(u))});const r=this.weaponStats(n),a=(h,u,d)=>`<div class="stat"><span>${h}</span><i style="--v:${Math.round(u*100)}%"></i><em class="mono">${d}</em></div>`,o=this.screens.querySelector(".wstats");o&&(o.innerHTML=`<p class="w-desc">${Ut(n.caliber)} · ${Ut(n.description)}</p>${a("정확도",r.acc,`${n.ammo[0].dispersionMoa}MOA`)}${a("위력",r.power,`${Math.round(r.e800)}J@800`)}${a("볼트",r.bolt,`${n.boltTime}s`)}${a("반동",r.recoil,`${n.recoilKick}`)}<p class="w-ammo">${n.ammo.map(h=>Ut(h.name)).join(" / ")} · 탄창 ${n.magazine}발 · ${n.zoomMin}-${n.zoomMax}×</p>`);const l=this.screens.querySelector("[data-suppressor]");l&&(l.classList.toggle("on",e.suppressor),l.setAttribute("aria-pressed",String(e.suppressor)),l.querySelector("small").textContent=e.suppressor?"장착 – 총성 범위↓ · 섬광 없음 · 탄속 −1.5%":"미장착 – 총성이 전장에 울린다");const c=this.screens.querySelector(".ws-name");if(c&&(c.innerHTML=`<b>${Ut(n.name)}</b><small class="mono">${Ut(n.caliber)}${e.suppressor?" · SUPPRESSED":""}</small>`),this.weaponStage){const h=mh(n,e.suppressor);h.group.position.z=.2,h.group.rotation.y=Math.PI/2;const u=new oe;u.add(h.group),this.weaponStage.show(u,()=>h.dispose())}}backFromBriefing(){this.game.toMenu(),this.briefingMission&&!this.briefingMission.isRange&&!this.briefingMission.id.startsWith("daily-")?this.showMissions():this.showMenu()}startMission(){!this.briefingMission||this.transitioning||(this.audio.unlock(),!this.game.begin())||(this.show("none"),this.setHudVisible(!0),this.prepareHud())}prepareHud(){const t=this.game.hud();this.touch?.setAmmoVisible(t.canSwitchAmmo),this.touch?.setRangeVisible(t.rangefinderAllowed),this.hudCache.clear(),this.hideTransient(),this.lockWanted=!this.input.isTouch&&!this.input.pointerLocked}hideTransient(){this.hitTimer=0,this.analysisTimer=0,this.rangeTimer=0,this.alertTimer=0;for(const t of[".hud-hit",".hud-analysis",".hud-range",".hud-alert"])this.q(t).classList.remove("show")}pauseGame(){this.game.fsm.is("playing")&&this.game.pause()}renderPause(){const t=!!this.game.mission?.isRange,e=this.game.mission;this.show("pause",`<div class="panel narrow frame">
        <div class="panel-head"><h2><span class="h-tag">PAUSED</span>작전 일시중지</h2></div>
        <p class="muted mono">${Ut(e?.codename??"")} · T+${Tn(this.game.hud().time)}</p>
        <div class="menu-buttons">
          <button class="btn primary big" data-primary data-act="resume">계속 ${this.input.isTouch?"":"(Esc)"}</button>
          <button class="btn" data-act="restart">처음부터 다시 ${this.input.isTouch?"":"(R)"}</button>
          <button class="btn" data-act="settings">설정</button>
          <button class="btn" data-act="controls">조작법</button>
          <button class="btn danger" data-act="quit">${t?"사격장 나가기":"작전 포기"}</button>
        </div>
      </div>`),this.bind("[data-act]",i=>{const n=i.dataset.act;n==="resume"?this.resumeGame():n==="restart"?this.restartGame():n==="settings"?this.showSettings("pause"):n==="controls"?this.showControls("pause"):n==="quit"&&this.fade(()=>{this.game.abandon(),this.setHudVisible(!1),this.showMenu()})})}resumeGame(){if(this.game.fsm.is("paused")){if(this.portrait()){this.toast("가로 화면에서 계속할 수 있습니다");return}this.show("none"),this.game.resume(),this.lockWanted=!this.input.isTouch}}restartGame(){this.show("none"),this.setHudVisible(!0),this.game.restart(),this.prepareHud()}onMissionEnd(t){this.lastResult=t,window.setTimeout(()=>{this.setHudVisible(!1),this.renderResult(t)},350)}renderResult(t){const e=t.mission,i=ge.findIndex(h=>h.id===e.id),n=t.success&&i>=0&&i+1<ge.length?ge[i+1]:null,r=t.shots?Math.round(t.hits/t.shots*100):0,a=e.id.startsWith("daily-"),o=t.lastAnalysis,l=["D","C","B","A"][t.success?t.stars.filter(Boolean).length:0];this.show("result",`<div class="panel result frame ${t.success?"win":"lose"}">
        <div class="aar-head"><span class="h-tag">AFTER ACTION REPORT</span><span class="mono">${Ut(e.codename)}</span></div>
        <div class="aar-title">
          <h2>${t.success?"임무 완수":"임무 실패"}</h2>
          <span class="aar-stamp">${t.success?"MISSION COMPLETE":"MISSION FAILED"}</span>
          <span class="aar-grade mono" aria-label="평가 ${l}">${l}</span>
        </div>
        ${t.failReason?`<p class="fail-reason">${Ut(t.failReason)}</p>`:""}
        <div class="result-stars" aria-label="별 ${t.stars.filter(Boolean).length}개">${t.stars.map((h,u)=>`<span class="star big ${h?"pending":""}" data-i="${u}">★</span>`).join("")}</div>
        <ul class="objectives">${t.objectives.map((h,u)=>`<li class="${h.done?"done":""}"><span class="check">${h.done?"✔":"✖"}</span> ${Ut(h.label)} ${t.prevStars[u]&&!h.done?'<small class="muted">(이전에 달성)</small>':""}</li>`).join("")}</ul>
        <div class="result-stats">
          <div><b class="mono">${Tn(t.time)}</b><span>작전 시간${t.newBestTime?" · 신기록":""}</span></div>
          <div><b class="mono">${t.hits}/${t.shots}</b><span>명중 (${r}%)</span></div>
          <div><b class="mono">${t.kills}</b><span>제거</span></div>
          <div><b class="mono">${t.headshots}</b><span>헤드샷</span></div>
          <div><b class="mono">${Math.round(t.longest)}m</b><span>최장 명중</span></div>
          ${a?`<div><b class="mono">${t.score}</b><span>점수 (오늘 최고 ${t.bestScore})</span></div>`:""}
        </div>
        ${t.unlocked.length?`<div class="unlocks">${t.unlocked.map(h=>`<p>🔓 ${Ut(h)}</p>`).join("")}</div>`:""}
        ${t.tip?`<div class="tip"><b>다음엔 이렇게</b> ${Ut(t.tip)}</div>`:""}
        ${o&&!t.success?`<details class="analysis-details"><summary>마지막 빗나간 탄 분석</summary>${o.lines.map(h=>`<p>${Ut(h)}</p>`).join("")}</details>`:""}
        <div class="menu-buttons row-buttons">
          ${n?`<button class="btn primary big" data-primary data-act="next">다음 작전 ${this.input.isTouch?"":"(Enter)"}</button>`:""}
          <button class="btn ${n?"":"primary big"}" ${n?"":"data-primary"} data-act="retry">다시 하기 ${this.input.isTouch?"":"(R)"}</button>
          <button class="btn" data-act="missions">${a?"메인 메뉴":"작전 목록"}</button>
        </div>
      </div>`),Array.from(this.screens.querySelectorAll(".star.pending")).forEach((h,u)=>{window.setTimeout(()=>{h.classList.remove("pending"),h.classList.add("on","pop"),this.audio.play("star",{pitch:1+u*.12})},400+u*320)}),this.bind("[data-act]",h=>{const u=h.dataset.act;u==="next"&&n?this.fade(()=>this.openBriefing(n)):u==="retry"?this.restartGame():u==="missions"&&this.fade(()=>{this.game.toMenu(),a?this.showMenu():this.showMissions()})})}showSettings(t){this.settingsReturn=t;const e=this.save.data.settings,i=(h,u,d,f,m,v)=>`<label class="set-row"><span>${u}</span><input type="range" data-set="${h}" min="${d}" max="${f}" step="${m}" value="${e[h]}"><output>${v(e[h])}</output></label>`,n=(h,u)=>`<label class="set-row"><span>${u}</span><input type="checkbox" data-set="${h}" ${e[h]?"checked":""}><i class="switch" aria-hidden="true"></i></label>`,r=(h,u,d)=>`<label class="set-row"><span>${u}</span><select data-set="${h}">${d.map(([f,m])=>`<option value="${f}" ${e[h]===f?"selected":""}>${m}</option>`).join("")}</select></label>`,a=h=>`${Math.round(h*100)}%`,o=h=>`${h.toFixed(1)}×`,l=Object.keys(Ir).map(h=>`<div class="key-row"><span>${Ir[h]}</span><button class="btn small key-btn" data-key="${h}">${Ea(e.keys[h])}</button></div>`).join(""),c=this.save.data.progress.stats;this.show("settings",`<div class="panel wide settings">
        <div class="panel-head"><h2>설정</h2><button class="btn small" data-primary data-back>완료 (Esc)</button></div>
        <div class="settings-cols">
          <section><h3>소리</h3>
            ${i("masterVolume","전체 볼륨",0,1,.05,a)}
            ${i("sfxVolume","효과음",0,1,.05,a)}
            ${i("musicVolume","음악",0,1,.05,a)}
            ${n("muted","음소거")}
          <h3>조작</h3>
            ${i("mouseSensitivity","마우스 감도",.2,3,.1,o)}
            ${i("scopedSensitivity","스코프 감도",.2,3,.1,o)}
            ${i("touchSensitivity","터치 감도",.2,3,.1,o)}
            ${n("invertY","Y축 반전")}
            ${r("breathMode","숨 참기",[["hold","누르고 있기"],["toggle","한 번 눌러 전환"]])}
            ${r("scopeMode","스코프",[["toggle","한 번 눌러 전환"],["hold","누르고 있기"]])}
          </section>
          <section><h3>화면</h3>
            ${r("quality","그래픽 품질",[["auto","자동"],["high","높음"],["medium","중간"],["low","낮음"]])}
            ${r("reticleColor","레티클 색",[["black","검정"],["red","빨강"],["lime","연두"],["white","흰색"]])}
            ${r("bulletCam","불릿캠",[["final","마지막 결정타만"],["always","처치할 때마다"],["off","끄기"]])}
            ${n("screenShake","화면 흔들림")}
          <h3>접근성</h3>
            ${n("reduceFlashes","섬광 효과 줄이기")}
            ${n("showHints","도움말 표시")}
          <h3>데이터</h3>
            <p class="muted small-text">총 ${c.shots}발 · 명중 ${c.hits} · 처치 ${c.kills} · 헤드샷 ${c.headshots} · 플레이 ${Math.round(c.playSeconds/60)}분</p>
            <button class="btn small danger" data-reset>진행 기록 초기화</button>
          </section>
          <section class="keys-section"><h3>키 설정 ${this.input.isTouch?'<small class="muted">(키보드 연결 시)</small>':""}</h3>
            ${l}
            <button class="btn small" data-keyreset>키 기본값 복원</button>
            <p class="muted small-text">Esc는 항상 일시정지, 마우스 휠은 배율 조절입니다.</p>
          </section>
        </div>
      </div>`),this.bind("[data-back]",()=>this.leaveSettings()),this.screens.querySelectorAll("[data-set]").forEach(h=>{h.addEventListener("input",()=>{const u=h.dataset.set,d=e;if(h instanceof HTMLInputElement&&h.type==="checkbox")d[u]=h.checked;else if(h instanceof HTMLInputElement&&h.type==="range"){d[u]=Number(h.value);const f=h.parentElement?.querySelector("output");f&&(f.textContent=u.toLowerCase().includes("volume")?a(Number(h.value)):o(Number(h.value)))}else d[u]=h.value;this.applySettings(),this.save.save()})}),this.bind("[data-key]",h=>{const u=h.dataset.key;h.textContent="키를 누르세요…",h.classList.add("listening"),this.input.captureKey(d=>{if(d==="Escape"){this.showSettings(this.settingsReturn);return}const f=Object.keys(e.keys).find(m=>m!==u&&e.keys[m]===d);f&&(e.keys[f]=e.keys[u]),e.keys[u]=d,this.input.setKeys(e.keys),this.save.save(),this.showSettings(this.settingsReturn),f&&this.toast(`'${Ir[f]}'와(과) 키를 서로 바꿨습니다`)})}),this.bind("[data-keyreset]",()=>{e.keys={...yc},this.input.setKeys(e.keys),this.save.save(),this.showSettings(this.settingsReturn)}),this.bind("[data-reset]",()=>this.confirm("진행 기록(별·최고 기록·통계)을 모두 지울까요? 설정은 유지됩니다.",()=>{this.save.resetProgress(),this.toast("진행 기록을 초기화했습니다"),this.showSettings(this.settingsReturn)}))}leaveSettings(){this.input.cancelCapture(),this.settingsReturn==="pause"?this.renderPause():this.showMenu()}applySettings(){const t=this.save.data.settings;this.audio.setVolumes(t.masterVolume,t.sfxVolume,t.musicVolume,t.muted),this.input.setKeys(t.keys),this.scope.setColor(t.reticleColor);const e=t.quality==="auto"?this.game.qualityLevel:t.quality;e!==this.game.qualityLevel&&this.game.setQuality(e),document.body.classList.toggle("reduce-flash",t.reduceFlashes)}confirm(t,e){const i=document.createElement("div");i.className="confirm",i.setAttribute("role","dialog"),i.setAttribute("aria-modal","true"),i.innerHTML=`<div class="panel narrow"><p>${Ut(t)}</p><div class="row"><button class="btn danger" data-yes>예</button><button class="btn primary" data-no>아니요</button></div></div>`,this.root.appendChild(i);const n=()=>i.remove();i.querySelector("[data-yes]").addEventListener("click",()=>{n(),e()}),i.querySelector("[data-no]").addEventListener("click",n),i.querySelector("[data-no]").focus()}showControls(t){this.controlsReturn=t;const e=i=>`<kbd>${Ea(this.save.data.settings.keys[i])}</kbd>`;this.show("controls",`<div class="panel wide">
        <div class="panel-head"><h2>조작법과 사격 요령</h2><button class="btn small" data-primary data-back>뒤로 (Esc)</button></div>
        <div class="controls-cols">
          <section><h3>키보드 · 마우스</h3>
            <table class="keys-table">
              <tr><td>조준</td><td>마우스 이동</td></tr>
              <tr><td>스코프</td><td>${e("scope")}</td></tr>
              <tr><td>배율</td><td>마우스 휠 / ${e("zoomIn")} ${e("zoomOut")}</td></tr>
              <tr><td>숨 참기</td><td>${e("breath")} 또는 <kbd>Space</kbd></td></tr>
              <tr><td>발사</td><td>${e("fire")}</td></tr>
              <tr><td>고각 터렛</td><td>${e("elevUp")} ${e("elevDown")} (1클릭 0.1mil, 누르고 있으면 연속)</td></tr>
              <tr><td>좌우 터렛</td><td>${e("windLeft")} ${e("windRight")}</td></tr>
              <tr><td>터렛 초기화</td><td>${e("turretReset")}</td></tr>
              <tr><td>거리측정기</td><td>${e("rangefinder")}</td></tr>
              <tr><td>탄도표</td><td>${e("dope")}</td></tr>
              <tr><td>탄종 변경</td><td>${e("ammo")}</td></tr>
              <tr><td>재시작</td><td>${e("restart")} 길게</td></tr>
              <tr><td>일시정지</td><td><kbd>Esc</kbd> / ${e("pause")}</td></tr>
            </table>
            <h3>터치</h3>
            <p class="small-text">빈 곳을 드래그해 조준 · 두 손가락으로 벌려 배율 조절 · 오른쪽 아래 [발사] · 왼쪽 아래 [숨] · 왼쪽 십자 버튼으로 터렛 조절</p>
          </section>
          <section><h3>사격 요령</h3>
            <ol class="howto">
              <li><b>거리</b>를 잰다 – 거리측정기, 또는 레티클: <code>거리(m) = 크기(m) × 1000 ÷ mil</code></li>
              <li><b>탄도표</b>에서 그 거리의 고각(mil)을 찾아 터렛을 돌린다. <code>1mil = 1000m에서 1m</code></li>
              <li><b>바람</b>을 읽는다 – 깃발이 수평에 가까울수록 강하다(8m/s↑). 좌우 보정 = 탄도표의 "1m/s당 값" × 풍속</li>
              <li>움직이는 표적은 <b>리드</b>: <code>리드(mil) ≈ 속도 × 비행시간 ÷ 거리 × 1000</code></li>
              <li><b>숨을 참고</b>(흔들림 80%↓) 레티클이 멈춘 순간 쏜다. 너무 오래 참으면 오히려 흔들린다.</li>
              <li>빗나가면 <b>탄착 분석</b>을 보고 보정한다. 흙먼지가 보인 위치도 단서다.</li>
            </ol>
            <h3>판정</h3>
            <p class="small-text">사람: 머리·흉부·복부 명중 시 무력화, 팔·다리는 부상(경계 후 도주). 총성은 음속(343m/s)으로 퍼져 다른 사람이 듣고 반응한다.</p>
            <h3>식별과 은밀성</h3>
            <p class="small-text">스코프로 사람을 1초 관측하거나 레이저로 조사하면 식별 태그(핵심 표적·경비·민간인)가 붙습니다. <b>민간인을 쏘면 작전 실패</b>입니다. 쓰러진 사람은 그 자리에 남고, 근처(14m)를 지나는 사람이 발견하면 경보를 울립니다.</p>
            <p class="small-text">총성이 들리는 범위: 일반탄 = 전체 · 일반탄+소음기 = 400m(반응 느림) · 아음속탄 = 250m · 아음속탄+소음기 = 없음.</p>
          </section>
        </div>
      </div>`),this.bind("[data-back]",()=>this.controlsReturn==="pause"?this.renderPause():this.showMenu())}showCredits(){this.show("credits",`<div class="panel narrow frame credits">
        <div class="panel-head"><h2><span class="h-tag">CREDITS</span>크레딧</h2><button class="btn small" data-primary data-back>뒤로 (Esc)</button></div>
        <p><b>LONG SHOT</b> v2.0 – Ghost Protocol</p>
        <p>기획 · 개발: vecar0 with Claude Code</p>
        <h3 class="sec">기술</h3>
        <p>Three.js (MIT) · TypeScript · Vite · Rajdhani / Share Tech Mono 글꼴 (SIL OFL)</p>
        <h3 class="sec">그래픽 · 사운드</h3>
        <p>모든 3D 모델, 효과음, 배경음은 코드로 실시간 생성했습니다. 외부 이미지·음원을 사용하지 않았습니다.</p>
        <h3 class="sec">탄도 모델</h3>
        <p>G7 표준 항력 함수, ICAO 표준 대기, Litz 스핀 드리프트 근사식. 게임용 근사치이며 실제 사격에 사용하지 마세요.</p>
        <p class="muted">이 게임은 허구의 이야기이며 실존 인물·단체와 관계가 없습니다. 유혈 표현은 없습니다.</p>
      </div>`),this.bind("[data-back]",()=>this.showMenu())}onKey(t,e){const i=this.game.fsm.state;if(document.querySelector(".confirm"))return t==="Escape"&&document.querySelector(".confirm")?.remove(),!0;if(i==="playing")return!1;const n=this.save.data.settings.keys,r=t==="Escape";return this.screen==="pause"?r||t===n.pause?(performance.now()-this.pausedAt>350&&this.resumeGame(),!0):t===n.restart?(this.restartGame(),!0):!1:this.screen==="result"?t==="Enter"?(e.preventDefault(),this.screens.querySelector("[data-primary]")?.click(),!0):t===n.restart?(this.restartGame(),!0):r?(this.screens.querySelector('[data-act="missions"]')?.click(),!0):!1:this.screen==="briefing"?t==="Enter"&&!(e.target instanceof HTMLButtonElement&&!e.target.dataset.start)?(e.preventDefault(),this.startMission(),!0):r?(this.backFromBriefing(),!0):!1:r?(this.screen==="settings"?this.leaveSettings():this.screen==="controls"?this.controlsReturn==="pause"?this.renderPause():this.showMenu():(this.screen==="missions"||this.screen==="credits")&&this.showMenu(),!0):!1}onState(t,e){this.touch?.setVisible(t==="playing"),t==="paused"&&(this.pausedAt=performance.now(),this.renderPause()),t!=="playing"&&this.q(".hud-dope").classList.remove("show")}portrait(){return this.input.isTouch&&window.innerHeight>window.innerWidth}checkOrientation(){const t=this.portrait();this.rotateEl.classList.toggle("show",t),t&&this.pauseGame()}hudTemplate(){return`
      <div class="hud-vignette" aria-hidden="true"></div>
      <div class="hud-tl frame-lite">
        <div class="hud-code mono"></div>
        <div class="hud-mission"></div>
        <div class="hud-targets"></div>
        <div class="hud-time mono"></div>
      </div>
      <canvas class="hud-compass" width="440" height="40" aria-hidden="true"></canvas>
      <div class="hud-tr"><button class="hud-pause" aria-label="일시정지">II</button></div>
      <div class="hud-hint" role="status" aria-live="polite"></div>
      <div class="hud-alert" role="alert"></div>
      <div class="hud-cross" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="hud-hit"><b></b><span></span></div>
      <div class="hud-range mono"></div>
      <div class="hud-analysis"><div class="ha-lines"></div><div class="ha-tip"></div></div>
      <div class="hud-bl">
        <canvas class="hud-winddial" width="72" height="72" aria-hidden="true"></canvas>
        <div class="hud-wind"></div>
      </div>
      <div class="hud-br frame-lite">
        <div class="hud-weapon"><b class="hw-name"></b><span class="hw-sup">SUPPRESSED</span></div>
        <div class="hud-turret mono"><span class="ht-e"></span><span class="ht-w"></span><span class="hud-zoom"></span></div>
        <div class="hud-ammo"><span class="ha-pips"></span><b class="ha-count mono"></b><span class="ha-name"></span></div>
        <span class="ha-status"></span>
      </div>
      <div class="hud-breath"><span class="hb-label"></span><i></i></div>
      <div class="hud-restart"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" /></svg><span>재시작</span></div>
      <div class="hud-dope"></div>
      <div class="hud-cam"><span>불릿캠 · 클릭하면 건너뜀</span></div>
      <div class="hud-lock">화면을 클릭하면 마우스가 고정됩니다</div>
      <div class="hud-markers" aria-hidden="true"></div>`}q(t){return this.hudEl.querySelector(t)}setText(t,e){this.hudCache.get(t)!==e&&(this.hudCache.set(t,e),this.q(t).textContent=e)}setHudVisible(t){if(this.hudEl.style.display=t?"block":"none",t||(this.scope.el.style.display="none"),t){const e=this.q(".hud-pause");e.onclick=()=>this.pauseGame()}}frame(){const t=this.game.fsm.state;if(t!=="playing"&&t!=="paused")return;const e=this.game.hud();this.updateHud(e),this.scope.update(e);const i=1/60;t==="playing"&&(this.hitTimer>0&&(this.hitTimer-=i)<=0&&this.q(".hud-hit").classList.remove("show"),this.analysisTimer>0&&(this.analysisTimer-=i)<=0&&this.q(".hud-analysis").classList.remove("show"),this.rangeTimer>0&&(this.rangeTimer-=i)<=0&&this.q(".hud-range").classList.remove("show"),this.alertTimer>0&&(this.alertTimer-=i)<=0&&this.q(".hud-alert").classList.remove("show"))}lastCompass="";lastDial="";updateHud(t){const e=this.game.mission;this.setText(".hud-code",e?`${e.codename}`:""),this.setText(".hud-mission",t.missionName),this.setText(".hud-targets",t.isRange?`${t.weaponName} · 자유 연습`:`◆ 표적 ${t.targetsTotal-t.targetsLeft} / ${t.targetsTotal}`);const i=t.timeLimit>0?`T−${Tn(t.timeLimit-t.time)}`:`T+${Tn(t.time)}`;this.setText(".hud-time",i),this.q(".hud-time").classList.toggle("danger",t.timeLimit>0&&t.timeLimit-t.time<20),this.setText(".ht-e",`ELEV ${t.elev.toFixed(1)}`),this.setText(".ht-w",`WIND ${t.wind===0?"0.0":`${Math.abs(t.wind).toFixed(1)}${t.wind>0?"R":"L"}`}`),this.setText(".hud-zoom",`${t.zoom.toFixed(1)}×`),this.setText(".hw-name",t.weaponName),this.q(".hw-sup").style.display=t.suppressor?"":"none";const n=t.reserve===1/0?"∞":String(t.reserve);this.setText(".ha-count",`${t.inMag} | ${n}`);const r=`${t.inMag}`;this.hudCache.get("pips")!==r&&(this.hudCache.set("pips",r),this.q(".ha-pips").innerHTML=Array.from({length:Math.min(10,t.inMag)},()=>"<i></i>").join("")),this.setText(".ha-name",t.ammoName),this.setText(".ha-status",t.status),this.q(".ha-status").classList.toggle("warn",t.status!=="장전됨"),this.q(".ha-name").classList.toggle("sub",t.subsonic);const a=this.q(".hud-wind");t.windText?(this.setText(".hud-wind",t.windText),a.style.display=""):a.style.display="none",this.drawWindDial(t),this.drawCompass(t);const o=this.q(".hud-breath"),l=t.scopeT>.5||t.breath<.999||t.holding;o.classList.toggle("show",l),o.classList.toggle("holding",t.holding),o.classList.toggle("exhausted",t.exhausted),o.querySelector("i").style.transform=`scaleX(${t.breath.toFixed(3)})`,this.setText(".hb-label",`${t.exhausted?"호흡 회복 중":t.holding?"숨 참는 중":"호흡"} · ♥ ${Math.round(t.heartRate)}`),this.q(".hud-cross").style.display=t.scopeT<.3&&!t.bulletCam?"":"none",this.hudEl.classList.toggle("scoped",t.scopeT>.5),this.hudEl.classList.toggle("cam",t.bulletCam);const c=this.q(".hud-restart");c.classList.toggle("show",t.restartProgress>.05),c.querySelector("circle").style.strokeDashoffset=String(94.2*(1-Math.min(1,t.restartProgress))),this.updateMarkers(),this.q(".hud-lock").classList.toggle("show",this.lockWanted&&!this.input.pointerLocked&&this.game.fsm.is("playing"));const h=this.q(".hud-dope");if(h.classList.toggle("show",t.dopeOpen),t.dopeOpen){const u=`${t.weaponName}:${t.ammoName}:${t.suppressor}:${this.game.mission?.id}`;if(u!==this.dopeKey){this.dopeKey=u;const d=this.game.dopeRows(),f=this.game.mission;h.innerHTML=`<div class="dope-head"><span class="h-tag">DOPE CARD</span><b>${Ut(t.weaponName)}</b> · ${Ut(t.ammoName)}${t.suppressor?" · 소음기":""}<br><small>영점 100m · 고도 ${f.atmosphere.altitude}m · ${f.atmosphere.temperature}°C · 1클릭 = 0.1mil</small></div>
          <table class="mono"><thead><tr><th>거리</th><th>고각</th><th>클릭</th><th>바람/1m·s</th><th>비행</th><th>에너지</th></tr></thead><tbody>
          ${d.map(m=>`<tr><td>${m.range}m</td><td>${m.elevationMil.toFixed(1)}</td><td>${Math.round(m.elevationMil*10)}</td><td>${m.windPerMpsMil.toFixed(2)}</td><td>${m.time.toFixed(2)}s</td><td>${Math.round(m.energy)}J</td></tr>`).join("")}
          </tbody></table><div class="dope-foot">${this.input.isTouch?"[표] 버튼으로 닫기":`[${this.input.keyLabel("dope")}] 닫기`} · 스핀 드리프트: 1000m에서 약 0.2mil 오른쪽</div>`}}}drawCompass(t){const e=`${t.heading.toFixed(1)}|${t.bearings.map(u=>`${u.bearing.toFixed(1)}${u.role}${u.down}`).join(",")}|${t.scopeT>.5}`;if(e===this.lastCompass)return;this.lastCompass=e;const i=this.q(".hud-compass"),n=i.getContext("2d");if(!n)return;const r=i.width,a=i.height;n.clearRect(0,0,r,a);const o=90,l=r/o,c=r/2;n.font='600 12px "Share Tech Mono", ui-monospace, monospace',n.textAlign="center";const h={0:"N",45:"NE",90:"E",135:"SE",180:"S",225:"SW",270:"W",315:"NW"};for(let u=Math.floor(t.heading-o/2);u<=t.heading+o/2;u++){const d=(u%360+360)%360,f=c+(u-t.heading)*l,m=1-Math.abs(f-c)/(r/2);d%5===0&&(n.strokeStyle=`rgba(230,236,228,${.25+m*.55})`,n.lineWidth=1,n.beginPath(),n.moveTo(f,a-4),n.lineTo(f,a-(d%15===0?14:8)),n.stroke(),d%15===0&&(n.fillStyle=h[d]?`rgba(232,163,61,${.4+m*.6})`:`rgba(230,236,228,${.3+m*.6})`,n.fillText(h[d]??String(d).padStart(3,"0"),f,a-18)))}for(const u of t.bearings){let d=u.bearing-t.heading;d=(d+540)%360-180;const f=Math.max(-o/2+2,Math.min(o/2-2,d)),m=c+f*l;n.fillStyle=u.down?"rgba(160,160,160,0.6)":u.role==="hvt"?"#ff5a4a":u.role==="civilian"?"#6cb4ff":"#e8a33d",n.beginPath(),n.moveTo(m,a-2),n.lineTo(m-4,a-8),n.lineTo(m+4,a-8),n.closePath(),n.fill()}n.fillStyle="#e8a33d",n.fillRect(c-1,a-16,2,14),n.fillStyle="rgba(10,14,16,0.75)",n.fillRect(c-22,0,44,14),n.fillStyle="#f2f4ee",n.fillText(String(Math.round(t.heading)%360).padStart(3,"0"),c,11)}drawWindDial(t){const e=this.q(".hud-winddial");if(!t.windNow){e.style.display="none";return}e.style.display="";const i=`${t.windNow.speed.toFixed(1)}|${Math.round(t.windNow.fromDeg)}`;if(i===this.lastDial)return;this.lastDial=i;const n=e.getContext("2d");if(!n)return;const r=e.width,a=r/2-6;n.clearRect(0,0,r,r),n.save(),n.translate(r/2,r/2),n.strokeStyle="rgba(230,236,228,0.35)",n.lineWidth=1.5,n.beginPath(),n.arc(0,0,a,0,Math.PI*2),n.stroke();for(let m=0;m<12;m++){const v=m/12*Math.PI*2;n.beginPath(),n.moveTo(Math.sin(v)*(a-4),-Math.cos(v)*(a-4)),n.lineTo(Math.sin(v)*a,-Math.cos(v)*a),n.stroke()}const o=t.windNow.fromDeg*Math.PI/180,l=Math.min(a-2,8+t.windNow.speed*4);n.strokeStyle="#7fd3c8",n.fillStyle="#7fd3c8",n.lineWidth=3;const c=Math.sin(o)*a,h=-Math.cos(o)*a,u=Math.sin(o)*(a-l),d=-Math.cos(o)*(a-l);n.beginPath(),n.moveTo(c,h),n.lineTo(u,d),n.stroke();const f=Math.atan2(d-h,u-c);n.beginPath(),n.moveTo(u,d),n.lineTo(u-Math.cos(f-.5)*7,d-Math.sin(f-.5)*7),n.lineTo(u-Math.cos(f+.5)*7,d-Math.sin(f+.5)*7),n.fill(),n.fillStyle="#f2f4ee",n.font='600 13px "Share Tech Mono", ui-monospace, monospace',n.textAlign="center",n.textBaseline="middle",n.fillText(t.windNow.speed.toFixed(1),0,0),n.restore()}markerEls=[];updateMarkers(){const t=this.game.markers(),e=this.q(".hud-markers");for(;this.markerEls.length<t.length;){const i=document.createElement("div");i.className="marker",i.innerHTML="<span></span><i></i>",e.appendChild(i),this.markerEls.push(i)}this.markerEls.forEach((i,n)=>{const r=t[n];if(!r){i.style.display="none";return}i.style.display="",i.style.transform=`translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px)`,i.className=`marker r-${r.role}${r.alert?" alert":""}`;const a=i.firstElementChild;a.textContent!==r.label&&(a.textContent=r.label)})}setHint(t){const e=this.q(".hud-hint");e.textContent=t??"",e.classList.toggle("show",!!t)}showHit(t){const e=this.q(".hud-hit");e.className=`hud-hit show k-${t.kind}`,e.querySelector("b").textContent=t.title,e.querySelector("span").textContent=t.detail,this.hitTimer=vt.feedback.hitMarkerTime,t.kind!=="wound"&&(this.q(".hud-analysis").classList.remove("show"),this.analysisTimer=0)}showTag(t){const e=t.role==="hvt"?"핵심 표적":t.role==="civilian"?"민간인 – 사격 금지":"경비병";this.toast(`식별: ${t.label} · ${e} · ${Math.round(t.distance)}m`)}showAnalysis(t){const e=this.q(".hud-analysis");if(!t){e.classList.remove("show");return}e.querySelector(".ha-lines").innerHTML=`<b>빗나감</b>${t.lines.map(i=>`<p>${Ut(i)}</p>`).join("")}`,e.querySelector(".ha-tip").textContent=`→ ${t.tip}`,e.classList.add("show"),this.analysisTimer=9}showRange(t,e){const i=this.q(".hud-range");if(!e){i.textContent=this.game.mission?.noRangefinder?"거리측정기 고장 – 레티클로 재세요":"이 난이도에서는 거리측정기가 없습니다",i.classList.add("show","err"),this.rangeTimer=2.5;return}if(i.classList.remove("err"),t===null&&this.rangeTimer<=0){i.classList.remove("show");return}i.textContent=t===null?"거리: 측정 불가":`거리 ${Math.round(t)}m`,i.classList.add("show"),this.rangeTimer=5}showAlert(t){const e=this.q(".hud-alert");e.textContent=`⚠ ${t}`,e.classList.add("show"),this.alertTimer=3}muzzleFlash(){this.save.data.settings.reduceFlashes||(this.flashEl.classList.remove("on"),this.flashEl.offsetWidth,this.flashEl.classList.add("on"))}toast(t){this.toastEl.textContent=t,this.toastEl.classList.add("show"),this.toastTimer!==null&&clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toastEl.classList.remove("show"),2600)}enterMenu(){this.showMenu()}get lastMissionResult(){return this.lastResult}}function ns(s,t){const e=document.querySelector(".loading-bar i"),i=document.querySelector(".loading-text");e&&(e.style.transform=`scaleX(${s})`),i&&(i.textContent=t)}function Lr(s){console.error(s);const t=document.getElementById("fatal");if(!t)return;t.style.display="flex";const e=t.querySelector(".fatal-msg");e&&(e.textContent=s instanceof Error?s.message:String(s))}const ss=()=>new Promise(s=>requestAnimationFrame(()=>s()));function Mg(){try{const s=document.createElement("canvas");return!!(s.getContext("webgl2")||s.getContext("webgl"))}catch{return!1}}async function yg(){if(!Mg()){Lr(new Error("이 브라우저는 WebGL을 지원하지 않습니다. 최신 Chrome, Edge, Safari, Firefox에서 실행해 주세요."));return}ns(.15,"저장 데이터 불러오는 중…"),await ss();const s=new wo,t=new Mh,e=document.getElementById("app"),i=document.getElementById("game"),n=new wh(i,s.data.settings.keys);ns(.35,"그래픽 준비 중…"),await ss();const r=new pg(i,s,t,n);ns(.6,"작전 지역 지형 생성 중…"),await ss(),r.loadBackdrop(ge[3]),ns(.85,"셰이더 준비 중…"),await ss(),r.world&&r.renderer.compile(r.world.scene,r.camera);const a=new xg(e,r,s,t,n);r.fsm.go("menu"),r.start(),ns(1,"완료"),await ss(),document.getElementById("loading")?.classList.add("done"),window.setTimeout(()=>document.getElementById("loading")?.remove(),500),a.enterMenu(),s.loadWarning&&a.toast(s.loadWarning),t.startMusic(),new URLSearchParams(location.search).has("test")&&(window.__longshot={game:r,ui:a,save:s,input:n,audio:t})}window.addEventListener("error",s=>Lr(s.error??s.message));window.addEventListener("unhandledrejection",s=>Lr(s.reason));yg().catch(Lr);
