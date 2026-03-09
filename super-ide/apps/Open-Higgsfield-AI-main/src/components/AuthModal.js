import { muapi } from '../lib/muapi.js';

export function AuthModal(onSuccess, feature = 'image') {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6';

    const modal = document.createElement('div');
    modal.className = 'w-full max-w-md bg-panel-bg border border-white/10 rounded-3xl p-8 shadow-3xl animate-fade-in-up';

    const getDescriptor = () => muapi.getAuthConfig(feature);
    const currentDescriptor = getDescriptor();

    modal.innerHTML = `
        <div class="flex flex-col items-center text-center mb-8">
            <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-glow mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l-2.25-2.25"/>
                </svg>
            </div>
            <h2 id="auth-title" class="text-2xl font-black text-white uppercase tracking-wider mb-2">${currentDescriptor.title}</h2>
            <p id="auth-description" class="text-secondary text-sm">${currentDescriptor.description}</p>
        </div>

        <div class="space-y-4">
            <div class="space-y-2">
                <label class="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Provider</label>
                <select id="provider-select" class="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary/50 transition-colors shadow-inner">
                    <option value="muapi">Muapi</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="local">Local API</option>
                </select>
            </div>

            <div id="key-wrap" class="space-y-2">
                <label id="api-key-label" class="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">${currentDescriptor.keyLabel}</label>
                <input
                    type="password"
                    id="api-key-input"
                    placeholder="${currentDescriptor.keyPlaceholder}"
                    class="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors shadow-inner"
                >
            </div>

            <div id="openrouter-wrap" class="space-y-2 hidden">
                <label class="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">OpenRouter Image Model</label>
                <input
                    type="text"
                    id="openrouter-model-image"
                    placeholder="openrouter/free"
                    class="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors shadow-inner"
                >
            </div>

            <div id="local-wrap" class="space-y-2 hidden">
                <label class="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Local API Base URL</label>
                <input
                    type="text"
                    id="local-base-url"
                    placeholder="http://127.0.0.1:8787"
                    class="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors shadow-inner"
                >
            </div>

            <div class="flex flex-col gap-3 pt-2">
                <button id="save-key-btn" class="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all">
                    Initialize Studio
                </button>
                <a id="key-help-link" href="${currentDescriptor.linkUrl || '#'}" target="_blank" class="text-center text-[11px] font-bold text-muted hover:text-white transition-colors py-2 uppercase tracking-tighter ${currentDescriptor.linkUrl ? '' : 'hidden'}">
                    ${currentDescriptor.linkText || ''}
                </a>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const providerSelect = modal.querySelector('#provider-select');
    const keyWrap = modal.querySelector('#key-wrap');
    const keyLabel = modal.querySelector('#api-key-label');
    const keyInput = modal.querySelector('#api-key-input');
    const openRouterWrap = modal.querySelector('#openrouter-wrap');
    const openRouterModelInput = modal.querySelector('#openrouter-model-image');
    const localWrap = modal.querySelector('#local-wrap');
    const localBaseInput = modal.querySelector('#local-base-url');
    const titleEl = modal.querySelector('#auth-title');
    const descEl = modal.querySelector('#auth-description');
    const linkEl = modal.querySelector('#key-help-link');
    const btn = modal.querySelector('#save-key-btn');

    providerSelect.value = muapi.getProvider();
    keyInput.value = localStorage.getItem('ai_api_key') || localStorage.getItem('muapi_key') || '';
    openRouterModelInput.value = localStorage.getItem('openrouter_model_image') || 'openrouter/free';
    localBaseInput.value = localStorage.getItem('local_ai_base_url') || 'http://127.0.0.1:8787';

    const refresh = () => {
        localStorage.setItem('ai_provider', providerSelect.value);
        const descriptor = getDescriptor();

        titleEl.textContent = descriptor.title;
        descEl.textContent = descriptor.description;
        keyLabel.textContent = descriptor.keyLabel || 'API Key';
        keyInput.placeholder = descriptor.keyPlaceholder || '';

        keyWrap.classList.toggle('hidden', providerSelect.value === 'local');
        openRouterWrap.classList.toggle('hidden', providerSelect.value !== 'openrouter');
        localWrap.classList.toggle('hidden', providerSelect.value !== 'local');

        if (descriptor.linkUrl) {
            linkEl.classList.remove('hidden');
            linkEl.href = descriptor.linkUrl;
            linkEl.textContent = `${descriptor.linkText} →`;
        } else {
            linkEl.classList.add('hidden');
        }
    };

    providerSelect.onchange = refresh;
    refresh();

    btn.onclick = () => {
        const provider = providerSelect.value;
        const key = keyInput.value.trim();
        const localUrl = localBaseInput.value.trim();

        localStorage.setItem('ai_provider', provider);
        localStorage.setItem('openrouter_model_image', openRouterModelInput.value.trim() || 'openrouter/free');
        localStorage.setItem('local_ai_base_url', localUrl || 'http://127.0.0.1:8787');

        if (provider !== 'local' && !key) {
            keyInput.classList.add('border-red-500/50');
            setTimeout(() => keyInput.classList.remove('border-red-500/50'), 2000);
            return;
        }

        if (provider !== 'local') {
            localStorage.setItem('ai_api_key', key);
            if (provider === 'muapi') {
                localStorage.setItem('muapi_key', key);
            }
        }

        document.body.removeChild(overlay);
        if (onSuccess) onSuccess();
    };

    return overlay;
}
