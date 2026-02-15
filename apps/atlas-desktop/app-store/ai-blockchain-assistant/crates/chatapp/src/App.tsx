import { invoke } from '@tauri-apps/api/core'
import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'

interface Message {
  content: string
  timestamp: Date
  type?: 'success' | 'error' | 'warning'
}

export default function App() {
  const [command, setCommand] = useState('')
  const [isProcessing, setProcessing] = useState(false)
  const [history, setHistory] = useState<Message[]>([
    {
      content:
        "🚀 Welcome to your Advanced AI Blockchain Assistant!\n\nI'm ready to help your commands. Try typing something to get started!",
      timestamp: new Date(),
      type: 'success'
    }
  ])
  const [isDarkTheme, setIsDarkTheme] = useState(true)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [history])

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light')
  }, [isDarkTheme])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    } else if (e.key === 'ArrowUp' && commandHistory.length > 0) {
      e.preventDefault()
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
      setHistoryIndex(newIndex)
      setCommand(commandHistory[commandHistory.length - 1 - newIndex])
    } else if (e.key === 'ArrowDown' && historyIndex > -1) {
      e.preventDefault()
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setCommand(newIndex === -1 ? '' : commandHistory[commandHistory.length - 1 - newIndex])
    }
  }

  const handleCommandChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setCommand(event.target.value)
    setHistoryIndex(-1)
  }

  const sendMessage = async () => {
    if (!command.trim()) return

    const userMessage: Message = {
      content: `💬 You: ${command}`,
      timestamp: new Date(),
      type: 'success'
    }

    // Add user message to history
    setHistory(prev => [...prev, userMessage])

    // Add to command history
    setCommandHistory(prev => [...prev, command])
    setHistoryIndex(-1)

    const currentCommand = command
    setCommand('')

    try {
      setProcessing(true)

      // Show typing indicator
      const typingIndicator = document.getElementById('typing-indicator')
      if (typingIndicator) {
        typingIndicator.classList.add('active')
      }

      const result = await invoke<string>('process_command', {
        command: currentCommand
      })

      const assistantMessage: Message = {
        content: `🤖 Assistant: ${result}`,
        timestamp: new Date(),
        type: 'success'
      }

      setHistory(prev => [...prev, assistantMessage])
    } catch (error) {
      console.log(error)
      const errorMessage: Message = {
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to process your message'}`,
        timestamp: new Date(),
        type: 'error'
      }

      setHistory(prev => [...prev, errorMessage])
    } finally {
      setProcessing(false)

      // Hide typing indicator
      const typingIndicator = document.getElementById('typing-indicator')
      if (typingIndicator) {
        typingIndicator.classList.remove('active')
      }

      // Refocus input
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme)
  }

  const formatMessage = (content: string) => {
    // Simple formatting for better readability
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
  }

  const getMessageClass = (type?: string) => {
    switch (type) {
      case 'success':
        return 'result-box success'
      case 'error':
        return 'result-box error'
      case 'warning':
        return 'result-box warning'
      default:
        return 'result-box'
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className='app'>
      <div className='header'>
        <h1>AI Blockchain Assistant</h1>
        <button
          className='theme-toggle'
          onClick={toggleTheme}
          title={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
        >
          {isDarkTheme ? '☀️' : '🌙'}
        </button>
      </div>

      <div className='chat-container'>
        <div className='messages' id='messages' ref={messagesRef}>
          {history.map((message, index) => (
            <div
              key={`message-${index}`}
              className={getMessageClass(message.type)}
              title={`Sent at ${formatTime(message.timestamp)}`}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: formatMessage(message.content)
                }}
              />
            </div>
          ))}
        </div>

        <div className='typing-indicator' id='typing-indicator'>
          Assistant is processing...
        </div>

        <div className='input-container'>
          <div className='input-wrapper'>
            <textarea
              ref={inputRef}
              id='message-input'
              className='message-input'
              placeholder='Type your command here...'
              rows={1}
              value={command}
              onKeyDown={handleKeyDown}
              onChange={handleCommandChange}
              disabled={isProcessing}
            />
            <button
              id='send-button'
              className={`send-button ${isProcessing ? 'loading' : ''}`}
              onClick={sendMessage}
              disabled={isProcessing || !command.trim()}
              title='Send message (Enter)'
            >
              {isProcessing ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
