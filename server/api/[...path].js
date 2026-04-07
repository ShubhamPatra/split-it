const normalizeOrigin = (origin) => {
	if (!origin) {
		return origin;
	}

	try {
		return new URL(origin).origin;
	} catch (error) {
		return origin.replace(/\/$/, '');
	}
};

const isAllowedOrigin = (origin) => {
	if (!origin) {
		return true;
	}

	const normalizedOrigin = normalizeOrigin(origin);

	try {
		const host = new URL(normalizedOrigin).host;
		return host === 'split-it.live' || host === 'www.split-it.live' || host.endsWith('.split-it.live') || host === 'localhost:3000' || host === 'localhost:5173' || host === '127.0.0.1:3000' || host === '127.0.0.1:5173';
	} catch (error) {
		return false;
	}
};

const applyCorsHeaders = (req, res) => {
	const origin = req.headers.origin;

	res.setHeader('Vary', 'Origin');
	res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

	if (origin && isAllowedOrigin(origin)) {
		res.setHeader('Access-Control-Allow-Origin', normalizeOrigin(origin));
	}
};

let appPromise;

const getApp = () => {
	if (!appPromise) {
		appPromise = import('../server.js').then(({ app }) => app);
	}

	return appPromise;
};

export default async function handler(req, res) {
	applyCorsHeaders(req, res);

	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}

	const app = await getApp();
	return app(req, res);
}
