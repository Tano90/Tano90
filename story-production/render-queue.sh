#!/bin/sh
# render queue: skips frames that already exist, so it can be restarted
cd /home/user/Tano90/web
R="python scripts/story-blender/scene.py -- --assets ASSETS_DIR --screens public/story --samples 12"
for job in "office 60 d" "office 60 m" "aerial 40 d" "enter 45 d" "phone 24 d" "outlets 60 d" "return 40 d" "aerial 40 m" "enter 45 m" "phone 24 m" "outlets 60 m" "return 40 m"; do
  set -- $job
  if [ "$3" = d ]; then size=1152x648; else size=486x864; fi
  mkdir -p /home/user/Tano90/story-production/renders/$3
  $R --out /home/user/Tano90/story-production/renders/$3 --shot $1 --frames $2 --size $size 2>&1 | grep --line-buffered -E "^FRAME|Error|Traceback" | sed "s/^/$1 $3 /"
done
echo QUEUE_DONE
