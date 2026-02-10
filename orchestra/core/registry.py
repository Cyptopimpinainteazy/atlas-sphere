import yaml
import os
from typing import Dict, List, Optional
from orchestra.core.enums import AgentRole, OrchestraSection

class AgentRegistry:
    _instance = None
    
    def __init__(self, config_path: str = "orchestra/config/core_extended.yaml"):
        self.role_map: Dict[str, OrchestraSection] = {}
        self.jury_eligibility: Dict[str, bool] = {} # role_value -> bool
        self.config_path = config_path
        self._load_config()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_config(self):
        if not os.path.exists(self.config_path):
            if os.path.exists("orchestra/config/core_extended.yaml"):
                self.config_path = "orchestra/config/core_extended.yaml"
            else:
                print(f"[REGISTRY] Warning: Config file {self.config_path} not found.")
                return

        with open(self.config_path, 'r') as f:
            data = yaml.safe_load(f)
            
        for entry in data:
            role_name = entry.get('role')
            section_name = entry.get('section')
            is_jury_eligible = entry.get('jury_duty', True) # Default True
            
            try:
                role_enum = AgentRole[role_name]
                section_enum = OrchestraSection[section_name]
                
                self.role_map[role_enum.value] = section_enum
                self.jury_eligibility[role_enum.value] = is_jury_eligible
                
            except KeyError as e:
                print(f"[REGISTRY] Warning: Config key mismatch for {role_name} or {section_name}: {e}")

    def get_section(self, role: AgentRole) -> OrchestraSection:
        if role.value in self.role_map:
            return self.role_map[role.value]
        raise ValueError(f"Role {role.value} not found in Registry.")
        
    def is_eligible_for_jury(self, role: AgentRole) -> bool:
        return self.jury_eligibility.get(role.value, True)
