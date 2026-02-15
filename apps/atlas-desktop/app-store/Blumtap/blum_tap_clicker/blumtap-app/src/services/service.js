import axios from 'axios'

class BlumDataService {
	login(data) {
		const postURL =
			import.meta.env.VITE_DEBUG === 'True'
				? import.meta.env.VITE_SERVICE_URL_LOGIN
				: import.meta.env.VITE_SERVICE_URL_LOGIN_PROD
		return axios.post(postURL, data)
	}

	register(data) {
		const postURL =
			import.meta.env.VITE_DEBUG === 'True'
				? import.meta.env.VITE_SERVICE_URL_SIGNUP
				: import.meta.env.VITE_SERVICE_URL_SIGNUP_PROD
		return axios.post(postURL, data)
	}
}

export default new BlumDataService()
