import type { DragonPartSprites, SpriteSheet } from './sprites';

export type DragonPoseKind =
  | 'hover'
  | 'attack'
  | 'beam'
  | 'coil'
  | 'tailWhip'
  | 'swoop'
  | 'stunned'
  | 'defeated';

export interface DragonRenderParams {
  x: number;
  y: number;
  width: number;
  height: number;
  facing: 1 | -1;
  elapsed: number;
  beatSpeed: number;
  pose: DragonPoseKind;
  hurtTimer: number;
  isFlash: boolean;
  isMouthEmberActive: boolean;
  targetDeltaX: number;
  targetDeltaY: number;
  decapitated: boolean;
  severedHeadX: number;
  severedHeadY: number;
  severedHeadGrounded: boolean;
  parts: DragonPartSprites;
}

interface Pt {
  x: number;
  y: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Crisp integer Bresenham pixel line (1px-3px thick, zero anti-aliasing, batched horizontal runs)
function drawPixelLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thickness = 1,
): void {
  if (
    !Number.isFinite(x0) ||
    !Number.isFinite(y0) ||
    !Number.isFinite(x1) ||
    !Number.isFinite(y1)
  ) {
    return;
  }
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const t = Math.max(1, Math.min(6, Math.round(thickness)));

  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  if (dx > 300 || dy > 300) return;

  ctx.fillStyle = color;
  if (dy === 0) {
    ctx.fillRect(Math.min(ix0, ix1), iy0, dx + t, t);
    return;
  }
  if (dx === 0) {
    ctx.fillRect(ix0, Math.min(iy0, iy1), t, dy + t);
    return;
  }

  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;

  let runStartX = ix0;
  let runEndX = ix0;
  let runY = iy0;
  const maxSteps = Math.min(256, dx + dy + 1);

  for (let step = 0; step < maxSteps; step++) {
    if (iy0 === runY) {
      runEndX = ix0;
    } else {
      const rx = Math.min(runStartX, runEndX);
      const rw = Math.abs(runEndX - runStartX) + t;
      ctx.fillRect(rx, runY, rw, t);
      runStartX = ix0;
      runEndX = ix0;
      runY = iy0;
    }
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      ix0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      iy0 += sy;
    }
  }
  const rx = Math.min(runStartX, runEndX);
  const rw = Math.abs(runEndX - runStartX) + t;
  ctx.fillRect(rx, runY, rw, t);
}

// Crisp scanline triangle rasterizer for authentic pixel-art wing membranes
function fillPixelTri(
  ctx: CanvasRenderingContext2D,
  p0: Pt,
  p1: Pt,
  p2: Pt,
  color: string,
): void {
  if (
    !Number.isFinite(p0.x) ||
    !Number.isFinite(p0.y) ||
    !Number.isFinite(p1.x) ||
    !Number.isFinite(p1.y) ||
    !Number.isFinite(p2.x) ||
    !Number.isFinite(p2.y)
  ) {
    return;
  }

  const pts: Pt[] = [
    { x: Math.round(p0.x), y: Math.round(p0.y) },
    { x: Math.round(p1.x), y: Math.round(p1.y) },
    { x: Math.round(p2.x), y: Math.round(p2.y) },
  ].sort((a, b) => a.y - b.y);

  const [a, b, c] = pts;
  const totalH = c.y - a.y;
  if (totalH > 240) return;

  if (a.y === c.y) {
    const minX = Math.min(a.x, b.x, c.x);
    const maxX = Math.max(a.x, b.x, c.x);
    if (maxX - minX > 300) return;
    ctx.fillStyle = color;
    ctx.fillRect(minX, a.y, maxX - minX + 1, 1);
    return;
  }

  ctx.fillStyle = color;

  for (let y = a.y; y <= c.y; y++) {
    const secondHalf = y > b.y || b.y === a.y;
    const segH = secondHalf ? c.y - b.y : b.y - a.y;
    const alpha = totalH === 0 ? 0 : (y - a.y) / totalH;
    const beta = segH === 0 ? 0 : (y - (secondHalf ? b.y : a.y)) / segH;

    let ax = a.x + (c.x - a.x) * alpha;
    let bx = secondHalf
      ? b.x + (c.x - b.x) * beta
      : a.x + (b.x - a.x) * beta;

    if (ax > bx) {
      const tmp = ax;
      ax = bx;
      bx = tmp;
    }
    const sx = Math.round(ax);
    const ex = Math.round(bx);
    if (ex >= sx && ex - sx <= 300) {
      ctx.fillRect(sx, y, ex - sx + 1, 1);
    }
  }
}

interface WingJoints {
  shoulder: Pt;
  elbow: Pt;
  wrist: Pt;
  thumbTip: Pt;
  tips: [Pt, Pt, Pt, Pt];
  bowOut: number;
}

// Computes naturalistic multi-jointed wing kinematics in Dragon local space (facing LEFT)
function computeNaturalWingJoints(
  shoulder: Pt,
  phase: number,
  foldBias: number,
  spanScale: number,
  isDefeated: boolean,
): WingJoints {
  if (isDefeated) {
    // Collapsed heavy leathery wing draped across the back
    const elbow = { x: shoulder.x + 8, y: shoulder.y - 6 };
    const wrist = { x: shoulder.x + 20, y: shoulder.y - 8 };
    return {
      shoulder,
      elbow,
      wrist,
      thumbTip: { x: wrist.x + 1, y: wrist.y - 3 },
      tips: [
        { x: shoulder.x + 36, y: shoulder.y - 3 },
        { x: shoulder.x + 33, y: shoulder.y + 3 },
        { x: shoulder.x + 27, y: shoulder.y + 7 },
        { x: shoulder.x + 19, y: shoulder.y + 9 },
      ],
      bowOut: 0,
    };
  }

  const twoPi = Math.PI * 2;
  const u = (((phase % twoPi) + twoPi) % twoPi) / twoPi;

  // Asymmetric naturalistic flap curve:
  // 0.00..0.54 = slower folding upstroke (elbow leads, fingers fold inward to reduce drag)
  // 0.54..0.66 = apex extension (joints snap wide & lock)
  // 0.66..0.92 = fast explosive power downstroke (taut stretched membrane, upward bow)
  // 0.92..1.00 = follow-through lift rebound
  let wingLift = 0; // -1 (high up) .. +1 (deep downstroke)
  let fold = foldBias;
  let wristLag = 0;
  let bowOut = 0;

  if (u < 0.54) {
    const t = u / 0.54;
    const ease = 0.5 - 0.5 * Math.cos(t * Math.PI);
    wingLift = lerp(0.85, -1.0, ease);
    // Natural fold peaks mid-upstroke as wing draws upward
    const foldWave = Math.sin(t * Math.PI);
    fold = clamp(foldBias + foldWave * 0.52, 0, 0.9);
    wristLag = foldWave * 5.5;
    bowOut = -foldWave * 1.5;
  } else if (u < 0.66) {
    const t = (u - 0.54) / 0.12;
    wingLift = lerp(-1.0, -0.78, t);
    fold = clamp(foldBias * (1 - t), 0, 0.9);
    wristLag = lerp(1.5, -1.0, t);
    bowOut = 0.5;
  } else if (u < 0.92) {
    const t = (u - 0.66) / 0.26;
    // Snappy power downstroke (fast acceleration into air resistance)
    const snap = 1 - Math.pow(1 - t, 2.2);
    wingLift = lerp(-0.78, 1.0, snap);
    fold = clamp(foldBias * 0.25, 0, 0.9);
    wristLag = -Math.sin(t * Math.PI) * 3.0;
    // Membrane puffs/bows upward against air load during power stroke
    bowOut = Math.sin(t * Math.PI) * 3.2;
  } else {
    const t = (u - 0.92) / 0.08;
    wingLift = lerp(1.0, 0.85, t);
    fold = foldBias * 0.35;
    wristLag = lerp(-1.0, 1.0, t);
    bowOut = lerp(1.2, 0, t);
  }

  // Shoulder -> Elbow (humerus)
  const elbowAngle = lerp(-1.22, 0.42, (wingLift + 1) * 0.5) - fold * 0.25;
  const humerusLen = 11.5 * spanScale;
  const elbow: Pt = {
    x: shoulder.x + Math.cos(elbowAngle) * humerusLen,
    y: shoulder.y + Math.sin(elbowAngle) * humerusLen,
  };

  // Elbow -> Wrist (forearm): folds closer when fold is high
  const forearmAngle =
    lerp(-0.98, 0.64, (wingLift + 1) * 0.5) + wristLag * 0.045 - fold * 0.45;
  const forearmLen = (15.5 - fold * 4.5) * spanScale;
  const wrist: Pt = {
    x: elbow.x + Math.cos(forearmAngle) * forearmLen,
    y: elbow.y + Math.sin(forearmAngle) * forearmLen,
  };

  // Wing-thumb claw pointing upward-forward from wrist
  const thumbTip: Pt = {
    x: wrist.x - 1.5,
    y: wrist.y - 4.0,
  };

  // 4 Phalanges (wing fingers) fanning out with air-resistance flex
  const baseFan = forearmAngle + 0.14 + fold * 0.58 + wristLag * 0.05;
  const fingerLens = [20.5, 19.0, 16.5, 13.0];
  const spreadOffsets = [0.02, 0.34 - fold * 0.14, 0.72 - fold * 0.26, 1.16 - fold * 0.36];

  const tips = [0, 1, 2, 3].map((idx) => {
    const len = fingerLens[idx] * (1 - fold * 0.24) * spanScale;
    const ang = baseFan + spreadOffsets[idx];
    return {
      x: wrist.x + Math.cos(ang) * len,
      y: wrist.y + Math.sin(ang) * len + wristLag * (0.28 + idx * 0.14),
    };
  }) as [Pt, Pt, Pt, Pt];

  return { shoulder, elbow, wrist, thumbTip, tips, bowOut };
}

function drawPixelArtWing(
  ctx: CanvasRenderingContext2D,
  joints: WingJoints,
  hipAnchor: Pt,
  palette: Record<string, string>,
  isBackWing: boolean,
  isFlash: boolean,
): void {
  const outlineCol = isFlash ? '#dceeff' : palette.K || '#1e1033';
  const boneHi = isFlash ? '#fff7dc' : isBackWing ? palette.v || '#3e1b5c' : palette.V || '#753999';
  const boneShadow = isFlash ? '#fff7dc' : palette.v || '#3e1b5c';
  const memMain = isFlash
    ? '#fff7dc'
    : isBackWing
      ? palette.n || '#5e3d4f'
      : palette.M || '#e0ab6c';
  const memMid = isFlash
    ? '#fff7dc'
    : isBackWing
      ? palette.n || '#5e3d4f'
      : palette.m || '#9e6e5c';
  const memDark = isFlash ? '#fff7dc' : palette.n || '#5e3d4f';
  const clawHi = isFlash ? '#fff7dc' : palette.H || '#632985';

  const { shoulder, elbow, wrist, thumbTip, tips, bowOut } = joints;

  // Mid-edge control points for subtle air-resistance bowing
  const midCurve = (a: Pt, b: Pt, lift: number): Pt => ({
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5 - lift,
  });

  const panels: Array<{ a: Pt; b: Pt; c: Pt; col: string }> = [
    { a: elbow, b: hipAnchor, c: tips[3], col: memDark },
    { a: wrist, b: elbow, c: tips[3], col: memMid },
    { a: wrist, b: tips[3], c: tips[2], col: memMid },
    { a: wrist, b: tips[2], c: tips[1], col: memMain },
    { a: wrist, b: tips[1], c: tips[0], col: memMain },
  ];

  // Pass 1: crisp 1px dark silhouette outline behind membrane edges
  for (const p of panels) {
    drawPixelLine(ctx, p.a.x, p.a.y + 1, p.c.x, p.c.y + 1, outlineCol, 2);
    drawPixelLine(ctx, p.b.x, p.b.y + 1, p.c.x, p.c.y + 1, outlineCol, 2);
  }
  drawPixelLine(ctx, hipAnchor.x, hipAnchor.y + 1, tips[3].x, tips[3].y + 1, outlineCol, 2);
  for (let i = 0; i < 3; i++) {
    const sc = midCurve(tips[i], tips[i + 1], bowOut * 0.5);
    drawPixelLine(ctx, tips[i].x, tips[i].y + 1, sc.x, sc.y + 1, outlineCol, 2);
    drawPixelLine(ctx, sc.x, sc.y + 1, tips[i + 1].x, tips[i + 1].y + 1, outlineCol, 2);
  }

  // Pass 2: shaded leathery membrane triangles + bowed trailing edge
  for (const p of panels) {
    fillPixelTri(ctx, p.a, p.b, p.c, p.col);
  }
  // Scalloped trailing arch fill when membrane bows under air resistance
  if (Math.abs(bowOut) > 0.35) {
    for (let i = 0; i < 3; i++) {
      const sc = midCurve(tips[i], tips[i + 1], bowOut * 0.65);
      fillPixelTri(ctx, tips[i], tips[i + 1], sc, i === 0 ? memMain : memMid);
    }
  }

  // Pass 3: membrane tendon creases for anatomical weight
  if (!isFlash) {
    for (let i = 0; i < 3; i++) {
      const m = midCurve(wrist, tips[i], -1);
      drawPixelLine(ctx, wrist.x, wrist.y, m.x, m.y, memDark, 1);
    }
  }

  // Pass 4: articulated finger bones (outlined + bone highlights)
  for (let i = 0; i < 4; i++) {
    drawPixelLine(ctx, wrist.x, wrist.y, tips[i].x, tips[i].y, outlineCol, 2);
    drawPixelLine(ctx, wrist.x, wrist.y, tips[i].x, tips[i].y, i < 2 ? boneHi : boneShadow, 1);
  }

  // Pass 5: main wing arm bones (shoulder -> elbow -> wrist) + shoulder muscle bulk
  drawPixelLine(ctx, shoulder.x, shoulder.y - 1, elbow.x, elbow.y - 1, outlineCol, 3);
  drawPixelLine(ctx, elbow.x, elbow.y - 1, wrist.x, wrist.y - 1, outlineCol, 3);
  drawPixelLine(ctx, shoulder.x, shoulder.y, elbow.x, elbow.y, boneShadow, 2);
  drawPixelLine(ctx, shoulder.x, shoulder.y - 1, elbow.x, elbow.y - 1, boneHi, 1);
  drawPixelLine(ctx, elbow.x, elbow.y, wrist.x, wrist.y, boneShadow, 2);
  drawPixelLine(ctx, elbow.x, elbow.y - 1, wrist.x, wrist.y - 1, boneHi, 1);

  // Wing-thumb claw spike at wrist apex
  drawPixelLine(ctx, wrist.x, wrist.y, thumbTip.x, thumbTip.y, outlineCol, 2);
  drawPixelLine(ctx, wrist.x, wrist.y, thumbTip.x, thumbTip.y, clawHi, 1);
}

function pickSheet(sheet: SpriteSheet, isFlash: boolean): HTMLCanvasElement {
  return isFlash ? sheet.flashCanvas : sheet.canvas;
}

function drawRotatedPart(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  worldAnchorX: number,
  worldAnchorY: number,
  pivotX: number,
  pivotY: number,
  angleRad: number,
): void {
  ctx.save();
  ctx.translate(Math.round(worldAnchorX), Math.round(worldAnchorY));
  if (Math.abs(angleRad) > 0.015) {
    ctx.rotate(angleRad);
  }
  ctx.drawImage(img, Math.round(-pivotX), Math.round(-pivotY));
  ctx.restore();
}

export function drawDragonArticulated(
  ctx: CanvasRenderingContext2D,
  p: DragonRenderParams,
): void {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    !Number.isFinite(p.elapsed) ||
    !Number.isFinite(p.beatSpeed)
  ) {
    return;
  }
  const { parts, isFlash, pose, elapsed, beatSpeed } = p;
  const palette = parts.palette;
  const t = elapsed;

  const isDefeated = pose === 'defeated';
  const isCoil = pose === 'coil';
  const isAttack = pose === 'attack';
  const isBeam = pose === 'beam';
  const isSwoop = pose === 'swoop';
  const isTailWhip = pose === 'tailWhip';
  const isStunned = pose === 'stunned';
  const isHurt = p.hurtTimer > 0;

  // Continuous wing-flap phase + secondary micro-motion oscillators
  const wingPhase = t * beatSpeed;
  const breathCycle = Math.sin(t * 3.4);
  const tailFreq = isTailWhip ? 17.5 : isAttack || isBeam ? 9.5 : isCoil ? 6.0 : 4.2;
  const tailPhase = t * tailFreq;

  // Body lift recoil synced to downstroke (downstroke lifts body slightly upward)
  const wingLiftBody = isDefeated ? 16 : Math.sin(wingPhase - 0.85) * (isSwoop ? 1.5 : 2.3);
  const bodyBobY = isDefeated ? 16 : wingLiftBody + breathCycle * 0.8;
  const bodyShiftX = isDefeated ? 2 : isAttack || isSwoop ? -2 : isCoil ? 3 : 0;

  const bodyPitch = isDefeated
    ? 0.22
    : isSwoop
      ? -0.22
      : isCoil
        ? 0.16
        : isAttack || isBeam
          ? -0.1
          : Math.sin(wingPhase - 0.4) * 0.05;

  // Wing parameters per pose
  const foldBias = isCoil ? 0.55 : isSwoop ? 0.34 : isStunned ? 0.42 : 0.08;
  const spanScale = isAttack || isBeam ? 1.12 : isCoil ? 0.82 : isStunned ? 0.9 : 1.0;

  // Root space (80x56 box facing LEFT, mirrored cleanly when facing === 1)
  const dDrawX = Math.round(p.x);
  const dDrawY = Math.round(p.y);

  ctx.save();
  if (p.facing === 1) {
    ctx.translate(dDrawX + p.width, dDrawY);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(dDrawX, dDrawY);
  }

  // Torso anchor center in local 80x56 frame
  const torsoCenter: Pt = { x: 29 + bodyShiftX, y: 28 + bodyBobY };

  // Local torso space rotated by subtle pitch
  ctx.save();
  ctx.translate(Math.round(torsoCenter.x), Math.round(torsoCenter.y));
  if (Math.abs(bodyPitch) > 0.015) {
    ctx.rotate(bodyPitch);
  }

  // Key sockets relative to torsoCenter
  const backWingShoulder: Pt = { x: -1, y: -7 };
  const frontWingShoulder: Pt = { x: 2, y: -5 };
  const tailHip: Pt = { x: 8, y: 7 };
  const backHip: Pt = { x: 3, y: 8 };
  const frontHip: Pt = { x: 6, y: 9 };
  const backShoulder: Pt = { x: -8, y: 2 };
  const frontShoulder: Pt = { x: -5, y: 3 };
  const neckRoot: Pt = { x: -7, y: -6 };

  // 1. BACK WING (slightly ahead in phase + deeper shadow shading for 3D depth)
  const backWingJoints = computeNaturalWingJoints(
    backWingShoulder,
    wingPhase + 0.22,
    foldBias,
    spanScale * 0.95,
    isDefeated,
  );
  drawPixelArtWing(ctx, backWingJoints, tailHip, palette, true, isFlash);

  // 2. MULTI-SEGMENT UNDULATING TAIL (5 overlapping vertebrae + spear tip)
  const tailAmp = isDefeated
    ? 0.4
    : isTailWhip
      ? 0.62
      : isCoil
        ? 0.36
        : isAttack || isBeam
          ? 0.28
          : 0.22;
  const tailBaseAngle = isDefeated ? 0.12 : isCoil ? -0.58 : isTailWhip ? -0.15 : 0.24;

  let tx = tailHip.x;
  let ty = tailHip.y;
  let accumAngle = tailBaseAngle;
  for (let i = 0; i < 5; i++) {
    const segWave = Math.sin(tailPhase - i * 0.78) * tailAmp * (1 + i * 0.12);
    const coilCurve = isCoil ? -0.28 : isDefeated ? 0.04 : -0.09;
    accumAngle += segWave * 0.42 + coilCurve;
    drawRotatedPart(ctx, pickSheet(parts.tailSeg, isFlash), tx, ty, 2, 3, accumAngle);
    const stepLen = 6.2;
    tx += Math.cos(accumAngle) * stepLen;
    ty += Math.sin(accumAngle) * stepLen;
  }
  const tipFlick = Math.sin(tailPhase - 3.6) * tailAmp * 0.55;
  drawRotatedPart(
    ctx,
    pickSheet(parts.tailTip, isFlash),
    tx,
    ty,
    2,
    6,
    accumAngle + tipFlick - 0.14,
  );

  // 3. BACK HIND LEG & TALONS
  const backLegSwing = isDefeated
    ? 0.55
    : isSwoop
      ? 0.42
      : isCoil
        ? -0.25
        : Math.sin(wingPhase - 1.1) * 0.16;
  drawRotatedPart(ctx, pickSheet(parts.hindLeg, isFlash), backHip.x, backHip.y, 6, 2, backLegSwing);

  // 4. BACK FOREARM & CLAWS
  const backArmSwing = isDefeated
    ? 0.5
    : isAttack
      ? -0.55 + Math.sin(t * 18) * 0.2
      : isCoil
        ? 0.42
        : Math.sin(t * 4.2 + 1.0) * 0.18;
  drawRotatedPart(
    ctx,
    pickSheet(parts.backArm, isFlash),
    backShoulder.x,
    backShoulder.y,
    7,
    2,
    backArmSwing,
  );

  // 5. BREATHING RIBCAGE TORSO + PULSING CHEST CORE
  const torsoSheet = pickSheet(parts.torso, isFlash);
  const breathScaleY = isDefeated ? 1 : 1 + breathCycle * 0.035;
  ctx.save();
  ctx.scale(1, breathScaleY);
  ctx.drawImage(torsoSheet, -13, -12);
  if (!isFlash && !isDefeated) {
    // Subtle pulsing core crystal highlight inside ribcage
    const corePulse = 0.5 + 0.5 * Math.sin(t * 6.5);
    if (corePulse > 0.35) {
      ctx.fillStyle = palette.W || '#fff7d6';
      ctx.globalAlpha = 0.35 + corePulse * 0.45;
      ctx.fillRect(-5, -8, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  // 6. FRONT HIND LEG & TALONS (counter-swinging for natural weight)
  const frontLegSwing = isDefeated
    ? 0.45
    : isSwoop
      ? 0.32
      : isCoil
        ? -0.15
        : Math.sin(wingPhase - 0.5) * 0.18;
  drawRotatedPart(
    ctx,
    pickSheet(parts.hindLeg, isFlash),
    frontHip.x,
    frontHip.y,
    6,
    2,
    frontLegSwing,
  );

  // 7. FRONT FOREARM & CLAWS
  const frontArmSwing = isDefeated
    ? 0.65
    : isAttack
      ? -0.68 + Math.sin(t * 20) * 0.28
      : isBeam
        ? -0.35
        : isCoil
          ? 0.52
          : Math.sin(t * 4.2) * 0.2;
  drawRotatedPart(
    ctx,
    pickSheet(parts.frontArm, isFlash),
    frontShoulder.x,
    frontShoulder.y,
    9,
    2,
    frontArmSwing,
  );

  // 8. ARTICULATED 2-SEGMENT NECK + HEAD + HINGED JAW + BLINKING EYE
  const neckReach = isAttack || isBeam ? -3.5 : isCoil ? 2.5 : Math.sin(t * 3.1) * 1.1;
  const neckBobY = isDefeated ? 6 : isBeam || isAttack ? -1.5 : breathCycle * 1.1 + Math.cos(t * 4.4) * 0.7;

  const neck1Pos: Pt = { x: neckRoot.x + neckReach * 0.4, y: neckRoot.y + neckBobY * 0.45 };
  const neck2Pos: Pt = { x: neckRoot.x - 4.5 + neckReach, y: neckRoot.y - 4.8 + neckBobY };

  const neck1Ang = isCoil ? 0.32 : isBeam || isAttack ? -0.18 : Math.sin(t * 3.2) * 0.08;
  const neck2Ang = isCoil ? 0.24 : isBeam || isAttack ? -0.14 : Math.cos(t * 3.2) * 0.09;

  drawRotatedPart(ctx, pickSheet(parts.neck, isFlash), neck1Pos.x, neck1Pos.y, 7, 5, neck1Ang);
  drawRotatedPart(ctx, pickSheet(parts.neck, isFlash), neck2Pos.x, neck2Pos.y, 7, 5, neck2Ang);

  if (!p.decapitated) {
    // Head tracking angle toward Warrior (when facing left or right)
    const dirDx = p.facing === -1 ? -p.targetDeltaX : p.targetDeltaX;
    const rawAim = Math.atan2(p.targetDeltaY, Math.max(24, dirDx));
    const clampedAim = clamp(-rawAim * 0.38, -0.26, 0.24);
    const headTilt = isDefeated
      ? 0.28
      : isStunned || isHurt
        ? Math.sin(t * 22) * 0.14 + 0.18
        : isBeam
          ? -0.14 + Math.sin(t * 16) * 0.05
          : isAttack
            ? -0.12
            : clampedAim + Math.sin(t * 2.8) * 0.04;

    const headPivotX = neck2Pos.x - 3.5;
    const headPivotY = neck2Pos.y - 3.5;

    // Hinged Lower Jaw opening (roar / beam / mouth embers / breathing)
    const jawOpen = isDefeated
      ? 0.18
      : isBeam
        ? 0.44 + Math.sin(t * 24) * 0.06
        : isAttack
          ? 0.36 + Math.sin(t * 16) * 0.08
          : p.isMouthEmberActive
            ? 0.18 + Math.sin(t * 10) * 0.06
            : Math.max(0, Math.sin(t * 2.6)) * 0.09;

    ctx.save();
    ctx.translate(Math.round(headPivotX), Math.round(headPivotY));
    if (Math.abs(headTilt) > 0.012) {
      ctx.rotate(headTilt);
    }

    // Draw hinged lower jaw first behind upper fangs
    ctx.save();
    ctx.translate(-3, 2);
    if (jawOpen > 0.015) {
      ctx.rotate(-jawOpen); // Negative angle drops jaw open while facing LEFT
    }
    ctx.drawImage(pickSheet(parts.jaw, isFlash), -13, -1);
    ctx.restore();

    // Draw upper skull, horns, brow ridges, and glowing eye
    ctx.drawImage(pickSheet(parts.head, isFlash), -15, -10);

    // Subtle periodic eye blink (approx every 3.8s for 110ms)
    const blinkCycle = t % 3.8;
    if (!isFlash && !isDefeated && (blinkCycle > 3.68 || isStunned)) {
      ctx.fillStyle = palette.I || '#fff1d4';
      ctx.fillRect(-9, -2, 3, 2);
      ctx.fillStyle = palette.K || '#1e1033';
      ctx.fillRect(-9, -1, 3, 1);
    } else if (!isFlash && !isDefeated && (isAttack || isBeam || p.isMouthEmberActive)) {
      // Fierce fiery eye glint
      ctx.fillStyle = palette.W || '#fff7d6';
      ctx.fillRect(-9, -2, 2, 1);
    }
    ctx.restore();
  }

  // 9. FRONT WING (full brightness, crisp highlights, articulated bones, claws & wind curl)
  const frontWingJoints = computeNaturalWingJoints(
    frontWingShoulder,
    wingPhase,
    foldBias,
    spanScale,
    isDefeated,
  );
  drawPixelArtWing(ctx, frontWingJoints, tailHip, palette, false, isFlash);

  ctx.restore(); // End torso pitch transform
  ctx.restore(); // End facing mirror transform

  // 10. VICTORY DECAPITATION: Independent tumbling / grounded severed Dragon head + jaw
  if (p.decapitated) {
    ctx.save();
    const hx = Math.round(p.severedHeadX);
    const hy = Math.round(p.severedHeadY);
    const rollAng = p.severedHeadGrounded ? -0.18 : Math.sin(t * 14) * 0.45;
    ctx.translate(hx + 12, hy + 10);
    if (p.facing === 1) {
      ctx.scale(-1, 1);
    }
    ctx.rotate(rollAng);
    ctx.drawImage(pickSheet(parts.jaw, isFlash), -10, 2);
    ctx.drawImage(pickSheet(parts.head, isFlash), -12, -8);
    ctx.restore();
  }
}
