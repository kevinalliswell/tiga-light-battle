import type { Episode } from './episodes';
import { episodeScene } from './episodeTimeline';

const LINES:Record<string,Array<[string,string]>>={
  briefing:[['通讯','城市东侧出现异常震动，雷达影像正在传回。'],['堀井','不是地震，热源正在地下移动。把频谱放大。'],['指挥官','新城和丽娜驾驶战机侦察。大古，协助地面疏散。'],['丽娜','航线确认，避开居民区，先找到怪兽的位置。'],['新城','先观察它的动作，不能让它靠近避难所。'],['大古','我去通知街区的人，保持通讯畅通。']],
  launch:[['通讯','机库开启。胜利飞跃号，准许起飞。'],['丽娜','动力稳定，机翼展开，开始滑行。'],['新城','一号机升空，二号机跟随。'],['堀井','热源就在前方山脊，别飞得太低。'],['指挥官','两机分开侦察，发现目标先报告。'],['丽娜','收到。全队，转向城市外侧。']],
  pilot:[['丽娜','现在由你驾驶。方向键调整航向，F加速，J减速，Q发射。'],['新城','瞄准框变亮就能命中，跟着前方的航路环飞。'],['通讯','四分钟掩护任务开始，保护撤离路线。'],['堀井','怪兽准备发射光线，向侧面闪避！'],['丽娜','保持高度，我掩护你通过下一个航路环。'],['指挥官','不要急着击倒它。给地面队争取撤离时间。']],
  rescue:[['大古','大家沿着蓝色路标走，不要回头！'],['市民','孩子还在前面的车里，请帮帮我们！'],['大古','我看到了。你们先走，我马上把他带出来。'],['丽娜','战机已经拉开怪兽，地面队可以穿过路口。'],['新城','再坚持一下，最后一辆救援车正在离开。'],['通讯','避难通道恢复。继续检查两侧街区。']],
  monster:[['堀井','它头部的能量正在聚集，全队注意！'],['新城','光线过来了！拉升，拉升！'],['丽娜','右翼擦伤，还能飞。我来把它引开。'],['指挥官','放弃正面强攻，保护地面队。'],['大古','它开始转向避难所了，我必须阻止它。'],['通讯','防线正在后撤，所有人员寻找掩体。']],
  counterattack:[['指挥官','两架战机交叉掩护，瞄准头部能量器官！'],['丽娜','一号机进入攻击航线，开始俯冲。'],['新城','我从另一边吸引它，你准备发射。'],['堀井','攻击命中！但装甲还没有被打穿。'],['丽娜','先脱离！它要反击了！'],['通讯','队员已安全跳伞，地面队前去接应。']],
  resolve:[['大古','大家都在拼命保护这座城市，我也不能放弃。'],['丽娜','大古，你在哪里？听到请回答。'],['大古','我很好。带大家离开，我一定会回来。'],['指挥官','还有生命反应，继续救援，不要放弃任何人。'],['大古','如果心中的光还在，我们就还有希望。'],['旁白','穿过烟尘，光的继承者举起了神光棒。']],
  outro:[['通讯','怪兽反应消失。救援队已经进入街区。'],['丽娜','这里是一号机，队员全部平安，准备返航。'],['新城','刚才真险啊。下次可不会再让它追着跑了。'],['堀井','样本已经取回，我会查清这次异常的原因。'],['市民','谢谢你们。我们终于可以回家了。'],['大古','真正让奇迹出现的，是每个人都没有放弃。']],
};
export function episodeDialogue(episode:Episode,elapsed:number,outro=false,offset=0){
  const scene=episodeScene(elapsed);
  const lines=LINES[outro?'outro':scene.kind];
  const index=Math.floor((outro?elapsed:scene.local)/10)+offset;
  if(index>=lines.length)return {speaker:'',text:'',key:`${outro?'outro':scene.kind}:quiet`};
  const [speaker,base]=lines[index%lines.length];
  let text=!outro&&scene.kind==='briefing'&&index===0?`${episode.narration[0]} ${base}`:
    !outro&&scene.kind==='monster'&&index===0?`发现${episode.enemies.map(e=>e.name).join('和')}！${base}`:base;
  if(episode.cast){
    for(const [from,to] of Object.entries(episode.cast))text=text.replaceAll(from,to);
    text=text.replaceAll('胜利飞跃号','支援战机').replaceAll('神光棒','变身装置');
    if(scene.kind==='briefing'&&index===0)text=`${episode.sceneName}。${text}`;
  }
  return {speaker:episode.cast?.[speaker]??speaker,voiceSpeaker:speaker,text,key:`${outro?'outro':scene.kind}:${index}`};
}
