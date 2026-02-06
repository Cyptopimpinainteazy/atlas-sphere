use proptest::prelude::*;
use swarm_media::reputation::compute_slash_amount;

// Property: result is in [0, bond]
proptest! {
    #[test]
    fn slash_within_bounds(bond in 0.0_f64..1_000_000.0_f64, severity in -1.0_f64..2.0_f64, repeat in 0i32..10, base_scale in 0.0_f64..2.0_f64) {
        let s = compute_slash_amount(bond, severity, repeat, base_scale);
        prop_assert!(s >= 0.0, "slash must be >= 0");
        prop_assert!(s <= bond + 1e-9, "slash cannot exceed bond");
    }

    // Monotonic in severity
    #[test]
    fn monotonic_in_severity(bond in 1.0_f64..1_000_000.0_f64, severity1 in 0.0_f64..1.0_f64, severity_delta in 0.0_f64..1.0_f64, repeat in 1i32..5, base_scale in 0.0_f64..1.0_f64) {
        let s1 = compute_slash_amount(bond, severity1, repeat, base_scale);
        let s2 = compute_slash_amount(bond, (severity1 + severity_delta).min(1.0), repeat, base_scale);
        prop_assert!(s2 + 1e-9 >= s1, "higher severity should not decrease slash");
    }

    // Monotonic in repeat count
    #[test]
    fn monotonic_in_repeat(bond in 1.0_f64..1_000_000.0_f64, severity in 0.0_f64..1.0_f64, repeat1 in 1i32..4, base_scale in 0.0_f64..1.0_f64) {
        let s1 = compute_slash_amount(bond, severity, repeat1, base_scale);
        let s2 = compute_slash_amount(bond, severity, repeat1 + 2, base_scale);
        prop_assert!(s2 + 1e-9 >= s1, "higher repeat should not decrease slash");
    }
}
