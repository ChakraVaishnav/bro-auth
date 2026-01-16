import crypto from 'crypto';

/**
 * Generate fingerprint from HTTP request headers (server-side)
 * MUST match the browser implementation exactly!
 */
export function generateServerFingerprint(req) {
    // Extract headers (handle both Express formats)
    const userAgent = req.get?.('user-agent') || req.headers?.['user-agent'] || '';
    const acceptLanguage = req.get?.('accept-language') || req.headers?.['accept-language'] || '';
    const acceptEncoding = req.get?.('accept-encoding') || req.headers?.['accept-encoding'] || '';
    const secChUa = req.get?.('sec-ch-ua') || req.headers?.['sec-ch-ua'] || '';
    const secChUaPlatform = req.get?.('sec-ch-ua-platform') || req.headers?.['sec-ch-ua-platform'] || '';
    const secChUaMobile = req.get?.('sec-ch-ua-mobile') || req.headers?.['sec-ch-ua-mobile'] || '';
    const dnt = req.get?.('dnt') || req.headers?.['dnt'] || '';
    const connection = req.get?.('connection') || req.headers?.['connection'] || '';

    // Create fingerprint string (SAME ORDER as browser!)
    const components = [
        userAgent,
        acceptLanguage,
        acceptEncoding,
        secChUa,
        secChUaPlatform,
        secChUaMobile,
        dnt,
        connection
    ].join('|');

    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(components).digest('hex');
}