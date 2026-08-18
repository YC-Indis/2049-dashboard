import type { MatrixBlueprint } from '@/types/dojoInspiration'

/**
 * 从《xros6 矩阵规划》100 条脚本中归纳的代表性母题。
 * 原始表格只读保留；这里存可直接进入生产流程的结构化蓝图，不冒充在线检索结果。
 */
export const matrixBlueprints: MatrixBlueprint[] = [
  {
    id: 'matrix-bestie-tap',
    motif: 'Bestie 双人碰拍',
    format: '双人互动 / 6–9 秒',
    promise: '用重复动作建立“同频好友”的关系记忆点',
    evidenceUrl: 'https://www.tiktok.com/@lds.studio83/video/7633855259688963350',
    shotRequirement: '两人先碰鞋，再碰产品；动作完整、节奏紧，产品从开场到收尾持续露出。',
    beats: ['鞋面近景建立动作', '两人同步碰鞋', '手部抬起完成产品碰拍', '卡点定格品牌与配色'],
    productRule: '产品始终在手中，碰拍时型号和配色不能被手指遮挡。',
    visual: '自然光，双人穿搭与产品颜色形成呼应。',
    audio: '使用对应市场当周 TikTok 热门音乐，碰拍落在重拍。',
    completeness: 94,
    variants: [
      {
        market: '美国',
        hook: 'if we both have one we click 👟⚡',
        distribution: 'find someone who matches your freak',
        hashtags: '#XROS6 #bestie #mood #fyp'
      },
      {
        market: '英国',
        hook: 'bestie check: same vibe, same XROS 6',
        distribution: 'When the vibe matches without even trying.',
        hashtags: '#XROS6 #BestieCheck #UKTikTok #FYP'
      },
      {
        market: '波兰',
        hook: 'bestie sync, but make it XROS 6',
        distribution: 'Ten moment, kiedy obie macie ten sam vibe.',
        hashtags: '#XROS6 #bestie #polskatiktok #fyp'
      }
    ]
  },
  {
    id: 'matrix-coffee-lid',
    motif: 'Coffee 伪联名',
    format: '生活方式反转 / 7–10 秒',
    promise: '先让观众误认咖啡杯，再用产品形成轻反转',
    evidenceUrl: 'https://www.tiktok.com/@feelm_us/video/7637731439504657695',
    shotRequirement: '将产品烟嘴卡在咖啡杯盖上，拿起杯子再放下，动作像一次日常咖啡仪式。',
    beats: ['咖啡杯与手部入镜', '拿起杯子制造误认', '镜头靠近揭示产品', '放下并留出文案区'],
    productRule: '不做真实饮用暗示；揭示镜头必须清楚看到完整产品。',
    visual: '窗边自然光，桌面道具克制，咖啡与产品颜色统一。',
    audio: '轻快生活方式热门音乐，揭示点卡在节拍变化。',
    completeness: 91,
    variants: [
      {
        market: '美国',
        hook: 'xros x starbucks collab when ☕',
        distribution: 'new morning ritual just dropped',
        hashtags: '#XROS6 #coffee #lifestyle #foryou'
      },
      {
        market: '英国',
        hook: 'Starbucks run but make it XROS 6',
        distribution: 'Just a quick café stop and a familiar sidekick.',
        hashtags: '#XROS6 #CoffeeRun #LifestyleUK #FYP'
      },
      {
        market: '波兰',
        hook: 'coffee run, but XROS 6 came too',
        distribution: 'Mały rytuał na dobry początek dnia.',
        hashtags: '#XROS6 #coffee #polskatiktok #daily'
      }
    ]
  },
  {
    id: 'matrix-wallet-drop',
    motif: '口袋掉落反转',
    format: 'POV 喜剧 / 6–8 秒',
    promise: '用“本来只想拿手机”的意外制造完播点',
    evidenceUrl: 'https://www.tiktok.com/@puffproject_/video/7627904848180022541',
    shotRequirement: '从口袋取手机或钱包时，让两个产品自然掉出；先保留半秒静止，再给人物反应。',
    beats: ['手伸进口袋', '手机/钱包先出现', '产品意外掉落', '静默反应与字幕收尾'],
    productRule: '掉落高度和地面需可控，避免损坏；至少一个产品正面朝镜头。',
    visual: '固定低机位，自然光，背景避免杂物抢注意力。',
    audio: '掉落声保留，音乐在掉落瞬间抽空或降音量。',
    completeness: 88,
    variants: [
      {
        market: '美国',
        hook: 'xros said we’re coming too 👀',
        distribution: 'my phone was supposed to be the only thing in there',
        hashtags: '#XROS6 #relatable #funny #foryou'
      },
      {
        market: '英国',
        hook: 'XROS 6 said it’s coming too',
        distribution: 'When the essentials are already packed…',
        hashtags: '#XROS6 #EverydayCarry #UKTikTok #FYP'
      },
      {
        market: '波兰',
        hook: 'I only reached for my phone…',
        distribution: 'Kiedy kieszeń ma własny plan.',
        hashtags: '#XROS6 #relatable #polskatiktok #funny'
      }
    ]
  },
  {
    id: 'matrix-battery-day',
    motif: '全天续航时间码',
    format: '证据型 mini vlog / 22–28 秒',
    promise: '用一天内三次电量特写证明续航，而不是只说“续航久”',
    evidenceUrl: 'https://www.tiktok.com/@oppsy.bibby/video/7567544125206088968',
    shotRequirement:
      '开场 100% 电量特写；通勤、咖啡/学习、下午、晚餐、回家共 6 个节点，至少三次显示真实电量。',
    beats: [
      '00:00 100% 快剪开场',
      '08:00 通勤与电量',
      '09:30 日常场景',
      '13:00 中段电量证据',
      '18:30 晚间场景',
      '22:00 结尾电量证据'
    ],
    productRule: '每次电量屏幕必须可读；字幕数值与实拍一致，不允许后期虚构。',
    visual: '早中晚光线自然过渡，所有镜头保留时间码，形成一日时间线。',
    audio: '稳定节奏的 vlog 音乐，环境声用于连接场景。',
    completeness: 100,
    variants: [
      {
        market: '美国',
        hook: 'a balanced day with XROS 6',
        distribution: 'Tiny detail in my vlog, major all-day energy.',
        hashtags: '#XROS6 #dailyvlog #routine #fyp'
      },
      {
        market: '英国',
        hook: 'taking XROS 6 through my day',
        distribution: 'Morning commute to home time — one full day.',
        hashtags: '#XROS6 #LifestyleUK #DailyVlog #FYP'
      },
      {
        market: '波兰',
        hook: 'one full day, one charge check',
        distribution: 'Od poranka do wieczora, wszystko na jednej osi czasu.',
        hashtags: '#XROS6 #dayinmylife #polskatiktok #daily'
      }
    ]
  },
  {
    id: 'matrix-asmr',
    motif: '换弹 ASMR',
    format: '沉浸式微距 / 10–15 秒',
    promise: '用磁吸、滑动和环境细节建立产品质感',
    evidenceUrl: 'https://www.tiktok.com/@puffplayground/video/7623923693533596941',
    shotRequirement: '微距记录烟弹吸入磁吸口的咔哒声、气流阀阻尼声与阳光下的外观变化。',
    beats: ['材质微距', '烟弹靠近磁吸口', '咔哒声完成安装', '滑动气流阀', '阳光下旋转定格'],
    productRule: '关键结构需在焦平面内；避免手遮挡接口和品牌标识。',
    visual: '侧向自然光，极简背景，浅景深但型号可辨认。',
    audio: '关闭背景噪声，保留机械声；音乐只做低电平铺底。',
    completeness: 96,
    variants: [
      {
        market: '美国',
        hook: 'enjoying my XROS 6 moment',
        distribution: 'don’t mind me, just vibing',
        hashtags: '#XROS6 #ASMR #mood #fyp'
      },
      {
        market: '英国',
        hook: 'a calm little XROS 6 moment',
        distribution: 'Quiet vibes, good energy.',
        hashtags: '#XROS6 #ASMR #LifestyleUK #Trending'
      },
      {
        market: '波兰',
        hook: 'that click is the whole point',
        distribution: 'Mały dźwięk, który robi cały klimat.',
        hashtags: '#XROS6 #asmr #polskatiktok #vibes'
      }
    ]
  },
  {
    id: 'matrix-pet',
    motif: '宠物阻止事件',
    format: '宠物互动 / 7–12 秒',
    promise: '把宠物的随机动作变成产品保护冲突',
    evidenceUrl: 'https://www.tiktok.com/@user5318816887565/video/7639260939652451606',
    shotRequirement: '产品放在桌面，宠物试图推落时由主人及时阻止；拍到宠物视线与手部反应。',
    beats: ['产品与宠物同框', '宠物靠近并伸爪', '主人快速阻止', '宠物表情与字幕收尾'],
    productRule: '全程有人保护产品和宠物安全，不诱导宠物接触烟嘴。',
    visual: '固定中近景，桌面干净，宠物眼睛有光。',
    audio: '保留爪子和主人反应声，搭配轻喜剧热门音乐。',
    completeness: 90,
    variants: [
      {
        market: '美国',
        hook: 'hands off my XROS 6',
        distribution: 'yeah… this one’s not leaving my hands',
        hashtags: '#XROS6 #PetTok #relatable #fyp'
      },
      {
        market: '英国',
        hook: 'caught you eyeing my XROS 6',
        distribution: 'The little details always get noticed.',
        hashtags: '#XROS6 #PetMoments #UKTikTok #FYP'
      },
      {
        market: '波兰',
        hook: 'not the XROS 6, please',
        distribution: 'Mój mały kontroler jakości znowu w akcji.',
        hashtags: '#XROS6 #pettok #polskatiktok #funny'
      }
    ]
  }
]
