import { invoke } from '@tauri-apps/api'
import { Command } from '@tauri-apps/api/shell'
import React, { useEffect, useState } from 'react'
import { SendFill } from 'react-bootstrap-icons'

function Main({ token, user, setOutput, setShow }) {
	const [state, setState] = useState(false)
	const [isButtonLocked, setIsButtonLocked] = useState(false)
	const [scriptProcess, setScriptProcess] = useState(null)
	const [blumtap, setBlumtap] = useState(null)

	const handleMessage = text => {
		setOutput(text)
		setShow(true)
	}

	const runScript = async () => {
		const runPID = Command.sidecar('../bin/blumtap')
		setBlumtap(runPID)
		const process = await runPID.spawn()
		setScriptProcess(process)
	}

	const stopScript = async () => {
		if (scriptProcess) {
			scriptProcess.kill()
			invoke('close_script')
				.then(() => handleMessage('Кликер завершил работу'))
				.catch(() => handleMessage('Ошибка в остановке процесса'))
			setBlumtap(null)
			setScriptProcess(null)
		} else {
			handleMessage('Нет запущенных процессов')
		}
	}

	useEffect(() => {
		const btn = document.getElementById('toggleButton')
		if (blumtap) {
			blumtap.stdout.on('data', data => {
				if (data.includes('Run') || data.includes('Script')) {
					btn.classList.toggle('active')
					handleMessage(
						data.includes('Run')
							? 'Запустите Blum приложение'
							: 'Скрипт был остановлен'
					)
					setState(false)
					setScriptProcess(null)
				} else {
					handleMessage(data)
				}
			})
		}
		if (state && token === 'notoken') {
			btn.classList.toggle('active')
			stopScript()
			setState(false)
		}
	}, [state, blumtap, token])

	const runEvent = async () => {
		const btn = document.getElementById('toggleButton')
		if (token !== 'notoken' && user && !isButtonLocked) {
			btn.classList.toggle('active')
			setState(!state)
			!state ? runScript() : stopScript()
		} else if (user && !isButtonLocked && token === 'notoken') {
			const clickerText = document.getElementById('clickerState')
			btn.classList.toggle('notoken')
			clickerText.innerHTML = 'Пожалуйста, получите токен'
			clickerText.style = 'color: rgb(255, 190, 0)'
			setIsButtonLocked(true)
			setTimeout(() => {
				btn.classList.toggle('notoken')
				clickerText.style = 'color: white'
				clickerText.innerHTML = 'Clicker отключен'
				setIsButtonLocked(false)
			}, 2000)
		} else {
			if (!isButtonLocked) {
				const clickerText = document.getElementById('clickerState')
				btn.classList.toggle('inactive')
				clickerText.innerHTML = 'Пожалуйста, войдите в систему'
				clickerText.style = 'color: red'
				setIsButtonLocked(true)
				setTimeout(() => {
					btn.classList.toggle('inactive')
					clickerText.style = 'color: white'
					clickerText.innerHTML = 'Clicker отключен'
					setIsButtonLocked(false)
				}, 2000)
			}
		}
	}

	return (
		<div>
			<div className='div-help pt-2'>
				<p className='help-user'>Нажмите на кнопку, чтобы включить</p>
			</div>
			<div className='pt-2'>
				<div className='centralize-button-clicker'>
					<button
						id='toggleButton'
						className='button-start-clicker p-5'
						onClick={() => runEvent()}
					>
						<SendFill color='black' size={(65, 65)} />
					</button>
				</div>
				<div className='text-center pt-3'>
					{state ? (
						<p style={{ color: '#3de613' }}>
							Clicker включен
							<br />
							Нажмите на q дважды, чтобы выключить
						</p>
					) : (
						<p id='clickerState'>Clicker отключен</p>
					)}
				</div>
			</div>
			<div className='d-flex justify-content-center text-center fixed-bottom'>
				{user ? (
					<p className='p-5'>
						Ваш ID: {token !== 'notoken' ? token : 'нет токена'}
					</p>
				) : (
					<p className='p-5'>Ваш ID: не авторизован</p>
				)}
			</div>
		</div>
	)
}

export default Main
