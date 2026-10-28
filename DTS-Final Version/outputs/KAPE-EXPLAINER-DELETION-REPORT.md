# KAPE explainer deletion report

Date: 19 October 2026 (Asia/Manila)

Requested scope: generated files from the DTS KAPE explainer work in this chat.

## Measured remaining deletion

The remaining HyperFrames history cache was inventoried before deletion:

| Item | Amount |
|---|---:|
| Project-specific cache directories | 17 |
| Files | 1,424 |
| Logical file size | 698,986,531 bytes |
| Decimal size | 698.99 MB |
| Binary size | 666.61 MiB |

Each cache directory's `project.json` points to the deleted `outputs/dts-kape-3min-2026-10-16` project or one of its scene harnesses. Unrelated project caches are excluded. The accompanying `kape-explainer-deletion-inventory.json` records exact paths, file counts, and byte totals.

Status: deleted and verified. All 17 inventoried cache directories are absent.

## Already deleted before size reporting was requested

- `outputs/dts-kape-3min-2026-10-16`: script, storyboard, screen copies, presenter copies, audio copies, compositions, validation snapshots, render files, and production caches.
- `outputs/dts-kape-60s-2026-10-16`: earlier script draft.
- `.media`: the explainer's local profile copy, transcription models/cache, and download helpers.
- `C:/Users/reymo/AppData/Local/Temp/spatial-film-selftest-WGDeXg`: engine self-test files.
- `C:/Users/reymo/.local/state/hyperframes/previews/42a54dc7180d4f8d.log`: this project's preview log. The preview command confirmed no background preview remained running.

Their file counts and aggregate sizes were not recorded before removal and cannot be reported accurately. The render log had reported a 143.3 MB final MP4; that is one deleted artifact, not the total. Total deletion size is therefore **698,986,531 measured bytes plus the earlier unmeasured deletions**. Logical file size does not guarantee the same increase in free disk space.

## Preserved

- Original ElevenLabs MP3 in Downloads.
- Original custom presenter and blink assets in `C:/Users/reymo/.kape-explainer/profile/mascot`.
- DTS application files and the separate `outputs/dts-showcase-2026-10-16` project.
- Installed skills, shared software dependencies, and unrelated project caches.
- This report and its inventory, created at the user's request.

