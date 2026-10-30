//! Local camp-to-castle combat greybox. The simulation owns movement, minion
//! awareness, damage, gate and core progress. Online authority is not yet implemented.

use vgd_engine::clock::{FixedStep, DT};
use vgd_engine::events::Events;
use vgd_engine::math::{mix_seed, Rng};
use vgd_engine::Sim;

use crate::params::{self, DEFAULTS};

// ---------------------------------------------------------------- ABI layout

/// Bump when any export, stride, index or event meaning below changes;
/// `game/src/sim-abi.ts` must carry the same number (checked at boot).
pub const ABI_VERSION: u32 = 5;

/// Stats record, mirrored by game/src/sim-abi.ts; append or bump ABI for changes.
pub const STATS_FLOATS: usize = 39;
pub const ST_TIME: usize = 0;
pub const ST_ROUND_TIME: usize = 1;
pub const ST_STATE: usize = 2;
pub const ST_PAUSED: usize = 3;
pub const ST_ROUND: usize = 4;
pub const ST_STEPS: usize = 5;

/// Round states. The front end ends a round when the sim reports WON or LOST;
/// the blank round never does.
pub const STATE_READY: u8 = 0;
pub const STATE_PLAYING: u8 = 1;
pub const STATE_WON: u8 = 2;
pub const STATE_LOST: u8 = 3;

/// Round started: a = round number.
pub const EV_ROUND_START: f32 = 1.0;
pub const EV_SWING: f32 = 2.0;
pub const EV_HIT: f32 = 3.0;
pub const EV_PLAYER_HIT: f32 = 4.0;
pub const EV_GATE_OPEN: f32 = 5.0;
pub const EV_CORE_HIT: f32 = 6.0;
pub const EV_CORE_CLEAR: f32 = 7.0;
pub const EV_RESPAWN: f32 = 8.0;
const MAX_HEALTH: u8 = 6;
const CORE_START_HEALTH: u8 = 3;

// ---------------------------------------------------------------- state

pub struct World {
    /// Live-tunable parameters (`params.rs`).
    pub p: [f32; params::COUNT],
    pub seed: u32,
    /// Rounds laid out by this instance; mixed into the round seed so a
    /// replay can vary while the whole session replays from `seed`.
    pub round: u32,
    /// The round's random choices come from here (same seed ⇒ same run).
    pub rng: Rng,
    pub clock: FixedStep,
    pub events: Events,
    pub paused: bool,
    pub state: u8,
    /// Seconds stepped since the last reset.
    pub time: f32,
    /// Seconds spent PLAYING this round.
    pub round_time: f32,
    pub steps: u32,
    pub out_stats: [f32; STATS_FLOATS],
    pub x: f32, pub z: f32, pub input_x: f32, pub input_z: f32,
    pub attack: bool, pub cooldown: f32, pub class: u8, pub enemies: [bool; 3],
    pub enemy_x: [f32; 3], pub enemy_z: [f32; 3], pub enemy_attack: [f32; 3],
    pub health: u8, pub core_health: u8, pub cleared: bool, pub invulnerable: f32,
    pub ally_count: usize, pub ally_x: [f32; 3], pub ally_z: [f32; 3],
    pub ally_hp: [u8; 3], pub ally_cooldown: [f32; 3], pub ally_invulnerable: [f32; 3],
}

impl World {
    pub fn new(seed: u32) -> Self {
        let mut w = World {
            p: DEFAULTS,
            seed,
            round: 0,
            rng: Rng::new(seed),
            clock: FixedStep::default(),
            events: Events::default(),
            paused: false,
            state: STATE_READY,
            time: 0.0,
            round_time: 0.0,
            steps: 0,
            out_stats: [0.0; STATS_FLOATS],
            x: 0.0, z: -7.0, input_x: 0.0, input_z: 0.0, attack: false, cooldown: 0.0, class: 0, enemies: [true; 3],
            enemy_x: [-2.5, 2.5, 0.0], enemy_z: [-2.0, 0.0, 3.0], enemy_attack: [0.0; 3],
            health: MAX_HEALTH, core_health: CORE_START_HEALTH, cleared: false, invulnerable: 0.0,
            ally_count: 0, ally_x: [-1.3, 1.3, -2.6], ally_z: [-8.0, -8.0, -8.5],
            ally_hp: [4; 3], ally_cooldown: [1.2, 1.5, 1.8], ally_invulnerable: [0.0; 3],
        };
        w.reset();
        w
    }

    /// Back to a fresh round, READY. Tunable params are kept.
    pub fn reset(&mut self) {
        self.rng = Rng::new(mix_seed(self.seed, self.round));
        self.round = self.round.wrapping_add(1);
        self.clock.clear();
        self.events.clear();
        self.paused = false;
        self.state = STATE_READY;
        self.time = 0.0;
        self.round_time = 0.0;
        self.steps = 0;
        self.x = 0.0; self.z = -7.0; self.input_x = 0.0; self.input_z = 0.0;
        self.attack = false; self.cooldown = 0.0; self.enemies = [true; 3];
        self.enemy_x = [-2.5, 2.5, 0.0]; self.enemy_z = [-2.0, 0.0, 3.0]; self.enemy_attack = [0.0; 3];
        self.health = MAX_HEALTH; self.core_health = CORE_START_HEALTH; self.cleared = false; self.invulnerable = 0.0;
        self.ally_x = [-1.3, 1.3, -2.6]; self.ally_z = [-8.0, -8.0, -8.5];
        self.ally_hp = [4; 3]; self.ally_cooldown = [1.2, 1.5, 1.8]; self.ally_invulnerable = [0.0; 3];
        self.write_outputs();
    }

    /// READY → PLAYING; the greybox starts immediately without a countdown.
    pub fn round_start(&mut self) {
        if self.state != STATE_READY {
            return;
        }
        self.state = STATE_PLAYING;
        self.events.emit(EV_ROUND_START, self.round as f32, 0.0, 0.0, 0.0, 0.0);
        self.write_outputs();
    }

    /// Advance by real elapsed time in fixed steps; outputs are written once
    /// per call. Paused: nothing moves and no time accrues. Returns steps taken.
    pub fn advance(&mut self, real_dt: f32) -> u32 {
        if self.paused {
            return 0;
        }
        let n = self.clock.feed(real_dt);
        for _ in 0..n {
            self.step();
        }
        self.write_outputs();
        n
    }

    pub fn set_paused(&mut self, on: bool) {
        self.paused = on;
        if on {
            self.clock.clear(); // a fraction of a step must not carry over a pause
        }
        self.write_outputs();
    }

    /// One fixed step of the rules.
    pub fn step(&mut self) {
        self.time += DT;
        self.steps = self.steps.wrapping_add(1);
        if self.state == STATE_PLAYING {
            self.round_time += DT;
            let len = (self.input_x * self.input_x + self.input_z * self.input_z).sqrt().max(1.0);
            let speed = self.p[params::MOVE_SPEED].max(0.0);
            self.x = (self.x + self.input_x / len * speed * DT).clamp(-7.5, 7.5);
            let next_z = (self.z + self.input_z / len * speed * DT).clamp(-9.5, 10.5);
            let crosses = (self.z < 5.5 && next_z >= 5.5) || (self.z >= 5.5 && next_z < 5.5);
            let blocked = crosses && (self.x.abs() > 1.5 || self.enemies.iter().any(|e| *e));
            if !blocked { self.z = next_z; }
            self.cooldown = (self.cooldown - DT).max(0.0);
            self.invulnerable = (self.invulnerable - DT).max(0.0);
            if self.attack && self.cooldown <= 0.0 && !self.cleared {
                self.events.emit(EV_SWING, self.x, self.z, 0.0, 0.0, 0.0);
                let radius = match self.class { 1 => 6.0, 2 => 8.0, _ => self.p[params::ATTACK_RANGE].max(0.1) };
                let target = (0..3).filter(|i| self.enemies[*i]).filter(|i| {
                    (self.enemy_x[*i]-self.x).powi(2)+(self.enemy_z[*i]-self.z).powi(2) <= radius.powi(2)
                }).min_by(|a,b| {
                    let dist = |i: usize| (self.enemy_x[i]-self.x).powi(2)+(self.enemy_z[i]-self.z).powi(2);
                    dist(*a).total_cmp(&dist(*b))
                });
                if let Some(i) = target {
                    self.enemies[i] = false;
                    self.events.emit(EV_HIT, self.enemy_x[i], self.enemy_z[i], 0.0, 0.0, 0.0);
                    // Spellcaster splash is centered on the chosen target; Scout hits only one.
                    if self.class == 1 {
                        for j in 0..3 {
                            if self.enemies[j] && (self.enemy_x[j]-self.enemy_x[i]).powi(2)+(self.enemy_z[j]-self.enemy_z[i]).powi(2) <= 2.0_f32.powi(2) {
                                self.enemies[j] = false;
                                self.events.emit(EV_HIT, self.enemy_x[j], self.enemy_z[j], 0.0, 0.0, 0.0);
                            }
                        }
                    }
                    if !self.enemies.iter().any(|e| *e) { self.events.emit(EV_GATE_OPEN, 0.0, 6.0, 0.0, 0.0, 0.0); }
                } else if !self.enemies.iter().any(|e| *e) && (self.x.powi(2)+(self.z-8.5).powi(2)) <= radius.powi(2) && self.z >= 5.5 && self.core_health > 0 {
                    self.core_health -= 1;
                    self.events.emit(EV_CORE_HIT, 0.0, 8.5, self.core_health as f32, 0.0, 0.0);
                    if self.core_health == 0 { self.cleared = true; self.events.emit(EV_CORE_CLEAR, 0.0, 8.5, 0.0, 0.0, 0.0); }
                }
                self.cooldown = match self.class { 1 => 0.9, 2 => 0.65, _ => self.p[params::ATTACK_INTERVAL].max(0.1) };
            }
            // Test allies share the same target, gate and core state as the local player.
            // They are local AI proxies, not a network or population-scaling simulation.
            for ally in 0..self.ally_count {
                self.ally_cooldown[ally] = (self.ally_cooldown[ally] - DT).max(0.0);
                self.ally_invulnerable[ally] = (self.ally_invulnerable[ally] - DT).max(0.0);
                if self.cleared { continue; }
                let target = (0..3).filter(|i| self.enemies[*i]).min_by(|a,b| {
                    let distance = |i: usize| (self.enemy_x[i]-self.ally_x[ally]).powi(2)+(self.enemy_z[i]-self.ally_z[ally]).powi(2);
                    distance(*a).total_cmp(&distance(*b))
                });
                let (tx, tz) = match target {
                    Some(i) => (self.enemy_x[i], self.enemy_z[i]),
                    None if self.ally_z[ally] < 5.8 => (0.0, 6.4),
                    None => (0.0, 8.5),
                };
                let dx = tx-self.ally_x[ally]; let dz = tz-self.ally_z[ally];
                let distance = (dx*dx+dz*dz).sqrt();
                let reach = self.p[params::ATTACK_RANGE].max(0.1).min(2.0);
                let waypoint = target.is_none() && self.ally_z[ally] < 5.8;
                if distance > (if waypoint { 0.25 } else { reach * 0.85 }) && distance > 0.001 {
                    let step = (self.p[params::ALLY_SPEED].max(0.0) * DT).min(distance);
                    let nx = (self.ally_x[ally] + dx/distance*step).clamp(-7.5, 7.5);
                    let nz = (self.ally_z[ally] + dz/distance*step).clamp(-9.5, 10.5);
                    let crosses = (self.ally_z[ally] < 5.5 && nz >= 5.5) || (self.ally_z[ally] >= 5.5 && nz < 5.5);
                    if !crosses || (nx.abs() <= 1.5 && !self.enemies.iter().any(|e| *e)) { self.ally_z[ally] = nz; }
                    self.ally_x[ally] = nx;
                }
                if !waypoint && distance <= reach && self.ally_cooldown[ally] <= 0.0 {
                    if let Some(i) = target {
                        self.enemies[i] = false;
                        self.events.emit(EV_HIT, self.enemy_x[i], self.enemy_z[i], 0.0, 0.0, 0.0);
                        if !self.enemies.iter().any(|e| *e) { self.events.emit(EV_GATE_OPEN, 0.0, 6.0, 0.0, 0.0, 0.0); }
                    } else if self.core_health > 0 {
                        self.core_health -= 1;
                        self.events.emit(EV_CORE_HIT, 0.0, 8.5, self.core_health as f32, 0.0, 0.0);
                        if self.core_health == 0 { self.cleared = true; self.events.emit(EV_CORE_CLEAR, 0.0, 8.5, 0.0, 0.0, 0.0); }
                    }
                    self.ally_cooldown[ally] = self.p[params::ALLY_ATTACK_INTERVAL].max(0.25);
                }
            }
            for i in 0..3 {
                if !self.enemies[i] { continue; }
                self.enemy_attack[i] = (self.enemy_attack[i] - DT).max(0.0);
                let mut target = None;
                let mut tx = self.x; let mut tz = self.z;
                let mut dist = ((tx - self.enemy_x[i]).powi(2) + (tz - self.enemy_z[i]).powi(2)).sqrt();
                for ally in 0..self.ally_count {
                    let d = ((self.ally_x[ally]-self.enemy_x[i]).powi(2)+(self.ally_z[ally]-self.enemy_z[i]).powi(2)).sqrt();
                    if d < dist { target = Some(ally); tx = self.ally_x[ally]; tz = self.ally_z[ally]; dist = d; }
                }
                let dx = tx - self.enemy_x[i]; let dz = tz - self.enemy_z[i];
                // Local patrols are deliberately quiet until approached, preserving the low-population equilibrium.
                if dist < self.p[params::ENEMY_NOTICE] && dist > 0.9 && dist > 0.0001 {
                    let step = self.p[params::ENEMY_SPEED].max(0.0) * DT;
                    self.enemy_x[i] += dx / dist * step; self.enemy_z[i] += dz / dist * step;
                }
                if dist <= 1.05 && self.enemy_attack[i] <= 0.0 {
                    if let Some(ally) = target {
                        if self.ally_invulnerable[ally] <= 0.0 {
                            self.ally_hp[ally] = self.ally_hp[ally].saturating_sub(1);
                            self.ally_invulnerable[ally] = 0.65;
                            self.enemy_attack[i] = self.p[params::ENEMY_DAMAGE_INTERVAL].max(0.25);
                            if self.ally_hp[ally] == 0 {
                                self.ally_x[ally] = [-1.3, 1.3, -2.6][ally]; self.ally_z[ally] = -8.0;
                                self.ally_hp[ally] = 4; self.ally_invulnerable[ally] = 2.0;
                            }
                        }
                    } else if self.invulnerable <= 0.0 {
                        self.health = self.health.saturating_sub(1); self.invulnerable = 0.65;
                        self.enemy_attack[i] = self.p[params::ENEMY_DAMAGE_INTERVAL].max(0.25);
                        self.events.emit(EV_PLAYER_HIT, self.x, self.z, self.health as f32, 0.0, 0.0);
                        if self.health == 0 {
                            self.x = 0.0; self.z = -7.0; self.health = MAX_HEALTH; self.invulnerable = 2.0;
                            self.events.emit(EV_RESPAWN, self.x, self.z, 0.0, 0.0, 0.0);
                        }
                    }
                }
            }
        }
    }

    pub fn write_outputs(&mut self) {
        self.out_stats = [self.time, self.round_time, self.state as f32, self.paused as u8 as f32, self.round as f32, self.steps as f32, self.x, self.z, self.enemies[0] as u8 as f32, self.enemies[1] as u8 as f32, self.enemies[2] as u8 as f32, self.enemies.iter().filter(|e| **e).count() as f32, self.cooldown, if self.enemies.iter().any(|e| *e) { 0.0 } else { 1.0 }, self.health as f32, self.core_health as f32, self.cleared as u8 as f32, self.invulnerable, self.enemy_x[0], self.enemy_z[0], self.enemy_x[1], self.enemy_z[1], self.enemy_x[2], self.enemy_z[2], MAX_HEALTH as f32, CORE_START_HEALTH as f32, self.input_x, self.input_z, self.ally_count as f32, self.ally_x[0], self.ally_z[0], self.ally_x[1], self.ally_z[1], self.ally_x[2], self.ally_z[2], self.ally_hp[0] as f32, self.ally_hp[1] as f32, self.ally_hp[2] as f32, self.class as f32];
    }
}

/// The engine's lifecycle exports (`export_engine_abi!` in `lib.rs`) call these.
impl Sim for World {
    const ABI_VERSION: u32 = ABI_VERSION;
    const PARAM_DEFAULTS: &'static [f32] = &DEFAULTS;

    fn new(seed: u32) -> Self {
        World::new(seed)
    }
    fn reset(&mut self) {
        World::reset(self);
    }
    fn advance(&mut self, real_dt: f32) -> u32 {
        World::advance(self, real_dt)
    }
    fn set_paused(&mut self, on: bool) {
        World::set_paused(self, on);
    }
    fn round_start(&mut self) {
        World::round_start(self);
    }
    fn params(&mut self) -> &mut [f32] {
        &mut self.p
    }
    fn events(&mut self) -> &mut Events {
        &mut self.events
    }
    fn params_changed(&mut self) {
        self.write_outputs();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(w: &mut World, seconds: f32) -> u32 {
        (0..(seconds * 60.0).round() as usize).map(|_| w.advance(1.0 / 60.0)).sum()
    }

    #[test]
    fn a_ready_round_keeps_no_round_time_until_started() {
        let mut w = World::new(1);
        run(&mut w, 0.5);
        assert_eq!(w.state, STATE_READY);
        assert_eq!(w.round_time, 0.0);
        assert!(w.time > 0.49, "the sim clock still steps: {}", w.time);
        w.round_start();
        assert_eq!(w.events.records().map(|r| r[0]).collect::<Vec<_>>(), vec![EV_ROUND_START]);
        run(&mut w, 1.0);
        assert!((w.round_time - 1.0).abs() < 1e-4, "{}", w.round_time);
        assert_eq!(w.out_stats[ST_STATE], STATE_PLAYING as f32);
    }

    #[test]
    fn minions_gate_collision_and_reset_follow_the_gym_rules() {
        let mut w = World::new(1); w.round_start();
        w.z = 5.49; w.input_z = 1.0; w.step();
        assert!(w.z < 5.5, "closed gate blocks the player");
        w.input_z = 0.0;
        for i in 0..3 {
            let (x, z) = (w.enemy_x[i], w.enemy_z[i]);
            w.x = x; w.z = z; w.attack = true; w.cooldown = 0.0; w.step();
        }
        w.write_outputs();
        assert_eq!(w.out_stats[13], 1.0, "clearing minions opens the gate");
        w.x = 0.0; w.z = 5.49; w.input_z = 1.0; w.attack = false; w.step();
        assert!(w.z >= 5.5, "the open gate is passable");
        w.reset(); assert_eq!(w.enemies, [true; 3]); assert_eq!(w.z, -7.0);
    }

    #[test]
    fn distant_minions_are_quiet_and_close_minions_pursue() {
        let mut w = World::new(1); w.round_start();
        let start = (w.enemy_x[0], w.enemy_z[0]);
        run(&mut w, 0.5);
        assert_eq!((w.enemy_x[0], w.enemy_z[0]), start);
        w.x = -2.5; w.z = -4.5;
        run(&mut w, 0.5);
        assert!(w.enemy_z[0] < start.1, "nearby minion approaches the player");
    }

    #[test]
    fn core_requires_open_gate_and_clear_survives_respawn() {
        let mut w = World::new(1); w.round_start();
        w.x = 0.0; w.z = 8.5; w.attack = true; w.step();
        assert_eq!(w.core_health, CORE_START_HEALTH, "core is protected while gate is closed");
        w.enemies = [false; 3]; w.cooldown = 0.0;
        for _ in 0..3 { w.cooldown = 0.0; w.step(); }
        assert!(w.cleared); assert_eq!(w.core_health, 0);
        w.reset(); assert!(!w.cleared); assert_eq!(w.core_health, CORE_START_HEALTH);
    }

    #[test]
    fn defeat_returns_to_camp_without_resetting_gate_progress() {
        let mut w = World::new(1); w.round_start();
        w.enemies = [false, true, false]; w.x = w.enemy_x[1]; w.z = w.enemy_z[1]; w.health = 1;
        w.step();
        assert_eq!((w.x, w.z, w.health), (0.0, -7.0, MAX_HEALTH));
        assert_eq!(w.enemies, [false, true, false]);
        assert!(w.events.records().any(|event| event[0] == EV_RESPAWN));
    }

    #[test]
    fn optional_allies_act_and_respect_reset_and_pause() {
        let mut w = World::new(7); w.round_start();
        run(&mut w, 1.0); assert_eq!(w.ally_count, 0); assert_eq!(w.enemies, [true; 3]);
        w.ally_count = 2; let origin = (w.ally_x[0], w.ally_z[0]);
        run(&mut w, 1.0); assert_ne!((w.ally_x[0], w.ally_z[0]), origin);
        w.set_paused(true); let frozen = (w.ally_x, w.ally_z); run(&mut w, 1.0);
        assert_eq!((w.ally_x, w.ally_z), frozen);
        w.set_paused(false); run(&mut w, 15.0); assert!(w.cleared, "allies can progress through gate and core");
        w.reset(); assert_eq!(w.ally_count, 2, "reset keeps the selected ally count");
        assert_eq!(w.enemies, [true; 3]); assert!(!w.cleared);
    }

    #[test]
    fn classes_have_distinct_reach_and_splash() {
        let mut w = World::new(1); w.round_start();
        w.enemy_x = [0.0, 1.0, 7.0]; w.enemy_z = [0.0, 0.0, 4.0];
        w.x = 0.0; w.z = -5.0; w.attack = true;
        w.step(); assert!(w.enemies[0], "knight cannot hit at range");
        w.class = 1; w.cooldown = 0.0; w.step();
        assert_eq!(w.enemies, [false, false, true], "spell splash hits nearby enemies");
        w.reset(); w.round_start(); w.class = 2;
        w.enemy_x = [0.0, 1.0, 7.0]; w.enemy_z = [0.0, 0.0, 4.0];
        w.x = 0.0; w.z = -7.0; w.attack = true; w.step();
        assert_eq!(w.enemies, [false, true, true], "scout hits one target at long range");
        w.enemies = [false; 3]; w.x = 0.0; w.z = 4.0; w.cooldown = 0.0; w.step();
        assert_eq!(w.core_health, CORE_START_HEALTH, "ranged attacks cannot bypass the gate");
    }

    #[test]
    fn pause_freezes_the_clock() {
        let mut w = World::new(1);
        w.round_start();
        run(&mut w, 0.25);
        let (t, steps) = (w.round_time, w.steps);
        w.set_paused(true);
        assert_eq!(run(&mut w, 2.0), 0);
        assert_eq!((w.round_time, w.steps, w.out_stats[ST_PAUSED]), (t, steps, 1.0));
        w.set_paused(false);
        run(&mut w, 0.25);
        assert!(w.round_time > t);
    }

    #[test]
    fn reset_lays_out_a_fresh_round_and_keeps_tuning() {
        let mut w = World::new(9);
        w.round_start();
        run(&mut w, 1.0);
        w.reset();
        assert_eq!((w.state, w.time, w.round_time, w.steps), (STATE_READY, 0.0, 0.0, 0));
        assert_eq!(w.out_stats[ST_ROUND], 2.0, "the second round laid out by this instance");
        assert!(w.events.is_empty());
    }

    /// Same seed + same frame times → bit-identical outputs and random draws.
    #[test]
    fn deterministic_for_a_seed() {
        let script = |seed| {
            let mut w = World::new(seed);
            w.round_start();
            let mut trace = Vec::new();
            for f in 0..300 {
                w.advance(if f % 3 == 0 { 0.021 } else { 1.0 / 60.0 });
                trace.extend(w.out_stats.iter().map(|v| v.to_bits()));
                trace.push(w.rng.next_u32());
                w.clear_frame_events();
            }
            trace
        };
        assert_eq!(script(42), script(42));
        assert_ne!(script(42), script(43));
    }

    impl World {
        fn clear_frame_events(&mut self) {
            self.events.clear();
        }
    }
}
