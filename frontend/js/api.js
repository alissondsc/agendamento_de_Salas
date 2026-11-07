const API_BASE_URL = window.RESERVE_ME_API_URL || 'http://localhost:3000/api';
const API_URL = new URL(API_BASE_URL, window.location.origin);
const API_PATH = API_URL.pathname.replace(/\/+$/, '');

async function requestApi(path, options = {}) {
    if (!path.startsWith('/') || path.startsWith('//')) {
        throw new TypeError('O caminho da API deve ser local e começar com uma barra.');
    }

    const url = new URL(`${API_PATH}${path}`, API_URL.origin);
    if (
        url.origin !== API_URL.origin
        || (url.pathname !== API_PATH && !url.pathname.startsWith(`${API_PATH}/`))
    ) {
        throw new TypeError('O caminho solicitado está fora da API.');
    }

    const headers = new Headers(options.headers);
    let body = options.body;

    if (body !== undefined && typeof body !== 'string') {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(body);
    }

    const response = await fetch(url, {
        ...options,
        headers,
        body
    });

    if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const errorResponse = await response.json();
            if (typeof errorResponse.error === 'string') {
                throw new Error(errorResponse.error);
            }
        }

        throw new Error(`A API respondeu com o status ${response.status}.`);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('A API retornou uma resposta que não é JSON.');
    }

    return response.json();
}

window.reserveMeApi = Object.freeze({ request: requestApi });
