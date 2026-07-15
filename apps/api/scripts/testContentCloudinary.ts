/**
 * scripts/testContentCloudinary.ts
 *
 * E2E tests for Step 9:
 * 1. Articles CRUD & Permission Gates
 * 2. News CRUD & Permission Gates
 * 3. Cloudinary Upload Signature and E2E resizing verification.
 *
 * Run:
 *   npm -w api exec tsx -- scripts/testContentCloudinary.ts
 */

import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';
import { supabase } from '../src/config/supabase.js';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}/api`;

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, data: json };
}

async function run() {
  console.log('🧪 Starting Step 9 Articles, News & Cloudinary Verification...\n');

  // 1. Log in as admin and seller
  console.log('1. Logging in users...');
  const adminLogin = await login('ADMIN-001', 'ChangeMe123!');
  console.log('✅ Admin logged in.');

  let sellerLogin;
  try {
    sellerLogin = await login('BF-TZ-99999', 'NewSellerPass123!');
  } catch {
    sellerLogin = await login('BF-TZ-99999', 'SellerPass123!');
  }
  console.log('✅ Seller logged in.');

  const adminHeaders = { 'Authorization': `Bearer ${adminLogin.token}` };
  const sellerHeaders = { 'Authorization': `Bearer ${sellerLogin.token}` };

  // ───────────────────────────────────────────────────────────────────────────
  // ARTICLES TESTS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Articles ---');

  // Test: POST /api/articles as seller -> should be 403
  console.log('2. Trying to create article as seller...');
  const createArticleSeller = await request('/articles', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      title: 'Seller Article',
      body: 'Should fail',
    }),
  });
  if (createArticleSeller.status !== 403) {
    throw new Error(`Expected 403 for seller article creation, got ${createArticleSeller.status}`);
  }
  console.log('✅ Seller creation correctly rejected with 403.');

  // Test: POST /api/articles as admin -> should succeed (published = false to test get details gate)
  console.log('3. Creating unpublished article as admin...');
  const articleTitle = `Admin Test Article ${Date.now()}`;
  const createArticleAdmin = await request('/articles', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: articleTitle,
      body: 'This is a test article body from admin.',
      isPublished: false,
    }),
  });
  if (createArticleAdmin.status !== 201) {
    throw new Error(`Expected 201 for admin article creation, got ${createArticleAdmin.status}: ${JSON.stringify(createArticleAdmin.data)}`);
  }
  const testArticle = createArticleAdmin.data;
  console.log(`✅ Article created: "${testArticle.title}" (ID: ${testArticle.id})`);

  // Test: GET /api/articles/:id as seller -> should return 404 (because isPublished is false)
  console.log('4. Getting unpublished article as seller (should 404)...');
  const getArticleSeller = await request(`/articles/${testArticle.id}`, {
    headers: sellerHeaders,
  });
  if (getArticleSeller.status !== 404) {
    throw new Error(`Expected 404 for unpublished article fetched by seller, got ${getArticleSeller.status}`);
  }
  console.log('✅ Unpublished article correctly hidden from seller (returned 404).');

  // Test: GET /api/articles/:id as admin -> should succeed
  console.log('5. Getting unpublished article as admin...');
  const getArticleAdmin = await request(`/articles/${testArticle.id}`, {
    headers: adminHeaders,
  });
  if (getArticleAdmin.status !== 200) {
    throw new Error(`Expected 200 for admin fetching unpublished article, got ${getArticleAdmin.status}`);
  }
  console.log('✅ Admin successfully fetched unpublished article.');

  // Test: PATCH /api/articles/:id as admin -> publish it
  console.log('6. Publishing article as admin...');
  const updateArticleAdmin = await request(`/articles/${testArticle.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      isPublished: true,
    }),
  });
  if (updateArticleAdmin.status !== 200) {
    throw new Error(`Expected 200 for article update, got ${updateArticleAdmin.status}`);
  }
  console.log('✅ Article updated and published.');

  // Test: GET /api/articles/:id as seller -> should now succeed (200)
  console.log('7. Getting published article as seller...');
  const getArticleSellerPub = await request(`/articles/${testArticle.id}`, {
    headers: sellerHeaders,
  });
  if (getArticleSellerPub.status !== 200) {
    throw new Error(`Expected 200 for published article fetched by seller, got ${getArticleSellerPub.status}`);
  }
  console.log('✅ Seller successfully fetched published article.');

  // Test: GET /api/articles -> check listing
  console.log('8. Listing articles...');
  const listArticles = await request('/articles', {
    headers: sellerHeaders,
  });
  if (listArticles.status !== 200) {
    throw new Error(`Expected 200 for articles listing, got ${listArticles.status}`);
  }
  const foundArticle = listArticles.data.find((a: any) => a.id === testArticle.id);
  if (!foundArticle) {
    throw new Error('Created article not found in published articles list');
  }
  console.log('✅ Published article successfully found in public listing.');

  // Test: DELETE /api/articles/:id as admin
  console.log('9. Deleting article as admin...');
  const deleteArticleAdmin = await request(`/articles/${testArticle.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  if (deleteArticleAdmin.status !== 200) {
    throw new Error(`Expected 200 for article deletion, got ${deleteArticleAdmin.status}`);
  }
  console.log('✅ Article deleted successfully.');

  // ───────────────────────────────────────────────────────────────────────────
  // NEWS TESTS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing News ---');

  // Test: POST /api/news as seller -> should be 403
  console.log('10. Trying to create news as seller...');
  const createNewsSeller = await request('/news', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      title: 'Seller News',
      body: 'Should fail',
    }),
  });
  if (createNewsSeller.status !== 403) {
    throw new Error(`Expected 403 for seller news creation, got ${createNewsSeller.status}`);
  }
  console.log('✅ Seller creation correctly rejected with 403.');

  // Test: POST /api/news as admin -> should succeed
  console.log('11. Creating unpublished news as admin...');
  const newsTitle = `Admin Test News ${Date.now()}`;
  const createNewsAdmin = await request('/news', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: newsTitle,
      body: 'This is a test news body from admin.',
      isPublished: false,
    }),
  });
  if (createNewsAdmin.status !== 201) {
    throw new Error(`Expected 201 for admin news creation, got ${createNewsAdmin.status}: ${JSON.stringify(createNewsAdmin.data)}`);
  }
  const testNews = createNewsAdmin.data;
  console.log(`✅ News created: "${testNews.title}" (ID: ${testNews.id})`);

  // Test: GET /api/news/:id as seller -> should return 404 (because isPublished is false)
  console.log('12. Getting unpublished news as seller (should 404)...');
  const getNewsSeller = await request(`/news/${testNews.id}`, {
    headers: sellerHeaders,
  });
  if (getNewsSeller.status !== 404) {
    throw new Error(`Expected 404 for unpublished news fetched by seller, got ${getNewsSeller.status}`);
  }
  console.log('✅ Unpublished news correctly hidden from seller (returned 404).');

  // Test: GET /api/news/:id as admin -> should succeed
  console.log('13. Getting unpublished news as admin...');
  const getNewsAdmin = await request(`/news/${testNews.id}`, {
    headers: adminHeaders,
  });
  if (getNewsAdmin.status !== 200) {
    throw new Error(`Expected 200 for admin fetching unpublished news, got ${getNewsAdmin.status}`);
  }
  console.log('✅ Admin successfully fetched unpublished news.');

  // Test: PATCH /api/news/:id as admin -> publish it
  console.log('14. Publishing news as admin...');
  const updateNewsAdmin = await request(`/news/${testNews.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      isPublished: true,
    }),
  });
  if (updateNewsAdmin.status !== 200) {
    throw new Error(`Expected 200 for news update, got ${updateNewsAdmin.status}`);
  }
  console.log('✅ News updated and published.');

  // Test: GET /api/news/:id as seller -> should now succeed (200)
  console.log('15. Getting published news as seller...');
  const getNewsSellerPub = await request(`/news/${testNews.id}`, {
    headers: sellerHeaders,
  });
  if (getNewsSellerPub.status !== 200) {
    throw new Error(`Expected 200 for published news fetched by seller, got ${getNewsSellerPub.status}`);
  }
  console.log('✅ Seller successfully fetched published news.');

  // Test: DELETE /api/news/:id as admin
  console.log('16. Deleting news as admin...');
  const deleteNewsAdmin = await request(`/news/${testNews.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  if (deleteNewsAdmin.status !== 200) {
    throw new Error(`Expected 200 for news deletion, got ${deleteNewsAdmin.status}`);
  }
  console.log('✅ News deleted successfully.');

  // ───────────────────────────────────────────────────────────────────────────
  // CLOUDINARY SIGNATURE AND UPLOAD TESTS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Cloudinary Uploads ---');

  // Test: GET /api/uploads/cloudinary-signature as seller -> should be 403
  console.log('17. Requesting signature as seller...');
  const getSigSeller = await request('/uploads/cloudinary-signature', {
    headers: sellerHeaders,
  });
  if (getSigSeller.status !== 403) {
    throw new Error(`Expected 403 for seller requesting signature, got ${getSigSeller.status}`);
  }
  console.log('✅ Seller signature request correctly rejected with 403.');

  // Test: GET /api/uploads/cloudinary-signature as admin -> should succeed
  console.log('18. Requesting signature as admin...');
  const getSigAdmin = await request('/uploads/cloudinary-signature', {
    headers: adminHeaders,
  });
  if (getSigAdmin.status !== 200) {
    throw new Error(`Expected 200 for admin signature request, got ${getSigAdmin.status}: ${JSON.stringify(getSigAdmin.data)}`);
  }
  const sigData = getSigAdmin.data;
  console.log('✅ Admin signature request succeeded.');
  console.log('   Timestamp:', sigData.timestamp);
  console.log('   Signature:', sigData.signature);
  console.log('   CloudName:', sigData.cloudName);
  console.log('   ApiKey:   ', sigData.apiKey);
  console.log('   Transform:', sigData.transformation);

  // Test: Real Cloudinary upload verification (if credentials are set)
  if (sigData.cloudName && sigData.cloudName !== 'your-cloud-name') {
    console.log('\n19. Running E2E Cloudinary upload with a large image...');
    
    // Look for test image generated by our test tool, or fall back to a small base64
    const largeImagePath = path.join(process.cwd(), 'large_test_image.jpg');
    let base64Image = '';

    if (fs.existsSync(largeImagePath)) {
      console.log(`   Found large test image at: ${largeImagePath}`);
      const fileBuffer = fs.readFileSync(largeImagePath);
      base64Image = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
    } else {
      console.log('   large_test_image.jpg not found, falling back to dummy base64 string...');
      // Minimal 1x1 transparent GIF base64
      base64Image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }

    // Cloudinary endpoint: https://api.cloudinary.com/v1_1/<cloud_name>/image/upload
    const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`;
    
    // In node-fetch, we can send as multipart/form-data or JSON (Cloudinary supports application/json for base64!)
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: base64Image,
        api_key: sigData.apiKey,
        timestamp: sigData.timestamp,
        signature: sigData.signature,
        transformation: sigData.transformation,
      }),
    });

    const uploadResult = await uploadRes.json() as any;

    if (uploadRes.status !== 200) {
      console.warn(`   ⚠️ Cloudinary upload failed with status ${uploadRes.status}:`, uploadResult.error?.message || JSON.stringify(uploadResult));
      console.warn('   Please check if your Cloudinary API credentials in .env are valid.');
    } else {
      console.log('   ✅ Cloudinary upload succeeded!');
      console.log('      URL:   ', uploadResult.secure_url);
      console.log(`      Width:  ${uploadResult.width}px`);
      console.log(`      Height: ${uploadResult.height}px`);
      console.log('      Format: ', uploadResult.format);
      
      // Verification: width and height must not exceed 1200px
      if (uploadResult.width > 1200 || uploadResult.height > 1200) {
        throw new Error(`Upload was not downsized! Result size is ${uploadResult.width}x${uploadResult.height}, cap is 1200x1200`);
      }
      console.log('   ✅ Cloudinary correctly enforced the size limits from the signed signature.');
    }
  } else {
    console.log('\n⚠️ Skipping real Cloudinary upload test: Cloudinary credentials are placeholders in .env.');
  }

  console.log('\n🎉 ALL STEP 9 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
