// 音乐风格标签多语言数据 - Suno AI 完整标签
// 支持的语言列表
export const SUPPORTED_LANGUAGES = {
  'en': '🇬🇧 English',
  'zh-CN': '🇨🇳 简体中文',
  'zh-TW': '🇹🇼 繁體中文',
  'ja': '🇯🇵 日本語',
  'ko': '🇰🇷 한국어'
}

// 定义标签数据 - value 始终为英文用于 API 传递
const GENRE_TAGS = {
  // 主流流派
  pop: { en: 'Pop', 'zh-CN': '流行', 'zh-TW': '流行', ja: 'ポップ', ko: '팝' },
  rock: { en: 'Rock', 'zh-CN': '摇滚', 'zh-TW': '搖滾', ja: 'ロック', ko: '록' },
  electronic: { en: 'Electronic', 'zh-CN': '电子', 'zh-TW': '電子', ja: 'エレクトロニック', ko: '일렉트로닉' },
  hiphop: { en: 'Hip-Hop', 'zh-CN': '嘻哈', 'zh-TW': '嘻哈', ja: 'ヒップホップ', ko: '힙합' },
  rnb: { en: 'R&B', 'zh-CN': 'R&B', 'zh-TW': 'R&B', ja: 'R&B', ko: 'R&B' },
  jazz: { en: 'Jazz', 'zh-CN': '爵士', 'zh-TW': '爵士', ja: 'ジャズ', ko: '재즈' },
  classical: { en: 'Classical', 'zh-CN': '古典', 'zh-TW': '古典', ja: 'クラシック', ko: '클래식' },
  country: { en: 'Country', 'zh-CN': '乡村', 'zh-TW': '鄉村', ja: 'カントリー', ko: '컨트리' },
  folk: { en: 'Folk', 'zh-CN': '民谣', 'zh-TW': '民謠', ja: 'フォーク', ko: '포크' },
  blues: { en: 'Blues', 'zh-CN': '布鲁斯', 'zh-TW': '藍調', ja: 'ブルース', ko: '블루스' },
  soul: { en: 'Soul', 'zh-CN': '灵魂乐', 'zh-TW': '靈魂樂', ja: 'ソウル', ko: '소울' },
  funk: { en: 'Funk', 'zh-CN': '放克', 'zh-TW': '放克', ja: 'ファンク', ko: '펑크' },
  disco: { en: 'Disco', 'zh-CN': '迪斯科', 'zh-TW': '迪斯科', ja: 'ディスコ', ko: '디스코' },
  reggae: { en: 'Reggae', 'zh-CN': '雷鬼', 'zh-TW': '雷鬼', ja: 'レゲエ', ko: '레게' },
  latin: { en: 'Latin', 'zh-CN': '拉丁', 'zh-TW': '拉丁', ja: 'ラテン', ko: '라틴' },
  // 摇滚子类
  metal: { en: 'Metal', 'zh-CN': '金属', 'zh-TW': '金屬', ja: 'メタル', ko: '메탈' },
  punk: { en: 'Punk', 'zh-CN': '朋克', 'zh-TW': '龐克', ja: 'パンク', ko: '펑크' },
  grunge: { en: 'Grunge', 'zh-CN': '垃圾摇滚', 'zh-TW': '油漬搖滾', ja: 'グランジ', ko: '그런지' },
  indie: { en: 'Indie', 'zh-CN': '独立', 'zh-TW': '獨立', ja: 'インディー', ko: '인디' },
  alternative: { en: 'Alternative', 'zh-CN': '另类', 'zh-TW': '另類', ja: 'オルタナティブ', ko: '얼터너티브' },
  progressive: { en: 'Progressive Rock', 'zh-CN': '前卫摇滚', 'zh-TW': '前衛搖滾', ja: 'プログレッシブ', ko: '프로그레시브' },
  psychedelic: { en: 'Psychedelic', 'zh-CN': '迷幻', 'zh-TW': '迷幻', ja: 'サイケデリック', ko: '사이키델릭' },
  // 电子子类
  edm: { en: 'EDM', 'zh-CN': 'EDM', 'zh-TW': 'EDM', ja: 'EDM', ko: 'EDM' },
  house: { en: 'House', 'zh-CN': '浩室', 'zh-TW': '浩室', ja: 'ハウス', ko: '하우스' },
  techno: { en: 'Techno', 'zh-CN': '铁克诺', 'zh-TW': '鐵克諾', ja: 'テクノ', ko: '테크노' },
  trance: { en: 'Trance', 'zh-CN': '迷幻舞曲', 'zh-TW': '迷幻舞曲', ja: 'トランス', ko: '트랜스' },
  dubstep: { en: 'Dubstep', 'zh-CN': '回响贝斯', 'zh-TW': '回響貝斯', ja: 'ダブステップ', ko: '덥스텝' },
  dnb: { en: 'Drum and Bass', 'zh-CN': '鼓打贝斯', 'zh-TW': '鼓打貝斯', ja: 'ドラムンベース', ko: '드럼 앤 베이스' },
  trap: { en: 'Trap', 'zh-CN': '陷阱音乐', 'zh-TW': '陷阱音樂', ja: 'トラップ', ko: '트랩' },
  synthwave: { en: 'Synthwave', 'zh-CN': '合成波', 'zh-TW': '合成波', ja: 'シンセウェーブ', ko: '신스웨이브' },
  // 氛围/背景
  ambient: { en: 'Ambient', 'zh-CN': '氛围', 'zh-TW': '氛圍', ja: 'アンビエント', ko: '앰비언트' },
  lofi: { en: 'Lo-Fi', 'zh-CN': '低保真', 'zh-TW': '低保真', ja: 'ローファイ', ko: '로파이' },
  chillout: { en: 'Chillout', 'zh-CN': '放松', 'zh-TW': '放鬆', ja: 'チルアウト', ko: '칠아웃' },
  newage: { en: 'New Age', 'zh-CN': '新世纪', 'zh-TW': '新世紀', ja: 'ニューエイジ', ko: '뉴에이지' },
  // 影视/史诗
  cinematic: { en: 'Cinematic', 'zh-CN': '电影感', 'zh-TW': '電影感', ja: 'シネマティック', ko: '시네마틱' },
  epic: { en: 'Epic', 'zh-CN': '史诗', 'zh-TW': '史詩', ja: 'エピック', ko: '에픽' },
  orchestral: { en: 'Orchestral', 'zh-CN': '管弦乐', 'zh-TW': '管弦樂', ja: 'オーケストラ', ko: '오케스트라' },
  soundtrack: { en: 'Soundtrack', 'zh-CN': '原声带', 'zh-TW': '原聲帶', ja: 'サウンドトラック', ko: '사운드트랙' },
  // 世界音乐
  world: { en: 'World Music', 'zh-CN': '世界音乐', 'zh-TW': '世界音樂', ja: 'ワールドミュージック', ko: '월드뮤직' },
  bossanova: { en: 'Bossa Nova', 'zh-CN': '波萨诺瓦', 'zh-TW': '波薩諾瓦', ja: 'ボサノバ', ko: '보사노바' },
  flamenco: { en: 'Flamenco', 'zh-CN': '弗拉门戈', 'zh-TW': '佛朗明哥', ja: 'フラメンコ', ko: '플라멩코' },
  celtic: { en: 'Celtic', 'zh-CN': '凯尔特', 'zh-TW': '凱爾特', ja: 'ケルト', ko: '켈틱' },
  // 亚洲流行
  jpop: { en: 'J-Pop', 'zh-CN': '日本流行', 'zh-TW': '日本流行', ja: 'J-POP', ko: 'J-POP' },
  kpop: { en: 'K-Pop', 'zh-CN': '韩国流行', 'zh-TW': '韓國流行', ja: 'K-POP', ko: 'K-POP' },
  cpop: { en: 'C-Pop', 'zh-CN': '华语流行', 'zh-TW': '華語流行', ja: 'C-POP', ko: 'C-POP' },
  // 其他
  acoustic: { en: 'Acoustic', 'zh-CN': '原声', 'zh-TW': '原聲', ja: 'アコースティック', ko: '어쿠스틱' },
  gospel: { en: 'Gospel', 'zh-CN': '福音', 'zh-TW': '福音', ja: 'ゴスペル', ko: '가스펠' },
  ska: { en: 'Ska', 'zh-CN': '斯卡', 'zh-TW': '斯卡', ja: 'スカ', ko: '스카' }
}

const MOOD_TAGS = {
  // 积极情绪
  happy: { en: 'Happy', 'zh-CN': '快乐', 'zh-TW': '快樂', ja: '幸せ', ko: '행복한' },
  uplifting: { en: 'Uplifting', 'zh-CN': '振奋', 'zh-TW': '振奮', ja: '高揚', ko: '고양되는' },
  energetic: { en: 'Energetic', 'zh-CN': '活力', 'zh-TW': '活力', ja: 'エネルギッシュ', ko: '활기찬' },
  joyful: { en: 'Joyful', 'zh-CN': '欢乐', 'zh-TW': '歡樂', ja: '喜び', ko: '즐거운' },
  playful: { en: 'Playful', 'zh-CN': '俏皮', 'zh-TW': '俏皮', ja: '遊び心', ko: '장난스러운' },
  triumphant: { en: 'Triumphant', 'zh-CN': '胜利', 'zh-TW': '勝利', ja: '勝利', ko: '승리의' },
  hopeful: { en: 'Hopeful', 'zh-CN': '希望', 'zh-TW': '希望', ja: '希望', ko: '희망찬' },
  // 平静情绪
  calm: { en: 'Calm', 'zh-CN': '平静', 'zh-TW': '平靜', ja: '穏やか', ko: '차분한' },
  peaceful: { en: 'Peaceful', 'zh-CN': '祥和', 'zh-TW': '祥和', ja: '平和', ko: '평화로운' },
  relaxing: { en: 'Relaxing', 'zh-CN': '放松', 'zh-TW': '放鬆', ja: 'リラックス', ko: '편안한' },
  dreamy: { en: 'Dreamy', 'zh-CN': '梦幻', 'zh-TW': '夢幻', ja: '夢幻', ko: '몽환적' },
  ethereal: { en: 'Ethereal', 'zh-CN': '空灵', 'zh-TW': '空靈', ja: '神秘的', ko: '초월적' },
  serene: { en: 'Serene', 'zh-CN': '宁静', 'zh-TW': '寧靜', ja: '静寂', ko: '고요한' },
  // 情感情绪
  romantic: { en: 'Romantic', 'zh-CN': '浪漫', 'zh-TW': '浪漫', ja: 'ロマンチック', ko: '로맨틱' },
  sentimental: { en: 'Sentimental', 'zh-CN': '感性', 'zh-TW': '感性', ja: '感傷的', ko: '감상적' },
  nostalgic: { en: 'Nostalgic', 'zh-CN': '怀旧', 'zh-TW': '懷舊', ja: '懐かしい', ko: '향수의' },
  passionate: { en: 'Passionate', 'zh-CN': '热情', 'zh-TW': '熱情', ja: '情熱的', ko: '열정적' },
  // 负面情绪
  sad: { en: 'Sad', 'zh-CN': '悲伤', 'zh-TW': '悲傷', ja: '悲しい', ko: '슬픈' },
  melancholic: { en: 'Melancholic', 'zh-CN': '忧郁', 'zh-TW': '憂鬱', ja: '憂鬱', ko: '우울한' },
  dark: { en: 'Dark', 'zh-CN': '黑暗', 'zh-TW': '黑暗', ja: 'ダーク', ko: '어두운' },
  angry: { en: 'Angry', 'zh-CN': '愤怒', 'zh-TW': '憤怒', ja: '怒り', ko: '화난' },
  aggressive: { en: 'Aggressive', 'zh-CN': '激进', 'zh-TW': '激進', ja: 'アグレッシブ', ko: '공격적' },
  // 氛围情绪
  mysterious: { en: 'Mysterious', 'zh-CN': '神秘', 'zh-TW': '神秘', ja: 'ミステリアス', ko: '신비로운' },
  intense: { en: 'Intense', 'zh-CN': '紧张', 'zh-TW': '緊張', ja: '激しい', ko: '강렬한' },
  dramatic: { en: 'Dramatic', 'zh-CN': '戏剧性', 'zh-TW': '戲劇性', ja: 'ドラマチック', ko: '드라마틱' },
  suspenseful: { en: 'Suspenseful', 'zh-CN': '悬疑', 'zh-TW': '懸疑', ja: 'サスペンス', ko: '긴장감' },
  groovy: { en: 'Groovy', 'zh-CN': '律动', 'zh-TW': '律動', ja: 'グルービー', ko: '그루브' },
  chill: { en: 'Chill', 'zh-CN': '慵懒', 'zh-TW': '慵懶', ja: 'チル', ko: '칠' }
}

const VOCAL_TAGS = {
  // 性别
  female: { en: 'Female Vocal', 'zh-CN': '女声', 'zh-TW': '女聲', ja: '女性ボーカル', ko: '여성 보컬' },
  male: { en: 'Male Vocal', 'zh-CN': '男声', 'zh-TW': '男聲', ja: '男性ボーカル', ko: '남성 보컬' },
  duet: { en: 'Duet', 'zh-CN': '对唱', 'zh-TW': '對唱', ja: 'デュエット', ko: '듀엣' },
  // 合唱
  choir: { en: 'Choir', 'zh-CN': '合唱', 'zh-TW': '合唱', ja: '合唱', ko: '합창' },
  harmony: { en: 'Harmony', 'zh-CN': '和声', 'zh-TW': '和聲', ja: 'ハーモニー', ko: '하모니' },
  acappella: { en: 'A Cappella', 'zh-CN': '阿卡贝拉', 'zh-TW': '阿卡貝拉', ja: 'アカペラ', ko: '아카펠라' },
  // 唱法
  rap: { en: 'Rap', 'zh-CN': '说唱', 'zh-TW': '饒舌', ja: 'ラップ', ko: '랩' },
  falsetto: { en: 'Falsetto', 'zh-CN': '假声', 'zh-TW': '假聲', ja: 'ファルセット', ko: '가성' },
  whisper: { en: 'Whisper', 'zh-CN': '耳语', 'zh-TW': '耳語', ja: 'ささやき', ko: '속삭임' },
  growl: { en: 'Growl', 'zh-CN': '咆哮', 'zh-TW': '咆哮', ja: 'グロウル', ko: '그로울' },
  operatic: { en: 'Operatic', 'zh-CN': '歌剧唱腔', 'zh-TW': '歌劇唱腔', ja: 'オペラ', ko: '오페라' },
  soulful: { en: 'Soulful', 'zh-CN': '有灵魂的', 'zh-TW': '有靈魂的', ja: 'ソウルフル', ko: '소울풀' },
  // 音色
  deep: { en: 'Deep Voice', 'zh-CN': '低沉', 'zh-TW': '低沉', ja: '低音', ko: '저음' },
  high: { en: 'High Pitch', 'zh-CN': '高音', 'zh-TW': '高音', ja: '高音', ko: '고음' },
  raspy: { en: 'Raspy', 'zh-CN': '沙哑', 'zh-TW': '沙啞', ja: 'ハスキー', ko: '허스키' },
  smooth: { en: 'Smooth', 'zh-CN': '柔滑', 'zh-TW': '柔滑', ja: 'スムーズ', ko: '부드러운' },
  powerful: { en: 'Powerful', 'zh-CN': '有力', 'zh-TW': '有力', ja: 'パワフル', ko: '강렬한' }
}

const INSTRUMENT_TAGS = {
  // 键盘
  piano: { en: 'Piano', 'zh-CN': '钢琴', 'zh-TW': '鋼琴', ja: 'ピアノ', ko: '피아노' },
  keyboard: { en: 'Keyboard', 'zh-CN': '键盘', 'zh-TW': '鍵盤', ja: 'キーボード', ko: '키보드' },
  organ: { en: 'Organ', 'zh-CN': '风琴', 'zh-TW': '風琴', ja: 'オルガン', ko: '오르간' },
  synth: { en: 'Synthesizer', 'zh-CN': '合成器', 'zh-TW': '合成器', ja: 'シンセサイザー', ko: '신시사이저' },
  // 弦乐
  guitar: { en: 'Guitar', 'zh-CN': '吉他', 'zh-TW': '吉他', ja: 'ギター', ko: '기타' },
  electricguitar: { en: 'Electric Guitar', 'zh-CN': '电吉他', 'zh-TW': '電吉他', ja: 'エレキギター', ko: '일렉기타' },
  acousticguitar: { en: 'Acoustic Guitar', 'zh-CN': '木吉他', 'zh-TW': '木吉他', ja: 'アコギ', ko: '어쿠스틱기타' },
  bass: { en: 'Bass', 'zh-CN': '贝斯', 'zh-TW': '貝斯', ja: 'ベース', ko: '베이스' },
  violin: { en: 'Violin', 'zh-CN': '小提琴', 'zh-TW': '小提琴', ja: 'バイオリン', ko: '바이올린' },
  cello: { en: 'Cello', 'zh-CN': '大提琴', 'zh-TW': '大提琴', ja: 'チェロ', ko: '첼로' },
  harp: { en: 'Harp', 'zh-CN': '竖琴', 'zh-TW': '豎琴', ja: 'ハープ', ko: '하프' },
  ukulele: { en: 'Ukulele', 'zh-CN': '尤克里里', 'zh-TW': '烏克麗麗', ja: 'ウクレレ', ko: '우쿨렐레' },
  strings: { en: 'Strings', 'zh-CN': '弦乐', 'zh-TW': '弦樂', ja: 'ストリングス', ko: '현악기' },
  // 打击乐
  drums: { en: 'Drums', 'zh-CN': '鼓', 'zh-TW': '鼓', ja: 'ドラム', ko: '드럼' },
  percussion: { en: 'Percussion', 'zh-CN': '打击乐', 'zh-TW': '打擊樂', ja: 'パーカッション', ko: '타악기' },
  beatbox: { en: 'Beatbox', 'zh-CN': '人声打击', 'zh-TW': '人聲打擊', ja: 'ビートボックス', ko: '비트박스' },
  // 管乐
  saxophone: { en: 'Saxophone', 'zh-CN': '萨克斯', 'zh-TW': '薩克斯', ja: 'サックス', ko: '색소폰' },
  trumpet: { en: 'Trumpet', 'zh-CN': '小号', 'zh-TW': '小號', ja: 'トランペット', ko: '트럼펫' },
  flute: { en: 'Flute', 'zh-CN': '长笛', 'zh-TW': '長笛', ja: 'フルート', ko: '플루트' },
  clarinet: { en: 'Clarinet', 'zh-CN': '单簧管', 'zh-TW': '單簧管', ja: 'クラリネット', ko: '클라리넷' },
  harmonica: { en: 'Harmonica', 'zh-CN': '口琴', 'zh-TW': '口琴', ja: 'ハーモニカ', ko: '하모니카' },
  brass: { en: 'Brass', 'zh-CN': '铜管', 'zh-TW': '銅管', ja: 'ブラス', ko: '금관악기' },
  woodwinds: { en: 'Woodwinds', 'zh-CN': '木管', 'zh-TW': '木管', ja: '木管', ko: '목관악기' },
  // 其他
  orchestra: { en: 'Orchestra', 'zh-CN': '管弦乐队', 'zh-TW': '管弦樂隊', ja: 'オーケストラ', ko: '오케스트라' },
  choir: { en: 'Choir', 'zh-CN': '合唱团', 'zh-TW': '合唱團', ja: '合唱団', ko: '합창단' }
}

// 构建多语言标签对象
function buildI18nTags(tagsData) {
  const result = {}
  const languages = Object.keys(SUPPORTED_LANGUAGES)
  
  languages.forEach(lang => {
    result[lang] = {}
    Object.entries(tagsData).forEach(([key, translations]) => {
      result[lang][key] = {
        label: translations[lang] || translations.en,
        value: key.replace(/([A-Z])/g, '-$1').toLowerCase() // 转换为连字符格式
      }
    })
  })
  
  return result
}

// 特殊值映射（某些标签需要特定的 API 值）
const VALUE_OVERRIDES = {
  hiphop: 'hip-hop',
  rnb: 'r&b',
  lofi: 'lo-fi',
  dnb: 'drum and bass',
  edm: 'edm',
  jpop: 'j-pop',
  kpop: 'k-pop',
  cpop: 'c-pop',
  newage: 'new age',
  bossanova: 'bossa nova',
  electricguitar: 'electric guitar',
  acousticguitar: 'acoustic guitar',
  female: 'female vocal',
  male: 'male vocal',
  deep: 'deep voice',
  high: 'high pitch',
  acappella: 'a cappella'
}

// 应用值覆盖
function applyValueOverrides(i18nTags) {
  Object.keys(i18nTags).forEach(lang => {
    Object.keys(i18nTags[lang]).forEach(key => {
      if (VALUE_OVERRIDES[key]) {
        i18nTags[lang][key].value = VALUE_OVERRIDES[key]
      }
    })
  })
  return i18nTags
}

// 导出多语言标签数据
export const MUSIC_TAGS_I18N = {
  genre: applyValueOverrides(buildI18nTags(GENRE_TAGS)),
  mood: applyValueOverrides(buildI18nTags(MOOD_TAGS)),
  vocal: applyValueOverrides(buildI18nTags(VOCAL_TAGS)),
  instruments: applyValueOverrides(buildI18nTags(INSTRUMENT_TAGS))
}

// 获取本地化标签的辅助函数
export function getLocalizedTags(category, language = 'en') {
  const categoryTags = MUSIC_TAGS_I18N[category]?.[language]
  if (!categoryTags) {
    // 回退到英文
    const fallback = MUSIC_TAGS_I18N[category]?.['en']
    if (!fallback) return []
    return Object.values(fallback)
  }
  return Object.values(categoryTags)
}

// 获取所有分类的标签数量
export function getTagsCount() {
  return {
    genre: Object.keys(GENRE_TAGS).length,
    mood: Object.keys(MOOD_TAGS).length,
    vocal: Object.keys(VOCAL_TAGS).length,
    instruments: Object.keys(INSTRUMENT_TAGS).length
  }
}
