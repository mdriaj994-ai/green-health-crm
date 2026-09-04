const fs = require('fs');
const path = require('path');

const srcPath = 'd:/Ads Power And All akhane ase may mas/Data Deshbord/view_report.html';
const destPath = path.join(__dirname, '../public/master-report.html');

let content = fs.readFileSync(srcPath, 'utf8');

// Replace image source to use Next.js API endpoint
content = content.replace(
  'const mainImg = `Product Image/${fn}`;',
  'const mainImg = fn ? `/api/products/image?file=${encodeURIComponent(fn)}` : `Product Image/${fn}`;'
);

// Add top navigation bar to go back to /dashboard/products
const topBar = `
<div style="background: linear-gradient(90deg, #1e1b4b, #312e81); padding: 12px 20px; border-bottom: 2px solid #6366f1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; position: sticky; top: 0; z-index: 9999;">
  <div style="display: flex; align-items: center; gap: 12px;">
    <a href="/dashboard/products" style="background: #4f46e5; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(79,70,229,0.4);">
      ⬅️ কার্ড ড্যাশবোর্ডে ফিরুন
    </a>
    <span style="color: #c7d2fe; font-size: 14px; font-weight: 600;">
      🔬 MediScan AI — সম্পূর্ণ ৫৭টি ওষুধের ইন-ডিটেইলস মেগা এনসাইক্লোপিডিয়া
    </span>
  </div>
  <div style="display: flex; gap: 12px; align-items: center;">
    <a href="/dashboard" style="color: #a5b4fc; text-decoration: none; font-size: 13px; font-weight: 600;">💬 ইনবক্স</a>
    <span style="color: #4b5563;">|</span>
    <a href="/dashboard/products" style="color: #a5b4fc; text-decoration: none; font-size: 13px; font-weight: 600;">📦 প্রোডাক্ট কার্ড এডিটর</a>
  </div>
</div>
`;

content = content.replace('<body>', '<body>\n' + topBar);

fs.writeFileSync(destPath, content, 'utf8');
console.log('Successfully created public/master-report.html. Size:', fs.statSync(destPath).size, 'bytes');
