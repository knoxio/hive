/// Returns the current time as Unix seconds (seconds since the Unix epoch).
pub fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Format a Unix epoch (seconds) as `"YYYY-MM-DD HH:MM:SS"` for SQLite storage.
///
/// Uses `chrono` for correct Gregorian calendar arithmetic.
pub fn unix_secs_to_sqlite_datetime(secs: u64) -> String {
    use chrono::{DateTime, Utc};
    let dt = DateTime::<Utc>::from_timestamp(secs as i64, 0)
        .unwrap_or_else(|| DateTime::<Utc>::from_timestamp(0, 0).unwrap());
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unix_now_is_recent() {
        let secs = unix_now();
        // Must be after 2020-01-01 (1577836800) and before 2100-01-01 (4102444800).
        assert!(
            secs > 1_577_836_800,
            "unix_now() returned a suspiciously old timestamp"
        );
        assert!(
            secs < 4_102_444_800,
            "unix_now() returned a suspiciously far-future timestamp"
        );
    }

    #[test]
    fn unix_epoch_zero() {
        assert_eq!(unix_secs_to_sqlite_datetime(0), "1970-01-01 00:00:00");
    }

    #[test]
    fn known_timestamp_2021() {
        // 2021-01-01 00:00:00 UTC = 1609459200
        assert_eq!(
            unix_secs_to_sqlite_datetime(1_609_459_200),
            "2021-01-01 00:00:00"
        );
    }

    #[test]
    fn known_timestamp_2024() {
        // 2024-02-29 00:00:00 UTC (leap day) = 1709164800
        assert_eq!(
            unix_secs_to_sqlite_datetime(1_709_164_800),
            "2024-02-29 00:00:00"
        );
    }

    #[test]
    fn output_format_matches_sqlite() {
        let s = unix_secs_to_sqlite_datetime(unix_now());
        // Must match YYYY-MM-DD HH:MM:SS (19 chars, correct separators).
        assert_eq!(s.len(), 19);
        assert_eq!(&s[4..5], "-");
        assert_eq!(&s[7..8], "-");
        assert_eq!(&s[10..11], " ");
        assert_eq!(&s[13..14], ":");
        assert_eq!(&s[16..17], ":");
    }
}
