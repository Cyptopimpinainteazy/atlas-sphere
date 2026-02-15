use anyhow::Result;
use colored::*;
use rustyline::error::ReadlineError;
use rustyline::history::DefaultHistory;
use rustyline::Editor;

use crate::agent::BlockchainAgent;

pub struct REPL {
    editor: Editor<(), DefaultHistory>,
}

impl REPL {
    pub fn new() -> Self {
        Self {
            editor: Editor::<(), DefaultHistory>::new().expect("Failed to create editor"),
        }
    }

    pub async fn run(&mut self, agent: &BlockchainAgent) -> Result<()> {
        println!("{}", "Welcome to the Blockchain AI Agent".green().bold());
        println!(
            "{}",
            "Type 'help' for available commands or 'exit' to quit".cyan()
        );
        println!();

        let mut agent_clone = agent.clone();

        loop {
            let prompt = format!("{} ", ">".green().bold());

            match self.editor.readline(&prompt) {
                Ok(line) => {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }

                    let _ = self.editor.add_history_entry(line);

                    match line {
                        "exit" | "quit" => {
                            println!("{}", "Goodbye!".green());
                            break;
                        }
                        "help" => {
                            self.print_help();
                        }
                        _ => match self.handle_command(line, &mut agent_clone).await {
                            Ok(_) => {}
                            Err(e) => {
                                println!("{}: {}", "Error".red().bold(), e);
                            }
                        },
                    }
                }
                Err(ReadlineError::Interrupted) => {
                    println!("CTRL-C");
                    break;
                }
                Err(ReadlineError::Eof) => {
                    println!("CTRL-D");
                    break;
                }
                Err(err) => {
                    println!("Error: {:?}", err);
                    break;
                }
            }
        }

        Ok(())
    }

    fn print_help(&self) {
        println!("{}", "Available Commands:".yellow().bold());
        println!("  {:<20} - {}", "help".cyan(), "Show this help message");
        println!("  {:<20} - {}", "exit".cyan(), "Exit the application");
        println!();
        println!("{}", "Example Queries:".yellow().bold());
        println!("  {}", "send 1 ETH from Alice to Bob".cyan());
        println!("  {}", "How much USDC does Alice have?".cyan());
        println!("  {}", "Is Uniswap V2 Router deployed?".cyan());
        println!("  {}", "Swap 10 ETH for USDC on Alice's account".cyan());
    }

    async fn handle_command(&self, input: &str, agent: &mut BlockchainAgent) -> Result<String> {
        // Process the command using the agent
        let response = agent.process_message(input).await?;

        // Print the response
        println!("{}", response);

        Ok(response)
    }
}
