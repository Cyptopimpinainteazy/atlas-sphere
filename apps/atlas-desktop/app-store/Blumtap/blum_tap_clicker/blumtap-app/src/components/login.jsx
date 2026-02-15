import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Form from 'react-bootstrap/Form'
import Container from 'react-bootstrap/Container'
import Button from 'react-bootstrap/Button'

function Login({ login }) {
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const navigate = useNavigate()

	const onChangeUsername = e => {
		const username = e.target.value
		setUsername(username)
	}

	const onChangePassword = e => {
		const password = e.target.value
		setPassword(password)
	}

	const handleLogin = async e => {
		e.preventDefault()
		await login({ username: username, password: password })
		navigate('/')
	}

	return (
		<Container>
			<Form onSubmit={handleLogin}>
				<h1 className='text-center'>Log In</h1>
				<Form.Group className='mb-3 pt-3'>
					<Form.Control
						type='text'
						placeholder='Enter username'
						value={username}
						onChange={onChangeUsername}
					/>
				</Form.Group>
				<Form.Group className='mb-3 pt-3 pb-3'>
					<Form.Control
						type='password'
						placeholder='Enter password'
						value={password}
						onChange={onChangePassword}
					/>
				</Form.Group>
				<div className='d-flex justify-content-center'>
					<Button type='submit' variant='dark'>
						Login
					</Button>
				</div>
			</Form>
		</Container>
	)
}

export default Login
