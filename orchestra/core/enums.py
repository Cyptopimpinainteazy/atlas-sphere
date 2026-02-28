from enum import Enum, auto

class OrchestraSection(str, Enum):
    STRINGS = "Strings"
    WOODWINDS = "Woodwinds"
    BRASS = "Brass"
    PERCUSSION = "Percussion"

class AgentRole(str, Enum):
    # Strings (Leadership & Execution)
    CONDUCTOR = "Conductor"
    ASSOCIATE_CONDUCTOR = "Associate Conductor"
    COVER_CONDUCTOR = "Cover Conductor"
    CONCERTMASTER = "Concertmaster" # First Violinist
    ASSISTANT_CONCERTMASTER = "Assistant Concertmaster"
    FIRST_VIOLIN = "First Violin"
    VIOLIN_1 = "Violin 1"
    VIOLIN_2 = "Violin 2"
    VIOLA = "Viola"
    CELLO = "Cello"
    BASS = "Bass"
    HARP = "Harp"
    ROADIE = "Roadie"
    CONCERT_STAFF = "Concert Staff"

    # Woodwinds (Analysis & Strategy)
    FLUTE = "Flute"
    OBOE = "Oboe"
    CLARINET = "Clarinet"
    BASSOON = "Bassoon"
    PICCOLO = "Piccolo"
    ENGLISH_HORN = "English Horn"
    SAXOPHONE = "Saxophone"
    RECORDER = "Recorder"
    PROMOTER = "Promoter"

    # Brass (Adversarial & Critique)
    TRUMPET = "Trumpet"
    HORN = "Horn"
    TROMBONE = "Trombone"
    TUBA = "Tuba"
    CORNET = "Cornet"
    EUPHONIUM = "Euphonium"
    SOUSAPHONE = "Sousaphone"
    BUGLE = "Bugle"

    # Percussion (Governance & Finality)
    TIMPANI = "Timpani"
    SNARE = "Snare"
    BASS_DRUM = "Bass Drum"
    CYMBALS = "Cymbals"
    TRIANGLE = "Triangle"
    GONG = "Gong"
    XYLOPHONE = "Xylophone"
    CHIMES = "Chimes"

class TaskSeverity(str, Enum):
    MAJOR = "Major"
    MINOR = "Minor"

class JuryVote(str, Enum):
    YES = "Yes"
    NO = "No"
    ABSTAIN = "Abstain"
