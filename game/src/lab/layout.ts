/**
 * Room layout shared by the hub (Lab, Scenery, Desk, Pickups) and the actors: one source for where things stand.
 * Angles: the room is a 10-sided study; wall panel k faces the centre at angle gap(k) (x = cos, z = sin).
 */
export const WALL = 7, SIDES = 10, EYE = 1.65, BODY = 0.4;
export const STEP = (Math.PI * 2) / SIDES;
export const APO = WALL * Math.cos(Math.PI / SIDES); // centre to the flat face of a wall panel
export const gap = (k: number) => Math.PI + (k + 0.5) * STEP;
export const polar = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r] as const;
export const faceIn = (a: number) => -a - Math.PI / 2; // yaw that turns an object's +z toward the room centre

type V3 = [number, number, number];
/** Local frame (x along, y up, z out of the frame) rotated by `yaw` about (ox, oz) -> world. */
const frame = (ox: number, oz: number, yaw: number) => (lx: number, y: number, lz: number): V3 =>
  [ox + lx * Math.cos(yaw) + lz * Math.sin(yaw), y, oz - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
/** Point in wall panel k's frame (x along the wall, +z into the room, z = 0 at the wall face) -> world. */
export const onPanel = (k: number, lx: number, y: number, lz: number) => frame(...polar(gap(k), APO), faceIn(gap(k)))(lx, y, lz);

/** Wall panel contents (Scenery renders them): 0 bookcase behind the desk, 1 armchair + telephone, 2 fireplace, 3 window,
 *  4 bookcase, 5 lab cabinets, 6 side table, 7 window, 8 lab bench (glassware), 9 door with coat hooks. */
export const PANEL = { DESK_WALL: 0, ARMCHAIR: 1, FIRE: 2, WINDOW_A: 3, BOOKCASE: 4, CABINETS: 5, SIDE: 6, WINDOW_B: 7, BENCH: 8, DOOR: 9 } as const;

/** The one hero desk, against the bookcase on panel 0, its front (+z local) facing the room and the spawn side. */
const DA = gap(0), DR = 4.9;
const [dx, dz] = polar(DA, DR);
export const deskToWorld = frame(dx, dz, faceIn(DA));
export const DESK = {
  x: dx, z: dz, yaw: faceIn(DA),
  w: 2.8, d: 1.1, top: 0.79, // top surface height
  monitor: deskToWorld(0, 1.328, 0.065), // centre of the terminal's screen: the aim/close-up target
  view: deskToWorld(0, 1.36, 0.95), // where the camera sits for the close-up
  stand: deskToWorld(0, 0, 1.45), // a comfortable spot in front of the desk (x, -, z)
};

/** The player starts by the door side of the chamber, turned toward the desk. */
export const SPAWN = { x: 0.4, z: 3.4, yaw: 0.55 };

/** Every static obstacle as a disc (player radius included). Characters are not here; they move. */
export const COLLIDERS: { x: number; z: number; r: number }[] = [
  ...Array.from({ length: SIDES }, (_, k) => { const [x, z] = polar(gap(k), 6.6); return { x, z, r: 1.0 }; }),
  ...[-0.95, 0, 0.95].map((lx) => { const [x, , z] = deskToWorld(lx, 0, 0); return { x, z, r: 0.85 }; }),
  (() => { const [x, , z] = deskToWorld(-1.1, 0, 1.0); return { x, z, r: 0.45 }; })(), // desk chair, pulled out
  { x: 0, z: 0, r: 1.9 }, // the chamber plinth
];

/** Where each collectible (story/barks FETCH ids) waits in the room, matching its hint. y is the surface it rests on. */
export const SPOTS: Record<string, V3> = {
  'l1-inductor': onPanel(PANEL.FIRE, -0.55, 1.56, 0.86), // fireplace mantel
  'l1-capacitor': onPanel(PANEL.BOOKCASE, 0.6, 1.25, 0.66), // bookcase ledge, by the books
  'l2-junction': onPanel(PANEL.WINDOW_A, -0.35, 1.13, 0.3), // window sill
  'l3-pulse-box': onPanel(PANEL.CABINETS, -0.62, 0.98, 0.42), // in the cabinets, under the glassware
  'l3-loss-dial': onPanel(PANEL.BENCH, -0.3, 0.72, 0.75), // lab bench table
  'l4-drive': onPanel(PANEL.ARMCHAIR, -0.6, 0.47, 0.82), // armchair seat, beside the telephone
  'l5-cat-coil': [1.75, 0.02, -2.55], // on the rug
  'l5-wigner-lens': onPanel(PANEL.BENCH, 0.25, 0.72, 0.82),
  'l6-loss-valve': onPanel(PANEL.CABINETS, 0.62, 0.98, 0.42),
  'l6-parity-meter': onPanel(PANEL.ARMCHAIR, 0.32, 0.62, 0.78), // coffee table by the phone
  'l7-pair-dissipator': onPanel(PANEL.FIRE, 0.55, 1.56, 0.86),
  'l7-rate-knob': onPanel(PANEL.BOOKCASE, -0.6, 1.25, 0.66),
  'l8-squid': onPanel(PANEL.WINDOW_A, 0.4, 1.13, 0.3),
  'l8-pump': onPanel(PANEL.DOOR, 1.05, 0.0, 0.32), // floor under the coat hooks
  'l8-buffer': onPanel(PANEL.CABINETS, 0.0, 1.36, 0.42),
  'l9-fit-kit': deskToWorld(-1.05, 0.62, 0.62), // in the open top drawer of the left pedestal
  'l9-bias-gauge': onPanel(PANEL.BENCH, 0.7, 0.72, 0.7),
  'l10-detector': onPanel(PANEL.BENCH, -0.75, 0.72, 0.85),
  'l10-drive': onPanel(PANEL.ARMCHAIR, 0.78, 0.62, 0.78),
  'l10-line': onPanel(PANEL.DESK_WALL, 1.75, 0.0, 0.9), // floor at the end of the bookcase, toward the door
};
