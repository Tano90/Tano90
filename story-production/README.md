# Rohbilder der Kamerafahrt (Zwischenstand)
- `renders/d` (1152×648, Desktop) ist vollständig; daraus besteht die Website-Folge `web/public/story/seq/d`.
- `renders/m` (486×864, Hochformat) ist unvollständig. Fortsetzen mit `render-queue.sh`:
  - `ASSETS_DIR` durch einen Ordner mit den Khronos-Modellen ersetzen (Liste in `STATUS.md`).
  - Vorher `pip install bpy==5.2.3` ausführen.
- Danach neu verpacken mit `web/scripts/story-blender/pack.py`.
