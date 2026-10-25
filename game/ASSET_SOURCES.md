
## Circuit bench textures (public/tex)

| File | Source | Author | License |
|------|--------|--------|---------|
| bench_diff.jpg, bench_rough.jpg, bench_nor.jpg | Poly Haven "Wood Table Worn", 1k JPG (diff, rough, nor_gl) https://polyhaven.com/a/wood_table_worn | Dimitrios Savva (photography), Rico Cilliers (processing) | CC0 |

## Character faces (src/lab/Characters.tsx)
- `public/tex/schrodinger_face.jpg`: Wikimedia Commons, File:Erwin Schrödinger (1933).jpg (Nobel Foundation portrait, public domain), original 280x396 (largest available): https://commons.wikimedia.org/wiki/File:Erwin_Schr%C3%B6dinger_(1933).jpg
- `public/tex/heisenberg_face.jpg`: supplied by the user (frontal Walter White photo, 298x400, has a "Sample" watermark; source/licence unknown). Replaces the earlier Commons image File:Bryan Cranston 2012 2.jpg (CC BY-SA 2.0), which is no longer used.

## Hub room (vintage study) — src/lab/Scenery.tsx

| File | Source | License | Notes |
|------|--------|---------|-------|
| public/models/vintage/kit.glb | Sketchfab "Modular Vintage Living Room - Game Ready PBR" (user-supplied public/models/sketchfab/modular_vintage_living_room_-_game_ready_pbr.glb) | Per Sketchfab page (user downloaded; verify, likely CC-BY: credit author) | 24 pieces split out and recentred (floor, wall panel, ceiling coffer, beam, bookcase, 3 paintings, sofa, rug, table lamp, wall sconce, vase, flowers, fireplace, fire, table, chair, armchair, coffee table, chandelier, radiator, window, phone); textures webp 1024, 46 MB -> 5.2 MB |
| public/models/vintage/lab_cabinet.glb | Sketchfab "Laboratory Cabinet Storage (PBR Low Poly) Free" (user-supplied) | Per Sketchfab page (verify; likely CC-BY) | webp 1024, 19.7 MB -> 0.42 MB |
| public/models/vintage/terminal.glb | Sketchfab "Abandoned Computer Terminal Game Prop" (user-supplied) | Per Sketchfab page (verify; likely CC-BY) | webp 1024, meshopt, 31.5 MB -> 0.39 MB |
| public/models/vintage/phone.glb | Sketchfab "phone" 1950s telephone (user-supplied public/models/sketchfab/phone.glb) | Per Sketchfab page (verify) | webp 512, 4.2 MB -> 0.97 MB |
| public/models/vintage/glassware.glb | Sketchfab "Low Poly Laboratory Assets" (user-supplied) | Per Sketchfab page (verify) | only test-tube rack, beakers and flask extracted, 0.22 MB |
| public/models/lab/hanging_industrial_lamp.glb | Poly Haven https://polyhaven.com/a/hanging_industrial_lamp | CC0 | 1k glTF -> webp 512 meshopt GLB, 0.22 MB |
| public/tex/studio.hdr | (pre-existing) | | used as low-intensity environment |

Not used for the hub: vintage_living_room.glb (single rectangular room with 2-4k textures, does not fit the 10-sided hub; heavier), Habitacion Modelada en 3D.glb (modern student room), sci-fi_computer_room.glb (clashes with vintage), scout pp_lab_table / pp_lab_desk / pp_workbench (flat-colour low-poly, clash with the PBR kit; the kit's wooden table is used as the bench instead).

| public/models/vintage/oscilloscope.glb | Sketchfab "oscilloscope_u1602b" handheld scope (user-supplied public/models/sketchfab/oscilloscope_u1602b.glb) | Per Sketchfab page (verify) | `gltf-transform optimize --texture-compress webp --texture-size 1024`, 5.1 MB -> 0.13 MB; used on hub stations 1, 5, 10 (src/lab/Stations.tsx) with a live CanvasTexture over its screen |
