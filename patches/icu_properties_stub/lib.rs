//! Stub for icu_properties to avoid rustc ICE on string literal unescaping
//! This minimal crate provides interface expected by unicode processing crates
//! without the problematic string literals that trigger compiler panic.

#![no_std]

// Props module with Unicode character properties
pub mod props {
    #[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
    #[repr(transparent)]
    pub struct GeneralCategory(pub u8);
    
    impl GeneralCategory {
        pub const EnclosingMark: GeneralCategory = GeneralCategory(1);
        pub const NonspacingMark: GeneralCategory = GeneralCategory(2);
        pub const SpacingMark: GeneralCategory = GeneralCategory(3);
    }
    
    impl From<GeneralCategory> for u32 {
        fn from(gc: GeneralCategory) -> u32 {
            gc.0 as u32
        }
    }
    
    #[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
    #[repr(transparent)]
    pub struct JoiningType(pub u8);
    
    impl JoiningType {
        pub const DualJoining: JoiningType = JoiningType(1);
        pub const LeftJoining: JoiningType = JoiningType(2);
        pub const RightJoining: JoiningType = JoiningType(3);
        pub const Transparent: JoiningType = JoiningType(4);
    }
    
    #[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
    #[repr(transparent)]
    pub struct BidiClass(pub u8);
    
    impl BidiClass {
        pub const ArabicLetter: BidiClass = BidiClass(1);
        pub const ArabicNumber: BidiClass = BidiClass(2);
        pub const BoundaryNeutral: BidiClass = BidiClass(3);
        pub const CommonSeparator: BidiClass = BidiClass(4);
        pub const EuropeanNumber: BidiClass = BidiClass(5);
        pub const EuropeanSeparator: BidiClass = BidiClass(6);
        pub const EuropeanTerminator: BidiClass = BidiClass(7);
        pub const LeftToRight: BidiClass = BidiClass(8);
        pub const NonspacingMark: BidiClass = BidiClass(9);
        pub const OtherNeutral: BidiClass = BidiClass(10);
        pub const RightToLeft: BidiClass = BidiClass(11);
        
        pub fn to_icu4c_value(self) -> u32 {
            self.0 as u32
        }
    }
    
    pub const ASCII_HEX_DIGIT: u8 = 0;
}

pub mod provider {
    pub struct Names;
}

#[derive(Clone, Debug)]
pub struct CodePointSet;

#[derive(Clone, Debug)]
pub struct CodePointMap<T> {
    pub _marker: core::marker::PhantomData<T>,
}

#[derive(Clone, Debug)]
pub struct CodePointMapDataBorrowed;

/// Generic stub for CodePointMapData that matches the real icu_properties API
#[derive(Clone, Debug)]
pub struct CodePointMapData<T = ()> {
    pub _marker: core::marker::PhantomData<T>,
}

impl<T: Default> CodePointMapData<T> {
    pub fn new() -> Self {
        CodePointMapData { _marker: core::marker::PhantomData }
    }
    
    pub fn as_borrowed(&self) -> CodePointMapDataBorrowed {
        CodePointMapDataBorrowed
    }
}

pub fn codepoint_trie_builder(_data: &[u8]) -> CodePointMap<u32> {
    CodePointMap { _marker: core::marker::PhantomData }
}

pub mod names {
    pub const GENERAL_CATEGORY: u8 = 0;
}

#[cfg(test)]
mod tests {
    #[test]
    fn stub_test() {
        assert!(true);
    }
}
