
import assert from 'assert';
import { generateTokens, verifyAccessToken, verifyRefreshToken } from '../src/core/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env manually for testing
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

// Fallback if .env is missing or empty for test
if (!process.env.BRO_AUTH_SECRET_PEPPER) {
    console.warn("Test Warning: BRO_AUTH_SECRET_PEPPER not found in .env, using fallback.");
    process.env.BRO_AUTH_SECRET_PEPPER = "test-pepper-secret-value";
}

console.log("Running Core Tests...");

try {
    const userId = "user_123";
    const fpHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // Empty SHA256 usually, but just a mock
    const accessSecret = "access-secret-123";
    const refreshSecret = "refresh-secret-123";

    // 1. Generate Tokens
    const { accessToken, refreshToken } = generateTokens(userId, fpHash, accessSecret, refreshSecret);

    assert(accessToken, "Access token should be generated");
    assert(refreshToken, "Refresh token should be generated");
    console.log("✅ Token Generation passed");

    // 2. Verify Access Token
    console.log("Verifying Access Token...");
    const accessResult = verifyAccessToken(accessToken, fpHash, accessSecret);
    if (!accessResult.valid) {
        throw new Error("Access Token Verification Failed: " + accessResult.error);
    }
    const decodedAccess = accessResult.payload;
    assert.strictEqual(decodedAccess.sub, userId, "User ID should match");
    assert.strictEqual(decodedAccess.fp, fpHash, "Fingerprint hash should match");
    console.log("✅ Access Token Verification passed");

    // 3. Verify Refresh Token
    console.log("Verifying Refresh Token...");
    const refreshResult = verifyRefreshToken(refreshToken, fpHash, refreshSecret);
    if (!refreshResult.valid) {
        throw new Error("Refresh Token Verification Failed: " + refreshResult.error);
    }
    const decodedRefresh = refreshResult.payload;
    assert.strictEqual(decodedRefresh.sub, userId, "User ID should match");
    console.log("✅ Refresh Token Verification passed");

    // 4. Test Invalid Fingerprint
    const wrongFpHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b999"; // Slightly different
    const invalidResult = verifyAccessToken(accessToken, wrongFpHash, accessSecret);

    // We expect it to FAIL or return invalid because the derived secret will be different!
    // If derived secret is different, jwt.verify throws "invalid signature". 
    // verifyAccessToken catches it and returns { valid: false, error: ... }

    assert.strictEqual(invalidResult.valid, false, "Should be invalid for wrong fingerprint");
    console.log("✅ Invalid Fingerprint detection passed");

    // 5. Test Invalid Pepper (Salting Check)
    const originalPepper = process.env.BRO_AUTH_SECRET_PEPPER;
    process.env.BRO_AUTH_SECRET_PEPPER = "changed-pepper-value";

    const wrongPepperResult = verifyAccessToken(accessToken, fpHash, accessSecret);
    assert.strictEqual(wrongPepperResult.valid, false, "Should be invalid when Pepper changes");
    console.log("✅ Salting/Pepper verification passed");

    // Restore pepper for any subsequent tests (good practice)
    process.env.BRO_AUTH_SECRET_PEPPER = originalPepper;

    console.log("\nALL CORE TESTS PASSED!");

} catch (err) {
    console.error("\n❌ TESTS FAILED");
    console.error(err);
    process.exit(1);
}
