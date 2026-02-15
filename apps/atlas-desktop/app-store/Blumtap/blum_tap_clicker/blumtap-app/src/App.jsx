import Cookies from 'js-cookie'
import React, { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import BlumDataService from './services/service'

import 'bootstrap/dist/css/bootstrap.min.css'
import { CSSTransition } from 'react-transition-group'
import './index.css'

import { Alert, Button, Dropdown, DropdownButton } from 'react-bootstrap'
import { Fingerprint, GearWideConnected } from 'react-bootstrap-icons'
import Login from './components/login'
import Main from './components/main'
import Register from './components/register'

function App() {
	const [user, setUser] = useState(null)
	const [token, setToken] = useState('notoken')
	const [output, setOutput] = useState('')
	const [show, setShow] = useState(false)
	const [headOutput, setHeadOutput] = useState('Вывод:')
	const [password, setPassword] = useState('')

	useEffect(() => {
		const token = Cookies.get('token')
		const user = Cookies.get('user')
		if (token || user) {
			setToken(token)
			setUser(user)
		}
		if (show) {
			setTimeout(() => {
				setShow(false)
				setTimeout(() => {
					setOutput('')
					setHeadOutput('Вывод:')
				}, 500)
			}, 4000)
		}
	}, [show])

	async function login(user = null) {
		BlumDataService.login(user)
			.then(response => {
				let resp = response.data
				let token = resp.token ? resp.token : 'notoken'
				setToken(token)
				setUser(user.username)
				setHeadOutput('Авторизация')
				setOutput(resp.success)
				setShow(true)
				Cookies.set('token', token, { expires: 7 })
				Cookies.set('user', user.username, { expires: 7 })
			})
			.catch(error => {
				setHeadOutput('Ошибка авторизации')
				setOutput(error.response.data.error)
				setShow(true)
			})
	}

	async function register(user = null) {
		BlumDataService.register(user)
			.then(response => {
				setPassword(response.data.password)
				setToken('notoken')
				setUser(user.username)
				Cookies.set('user', user.username, { expires: 7 })
			})
			.catch(error => {
				const err = error.response.data.error
				setHeadOutput('Ошибка регистрации')
				setOutput(err ? err : 'Вы не передали никаких данных')
				setShow(true)
			})
	}

	async function logout() {
		setToken('notoken')
		setUser(null)
		setOutput('')
		Cookies.remove('token')
		Cookies.remove('user')
	}

	return (
		<div className='App'>
			<div className='p-2'>
				<h1 style={{ color: 'white' }}>
					<div>
						<Link to={'/'} style={{ color: 'white', textDecoration: 'none' }}>
							<Fingerprint className='me-1' color='white' /> blum tap
						</Link>
						<div className='div-btn-without-style'>
							<DropdownButton
								className='btn-without-style btn-without-caret'
								variant='link'
								title={<GearWideConnected size={30} color='white' />}
							>
								{user ? (
									<>
										<Dropdown.Item onClick={logout}>
											Log Out ({user})
										</Dropdown.Item>
									</>
								) : (
									<>
										<Dropdown.Item as={Link} to={'/login'}>
											Log In
										</Dropdown.Item>
										<Dropdown.Item as={Link} to={'/signup'}>
											Sign Up
										</Dropdown.Item>
									</>
								)}
							</DropdownButton>
						</div>
					</div>
				</h1>
				<CSSTransition in={show} timeout={500} classNames='alert' unmountOnExit>
					<div className='alert-container'>
						<div className='alert-items'>
							<Alert variant='warning'>
								<Alert.Heading className='text-center'>
									{headOutput}
								</Alert.Heading>
								<p>{output}</p>
							</Alert>
						</div>
					</div>
				</CSSTransition>
				<CSSTransition
					in={password !== ''}
					timeout={500}
					classNames='alert'
					unmountOnExit
				>
					<div className='alert-container'>
						<div
							className='d-flex justify-content-center text-center help-user-p'
							style={{ height: '60px' }}
						>
							<Button
								variant='success'
								onClick={() => {
									navigator.clipboard.writeText(password)
									setPassword('')
								}}
							>
								Ваш пароль: ***************
								<br />
								Нажмите, чтобы скопировать
							</Button>
						</div>
					</div>
				</CSSTransition>
			</div>
			<div className='container mt-4'>
				<Routes>
					<Route
						exact
						path='/'
						element={
							<Main
								token={token}
								user={user}
								setOutput={setOutput}
								setShow={setShow}
							/>
						}
					/>
					<Route path='/login' element={<Login login={login} />} />
					<Route path='/signup' element={<Register register={register} />} />
				</Routes>
			</div>
		</div>
	)
}

export default App
