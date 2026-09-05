import type { Song } from '../types'
import { stringHash } from './utils'
import { parseFilenameMeta } from '../../electron/meta.mjs'

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus'])
const SKIP_DIR = new Set(['lyric', 'lyrics', 'cache', 'listen', 'node_modules', '.git', '$recycle.bin'])

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

export function revokeSongUrls(songs: Song[]): void {
  for (const song of songs) {
    if (song.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(song.sourceUrl)
  }
}

async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: Song[],
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'directory') {
      if (SKIP_DIR.has(name.toLowerCase())) continue
      await walkDirectory(handle as FileSystemDirectoryHandle, `${prefix}${name}/`, out)
      continue
    }
    const ext = extOf(name)
    if (!AUDIO_EXT.has(ext)) continue
    const fileHandle = handle as FileSystemFileHandle
    const file = await fileHandle.getFile()
    const rel = `${prefix}${name}`
    const meta = parseFilenameMeta(name)
    out.push({
      id: `local_${stringHash(rel).toString(16)}`,
      path: rel,
      title: meta.title,
      artist: meta.artist,
      artists: meta.artists,
      feat: meta.feat.length ? meta.feat : undefined,
      album: '',
      duration: 0,
      cover: null,
      hasLyrics: false,
      lyricsType: null,
      addedAt: file.lastModified,
      sourceUrl: URL.createObjectURL(file),
    })
  }
}

async function songsFromFileList(files: FileList | File[]): Promise<Song[]> {
  const out: Song[] = []
  for (const file of Array.from(files)) {
    const ext = extOf(file.name)
    if (!AUDIO_EXT.has(ext)) continue
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    if (/\/lyric\//i.test(rel)) continue
    const meta = parseFilenameMeta(file.name)
    out.push({
      id: `local_${stringHash(rel).toString(16)}`,
      path: rel,
      title: meta.title,
      artist: meta.artist,
      artists: meta.artists,
      feat: meta.feat.length ? meta.feat : undefined,
      album: '',
      duration: 0,
      cover: null,
      hasLyrics: false,
      lyricsType: null,
      addedAt: file.lastModified,
      sourceUrl: URL.createObjectURL(file),
    })
  }
  return out
}

export async function pickMusicFolder(): Promise<Song[]> {
  const w = window as Window & {
    showDirectoryPicker?: (opts?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>
  }
  if (typeof w.showDirectoryPicker === 'function') {
    const dir = await w.showDirectoryPicker({ mode: 'read' })
    const songs: Song[] = []
    await walkDirectory(dir, '', songs)
    songs.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
    return songs
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'audio/*,.mp3,.m4a,.flac,.wav,.ogg,.aac'
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
    input.style.display = 'none'
    input.onchange = () => {
      input.remove()
      if (!input.files?.length) {
        reject(new DOMException('No files', 'AbortError'))
        return
      }
      void songsFromFileList(input.files).then(resolve, reject)
    }
    input.oncancel = () => {
      input.remove()
      reject(new DOMException('The user aborted a request.', 'AbortError'))
    }
    document.body.appendChild(input)
    input.click()
  })
}
