<<<<<<< REPO
<<<<<<< REPO
import axios from 'axios'

export async function sendWebhook (url: string, payload: unknown) {
  const resp = await axios.post(url, payload, {
    headers: { 'content-type': 'application/json' }
  })
  return resp.data
}

=======
import axios from 'axios'

export async function sendWebhook (url: string, payload: unknown) {
  const resp = await axios.post(url, payload, {
    headers: { 'content-type': 'application/json' }
  })
  return resp.data
}

>>>>>>> IMPORT (TEXT)

=======
import axios from 'axios'

export async function sendWebhook (url: string, payload: unknown) {
  const resp = await axios.post(url, payload, {
    headers: { 'content-type': 'application/json' }
  })
  return resp.data
}

>>>>>>> IMPORT (TEXT)
