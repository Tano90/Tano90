# Camperteil – cinematic revision

Source imported from user archive camperteil-dc73831.zip. Original five-step form retained. Existing Site identity and owner-private audience retained.

## Added
- Full-bleed local camper/lake film and separate landscape film, poster images, pause/start controls, viewport pause and reduced-motion handling.
- Own illustrative 3D cover, real WebGL geometry using locally bundled Three.js 0.180.0 and OrbitControls. Rotation, mouse/touch orbit, keyboard controls, zoom, material colors, exploded view, wireframe and reset. Explicit non-product disclaimer and a perspective-projected software 3D renderer when WebGL is unavailable.
- Redesigned typography, spacing and responsive styling in experience.css; original form styling and JS retained.
- Touch/keyboard selection in illustrative parts table.
- Separate inspiration.html with HYMER Venture S and Bowlus references, no claim of partnership, and stock footage source/license notes.

## Asset sources
Mixkit 4122 https://mixkit.co/free-stock-video/an-off-road-camper-van-by-the-lake-4122/
Mixkit 4070 https://mixkit.co/free-stock-video/time-lapse-of-a-green-meadow-4070/
Both pages explicitly identify Stock Video Free License and commercial/personal use. Footage hosted locally; no remote playback services.
Three.js and OrbitControls 0.180.0 from official npm distribution via jsDelivr; MIT license in dist/assets/vendor/LICENSE-three.txt.
Fonts and license files preserved from user source archive.

## Outstanding
No production inquiry endpoint, no confirmed fabrication partner, legal pages still placeholder drafts. Images aren't persisted on reload. Imported original browser tests have not been run via their standalone automation harness; actual QA is performed using the supported browser interface. Verified: 320/390 px embedded mobile viewports without horizontal overflow, desktop, both videos playing, software 3D colors/explode/rotation/reset, required-photo error, photo picker/preview and complete five-step form through summary. WebGL path could not be visually exercised because WebGL is disabled in the browser environment. Public launch remains out of scope.
