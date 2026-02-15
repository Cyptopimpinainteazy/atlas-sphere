import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Form from 'react-bootstrap/Form'
import Container from 'react-bootstrap/Container'
import Button from 'react-bootstrap/Button'

function Register({ register }) {
	const [username, setUsername] = useState('')
	const navigate = useNavigate()

	const onChangeUsername = e => {
		const username = e.target.value
		setUsername(username)
	}

	const handleRegister = async e => {
		e.preventDefault()
		await register({ username: username })
		navigate('/')
	}

	return (
		<Container>
			<Form onSubmit={handleRegister}>
				<h1 className='text-center pt-3'>Sign Up</h1>
				<Form.Group className='mb-3 pt-3 pb-3'>
					<Form.Control
						type='text'
						placeholder='Enter username'
						value={username}
						onChange={onChangeUsername}
					/>
				</Form.Group>
				<div className='d-flex justify-content-center'>
					<Button variant='dark' type='submit'>
						Sign Up
					</Button>
				</div>
			</Form>
		</Container>
	)
}

export default Register
