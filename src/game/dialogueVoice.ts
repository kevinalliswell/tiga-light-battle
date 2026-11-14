const VOICES:Record<string,{pitch:number;rate:number;voice:number}>={
  '指挥官':{pitch:.7,rate:.91,voice:0},
  '丽娜':{pitch:1.35,rate:1.02,voice:1},
  '新城':{pitch:.85,rate:1.08,voice:2},
  '堀井':{pitch:.64,rate:.83,voice:3},
  '大古':{pitch:1,rate:.96,voice:2},
  '市民':{pitch:1.48,rate:1.05,voice:1},
  '通讯':{pitch:1.15,rate:.95,voice:0},
  '旁白':{pitch:.8,rate:.86,voice:3},
};
export class DialogueVoice {
  private key='';
  private muted=false;
  private enabled=true;
  setMuted(muted:boolean){this.muted=muted;if(muted)this.cancel();}
  setEnabled(enabled:boolean){this.enabled=enabled;if(!enabled)this.cancel();else this.key='';}
  speak(key:string,speaker:string,text:string){
    if(key===this.key)return;
    this.key=key;
    if(!('speechSynthesis' in window))return;
    window.speechSynthesis.cancel();
    if(this.muted||!this.enabled||!text)return;
    const profile=VOICES[speaker]??VOICES['大古'];
    const utterance=new SpeechSynthesisUtterance(text);
    const chinese=window.speechSynthesis.getVoices().filter(v=>/^zh|Chinese/i.test(v.lang));
    if(chinese.length)utterance.voice=chinese[profile.voice%chinese.length];
    utterance.lang='zh-CN';utterance.pitch=profile.pitch;utterance.rate=profile.rate;utterance.volume=.9;
    window.speechSynthesis.speak(utterance);
  }
  cancel(){if('speechSynthesis' in window)window.speechSynthesis.cancel();}
}
