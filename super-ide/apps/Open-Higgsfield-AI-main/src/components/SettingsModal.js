import { muapi } from '../lib/muapi.js';

export function SettingsModal(onClose) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4';

    const modal = document.createElement('div');
    modal.className = 'bg-card p-6 rounded-xl border border-border-color w-full max-w-xl glass max-h-[90vh] overflow-y-auto custom-scrollbar';
    modal.style.background = 'var(--bg-card)';
    modal.style.padding = '1.5rem';
    modal.style.borderRadius = 'var(--border-radius-xl)';
    modal.style.border = '1px solid var(--border-color)';

    const title = document.createElement('h2');
    title.textContent = 'Settings';
    title.className = 'text-xl font-bold mb-4';

    const providerWrap = document.createElement('div');
    providerWrap.className = 'mb-4';
    providerWrap.innerHTML = `
        <label class="block text-sm text-secondary mb-2">Provider</label>
        <select id="provider-select" class="w-full p-2 rounded bg-input border border-border-color">
            <option value="muapi">Muapi</option>
            <option value="openrouter">OpenRouter</option>
            <option value="local">Local API</option>
        </select>
    `;
    const providerSelect = providerWrap.querySelector('#provider-select');
    providerSelect.value = muapi.getProvider();

    const keyWrap = document.createElement('div');
    keyWrap.className = 'mb-4';
    keyWrap.innerHTML = `
        <label id="api-key-label" class="block text-sm text-secondary mb-2">API Key</label>
        <input id="api-key-input" type="password" class="w-full p-2 rounded bg-input border border-border-color" placeholder="sk-...">
    `;
    const apiKeyInput = keyWrap.querySelector('#api-key-input');
    const apiKeyLabel = keyWrap.querySelector('#api-key-label');
    apiKeyInput.value = localStorage.getItem('ai_api_key') || localStorage.getItem('muapi_key') || '';

    const openRouterWrap = document.createElement('div');
    openRouterWrap.className = 'mb-4';
    openRouterWrap.innerHTML = `
        <label class="block text-sm text-secondary mb-2">OpenRouter Image Model</label>
        <input id="openrouter-model-image" type="text" class="w-full p-2 rounded bg-input border border-border-color mb-2" placeholder="openrouter/free">
        <label class="block text-sm text-secondary mb-2">OpenRouter I2I Model (optional)</label>
        <input id="openrouter-model-i2i" type="text" class="w-full p-2 rounded bg-input border border-border-color" placeholder="openrouter/free">
        <p class="text-xs text-secondary mt-2">Use <code>openrouter/free</code> to route to free models. Video generation is not supported in OpenRouter mode in this app.</p>
    `;
    const openRouterImageInput = openRouterWrap.querySelector('#openrouter-model-image');
    const openRouterI2IInput = openRouterWrap.querySelector('#openrouter-model-i2i');
    openRouterImageInput.value = localStorage.getItem('openrouter_model_image') || 'openrouter/free';
    openRouterI2IInput.value = localStorage.getItem('openrouter_model_i2i') || '';

    const localWrap = document.createElement('div');
    localWrap.className = 'mb-4';
    localWrap.innerHTML = `
        <label class="block text-sm text-secondary mb-2">Local API Base URL</label>
        <input id="local-base-url" type="text" class="w-full p-2 rounded bg-input border border-border-color mb-2" placeholder="http://127.0.0.1:8787">
        <label class="block text-sm text-secondary mb-2">Local API Token (optional)</label>
        <input id="local-api-token" type="password" class="w-full p-2 rounded bg-input border border-border-color" placeholder="optional">
        <p class="text-xs text-secondary mt-2">Expected endpoints: <code>/v1/image</code>, <code>/v1/image/edit</code>, <code>/v1/video</code>, <code>/v1/video/edit</code>.</p>
    `;
    const localBaseInput = localWrap.querySelector('#local-base-url');
    const localTokenInput = localWrap.querySelector('#local-api-token');
    localBaseInput.value = localStorage.getItem('local_ai_base_url') || 'http://127.0.0.1:8787';
    localTokenInput.value = localStorage.getItem('local_ai_token') || '';

    const updateVisibility = () => {
        const provider = providerSelect.value;
        keyWrap.style.display = provider === 'local' ? 'none' : 'block';
        openRouterWrap.style.display = provider === 'openrouter' ? 'block' : 'none';
        localWrap.style.display = provider === 'local' ? 'block' : 'none';
        apiKeyLabel.textContent = provider === 'openrouter' ? 'OpenRouter API Key' : 'Muapi API Key';
        apiKeyInput.placeholder = provider === 'openrouter' ? 'sk-or-...' : 'sk-...';
    };
    providerSelect.onchange = updateVisibility;
    updateVisibility();

    const btnContainer = document.createElement('div');
    btnContainer.className = 'flex justify-end gap-2';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'px-4 py-2 rounded hover:bg-white/5';
    cancelBtn.onclick = () => {
        document.body.removeChild(overlay);
        if (onClose) onClose();
    };

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'px-4 py-2 rounded bg-primary text-black font-medium';
    saveBtn.style.backgroundColor = 'var(--color-primary)';
    saveBtn.style.color = 'black';
    saveBtn.style.fontWeight = '500';

    saveBtn.onclick = () => {
        const provider = providerSelect.value;
        const key = apiKeyInput.value.trim();

        if (provider !== 'local' && !key) {
            alert('Please enter a valid API key.');
            return;
        }

        localStorage.setItem('ai_provider', provider);
        if (provider !== 'local') {
            localStorage.setItem('ai_api_key', key);
            if (provider === 'muapi') {
                localStorage.setItem('muapi_key', key);
            }
        }

        localStorage.setItem('openrouter_model_image', openRouterImageInput.value.trim() || 'openrouter/free');
        localStorage.setItem('openrouter_model_i2i', openRouterI2IInput.value.trim());
        localStorage.setItem('local_ai_base_url', localBaseInput.value.trim() || 'http://127.0.0.1:8787');
        localStorage.setItem('local_ai_token', localTokenInput.value.trim());

        alert('Settings saved!');
        document.body.removeChild(overlay);
        if (onClose) onClose();
        window.location.reload();
    };

    modal.appendChild(title);
    modal.appendChild(providerWrap);
    modal.appendChild(keyWrap);
    modal.appendChild(openRouterWrap);
    modal.appendChild(localWrap);

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(saveBtn);
    modal.appendChild(btnContainer);

    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
            if (onClose) onClose();
        }
    });

    return overlay;
}
