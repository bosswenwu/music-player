/**
 * 艺人照片（Node 主进程专用）
 * 网易云音乐歌手搜索为主源（返回真实头像 img1v1Url），
 * 找不到时回退 iTunes 专辑封面（Apple 曲库，无头像但有大图）。
 * 返回可直接 <img> 加载的远程 URL；网络失败返回 null（前端渐变占位）。
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s\u3000\-–—_·・'"“”]/g, '')

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** 网易云歌手搜索：取名字匹配的头像 */
async function fromNetease(artist) {
  const url = `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(artist)}&type=100&limit=8`
  const data = await getJson(url, { Referer: 'https://music.163.com/' })
  const artists = data?.result?.artists
  if (!Array.isArray(artists) || !artists.length) return null
  const want = norm(artist)
  let best = null
  for (const a of artists) {
    const n = norm(a.name ?? '')
    const img = a.img1v1Url || a.picUrl
    if (!img) continue
    if (!want) return img
    if (n === want) return img // 精确命中直接返回
    if (!best && (n.includes(want) || want.includes(n)) && n.length >= want.length) best = img
  }
  return best
}

/** 回退：iTunes 搜索该艺人的专辑，取封面大图 */
async function fromItunes(artist) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=album&limit=1`
  const data = await getJson(url)
  const album = data?.results?.[0]
  if (!album?.artworkUrl100) return null
  // 100x100 → 600x600
  return album.artworkUrl100.replace(/100x100bb\.jpg$/, '600x600bb.jpg')
}

/** @returns {Promise<string|null>} 艺人照片 URL */
export async function fetchArtistPhoto(artist) {
  const name = String(artist ?? '').trim()
  if (!name || name === '未知艺人' || name === '未知') return null
  try {
    const netease = await fromNetease(name)
    if (netease) return netease
  } catch {
    /* 降级 */
  }
  try {
    return await fromItunes(name)
  } catch {
    return null
  }
}
