
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

## Rigged human characters (asset_originals/characters, scouted 2026-10-25; not yet in public/)

All files are unmodified poly.pizza downloads (static.poly.pizza GLB, no login), all under 2.3 MB, so no optimisation was needed. Bone style: none uses mixamorig except where noted. Preview: /private/tmp/claude-501/-Users-yubraj-Code-DuQuantum/c80f233b-27ce-42c8-90be-b1644c69d46b/scratchpad/sheet/contact.png (idle pose, three.js r169 render).

| File | Source | Licence | Triangles | Bones | Animation clips |
|------|--------|---------|-----------|-------|-----------------|
| characters/man_in_suit_quaternius_cc0.glb | https://poly.pizza/m/mQnGoME1ez (Quaternius "Man in Suit") | CC0 1.0 | 2058 | Body/Hips/Spine style (Quaternius, 31 joints) | Man_Idle, Man_Walk, Man_Run, Man_Standing, Man_Sitting, Man_Clapping, Man_Jump, Man_RunningJump, Man_Punch, Man_SwordSlash, Man_Death |
| characters/business_man_suit_tie_quaternius_cc0.glb | https://poly.pizza/m/JFrLIKqvCH (Quaternius "Business Man") | CC0 1.0 | 6634 | Root/Body/Hips style (Quaternius, 248 joints) | Idle, Idle_Neutral, Idle_Sword, Idle_Gun, Idle_Gun_Pointing, Idle_Gun_Shoot, Walk, Run, Run_Back, Run_Left, Run_Right, Run_Shoot, Wave, Interact, Punch_Left, Punch_Right, Kick_Left, Kick_Right, Roll, Sword_Slash, Gun_Shoot, HitRecieve, HitRecieve_2, Death (24) |
| characters/man_long_sleeves_quaternius_cc0.glb | https://poly.pizza/m/DLptRuewTn (Quaternius "Man in Long Sleeves") | CC0 1.0 | 1970 | Bone/Foot.L/Body/Hips style (Quaternius, 31 joints) | same 11 Man_* clips as man_in_suit |
| characters/man_quaternius_cc0.glb | https://poly.pizza/m/HMnuH5geEG (Quaternius "Man") | CC0 1.0 | 1852 | same Quaternius rig | same 11 Man_* clips |
| characters/man_shirt_quaternius_cc0.glb | https://poly.pizza/m/fjHyMd5Wxw (Quaternius "Man", second shirt variant) | CC0 1.0 | 1854 | same Quaternius rig | same 11 Man_* clips |
| characters/casual_character_quaternius_cc0.glb | https://poly.pizza/m/kZ3DmIoGip (Quaternius "Casual Character") | CC0 1.0 | 5776 | Root/Body/Hips style (Quaternius, 248 joints) | same 24 CharacterArmature clips as business_man |
| characters/hoodie_character_quaternius_cc0.glb | https://poly.pizza/m/gKLBoRsyKe (Quaternius "Hoodie Character") | CC0 1.0 | 6206 | same CharacterArmature rig | same 24 CharacterArmature clips as business_man |
| characters/animated_human_quaternius_cc0.glb | https://poly.pizza/m/c3Ibh9I3udk (Quaternius "Animated Human") | CC0 1.0 | 1578 | Hips/Spine/LeftArm style, no prefix (41 joints) | Human Armature|Idle, Walk, Run, Jump, Punch, Death, Working, ArmatureAction.002 |
| characters/animated_base_character_quaternius_cc-by.glb | https://poly.pizza/m/cwYvO5UauX (Quaternius "Animated Base Character") | CC-BY 3.0: credit Quaternius (poly.pizza) | 13744 | Rigify DEF-* style (53 joints) | Rig|Idle_Loop, Idle_Talking_Loop, Sitting_Talking_Loop, Walk_Loop, Walk_Formal_Loop, Jog_Fwd_Loop, Sprint_Loop, Crouch_Idle_Loop, Crouch_Fwd_Loop, Interact, PickUp_Table, Fixing_Kneeling, Idle_Torch_Loop, Dance_Loop, Driving_Loop, Push_Loop, Pistol_* (4), Punch_*(3), Hit_*(2), Death01, Jump_*(3), Roll, Roll_RM, Sword_*(3), Spell_Simple_*(4), Swim_*(2), Sitting_Enter/Exit/Idle_Loop, Pistol_Reload, Punch_Enter (45 total) |

Rejected from the same scout (not saved): Quaternius "Suit" (sOUciDsoVV, CC-BY, a woman), "Characters Shaun" (eJFT9MxzOM, stylised pirate), "Animated Platformer Character" (kKtL4zvS3n, blue creature), "Animated Woman" x3 (female), "Animated Robot", "Steve"/"Cube Guy" (blocky), "Animated Character Base" (J-Toastie, CC-BY, 1 Mixamo clip), "Rigged Character" (Rafael, CC0, mixamorig bones, single pose clip), "Hazmat Man" (CC-BY, 3 clips), "Hyper Casual Character" (CC-BY, idle only). Static, unrigged older men found but unusable for animation: "Grandpa" (scaranto, CC0), "Old Guy" (Polygonal Mind, CC0), "OLDMAN" (CC-BY), "Doctor"/"Teacher" (jeremy, CC-BY). No rigged lab-coat character was found on poly.pizza.

## Mixamo animations

asset_originals/maximo/*.fbx (12 clips, no skin) are from Mixamo (Adobe), free for personal projects under Adobe's Mixamo terms. `node scripts/convert-mixamo.mjs` retargets them to the Xbot rig (also Mixamo) and writes public/anims/mixamo.glb (clips: idle, laugh, pickup, point, run, run_carry, walk_start, talk, talk2, terrified, victory, walk), resampled to 24 fps, with hips x/z root motion stripped from walk/run/run_carry/walk_start.

## Props library (public/models/props/, optimised from asset_originals/sketchfab/, 2026-10-25)

Index: public/models/props/manifest.json (`id, file, sizeMeters, tris, notes, suggestedUse`). Every GLB is < 1.2 MB, meshopt-compressed, WebP textures (256-1024 px), PBR kept, real-world metres, origin at bottom-centre (y=0 floor, centred x/z), front facing +Z, transforms baked into the vertices (no root node scale). Materials rely on metalness, so the scene needs an environment map (`scene.environment`) or the radio/voltmeter/microscope render black. Licence: Sketchfab, verify per model; likely CC-BY (credit authors before shipping). Pipeline: @gltf-transform (flatten, join, weld, simplify, dedup, prune, textureCompress webp, meshopt); the build script lives outside the repo (session scratchpad).

| id | source file | size m (x,y,z) | tris | MB |
|----|-------------|----------------|------|----|
| radio-bush-dac10 | 1950_bush_dac10_vintage_radio.glb (BLEND material forced to MASK, else black slabs) | 0.50 x 0.34 x 0.40 | 19854 | 0.39 |
| book-stack | book_stack.glb | 0.37 x 0.25 x 0.41 | 1620 | 0.36 |
| bunsen-burner | bunsen_burner.glb (includes its red hose) | 0.36 x 0.25 x 0.17 | 2756 | 0.13 |
| computer-crt | computer.glb | 0.45 x 0.21 x 0.30 | 2524 | 0.09 |
| old-computer | old_computer.glb | 0.45 x 0.30 x 0.50 | 9997 | 0.52 |
| paintings-pack | free_medieval_paintings_pack.glb (24 paintings on one wall slab) | 3.00 x 1.62 x 0.04 | 782 | 0.25 |
| voltmeter-rusty | old_rusty_voltmeter.glb (rotated so dial faces +Z) | 0.20 x 0.20 x 0.20 | 7550 | 0.82 |
| tesla-coil-soviet | red_alert_2_-_soviet_tesla_coil.glb | 0.61 x 1.20 x 0.61 | 12348 | 0.64 |
| tesla-coil-gun | tesla_coil_gun.glb (marginal) | 0.18 x 0.21 x 0.60 | 3000 | 0.34 |
| time-bomb | time_bomb.glb | 0.20 x 0.11 x 0.09 | 20128 | 0.44 |
| typewriter-underwood | underwood_no._5_typewriter...glb (131 MB, stray `modifiers_wrench` node removed) | 0.35 x 0.20 x 0.31 | 37072 | 1.19 |
| vacuum-tube-instruments | vacuum_tube_instruments.glb | 0.29 x 0.23 x 0.25 | 9718 | 0.77 |
| desk-lamp | vintage_desk_lamp.glb | 0.35 x 0.45 x 0.27 | 22000 | 0.29 |
| microscope | vintage_microscope(1).glb | 0.18 x 0.35 x 0.23 | 21993 | 1.01 |

Not converted: munchkin_cat.glb (animation data made it 21 MB; public/models/sketchfab/bicolor_cat.glb already covers cats), low_poly_laboratory_assets.glb (glassware already in vintage/glassware.glb), and the room scenes (Habitacion Modelada, modular_vintage_living_room, vintage_living_room, sci-fi_computer_room), plus cabinet/oscilloscope/phone/terminal already done in public/models/vintage/.
