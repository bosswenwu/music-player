# 音乐 — 本地曲库播放器

Apple Music 风格的本地音乐网页播放器，融合 Spotify 的队列与搜索体验。
播放你本地的曲库（默认 `F:\照片\KuGou`，可通过环境变量 `MUSIC_ROOT` 指向任意目录），支持 KRC 逐字歌词 / LRC 逐行歌词同步。

> 仓库只包含代码，不包含任何音频文件。克隆后指向自己的音乐文件夹即可使用。

![screenshot](shot-home.png)

## 快速开始

```bash
npm install

# Windows PowerShell：先指定你的音乐目录（含 mp3/m4a/flac 等）
$env:MUSIC_ROOT = "D:/我的音乐"

npm run scan   # 扫描曲库：元数据、封面、KRC/LRC 歌词 → src/data/library.json
npm run dev    # 启动开发服务器（http://localhost:5173）
```

> macOS / Linux 用 `MUSIC_ROOT=/path/to/music npm run scan`。
> 不设环境变量时使用 `vite.config.ts` / `scripts/build-library.mjs` 中的默认路径。
> 音频文件不会被复制——dev 服务器把曲库目录挂载为 `/audio/**` 并支持 Range 请求。

## 功能

- **听一听**：每日精选、最近播放、热门艺人、重新发现、最近添加
- **资料库**：歌曲（可排序 + 虚拟滚动）、艺人、专辑、最近播放、已喜欢
- **搜索**：歌曲/艺人/专辑即时模糊搜索
- **全屏播放页**：封面主色动态背景、KRC 逐字卡拉OK高亮、点击歌词跳转
- **队列面板**：正在播放 / 接下来、点击跳播、移除、右键"下一首播放/加入队列"
- **播放引擎**：随机、单曲/列表循环、Media Session 系统媒体键、断点会话恢复
- **快捷键**：`空格` 播放/暂停 · `←/→` 快退快进 5s · `Ctrl+←/→` 切歌 · `↑/↓` 音量
- **持久化**：喜欢、播放列表、播放历史、音量/播放模式、上次队列（localStorage）

## 技术

Vite 8 · React 19 · TypeScript · Tailwind CSS v4 · music-metadata（扫描）

- KRC 解密：`krc1` magic + XOR 密钥 + zlib inflate，解析逐字时间轴
- 标签乱码修复：GBK/Big5 被误读为 Latin-1 的标题按常用字评分自动纠正
- 无内嵌封面的歌曲使用按名字哈希的渐变占位封面

## 验收

```bash
node scripts/e2e-check.mjs   # 12 项端到端检查（需 dev 服务器运行中）
```
