class OrchestraCLI:
    
    @staticmethod
    def print_banner():
        print("="*60)
        print("       THE ORCHESTRA  |  Institutional Governance v1.0")
        print("       Strings | Woodwinds | Brass | Percussion")
        print("="*60)

    @staticmethod
    def show_queue(tasks):
        print("\n[PENDING TASKS]")
        for t in tasks:
            print(f" - {t['id']}: {t['intent']}")

    @staticmethod
    def show_jury_state(state):
        print(f"\n[JURY STATUS: {state['task_id']}]")
        print(f" Phase: {state['status']}")
        print(f" Progress: {state['reveals']}/{state['commits']} Reveals")
