// Pitch & physics constants (metres, seconds). x = length axis, z = width axis, y = up.
export const HALF_L = 52.5;
export const HALF_W = 34;
export const GOAL_HW = 3.66;   // half goal width
export const GOAL_H = 2.44;
export const GOAL_D = 2.0;     // net depth
export const POST_R = 0.06;
export const BALL_R = 0.11;
export const G = 9.81;
export const PEN_D = 16.5;     // penalty area depth
export const PEN_HW = 20.16;   // penalty area half width
export const SIX_D = 5.5;
export const SIX_HW = 9.16;
export const PEN_SPOT = 11;
export const CIRCLE_R = 9.15;

export const SIM_DT = 1 / 60;
export const AI_DT = 0.1;
// Each simulated second advances the match clock by this many seconds at 1x (90 min ≈ 10 real minutes).
export const CLOCK_FACTOR = 9;

// rolling friction model: dv/dt = -(ROLL_A + ROLL_B * v)
export const ROLL_A = 0.9;
export const ROLL_B = 0.065;
export const AIR_K = 0.012;    // quadratic drag
export const MAGNUS_K = 0.0042;
