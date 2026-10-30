import './player-death.css';
import type { GameRuntime } from '@engine/runtime';
import type { InputSnapshot } from '@engine/input';
import type { Phase } from '@engine/game';
import { loadGlb } from '@engine/gltf/glb';
import { Animator, type Layer } from '@engine/gltf/animator';
import { ModelRenderer, type GpuModel } from '@engine/gpu/model';
import { MESH, hex } from '@engine/gpu/meshes';
import { mat4 } from '@engine/math';
import { EnvironmentScene } from './scenes/environment';
import { terrainHeight } from './scenes/terrain';
import { overlookHeight } from './scenes/overlook';
import { CastlePatrol, ENEMY_MODEL_LIMIT, CORE_MAX_HP } from './castle-patrol';
import { AttackWindow, attackVolume, PROJECTILE_RELEASE, type FighterClass } from './castle-combat';
import { makeProjectile, advanceProjectiles, assistedTarget, type Projectile } from './castle-projectiles';
import { PARTICLE } from '@engine/fx';
import { StuckArrows, scoutAimGuide } from './scout-arrows';
import { installSceneLinks } from './scene-menu';
import { installMobilePreview } from './mobile-preview';
import { loopLayers } from './loop-layers';
import { IdleVariations } from './idle-motion';
import { enemyAttackPose, EnemyDeaths, enemyReaction } from './enemy-motion';
import { enemyType } from './enemy-types';
import { CastleMusic, campDistance } from './castle-music';
import { CombatAudioEvents } from './combat-audio-events';
import { drawGateLevers } from './gate-view';
import { LeverReactions, emitLeverImpact } from './lever-effects';
import { playerDamageFeedback } from './player-damage-feedback';
import { GateCinematic } from './gate-cinematic';
import { VictoryFinale } from './victory-finale';
import { CasterSpells } from './caster-spells';
import { HEAL_COOLDOWN, healNearby } from './healing';
import { emitHealing } from './healing-effects';
import { GuardianHud } from './guardian-hud';
import { HeartTree } from './heart-tree';
import { EnemyEmergence } from './enemy-emergence';
import { spawnCue } from './spawn-cue';
import { DeathNotice } from './player-death';
import { ScoutDraw, SCOUT_MIN_RANGE } from './scout-draw';

type EnvironmentState = { playerX:number; playerZ:number; selected:FighterClass };
/** Play-specific objectives and combat layered over the unchanged environment test. */
export class CastleGame extends EnvironmentScene {
  private runtime!:GameRuntime;
  private patrol=new CastlePatrol();
  private musicState=new CastleMusic();
  private combatAudio=new CombatAudioEvents();
  private cinematic=new GateCinematic();
  private finale=new VictoryFinale();
  private casterSpells=new CasterSpells();
  private healCooldown=0;
  private castHealing=false;
  private guardianHud=new GuardianHud();
  private leverReactions = new LeverReactions();
  private deathNotice=new DeathNotice();
  private heartTree!:HeartTree;
  private swing=new AttackWindow();
  private scoutDraw=new ScoutDraw();
  private scoutShotRange=SCOUT_MIN_RANGE;
  private enemyRenderer!:ModelRenderer;
  private models:GpuModel[]=[];
  private enemyAnimators:Animator[]=[];
  private breachedKeep!:GpuModel;
  private arrows:GpuModel[]=[];
  private projectiles:Projectile[]=[];
  private stuck=new StuckArrows();
  private stuckModels:GpuModel[]=[];
  private enemyRoot=mat4.identity();
  private enemyDeaths=new EnemyDeaths();
  private enemyIdles=new IdleVariations();
  private enemyEmergence=new EnemyEmergence();
  private heldAttack=false;
  private showHitboxes=false;
  private debugButton!:HTMLButtonElement;
  private get player():EnvironmentState {return (this.runtime.hooks.environmentLab as ()=>EnvironmentState)();}
  protected override musicTrack(){return 'castleCamp';}
  protected override initialPossessed(){return true;}
  protected override coreVisible(){return false;}
  protected override playerDeathRemaining(){return this.patrol.respawnRemaining;}
  protected override showNockedArrow(age:number){return age<PROJECTILE_RELEASE;}
  protected override castleBreached(){return this.patrol.gateOpen || this.playablePose().z < -20.2;}
  async load(rt:GameRuntime,progress:(p:number,label?:string)=>void){
    this.runtime=rt;await super.load(rt,progress);rt.input.stickZone=()=>true;if(import.meta.env.DEV)installMobilePreview(rt);this.enemyRenderer=new ModelRenderer(rt.renderer);
    const docs=await Promise.all(['enemies/bloom-animated.glb','enemies/bramble-animated.glb','enemies/mushroom-animated.glb','enemies/stump-animated.glb','environment-lab/tripo-keep-breached.glb','weapons/arrow.glb'].map(name=>loadGlb(new URL(`assets/${name}`,document.baseURI).href)));
    const actors=docs.slice(0,4);
    for(const doc of actors)if(!doc.skins.length || !['idle','walk','attack'].every(name=>doc.clips.some(clip=>clip.name===name)))throw new Error('Enemy model is missing its rig or animation clips');
    const base=actors.map(doc=>this.enemyRenderer.upload(doc));
    this.models=Array.from({length:ENEMY_MODEL_LIMIT},(_,i)=>i<4?base[i]:this.enemyRenderer.instance(base[i%4]));
    this.enemyAnimators=Array.from({length:ENEMY_MODEL_LIMIT},(_,i)=>new Animator(actors[i%4]));
    this.breachedKeep=this.enemyRenderer.upload(docs[4]);
    this.heartTree=new HeartTree(this.enemyRenderer,docs[3]);
    const arrow=this.enemyRenderer.upload(docs[5]);this.arrows=Array.from({length:8},(_,i)=>i?this.enemyRenderer.instance(arrow):arrow);
    this.stuckModels=Array.from({length:12},()=>this.enemyRenderer.instance(arrow));
    this.enemyRenderer.recolor(this.breachedKeep,new Map([['tripo_material_7b637080-eb7c-480b-a995-2928cb1e52c9',[.32,.32,.32]]]));
    rt.renderer.sceneHooks.push(()=>this.enemyRenderer.draw());document.body.classList.add('castle-play');installSceneLinks();
    document.querySelector<HTMLButtonElement>('#gym-class')?.addEventListener('click',()=>this.cycleClass());
    const allies=document.querySelector<HTMLElement>('#gym-allies');if(allies)allies.hidden=true;
    this.debugButton=document.createElement('button');this.debugButton.type='button';this.debugButton.className='castle-hitboxes';this.debugButton.addEventListener('click',()=>this.toggleHitboxes());document.body.append(this.debugButton);this.updateDebug();
    Object.assign(rt.hooks,{leverEffects:()=>this.leverReactions.snapshot()});
    Object.assign(rt.hooks,{castlePlay:()=>({health:this.patrol.health,defeats:this.patrol.defeats,alive:this.patrol.alive,limit:ENEMY_MODEL_LIMIT,gateOpen:this.patrol.gateOpen,leverHealth:[...this.patrol.gate.health],gateRemaining:this.patrol.gate.remaining,cinematic:this.cinematic.active,victorySequence:this.finale.active,coreHealth:this.patrol.coreHealth,guardian:{...this.patrol.guardian},cleared:this.patrol.cleared,attackAge:this.swing.age,attackKind:this.swing.kind,projectiles:this.projectiles.map(p=>({...p})),stuckArrows:this.stuck.arrows.map(a=>({...a})),drawProgress:this.scoutDraw.active?this.scoutDraw.progress:-1,drawRange:this.scoutDraw.range,aimTarget:this.player.selected==='Scout' ? scoutAimGuide(this.player.playerX,this.player.playerZ,this.playablePose().yaw,this.patrol.targets(),this.patrol.gateOpen,this.scoutDraw.range).target?.id??null : null,hitboxes:this.showHitboxes,enemies:this.patrol.enemies.map(e=>({...e})),playerX:this.player.playerX,playerZ:this.player.playerZ})});progress(1,'Castle assault ready');
  }
  private cycleClass(){const select=document.querySelector<HTMLSelectElement>('#environment-lab .env-cast select');if(select){select.selectedIndex=(select.selectedIndex+1)%select.options.length;this.selectPlayableCharacter(select.selectedIndex);}}
  private updateDebug(){if(this.debugButton){this.debugButton.textContent=`Hitboxes: ${this.showHitboxes?'on':'off'}`;this.debugButton.setAttribute('aria-pressed',String(this.showHitboxes));}}
  private toggleHitboxes(){this.showHitboxes=!this.showHitboxes;this.updateDebug();}
  reset(){this.healCooldown=0;this.castHealing=false;this.finale.skip();this.deathNotice.clear();this.cinematic.skip();super.reset();this.patrol.reset();this.enemyDeaths.clear();this.enemyIdles.clear();this.enemyEmergence.clear();this.musicState.reset();this.combatAudio.reset();this.sound.setTrack('castleCamp');this.swing=new AttackWindow();this.scoutDraw.cancel();this.projectiles=[];this.stuck.clear();}
  input(snap:InputSnapshot,dt:number){
    if(this.patrol.respawnRemaining>0){this.heldAttack=false;this.scoutDraw.cancel();return;}
    if(snap.pressed.has('class'))this.cycleClass();if(snap.pressed.has('bounds'))this.toggleHitboxes();
    this.heldAttack=snap.held.has('attack') || snap.pressed.has('attack');const pressed=new Set(snap.pressed);
    pressed.delete('attack');
    const kind=this.player.selected;
    if(kind!=='Scout')this.scoutDraw.cancel();
    const release=kind==='Scout'?this.scoutDraw.step(this.heldAttack,dt,this.swing.ready && !this.patrol.cleared && this.runtime.phase==='playing'):null;
    const healing=kind==='Spellcaster' && this.casterSpells.selected==='heal';
    const start=kind==='Scout'?release!==null:this.heldAttack && this.swing.ready && (!healing || this.healCooldown<=0);
    if(start && !this.patrol.cleared && this.runtime.phase==='playing'){
      const pose=this.playablePose(),targets=this.patrol.targets();
      if(release!==null)this.scoutShotRange=release;
      const target=kind==='Knight' ? targets.map(t=>({...t,d:Math.hypot(t.x-pose.x,t.z-pose.z)})).filter(t=>t.d<=2.1).sort((a,b)=>a.d-b.d)[0]
        : kind==='Scout' ? assistedTarget(pose.x,pose.z,pose.yaw,targets,this.patrol.gateOpen,this.scoutShotRange) : undefined;
      if(target)this.aimPlayableAt(target.x,target.z);
      this.castHealing=healing;this.swing.start(kind);pressed.add('attack');
    }
    super.input({...snap,pressed},dt);
    if(this.scoutDraw.active)this.holdScoutDrawPose();
  }
  frame(dt:number,snap:InputSnapshot,phase:Phase):[number,number]{
    if(phase==='playing') {
      const pose=this.playablePose();
      const danger=this.patrol.enemies.some(e=>e.alive && Math.hypot(e.x-pose.x,e.z-pose.z)<4.5);
      this.sound.setTrack(this.musicState.update(dt,{cleared:this.patrol.cleared,gateOpen:this.patrol.gateOpen,danger,coreHealth:this.patrol.coreHealth,coreMaxHealth:CORE_MAX_HP,nearCore:Math.hypot(pose.x-this.patrol.guardian.x,pose.z-this.patrol.guardian.z)<4.5,campDistance:campDistance(pose.x,pose.z)}));
    }
    const camera=super.frame(dt,snap,phase);
    if(phase!=='playing')this.finale.skip();else this.finale.step(dt,this.runtime);
    if(this.cinematic.step(dt,this.runtime) && phase==='playing')this.sound.cue('gateImpact');
    if(phase==='playing'){
      this.healCooldown=Math.max(0,this.healCooldown-dt);
      this.swing.advance(Math.min(dt,.1));
      const pose=this.playablePose();
      if(this.swing.kind!=='Knight' && !this.swing.released && this.swing.age>=PROJECTILE_RELEASE && this.swing.age<1){
        this.swing.released=true;
        if(this.swing.kind==='Spellcaster'&&this.castHealing){const self={x:pose.x,z:pose.z,health:this.patrol.health,connected:true,respawnRemaining:this.patrol.respawnRemaining};healNearby(pose,[self],this.patrol.gateOpen);this.patrol.health=self.health;this.healCooldown=HEAL_COOLDOWN;emitHealing(this.runtime,pose.x,pose.z);}
        else {const hand=this.swing.kind==='Scout'?this.scoutArrowOrigin():{x:pose.x,y:.9,z:pose.z};
        const projectile=makeProjectile(this.swing.kind==='Scout'?'arrow':'orb',hand.x,hand.z,pose.yaw,this.patrol.targets(),this.patrol.gateOpen,this.scoutShotRange);
        projectile.height=Math.max(.4,hand.y);this.projectiles.push(projectile);}
      }
      this.stuck.step(dt,this.patrol.targets());
      const defeatsBefore=this.patrol.defeats;
      const result=this.patrol.hit(this.swing,pose.x,pose.z,pose.yaw,this.swing.kind);
      this.showImpact(result,pose.x,pose.z);
      for(const impact of advanceProjectiles(this.projectiles,dt,this.patrol.targets(),this.patrol.gateOpen)){
        this.stuck.add(impact,this.patrol.targets());
        const damage=this.patrol.impact(impact);this.showImpact(damage,impact.x,impact.z);
        if(impact.projectile.kind==='orb'){this.sound.cue('orbImpact');this.runtime.particles.spawn({kind:PARTICLE.ring,x:impact.x,y:.15,z:impact.z,size:1.65,life:.35,color:[.7,.45,1],glow:.25});}
      }
      if(this.patrol.defeats>defeatsBefore)this.sound.cue('enemyDefeat');
      const before=this.patrol.health;
      if(this.patrol.step(dt,pose.x,pose.z)){this.sound.cue('respawn');super.reset();this.projectiles=[];this.stuck.clear();this.runtime.pops.pop(0,1.7,22,'Back at camp','good',1);}
      else if(this.patrol.health<before){this.sound.cue('playerHurt');playerDamageFeedback(this.runtime, this.patrol.health <= 0);if(this.patrol.health<=0){this.swing=new AttackWindow();this.scoutDraw.cancel();}else this.runtime.pops.pop(pose.x,1.7,pose.z,'Ouch!','bad',1);}
    }
    if (phase === "playing") for (const i of this.leverReactions.step(this.patrol.gate.hitCount, dt)) emitLeverImpact(this.runtime, i, this.playablePose());
    const listener=this.playablePose();
    this.sound.combat(this.combatAudio.update({round:0,gateOpen:this.patrol.gateOpen,cleared:this.patrol.cleared,coreHealth:this.patrol.coreHealth,corePosition:{x:this.patrol.guardian.x,z:this.patrol.guardian.z},guardianAttack:this.patrol.guardian.attackCue,leverHealth:this.patrol.gate.health,leverHits:this.patrol.gate.hitCount,enemies:this.patrol.enemies.map((e,i)=>({id:String(i),x:e.x,z:e.z,hp:e.hp,attackSeq:e.attackSeq}))},phase==='playing'),listener.x,listener.z);
    for(const [i,e] of this.patrol.enemies.entries()){this.enemyDeaths.update(String(i),e.alive,dt);if(e.alive)this.enemyIdles.update(String(i),phase==='playing'?dt:0,!e.moving && e.windup<=0 && e.attackCue<=0 && e.hitFlash<=0);else this.enemyIdles.remove(String(i));if(this.enemyEmergence.update(String(i),e.alive,dt))spawnCue(this.runtime,e.x,e.z);}
    this.casterSpells.update(phase==='playing'&&!this.patrol.cleared&&this.player.selected==='Spellcaster'&&this.patrol.respawnRemaining<=0,this.healCooldown);
    const guardian=this.patrol.guardian,hero=this.playablePose();
    this.guardianHud.update(phase==='playing'&&!this.patrol.cleared&&hero.z < -20.2&&Math.hypot(hero.x-guardian.x,hero.z-guardian.z)<10,guardian.phase,guardian.windup,this.patrol.coreHealth);
    const status=document.querySelector<HTMLElement>('#gym-status');if(status)status.textContent=this.patrol.cleared?'Bramble Boss defeated!':this.patrol.gateOpen?`Bramble Boss ${this.patrol.coreHealth}/${CORE_MAX_HP} · ${this.patrol.gate.remaining>0?`gate ${Math.ceil(this.patrol.gate.remaining)}s`:'gate held'}`:'Break the gate';
    this.deathNotice.update(this.patrol.respawnRemaining);
    const health=document.querySelector<HTMLElement>('#gym-health');if(health)health.textContent=`♥ ${this.patrol.health}/6`;
    const hint=document.querySelector<HTMLElement>('#gym-objective');if(hint)hint.textContent=this.scoutDraw.active?`Drawing ${Math.round(this.scoutDraw.progress*100)}% · release to fire`:this.patrol.cleared?'Bramble Boss defeated!':this.patrol.gateOpen?'Attack the Bramble Boss · strike levers to delay repairs':'Strike both levers to zero before they repair';
    const button=document.querySelector<HTMLButtonElement>('#gym-class');if(button)button.textContent=`Class: ${this.player.selected}`;return camera;
  }
  private showImpact(result:{hits:number;coreHit:boolean;breached:boolean;cleared:boolean},x:number,z:number){
    if(result.hits)this.runtime.pops.pop(x,1.7,z,result.hits>1?`${result.hits} hits!`:'Hit!','good',.7);
    if(result.breached){this.cinematic.start(this.runtime);this.sound.cue('gateBreach');}
    if(result.cleared){this.sound.cue('coreClear');this.finale.start(this.runtime,this.patrol.guardian.x,this.patrol.guardian.z);}
    if(result.coreHit)this.runtime.pops.pop(this.patrol.guardian.x,2,this.patrol.guardian.z,result.cleared?'Bramble Boss defeated!':'Boss hit!','good',1);
  }
  draw(){
    super.draw();const b=this.runtime.batches;
    { const pose = this.playablePose(); drawGateLevers(this.runtime,this.patrol.gate.health,this.patrol.time,{...pose,ground:Math.max(terrainHeight(pose.x,pose.z),overlookHeight(pose.x,pose.z))},this.patrol.cleared,this.cinematic.active,this.patrol.gateOpen,[this.leverReactions.angle(0),this.leverReactions.angle(1)],[this.leverReactions.flash(0),this.leverReactions.flash(1)]); }
    if(this.patrol.gateOpen && this.playablePose().z > -21){mat4.compose(this.enemyRoot,0,0,0,-18,0,0,0,1.2,1.4,1);this.enemyRenderer.prepareStatic(this.breachedKeep,{root:this.enemyRoot});}
    if(this.patrol.gateOpen)this.cinematic.draw(this.runtime);
    if(this.patrol.gateOpen || this.playablePose().z < -20.2 || this.patrol.guardian.phase>0)this.heartTree.draw(this.runtime,this.patrol.coreHealth,this.patrol.time,this.patrol.cleared,this.patrol.guardian);
    for(const [i,e] of this.patrol.enemies.entries()){
      const deathAge=this.enemyDeaths.age(String(i));if(!e.alive && deathAge===undefined)continue;
      const reaction=enemyReaction(e.alive?e.hitFlash:0,deathAge),profile=enemyType(e.type);
      const anticipation=e.windup>0?1-e.windup/.5:0;
      const lunge=e.alive?(e.attackCue>0?Math.sin(Math.PI*(1-e.attackCue/.45))*.24:-anticipation*.13):0;
      const offset=lunge-reaction.back*profile.scale;
      mat4.compose(this.enemyRoot,0,e.x+Math.sin(e.yaw)*offset,-reaction.sink*profile.scale,e.z+Math.cos(e.yaw)*offset+this.enemyEmergence.offset(String(i)),e.yaw,reaction.pitch,0,profile.scale,profile.scale,profile.scale);
      const animator=this.enemyAnimators[i], layers:Layer[]=[{clip:'idle',time:0}];
      if(e.alive && e.moving)layers.push(...loopLayers('walk',e.gait,animator.clipDuration('walk'),1));
      animator.update(layers,this.enemyRoot,reaction.pose ?? (e.alive?(enemyAttackPose(e.windup,e.attackCue) ?? this.enemyIdles.pose(String(i),e.type,true)):undefined));
      this.enemyRenderer.prepareSkinned(this.models[i],animator,{flash:e.alive&&e.hitFlash>0?.65:0});this.runtime.blob(e.x,e.z,profile.radius,.35*(1-reaction.sink));
      if(!e.alive)continue;
      if(e.windup>0)b[MESH.cylinder].push(e.x,.05,e.z,0,0,0,1.8,.03,1.8,hex(0xe46f4f),.8);
      if(e.hp<e.maxHp){const barY=profile.height*profile.scale+.25;b[MESH.box].push(e.x,barY,e.z,0,0,0,1,.07,.08,hex(0x442b32),.8);b[MESH.box].push(e.x-(1-e.hp/e.maxHp)*.5,barY+.02,e.z,0,0,0,e.hp/e.maxHp,.08,.09,hex(0x8fe86d),.8);}
      if(this.showHitboxes)b[MESH.cylinder].push(e.x,.04,e.z,0,0,0,profile.radius*2,.035,profile.radius*2,hex(0xec6868),.8);
    }
    for(const [i,p] of this.projectiles.entries()){
      if(p.kind==='arrow' && i<this.arrows.length){
        const yaw=Math.atan2(p.dx,p.dz);mat4.compose(this.enemyRoot,0,p.x,p.height??.9,p.z,yaw,0,0,1,1,1);this.enemyRenderer.prepareStatic(this.arrows[i],{root:this.enemyRoot});
        // A restrained bright tip and short trail make fast arrows readable at game scale.
        b[MESH.sphere].push(p.x,p.height??.9,p.z,0,0,0,.10,.10,.10,hex(0xffe59b),.4,0,1,1,.25);
        b[MESH.box].push(p.x-p.dx*.28,p.height??.9,p.z-p.dz*.28,yaw,0,0,.035,.035,.55,hex(0xffe59b),.4,0,1,1,.2);
      }
      else if(p.kind==='orb'){
        const pulse=1+.12*Math.sin(this.patrol.time*12);b[MESH.sphere].push(p.x,1,p.z,0,0,0,.28*pulse,.28*pulse,.28*pulse,hex(0xba86ff),.35,0,1,1,.65);
        b[MESH.sphere].push(p.x-p.dx*.25,1,p.z-p.dz*.25,0,0,0,.12,.12,.12,hex(0xf3d8ff),.4,0,1,1,.4);
      }
      if(this.showHitboxes)b[MESH.cylinder].push(p.x,.08,p.z,0,0,0,p.kind==='arrow'?.24:.7,.04,p.kind==='arrow'?.24:.7,hex(0xf3dd58),.8);
    }
    for(const [i,a] of this.stuck.arrows.entries()){
      mat4.compose(this.enemyRoot,0,a.x,a.y,a.z,a.yaw,0,0,1.25,1.25,1.25);
      this.enemyRenderer.prepareStatic(this.stuckModels[i],{root:this.enemyRoot});
    }
    if(this.player.selected==='Scout' && !this.patrol.cleared){
      const pose=this.playablePose(),guide=scoutAimGuide(pose.x,pose.z,pose.yaw,this.patrol.targets(),this.patrol.gateOpen,this.scoutDraw.range);
      for(const dot of guide.points)b[MESH.sphere].push(dot.x,.16,dot.z,0,0,0,.13,.13,.13,hex(0x54e5ef),.7,0,1,1,.1);
      if(guide.target){const {x,z}=guide.target,c=hex(0x54e5ef);for(const side of [-1,1]){b[MESH.box].push(x+side*.62,.12,z,0,0,0,.30,.05,.09,c,.6);b[MESH.box].push(x,.12,z+side*.62,0,0,0,.09,.05,.30,c,.6);}}
    }
    if(this.showHitboxes && this.swing.kind==='Knight' && this.swing.active){const pose=this.playablePose(),v=attackVolume(pose.x,pose.z,pose.yaw,this.player.selected);b[MESH.cylinder].push(v.x,.08,v.z,0,0,0,v.radius*2,.04,v.radius*2,hex(0xf3dd58),.8);}
    if(this.showHitboxes && this.patrol.gateOpen && !this.patrol.cleared)b[MESH.cylinder].push(this.patrol.guardian.x,.06,this.patrol.guardian.z,0,0,0,1.6,.04,1.6,hex(0xec6868),.8);
  }
  showHud(on:boolean){if(!on){this.casterSpells.hide();this.guardianHud.hide();this.finale.skip();this.cinematic.skip();this.deathNotice.clear();}super.showHud(on);const hud=document.querySelector<HTMLElement>('#hud');if(hud)hud.hidden=!on;const panel=document.querySelector<HTMLElement>('#environment-lab');if(panel)panel.hidden=true;if(this.debugButton)this.debugButton.hidden=!on;}
}
