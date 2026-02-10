"""
Immutable constants for the Orchestra.
Values here are derived from the Score v1 and cannot be changed without constitutional amendment.
"""

# Jury Configuration
MIN_JURY_SIZE = 5
MAX_JURY_SIZE = 13  # Ideally prime number
JURY_MAJORITY_THRESHOLD = 0.51  # Simple majority

# Rotation
ROTATION_EPOCH_LENGTH_BLOCKS = 1000
JURY_SANDBOX_ISOLATION_LEVEL = "STRICT"

# Section Constraints (Caps per Jury)
SECTION_JURY_CAPS = {
    "Strings": 3,
    "Woodwinds": 3,
    "Brass": 2,      # Limit adversarial noise in decision making
    "Percussion": 5  # Governance specialists heavily weighted
}

# Scrap Yard
MAX_CONSECUTIVE_BAD_VOTES = 3
BAD_VOTE_LOOKBACK_WINDOW = 10  # TASKS

# Task Queue
TASK_HASH_ALGO = "sha256"
