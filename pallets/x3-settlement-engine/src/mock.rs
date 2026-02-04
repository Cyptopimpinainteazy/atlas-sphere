// Temporary mock to satisfy `mod mock;` inclusion during CI and formatting.
#![allow(dead_code)]

pub struct MockRuntime;

impl MockRuntime {
    pub fn new() -> Self { MockRuntime }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mock_available() {
        let _ = MockRuntime::new();
    }
}
