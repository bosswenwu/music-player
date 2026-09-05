/**
 * 共享元数据解析（纯函数，无 Node 依赖，浏览器 / Electron / 扫描脚本共用）
 *
 * 设计参照 Apple Music / Spotify 的元数据约定：
 *  - 每个艺人是一个唯一实体：昵称、译名、大小写变体合并为规范名
 *    （如 吹牛老爹 / Diddy / P. Diddy / Puff Daddy → "Puff Daddy"）
 *  - 合作曲目每位艺人都能进艺人列表（主艺人排最前），"feat./ft." 之后的
 *    是客串艺人（featured），单独展示但不单独占艺人列表
 *  - 标题 / 专辑去掉宣传残留（URL、QQ 号、kbps、营销词、中文备注后缀等）
 */

// ---------------------------------------------------------------- 噪音与别名

/** 会污染艺人列表的标签（同一首歌里如果只有这类标签，则归为"未知艺人"） */
export const NOISE_TOKENS = new Set([
  'dj', 'dj版', 'dj舞曲', '慢摇', '串烧', '车载', '车载音乐', '网络歌曲', '网络红歌',
  '经典老歌', '老歌经典', '欧美经典', '欧美歌曲', '英文歌', '英文', '英文歌曲',
  '法语歌曲', '闽南语歌曲', '华语歌曲', '流行歌曲', '草原歌曲', '军歌', '军旅歌曲',
  '佛教歌曲', '佛歌', '搞笑歌曲', '古典音乐', '轻音乐', '纯音乐', '钢琴曲',
  '钢琴纯音乐', '电影原声', '原声带', '最新歌曲', '伤感歌曲', '超好听', '非主流',
  '黄梅戏', '民歌', '江西民歌', '吉特巴', '舞曲', '翻唱', '伴奏', '演唱会',
  '现场版', '怀旧', '经典', '热门', '好听', '伤感', '情歌', '劲爆', '小清新',
  '广场舞', '铃声', '伤感音乐', '网络歌手',
])

/**
 * 同一艺人的不同写法 → 规范名（canonical artist，与 Apple Music 的
 * 艺术家实体概念一致）。key 统一为"小写去空格"形式。
 */
export const ARTIST_ALIASES = {
  吹牛老爹: 'Puff Daddy',
  老爹: 'Puff Daddy',
  puffdaddy: 'Puff Daddy',
  pdiddy: 'Puff Daddy',
  'p.diddy': 'Puff Daddy',
  'p diddy': 'Puff Daddy',
  diddy: 'Puff Daddy',
  阿姆: 'Eminem',
  eminem: 'Eminem',
  华语群星: '群星',
  欧美群星: '群星',
  // 品牌名固定小写，不被首字母大写规则改写
  'will.i.am': 'will.i.am',
}

/** 明显是宣传 / 联系方式残留的字符串 */
const NOISY_RE =
  /(?:https?:\/\/|www\.|\.com\b|\.cn\b|\.net\b|QQ\s*\d|\b\d{6,}\b|斌仔网|惠姗|优卡娱乐|全能王|fm386|微博|新浪)/i

export function looksNoisy(s) {
  return NOISY_RE.test(String(s ?? ''))
}

/** 艺人规范名（先查别名表；纯小写的英文名转为首字母大写，如 "rihanna" → "Rihanna"） */
export function canonicalArtist(name) {
  const key = String(name).trim().toLowerCase().replace(/\s+/g, '')
  if (ARTIST_ALIASES[key]) return ARTIST_ALIASES[key]
  const n = String(name).trim()
  // 全部是小写 ASCII（含数字/撇号/点号/叹号）才做首字母大写，
  // 避免误伤 CJK、全大写缩写（MC、DJ）等
  if (/^[a-z0-9.'!& ]+$/.test(n) && /[a-z]/.test(n)) {
    return n
      .split(' ')
      .map((w) => {
        const i = w.search(/[a-z]/)
        return i >= 0 ? w.slice(0, i) + w[i].toUpperCase() + w.slice(i + 1) : w
      })
      .join(' ')
  }
  return n
}

/** 艺人分组 / 去重 key：小写 + 去标点空格，让 "Eminem/eminem"、"S.H.E/s.h.e" 合并 */
export function artistKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
}

// ---------------------------------------------------------------- 艺人字段

/**
 * 解析艺人字段（ID3 标签或文件名左侧），返回主艺人 + 客串艺人。
 * "Puff Daddy & Faith feat. 112" → artists:["Puff Daddy","Faith"], feat:["112"]
 * "吹牛老爹、阿姆、欧美经典"     → artists:["Puff Daddy","Eminem"]（"欧美经典"被过滤）
 */
export function splitArtistField(raw) {
  const feat = []
  if (!raw) return { artists: ['未知艺人'], feat, display: '未知艺人' }
  let s = String(raw).trim()

  // 1) 去掉 URL / 联系方式 / 括号注释（"2NE1(CL&敏智)" → "2NE1"）
  s = s
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/QQ\s*\d{4,}/gi, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\([^()]*\)|（[^（）]*）/g, ' ')

  // 2) 分离客串：第一个 feat/ft./featuring 之后的全部内容
  const fi = s.search(/\s*(?:\(\s*)?\b(?:feat(?:uring)?\.?|ft\.?)\b/i)
  if (fi >= 0) {
    let after = s.slice(fi)
    after = after.replace(/^\s*(?:\(\s*)?\b(?:feat(?:uring)?\.?|ft\.?)\b[\s.:：]*/i, '')
    after = after.replace(/[)）\s]+$/, '')
    for (const n of after.split(/[、,，&/]/)) {
      const t = n.trim()
      if (t) feat.push(canonicalArtist(t))
    }
    s = s.slice(0, fi).trim()
  }

  // 3) 拆分多艺人（"A、B" "A & B" "A, B" "A / B" "A ; B" "A vs. B"）
  const parts = s
    .split(/[、,，/&;；]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => p.split(/\s+(?:vs\.?|versus|×)\s+/i))

  const artists = []
  const seen = new Set()
  for (let p of parts) {
    p = p.replace(/^[[【"']+|[\]】"']+$/g, '').trim()
    if (!p) continue
    const canon = canonicalArtist(p)
    if (NOISE_TOKENS.has(canon.toLowerCase())) continue
    const key = artistKey(canon)
    if (seen.has(key)) continue
    seen.add(key)
    artists.push(canon)
  }

  const list = artists.length ? artists : ['未知艺人']
  return { artists: list, feat, display: list.join('、') }
}

// ---------------------------------------------------------------- 标题 / 专辑

/** 提取标题里的 "(Feat. X)" / "[ft. Y]" → 返回清洗后的标题与客串列表 */
export function extractFeat(raw) {
  let t = String(raw).trim()
  const feat = []
  const re = /(?:\(|\[|\s|^)\s*\b(?:feat(?:uring)?\.?|ft\.?|featuring)\b[\s.:：]*([^)\]]*?)(?:\)|\]|$)/gi
  t = t.replace(re, (m, names) => {
    for (const n of names.split(/[、,，&/]/)) {
      const x = n.trim()
      if (x) feat.push(canonicalArtist(x))
    }
    return ' '
  })
  return { title: t.replace(/\s+/g, ' ').trim(), feat }
}

/** 标题清洗：去轨道编号、[标签]、尾随中文备注（" - 吹牛老爹"）、宣传残留 */
export function cleanTitle(raw) {
  let t = String(raw).trim()
  t = t.replace(/^\d{1,3}\s*[.、．:：\-－]\s*/, '')
  t = t.replace(/^\s*\[[^\]]{0,30}\]\s*/, ' ')
  t = t.replace(/\s*\[[^\]]{0,30}\]\s*$/, ' ')
  // 尾随 " - 中文备注"：只剥离艺人别名/昵称式备注
  // （"I Will Be Missing You - 吹牛老爹"、"If I Want To - 吹牛老爹 如果我想要"），
  // 标题词组（"卡农 - D - 大调钢琴曲"）不误伤
  t = t.replace(/\s*[-–—_－]\s*([\u4e00-\u9fff][\u4e00-\u9fff\s]{0,15})$/u, (m, seg) => {
    const key = seg.replace(/\s+/g, '')
    if (ARTIST_ALIASES[key]) return ''
    for (const k of Object.keys(ARTIST_ALIASES)) {
      if (key.startsWith(k) && key.length <= k.length + 6) return ''
    }
    return m
  })
  // 尾随 " - 宣传/版本残留"（"舞女 - 闽南语 惠姗音乐 A56kbps"）
  t = t.replace(/\s*[-–—_－]\s*[^-]{1,40}$/, (m) =>
    /(?:A\d+kbps|www\.|\.com|闽南语|华语|粤语|国语|音乐|DJ|dj|伴奏|remix|网)/i.test(m)
      ? ''
      : m,
  )
  // 尾随去重/副本后缀："Love The Way You Lie__同名1"、"今生有缘(2)" → 剥掉
  t = t.replace(/_{2,}同?名\d*$/u, '')
  t = t.replace(/[（(]\s*\d+\s*[)）]$/u, '')
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

/** 专辑名清洗：去掉 [www.xxx] 链接与发行商宣传残留 */
export function cleanAlbumTag(raw) {
  if (!raw) return ''
  let s = String(raw).trim()
  s = s.replace(/\[[^\]]*?(?:www\.|\.com|\.cn|\.net|http)[^\]]*?\]/gi, ' ')
  s = s.replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
  s = s.replace(/\s+[A-Za-z0-9]+A\d+kbps\b/gi, ' ')
  s = s.replace(/\s*(?:优卡娱乐|全能王影音|惠姗音乐|Dj斌仔网|DJ斌仔网)[\s\S]*$/i, '')
  return s.replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------- 文件名解析

/**
 * 从 "艺人 - 标题.ext" 文件名解析元数据。
 * 处理：多艺人、feat、轨道编号前缀（"21 - Pop It Up - Dj Antoine..."）、
 * 中文备注后缀（" - 吹牛老爹"）等。
 */
export function parseFilenameMeta(basename) {
  // 只剥真实扩展名（.mp3/.krc/…），避免 "R. City - Locked Away" 这类
  // 标题里的点号被当作扩展名截断
  const base = String(basename).replace(/\.[a-z0-9]{1,5}$/i, '').trim()
  let artistRaw = ''
  let titleRaw = base

  // 分隔符两侧必须有空白："Ne-Yo - Let's Go" 里的 "Ne-Yo" 连字符不能当分隔符
  const m = base.match(/^(.+?)\s+[-–—_－]\s+(.+)$/)
  if (m) {
    artistRaw = m[1].trim()
    titleRaw = m[2].trim()
    // 轨道编号前缀：把 "21 - Pop It Up - Dj Antoine Vs. Mad Mar"
    // 重排为 艺人="Dj Antoine Vs. Mad Mar"，标题="Pop It Up"
    if (/^\d{1,3}$/.test(artistRaw)) {
      const segs = titleRaw.split(/\s+[-–—_－]\s+/)
      if (segs.length >= 2) {
        artistRaw = segs[segs.length - 1].trim()
        titleRaw = segs.slice(0, -1).join(' - ').trim()
      } else {
        artistRaw = ''
      }
    }
  }

  const field = splitArtistField(artistRaw)
  const titleFeat = extractFeat(titleRaw)

  // 合并客串并去重（保持顺序）
  const seen = new Set()
  const feat = []
  for (const f of [...field.feat, ...titleFeat.feat]) {
    const k = artistKey(f)
    if (seen.has(k)) continue
    seen.add(k)
    feat.push(f)
  }

  const title = cleanTitle(titleFeat.title) || base

  return {
    artist: field.display,
    artists: field.artists,
    feat,
    title,
    rawArtist: artistRaw,
    rawTitle: titleFeat.title,
  }
}

// ---------------------------------------------------------------- 歌词配对 key

/** LRC 文本解析（纯函数，浏览器 / Node 共用；用于在线歌词） */
export function parseLrc(text) {
  const entries = []
  const tagRe = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
  const META_RE = /^(作词|作曲|编曲|制作人|混音|录音|母带|和声|吉他|贝斯|鼓|键盘|弦乐|监制|演唱|词|曲|by)\s*[：:]/i
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const tags = [...raw.matchAll(tagRe)]
    if (!tags.length) continue
    const content = raw.replace(tagRe, '').trim()
    if (!content) continue
    if (META_RE.test(content)) continue // 跳过作词/作曲等元数据行
    for (const t of tags) {
      const min = parseInt(t[1], 10)
      const sec = parseInt(t[2], 10)
      const fracRaw = t[3] ?? '0'
      const frac = parseInt(fracRaw, 10) / 10 ** fracRaw.length
      entries.push({ t: Math.round((min * 60 + sec + frac) * 1000) / 1000, text: content })
    }
  }
  entries.sort((a, b) => a.t - b.t)
  if (!entries.length) return null
  const lines = entries.map((e, i) => ({
    t: e.t,
    d: Math.round(Math.max(0.5, (entries[i + 1]?.t ?? e.t + 5) - e.t) * 1000) / 1000,
    text: e.text,
  }))
  return { synced: 'line', lines }
}

/** 英文缩写的展开（"I'll" → "Iwill"），让文件名与歌词文件标题能对齐 */
const CONTRACTIONS = [
  [/\b(\w+)'ll\b/g, '$1will'],
  [/\b(\w+)'re\b/g, '$1are'],
  [/\b(\w+)'ve\b/g, '$1have'],
  [/\b(\w+)'m\b/g, '$1am'],
  [/\b\w+n't\b/g, (m) => m.replace(/n't$/, 'not')],
  [/\b(\w+)'d\b/g, '$1would'],
  [/\b(\w+)'s\b/g, '$1'],
  [/\b(\w+)'em\b/g, '$1them'],
]

/** 歌词配对归一化 key：小写 + 缩写展开 + 去标点空格 */
export function normKeyForLyrics(s) {
  let t = String(s).toLowerCase()
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep)
  return t.replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
}
