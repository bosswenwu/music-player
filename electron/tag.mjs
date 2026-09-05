/**
 * ID3 标签处理（Node 专用：build-library 与桌面 scan 共用）
 *  - 修复 GBK/Big5 标签被按 Latin-1 解码的乱码
 *  - 标签值 vs 文件名值：优先更"干净"的来源
 *    （酷狗下载文件的标签常带广告："Dj斌仔网 QQ 609468730"、
 *    "官方新浪微博 http://weibo.com/djcaine"、"吹牛老爹 - 亞瑟小子-If I Want To…"）
 */
import {
  splitArtistField,
  extractFeat,
  artistKey,
  cleanTitle,
  cleanAlbumTag,
  looksNoisy,
} from './meta.mjs'

function mojibakeScore(s) {
  let good = 0
  let total = 0
  for (const c of s) {
    const cp = c.codePointAt(0)
    total++
    if (cp < 0x80 || (cp >= 0x4e00 && cp <= 0x9fa5) || '，。！？：；、（）《》'.includes(c)) good++
  }
  return total ? good / total : 0
}

export function fixMojibake(s) {
  if (!s || !/[\u0080-\u00ff]/.test(s)) return s
  // 字符必须全部落在 latin1 范围内才可能是被误解码的字节流
  if ([...s].some((c) => c.codePointAt(0) > 0xff)) return s
  const bytes = Buffer.from(s, 'latin1')
  let best = null
  for (const enc of ['gbk', 'big5']) {
    try {
      const decoded = new TextDecoder(enc).decode(bytes)
      if (decoded.includes('\uFFFD')) continue
      if (!/[\u4e00-\u9fff]/.test(decoded)) continue
      // 真正的乱码会解出"连续 ≥2 个汉字"的片段（"´«Ææ"→"传奇"）；
      // 正常带重音的拉丁文本（"Cláudia"）只会解出孤立的汉字 → 拒收
      if (!/[\u4e00-\u9fff]{2,}/.test(decoded)) continue
      const score = mojibakeScore(decoded)
      if (!best || score > best.score) best = { decoded, score }
    } catch {
      /* ignore */
    }
  }
  return best && best.score >= 0.6 ? best.decoded : s
}

function isCleanTagTitle(tagTitle) {
  if (!tagTitle) return false
  if (looksNoisy(tagTitle)) return false
  if (/ - /.test(tagTitle)) return false
  if (/\[[^\]]{1,50}\]/.test(tagTitle)) return false
  // 标签里混进文件名 / 轨道编号的营销残留
  if (/\.(mp3|m4a|flac|wav|ogg|ape|wma)$/i.test(tagTitle)) return false
  if (/^(曲目|歌曲|track|no\.?)\s*\d+/i.test(tagTitle)) return false
  return true
}

/**
 * 综合标签 + 文件名，得到最终元数据。
 * @param fromName parseFilenameMeta(basename) 的结果
 * @param tag { title?, artist?, album? }（music-metadata common 字段，未乱码修复）
 * @returns { title, artists, artist, feat, album }
 */
export function chooseMeta(fromName, tag) {
  const tagTitle = fixMojibake((tag?.title ?? '').trim())
  const tagArtist = fixMojibake((tag?.artist ?? '').trim())
  const tagAlbum = fixMojibake((tag?.album ?? '').trim())

  // ---- 标题：优先文件名；标签仅在干净时采用（剥离 (feat. …)）----
  let title = ''
  const titleFeat = []
  if (isCleanTagTitle(tagTitle)) {
    const tf = extractFeat(tagTitle)
    title = cleanTitle(tf.title)
    titleFeat.push(...tf.feat)
  }
  if (!title) title = fromName.title

  // ---- 艺人：文件名可解析时用文件名；否则用干净的标签 ----
  const tagField = splitArtistField(tagArtist)
  const tagUsable =
    tagField.artists.length > 0 && tagField.artists[0] !== '未知艺人' && !looksNoisy(tagArtist)
  const field =
    fromName.artists[0] !== '未知艺人' && !looksNoisy(fromName.artist)
      ? fromName
      : tagUsable
        ? tagField
        : fromName
  const artists = field.artists.length ? field.artists : ['未知艺人']

  // 客串艺人：文件名 + 标题 + 标签并集（去重）
  const seenFeat = new Set()
  const feat = []
  for (const f of [...fromName.feat, ...titleFeat, ...(tagUsable ? tagField.feat : [])]) {
    const k = artistKey(f)
    if (seenFeat.has(k)) continue
    seenFeat.add(k)
    feat.push(f)
  }

  return {
    title,
    artists,
    artist: artists.join('、'),
    feat,
    album: cleanAlbumTag(tagAlbum),
  }
}
