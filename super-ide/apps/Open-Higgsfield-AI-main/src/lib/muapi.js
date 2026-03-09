import { getModelById, getVideoModelById, getI2IModelById, getI2VModelById } from './models.js';

const STORAGE_KEYS = {
    provider: 'ai_provider',
    apiKey: 'ai_api_key',
    legacyMuapiKey: 'muapi_key',
    openrouterImageModel: 'openrouter_model_image',
    openrouterI2IModel: 'openrouter_model_i2i',
    openrouterSiteUrl: 'openrouter_site_url',
    openrouterSiteName: 'openrouter_site_name',
    localBaseUrl: 'local_ai_base_url',
    localApiToken: 'local_ai_token'
};

export class MuapiClient {
    constructor() {
        this.defaultMuapiBaseUrl = import.meta.env.DEV ? '' : 'https://api.muapi.ai';
        this.defaultOpenRouterBaseUrl = import.meta.env.DEV ? '/openrouter/api/v1' : 'https://openrouter.ai/api/v1';
        this.defaultLocalBaseUrl = 'http://127.0.0.1:8787';
    }

    getProvider() {
        const provider = (localStorage.getItem(STORAGE_KEYS.provider) || 'muapi').toLowerCase();
        if (provider === 'muapi' || provider === 'openrouter' || provider === 'local') {
            return provider;
        }
        return 'muapi';
    }

    getProviderLabel(provider = this.getProvider()) {
        if (provider === 'openrouter') return 'OpenRouter';
        if (provider === 'local') return 'Local';
        return 'Muapi';
    }

    getRawApiKey() {
        return localStorage.getItem(STORAGE_KEYS.apiKey) || localStorage.getItem(STORAGE_KEYS.legacyMuapiKey) || '';
    }

    requiresApiKey(provider = this.getProvider()) {
        return provider !== 'local';
    }

    hasProviderConfig(_feature = 'image') {
        const provider = this.getProvider();
        if (provider === 'local') return true;
        return Boolean(this.getRawApiKey());
    }

    getAuthConfig(feature = 'image') {
        const provider = this.getProvider();
        const providerLabel = this.getProviderLabel(provider);

        if (provider === 'openrouter') {
            return {
                provider,
                providerLabel,
                requiresKey: true,
                title: 'OpenRouter API Key Required',
                description: feature === 'video'
                    ? 'OpenRouter free mode in this app currently supports image generation. Video generation requires a local backend provider.'
                    : 'Please provide your OpenRouter API key. For free models, use the default model router in settings.',
                keyLabel: 'OpenRouter API Key',
                keyPlaceholder: 'sk-or-...',
                linkText: 'Get an API key at OpenRouter',
                linkUrl: 'https://openrouter.ai/keys'
            };
        }

        if (provider === 'local') {
            return {
                provider,
                providerLabel,
                requiresKey: false,
                title: 'Local Provider Selected',
                description: 'Local mode uses your local API endpoint. Configure the local URL in settings if needed.',
                keyLabel: '',
                keyPlaceholder: '',
                linkText: '',
                linkUrl: ''
            };
        }

        return {
            provider,
            providerLabel,
            requiresKey: true,
            title: 'Muapi API Key Required',
            description: 'Please provide your Muapi API key to generate images and videos.',
            keyLabel: 'Muapi API Key',
            keyPlaceholder: 'sk-...',
            linkText: 'Get an API key at Muapi.ai',
            linkUrl: 'https://muapi.ai'
        };
    }

    getKey({ throwIfMissing = true } = {}) {
        const key = this.getRawApiKey();
        if (!throwIfMissing) return key;
        if (!key && this.requiresApiKey()) {
            throw new Error(`${this.getProviderLabel()} API key missing. Please set it in Settings.`);
        }
        return key;
    }

    getLocalBaseUrl() {
        return (localStorage.getItem(STORAGE_KEYS.localBaseUrl) || this.defaultLocalBaseUrl).replace(/\/$/, '');
    }

    getOpenRouterModel(mode) {
        const imageModel = localStorage.getItem(STORAGE_KEYS.openrouterImageModel) || 'openrouter/free';
        if (mode === 'i2i') {
            return localStorage.getItem(STORAGE_KEYS.openrouterI2IModel) || imageModel;
        }
        return imageModel;
    }

    getDimensionsFromAR(ar) {
        switch (ar) {
            case '1:1': return [1024, 1024];
            case '16:9': return [1280, 720];
            case '9:16': return [720, 1280];
            case '4:3': return [1152, 864];
            case '3:2': return [1216, 832];
            case '21:9': return [1536, 640];
            default: return [1024, 1024];
        }
    }

    normalizeUrlResponse(data) {
        if (!data) return null;
        const url =
            data.url ||
            data.output_url ||
            data.file_url ||
            data.result_url ||
            data.outputs?.[0] ||
            data.output?.url ||
            data.data?.url;
        return url ? { ...data, url } : data;
    }

    async dataUrlFromFile(file) {
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsDataURL(file);
        });
    }

    async callJson(url, payload, headers = {}) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 200)}`);
        }
        return await response.json();
    }

    async pollForResult(requestId, headers, baseUrl, maxAttempts = 60, interval = 2000) {
        const pollUrl = `${baseUrl}/api/v1/predictions/${requestId}/result`;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, interval));
            try {
                const response = await fetch(pollUrl, { method: 'GET', headers });
                if (!response.ok) {
                    const errText = await response.text();
                    if (response.status >= 500) continue;
                    throw new Error(`Poll Failed: ${response.status} - ${errText.slice(0, 120)}`);
                }

                const data = await response.json();
                const status = data.status?.toLowerCase();
                if (status === 'completed' || status === 'succeeded' || status === 'success') {
                    return data;
                }
                if (status === 'failed' || status === 'error') {
                    throw new Error(`Generation failed: ${data.error || 'Unknown error'}`);
                }
            } catch (error) {
                if (attempt === maxAttempts) throw error;
            }
        }
        throw new Error('Generation timed out after polling.');
    }

    async generateImage(params) {
        const provider = this.getProvider();
        if (provider === 'openrouter') {
            return await this.generateImageOpenRouter(params);
        }
        if (provider === 'local') {
            return await this.generateWithLocal('/v1/image', params);
        }
        return await this.generateImageMuapi(params);
    }

    async generateVideo(params) {
        const provider = this.getProvider();
        if (provider === 'openrouter') {
            throw new Error('OpenRouter mode in this app currently supports image generation only. Use Local provider for video.');
        }
        if (provider === 'local') {
            return await this.generateWithLocal('/v1/video', params);
        }
        return await this.generateVideoMuapi(params);
    }

    async generateI2I(params) {
        const provider = this.getProvider();
        if (provider === 'openrouter') {
            return await this.generateI2IOpenRouter(params);
        }
        if (provider === 'local') {
            return await this.generateWithLocal('/v1/image/edit', params);
        }
        return await this.generateI2IMuapi(params);
    }

    async generateI2V(params) {
        const provider = this.getProvider();
        if (provider === 'openrouter') {
            throw new Error('OpenRouter mode in this app currently supports image generation only. Use Local provider for video.');
        }
        if (provider === 'local') {
            return await this.generateWithLocal('/v1/video/edit', params);
        }
        return await this.generateI2VMuapi(params);
    }

    async uploadFile(file) {
        const provider = this.getProvider();
        if (provider === 'openrouter' || provider === 'local') {
            return await this.dataUrlFromFile(file);
        }
        return await this.uploadFileMuapi(file);
    }

    async generateWithLocal(path, params) {
        const token = localStorage.getItem(STORAGE_KEYS.localApiToken) || this.getRawApiKey();
        const headers = {};
        if (token) {
            headers.Authorization = `Bearer ${token}`;
            headers['x-api-key'] = token;
        }
        const baseUrl = this.getLocalBaseUrl();
        const data = await this.callJson(`${baseUrl}${path}`, params, headers);
        const normalized = this.normalizeUrlResponse(data);
        if (normalized?.url) return normalized;
        throw new Error('Local provider did not return an output URL. Check your local backend response shape.');
    }

    buildOpenRouterMessages(params, mode) {
        const parts = [];
        const cleanPrompt = (params.prompt || '').trim();
        const aspect = params.aspect_ratio ? `Aspect ratio: ${params.aspect_ratio}.` : '';
        const resolution = params.resolution ? `Resolution preference: ${params.resolution}.` : '';
        const quality = params.quality ? `Quality preference: ${params.quality}.` : '';
        const modelHint = params.model ? `Style hint from UI model selection: ${params.model}.` : '';
        const promptPrefix = mode === 'i2i'
            ? 'Edit the provided reference image(s). Preserve key identity and composition unless prompt says otherwise.'
            : 'Generate a new image.';

        const text =
            `${promptPrefix}\n` +
            `${cleanPrompt || 'Create a cinematic high-quality image.'}\n` +
            `${aspect} ${resolution} ${quality} ${modelHint}`.trim();

        parts.push({ type: 'text', text });

        const refs = [];
        if (Array.isArray(params.images_list) && params.images_list.length > 0) {
            refs.push(...params.images_list);
        } else if (params.image_url) {
            refs.push(params.image_url);
        }

        refs.forEach((url) => {
            parts.push({ type: 'image_url', image_url: { url } });
        });

        return [{ role: 'user', content: parts }];
    }

    extractOpenRouterImageUrl(data) {
        const direct =
            data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
            data?.choices?.[0]?.message?.images?.[0]?.url;
        if (direct) return direct;

        const content = data?.choices?.[0]?.message?.content;
        if (Array.isArray(content)) {
            const item = content.find((entry) => entry?.type === 'image_url' && entry?.image_url?.url);
            if (item?.image_url?.url) return item.image_url.url;
        }

        const text = typeof content === 'string' ? content : '';
        const urlMatch = text.match(/https?:\/\/[^\s)]+/i);
        return urlMatch ? urlMatch[0] : null;
    }

    async callOpenRouter(mode, params) {
        const key = this.getKey();
        const model = this.getOpenRouterModel(mode);
        const siteUrl = localStorage.getItem(STORAGE_KEYS.openrouterSiteUrl) || window.location.origin;
        const siteName = localStorage.getItem(STORAGE_KEYS.openrouterSiteName) || 'Open Higgsfield AI (Local)';

        const payload = {
            model,
            modalities: ['text', 'image'],
            messages: this.buildOpenRouterMessages(params, mode)
        };

        const data = await this.callJson(
            `${this.defaultOpenRouterBaseUrl}/chat/completions`,
            payload,
            {
                Authorization: `Bearer ${key}`,
                'HTTP-Referer': siteUrl,
                'X-Title': siteName
            }
        );

        const imageUrl = this.extractOpenRouterImageUrl(data);
        if (!imageUrl) {
            throw new Error('OpenRouter did not return an image URL. Try another free model or provider.');
        }
        return { ...data, url: imageUrl };
    }

    async generateImageOpenRouter(params) {
        return await this.callOpenRouter('image', params);
    }

    async generateI2IOpenRouter(params) {
        return await this.callOpenRouter('i2i', params);
    }

    async generateImageMuapi(params) {
        const key = this.getKey();
        const baseUrl = this.defaultMuapiBaseUrl;

        const modelInfo = getModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        const url = `${baseUrl}/api/v1/${endpoint}`;

        const finalPayload = { prompt: params.prompt };
        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;
        if (params.image_url) {
            finalPayload.image_url = params.image_url;
            finalPayload.strength = params.strength || 0.6;
        } else {
            finalPayload.image_url = null;
        }
        if (params.seed && params.seed !== -1) finalPayload.seed = params.seed;

        const submitData = await this.callJson(url, finalPayload, { 'x-api-key': key });
        const requestId = submitData.request_id || submitData.id;
        if (!requestId) return this.normalizeUrlResponse(submitData);

        const result = await this.pollForResult(
            requestId,
            { 'Content-Type': 'application/json', 'x-api-key': key },
            baseUrl
        );
        return this.normalizeUrlResponse(result);
    }

    async generateVideoMuapi(params) {
        const key = this.getKey();
        const baseUrl = this.defaultMuapiBaseUrl;

        const modelInfo = getVideoModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        const url = `${baseUrl}/api/v1/${endpoint}`;

        const finalPayload = { prompt: params.prompt };
        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.duration) finalPayload.duration = params.duration;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;
        if (params.image_url) finalPayload.image_url = params.image_url;

        const submitData = await this.callJson(url, finalPayload, { 'x-api-key': key });
        const requestId = submitData.request_id || submitData.id;
        if (!requestId) return this.normalizeUrlResponse(submitData);

        const result = await this.pollForResult(
            requestId,
            { 'Content-Type': 'application/json', 'x-api-key': key },
            baseUrl,
            120,
            2000
        );
        return this.normalizeUrlResponse(result);
    }

    async generateI2IMuapi(params) {
        const key = this.getKey();
        const baseUrl = this.defaultMuapiBaseUrl;

        const modelInfo = getI2IModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        const url = `${baseUrl}/api/v1/${endpoint}`;

        const finalPayload = {};
        if (params.prompt) finalPayload.prompt = params.prompt;

        const imageField = modelInfo?.imageField || 'image_url';
        const imagesList = params.images_list?.length > 0 ? params.images_list : (params.image_url ? [params.image_url] : null);
        if (imagesList) {
            if (imageField === 'images_list') {
                finalPayload.images_list = imagesList;
            } else {
                finalPayload[imageField] = imagesList[0];
            }
        }

        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;

        const submitData = await this.callJson(url, finalPayload, { 'x-api-key': key });
        const requestId = submitData.request_id || submitData.id;
        if (!requestId) return this.normalizeUrlResponse(submitData);

        const result = await this.pollForResult(
            requestId,
            { 'Content-Type': 'application/json', 'x-api-key': key },
            baseUrl
        );
        return this.normalizeUrlResponse(result);
    }

    async generateI2VMuapi(params) {
        const key = this.getKey();
        const baseUrl = this.defaultMuapiBaseUrl;

        const modelInfo = getI2VModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        const url = `${baseUrl}/api/v1/${endpoint}`;

        const finalPayload = {};
        if (params.prompt) finalPayload.prompt = params.prompt;

        const imageField = modelInfo?.imageField || 'image_url';
        if (params.image_url) {
            if (imageField === 'images_list') {
                finalPayload.images_list = [params.image_url];
            } else {
                finalPayload[imageField] = params.image_url;
            }
        }

        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.duration) finalPayload.duration = params.duration;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;

        const submitData = await this.callJson(url, finalPayload, { 'x-api-key': key });
        const requestId = submitData.request_id || submitData.id;
        if (!requestId) return this.normalizeUrlResponse(submitData);

        const result = await this.pollForResult(
            requestId,
            { 'Content-Type': 'application/json', 'x-api-key': key },
            baseUrl,
            120,
            2000
        );
        return this.normalizeUrlResponse(result);
    }

    async uploadFileMuapi(file) {
        const key = this.getKey();
        const url = `${this.defaultMuapiBaseUrl}/api/v1/upload_file`;

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'x-api-key': key },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`File upload failed: ${response.status} - ${errText.slice(0, 120)}`);
        }

        const data = await response.json();
        const fileUrl = data.url || data.file_url || data.data?.url;
        if (!fileUrl) throw new Error('No URL returned from file upload');
        return fileUrl;
    }
}

export const muapi = new MuapiClient();
