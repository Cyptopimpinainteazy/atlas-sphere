import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
import os

APP_TITLE = "LLM Endpoint Lister"
RESULTS_FILE = "llm_recon_results.json"

class EndpointApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("700x500")
        self.resizable(False, False)
        self.create_widgets()

    def create_widgets(self):
        tk.Label(self, text=APP_TITLE, font=("Arial", 18, "bold")).pack(pady=10)
        self.go_btn = tk.Button(self, text="Go", font=("Arial", 14), command=self.list_endpoints)
        self.go_btn.pack(pady=10)
        self.text = scrolledtext.ScrolledText(self, wrap=tk.WORD, font=("Consolas", 11), width=80, height=22)
        self.text.pack(padx=10, pady=10)
        self.text.config(state=tk.DISABLED)

    def list_endpoints(self):
        self.text.config(state=tk.NORMAL)
        self.text.delete(1.0, tk.END)
        if not os.path.exists(RESULTS_FILE):
            self.text.insert(tk.END, f"File not found: {RESULTS_FILE}\n")
            self.text.config(state=tk.DISABLED)
            return
        try:
            with open(RESULTS_FILE, "r") as f:
                data = f.read()
            self.text.insert(tk.END, data)
        except Exception as e:
            self.text.insert(tk.END, f"Error reading file: {e}\n")
        self.text.config(state=tk.DISABLED)

if __name__ == "__main__":
    app = EndpointApp()
    app.mainloop()
