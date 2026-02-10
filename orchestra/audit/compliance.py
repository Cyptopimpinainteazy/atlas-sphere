import os

class ComplianceAuditor:
    """
    Ensures the codebase adheres to the Constitution.
    """
    
    def check_file_structure(self) -> bool:
        """
        Verifies all required components exist.
        """
        required_paths = [
            "orchestra/constitution/SCORE_v1.md",
            "orchestra/governance/jury.py",
            "orchestra/scrapyard/archive.py"
        ]
        
        missing = []
        for path in required_paths:
            if not os.path.exists(path):
                missing.append(path)
                
        if missing:
            print(f"COMPLIANCE FAILURE: Missing critical files: {missing}")
            return False
            
        print("COMPLIANCE PASS: Structure intact.")
        return True
