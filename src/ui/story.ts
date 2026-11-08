import type { Episode } from '../game/episodes';
import { episodeDialogue } from '../game/dialogue';
import { DialogueVoice } from '../game/dialogueVoice';
import { EPISODE_SECONDS, episodeScene, formatTime } from '../game/episodeTimeline';

export type StoryMode = 'watch' | 'combat' | 'outro' | 'timeskip' | 'ending';

export class StoryScreen {
  private readonly host = document.createElement('section');
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly label: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly musicLabel: HTMLElement;
  private readonly episodeSelect: HTMLSelectElement;
  private readonly skill: HTMLElement;
  private readonly ko: HTMLElement;
  private skip: (() => void) | null = null;
  private music: ((file: File) => void) | null = null;
  private jump: ((episode: number) => void) | null = null;
  private mode: ((mode:'story'|'manual'|'explore')=>void)|null=null;
  private returnToBattle:(()=>void)|null=null;
  private readonly dialogue:HTMLElement;
  private readonly travel:HTMLElement;
  private readonly mission:HTMLElement;
  private readonly voice=new DialogueVoice();
  private dialogueOffset=0;
  private dialogueBeat='';
  private currentLine:{speaker:string;text:string;key:string}|null=null;
  private pilotAction:((action:string,pressed:boolean)=>void)|null=null;

  constructor(episodes: Episode[]) {
    this.host.className = 'story-screen';this.host.hidden = true;
    this.host.innerHTML = `<div class="cinema-top"><span data-story-label></span>
      <div class="story-tools"><label>玩法 <select data-play-mode aria-label="选择玩法"><option value="manual">手动战斗 · 智能瞄准</option><option value="story">自动战斗</option><option value="explore">自由探索</option></select></label><button data-return type="button">返回剧情 / 战场</button><label><input data-voice type="checkbox" checked>角色语音</label><label class="episode-picker">选集 <select aria-label="选择剧集">
      ${episodes.map((ep,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')} · ${ep.title}</option>`).join('')}
      <option value="53">特别篇 · 两年后</option><option value="54">第 53 集 · 银河怪兽总攻</option></select></label>
      <label class="song-picker"><span data-music-label>导入《奇迹再现》</span><input type="file" accept="audio/*" aria-label="导入高潮配乐"></label></div></div>
      <div class="story-copy"><h2 data-story-title></h2><p data-story-subtitle></p>
      <button type="button" data-story-skip>进入本集战斗 <span>→</span></button></div>
      <div class="dialogue-card"><strong data-speaker></strong><p data-dialogue></p><button data-dialogue-skip type="button" aria-label="跳过这句对话">跳过这句 <span>›</span></button></div><div class="travel-info" hidden></div>
      <div class="pilot-hud" hidden><div data-mission></div><div class="pilot-reticle">⌖</div><div class="pilot-controls"><button data-pilot="move-left">←</button><button data-pilot="move-right">→</button><button data-pilot="jump">升</button><button data-pilot="move-down">降</button><button data-pilot="move-forward">加速</button><button data-pilot="punch">发射</button><button data-pilot="eject">P 跳伞</button></div></div>
      <div class="time-card" aria-live="polite">两年后</div><div class="skill-caption" hidden aria-live="polite"></div>
      <div class="ko-caption" hidden><strong>KO</strong><span>光，正在重新汇聚</span></div>`;
    document.body.append(this.host);
    this.title=this.host.querySelector('[data-story-title]')!;
    this.subtitle=this.host.querySelector('[data-story-subtitle]')!;
    this.label=this.host.querySelector('[data-story-label]')!;
    this.button=this.host.querySelector('[data-story-skip]')!;
    this.musicLabel=this.host.querySelector('[data-music-label]')!;
    this.episodeSelect=this.host.querySelector('[aria-label="选择剧集"]')!;
    this.dialogue=this.host.querySelector('.dialogue-card')!;
    this.travel=this.host.querySelector('.travel-info')!;
    this.mission=this.host.querySelector('.pilot-hud')!;
    this.host.querySelector('[data-dialogue-skip]')!.addEventListener('click',()=>{
      this.voice.cancel();this.dialogueOffset++;this.currentLine=null;
    });
    this.host.querySelector('[data-voice]')!.addEventListener('change',event=>this.voice.setEnabled((event.target as HTMLInputElement).checked));
    this.host.querySelectorAll<HTMLButtonElement>('[data-pilot]').forEach(button=>{
      button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);this.pilotAction?.(button.dataset.pilot!,true);});
      const release=()=>this.pilotAction?.(button.dataset.pilot!,false);
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    });
    this.host.querySelector('[data-play-mode]')!.addEventListener('change',event=>this.mode?.((event.target as HTMLSelectElement).value as 'story'|'manual'|'explore'));
    this.host.querySelector('[data-return]')!.addEventListener('click',()=>this.returnToBattle?.());
    this.skill=this.host.querySelector('.skill-caption')!;
    this.ko=this.host.querySelector('.ko-caption')!;
    this.button.addEventListener('click',()=>this.skip?.());
    this.episodeSelect.addEventListener('change',()=>this.jump?.(Number(this.episodeSelect.value)));
    this.host.querySelector('input[type="file"]')!.addEventListener('change', event=>{
      const file=(event.target as HTMLInputElement).files?.[0];
      if(file){this.music?.(file);this.musicLabel.textContent=`高潮配乐：${file.name}`;}
    });
  }
  onSkip(fn:()=>void){this.skip=fn;}
  onMusic(fn:(file:File)=>void){this.music=fn;}
  onJump(fn:(episode:number)=>void){this.jump=fn;}
  onMode(fn:(mode:'story'|'manual'|'explore')=>void){this.mode=fn;}
  onReturn(fn:()=>void){this.returnToBattle=fn;}
  onPilotAction(fn:(action:string,pressed:boolean)=>void){this.pilotAction=fn;}
  setPlayMode(mode:'story'|'manual'|'explore'){(this.host.querySelector('[data-play-mode]') as HTMLSelectElement).value=mode;}
  setMuted(muted:boolean){this.voice.setMuted(muted);}
  showMission(text:string,locked:boolean){this.mission.hidden=!text;this.mission.querySelector('[data-mission]')!.textContent=text;this.mission.classList.toggle('locked',locked);document.body.dataset.pilot=String(!!text);}
  showTravel(text:string){this.travel.textContent=text;this.travel.hidden=!text;}
  showSkill(text:string,color:string){this.skill.textContent=text;this.skill.style.setProperty('--skill-color',color);this.skill.hidden=!text;}
  showKo(active:boolean,rescue:boolean){this.ko.hidden=!active&&!rescue;this.ko.querySelector('span')!.textContent=rescue?'众人举起光芒 · 剧情自动演出中':'光，正在重新汇聚';}
  render(started:boolean, mode:StoryMode, episode:Episode, number:number, elapsed:number, deaths:number,episodeElapsed=elapsed,exploring=false){
    this.host.hidden=!started;
    this.host.dataset.mode=exploring?'combat':mode;
    document.body.dataset.story=started?(exploring?'combat':mode):'menu';
    const scene=episodeScene(elapsed);
    this.label.textContent=`${number===54?'EPISODE 53 · 银河怪兽总攻':number>52?'SPECIAL · 最终圣战':`EPISODE ${String(number).padStart(2,'0')} / 52`} · ${formatTime(episodeElapsed)} / ${formatTime(EPISODE_SECONDS)}${exploring?' · 探索中，剧情暂停':''}`;
    this.episodeSelect.value=String(number);
    this.dialogue.hidden=!started||exploring||(mode!=='watch'&&mode!=='outro');
    const beat=`${number}:${mode}:${Math.floor(elapsed/10)}`;
    if(beat!==this.dialogueBeat){this.dialogueBeat=beat;this.dialogueOffset=0;}
    const line=episodeDialogue(episode,elapsed,mode==='outro',this.dialogueOffset);
    if(!line.text)this.dialogue.hidden=true;
    this.dialogue.querySelector('strong')!.textContent=line.speaker;
    this.dialogue.querySelector('p')!.textContent=line.text;
    if(this.dialogue.hidden){if(this.currentLine)this.voice.cancel();this.currentLine=null;}
    else if(this.currentLine?.key!==`${number}:${line.key}`){this.currentLine={...line,key:`${number}:${line.key}`};this.voice.speak(this.currentLine.key,line.voiceSpeaker??line.speaker,line.text);}
    this.title.textContent=mode==='ending'?'光，仍在我们心中':mode==='outro'?'这一次，我们守住了光。':episode.title;
    this.subtitle.textContent=mode==='combat'?`本集倒下 ${deaths} 次 · ${episode.enemies.some(e=>e.id==='gatanothor'||e.id==='demogea')?'倒下一次唤醒闪耀':'倒下三次唤醒闪耀'}`
      :mode==='outro'?'战后搜救 · 战机返航 · 人物尾声':mode==='ending'?'最终圣战结束。谢谢你，光的继承者。':`${scene.title} · 空格自由探索`;
    this.button.hidden=exploring||mode==='combat'||mode==='timeskip'||mode==='ending';
    this.button.textContent=mode==='outro'?'继续下一集 →':'跳过片段 · 进入战斗 →';
  }
}
