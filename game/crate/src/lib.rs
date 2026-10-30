//! Bramblekeep's simulation, compiled to `sim.wasm`.
//!
//! The engine (`vgd_engine`, crates/engine) supplies the fixed-step clock,
//! events, params and the lifecycle exports (`export_engine_abi!`). This file
//! adds the game's own exports: output buffers, level building (`level_*`),
//! input (`sim_set_input`) and dev tools.
//!
//! Every export, stride, index and event kind is mirrored in
//! `game/src/sim-abi.ts`; bump `world::ABI_VERSION` (and the mirror) whenever
//! one of them changes, and the page refuses a stale `sim.wasm`.

pub mod params;
pub mod world;

use world::*;

vgd_engine::export_engine_abi!(World);

vgd_engine::buffer!(buf_stats, buf_stats_count, buf_stats_stride, STATS_FLOATS, |w| w.out_stats[..]);

#[no_mangle]
pub extern "C" fn sim_set_input(x: f32, z: f32, attack: u32) {
    let w = world();
    w.input_x = if x.is_finite() { x.clamp(-1.0, 1.0) } else { 0.0 };
    w.input_z = if z.is_finite() { z.clamp(-1.0, 1.0) } else { 0.0 };
    w.attack = attack != 0;
}

#[no_mangle]
pub extern "C" fn sim_set_class(class: u32) {
    let w = world();
    w.class = class.min(2) as u8;
    w.cooldown = 0.0;
    w.write_outputs();
}

#[no_mangle]
pub extern "C" fn sim_set_allies(count: u32) {
    let w = world();
    let next = (count as usize).min(3);
    for i in w.ally_count..next {
        w.ally_x[i] = [-1.3, 1.3, -2.6][i]; w.ally_z[i] = -8.0;
        w.ally_hp[i] = 4; w.ally_cooldown[i] = 1.2 + i as f32 * 0.3; w.ally_invulnerable[i] = 0.0;
    }
    w.ally_count = next;
    w.write_outputs();
}

#[cfg(test)]
mod tests {
    use super::*;
    use vgd_engine::events::EVENT_FLOATS;

    /// The exported C functions end to end, reading buffers through raw
    /// pointers the way JavaScript does. (The only test using the global.)
    #[test]
    fn abi_roundtrip() {
        assert_eq!(sim_abi_version(), ABI_VERSION);
        assert_eq!(sim_engine_version(), vgd_engine::ENGINE_ABI_VERSION);
        sim_init(5);
        assert_eq!((buf_stats_count(), buf_stats_stride() as usize), (1, STATS_FLOATS));
        assert_eq!(buf_events_stride() as usize, EVENT_FLOATS);
        assert_eq!(sim_param_count() as usize, params::COUNT);
        let stats = || unsafe { std::slice::from_raw_parts(buf_stats(), STATS_FLOATS) }.to_vec();
        assert_eq!(stats()[ST_STATE], STATE_READY as f32);

        sim_round_start();
        let ev = unsafe { std::slice::from_raw_parts(buf_events(), buf_events_count() as usize * EVENT_FLOATS) };
        assert_eq!(ev[0], EV_ROUND_START);
        sim_clear_frame();
        assert_eq!(buf_events_count(), 0);

        let steps: u32 = (0..60).map(|_| sim_advance(1.0 / 60.0)).sum();
        assert_eq!(steps, 120);
        assert_eq!(stats()[ST_STATE], STATE_PLAYING as f32);
        assert!((stats()[ST_ROUND_TIME] - 1.0).abs() < 1e-4);

        sim_set_paused(1);
        assert_eq!(sim_advance(0.05), 0);
        assert_eq!(stats()[ST_PAUSED], 1.0);
        sim_set_paused(0);
        sim_reset();
        assert_eq!((stats()[ST_STATE], stats()[ST_ROUND_TIME]), (STATE_READY as f32, 0.0));
    }
}
