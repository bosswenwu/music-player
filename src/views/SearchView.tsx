import { useMemo, type RefObject } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { SongTable } from '../components/SongTable'
import { AlbumCard, ArtistCard, Shelf } from '../components/Cards'
import { EmptyState, PageHeader } from './shared'
import { IconSearch } from '../components/Icons'

export function SearchView({
  query,
  scrollRef,
}: {
  query: string
  scrollRef: RefObject<HTMLElement | null>
}) {
  const { search } = useLibrary()
  const { playQueue } = usePlayer()
  const results = useMemo(() => search(query), [search, query])

  const empty = !results.songs.length && !results.artists.length && !results.albums.length

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="搜索"
        subtitle={`“${query}” 的结果 · ${results.songs.length} 首歌曲`}
        onPlay={results.songs.length ? () => playQueue(results.songs, 0, false) : undefined}
        onShuffle={
          results.songs.length
            ? () => playQueue(results.songs, Math.floor(Math.random() * results.songs.length), true)
            : undefined
        }
      />

      {empty ? (
        <EmptyState icon={<IconSearch />} title={`未找到与“${query}”相关的内容`} hint="换个关键词试试" />
      ) : (
        <>
          {results.artists.length > 0 && (
            <Shelf title="艺人">
              {results.artists.slice(0, 12).map((a) => (
                <ArtistCard key={a.name} artist={a} />
              ))}
            </Shelf>
          )}

          {results.albums.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-xl font-bold tracking-tight">专辑</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-6">
                {results.albums.slice(0, 6).map((a) => (
                  <AlbumCard key={a.key} album={a} />
                ))}
              </div>
            </section>
          )}

          {results.songs.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold tracking-tight">歌曲</h2>
              <SongTable songs={results.songs} scrollRef={scrollRef} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
