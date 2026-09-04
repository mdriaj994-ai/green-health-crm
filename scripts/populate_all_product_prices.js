const fs = require('fs');
const path = require('path');

const masterPath = path.join(__dirname, '..', 'data', 'medicine_master_complete_db.json');
const editsPath = path.join(__dirname, '..', 'data', 'custom_user_edits.json');
const dataDeshbordEditsPath = 'd:/Ads Power And All akhane ase may mas/Data Deshbord/custom_user_edits.json';

const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const currentEdits = fs.existsSync(editsPath) ? JSON.parse(fs.readFileSync(editsPath, 'utf8')) : {};

const fullEdits = {};

for (const p of master) {
  const sl = String(p.SL);
  const name = p['ওষুধের নাম (Brand Name)'] || '';
  const existing = currentEdits[sl] || {};

  if (sl === '39') {
    // Soul Mate
    fullEdits[sl] = {
      custom_details: existing.custom_details || 'প্রাকৃতিক ও ভেষজ উপাদানে তৈরি বিশেষ কার্যকরী ফর্মুলা।',
      custom_note: existing.custom_note || 'খাঁটি হরিণের কস্তুরি, শোধন করা পারদ, আসল হিমালয়ান শিলাজিৎ, কাশ্মীরি জাফরান ও কোরিয়ান জিনসেং সমৃদ্ধ। ১০০% গোপন প্যাকেজিং ও ক্যাশ অন ডেলিভারি।',
      custom_price: existing.custom_price || '৩,০০০',
      discount_price: existing.discount_price || '৩,০০০',
      stock_status: existing.stock_status || 'in_stock',
      stock_count: existing.stock_count || 'পর্যাপ্ত স্টক রয়েছে',
      custom_pitch: existing.custom_pitch || 'প্রাকৃতিক ভেষজ শক্তিসমৃদ্ধ ফর্মুলা - Soul Mate (সোল মেট)। শারীরিক দুর্বলতা দূর করে দীর্ঘস্থায়ী শক্তি ও সতেজতা বজায় রাখতে কার্যকরী।',
      last_updated: existing.last_updated || new Date().toLocaleString('bn-BD')
    };
  } else {
    fullEdits[sl] = {
      custom_details: existing.custom_details || (name + '-এর ১০০% খাঁটি প্রাকৃতিক ও কার্যকরী ফর্মুলা।'),
      custom_note: existing.custom_note || 'সারা দেশে ক্যাশ অন ডেলিভারিতে ফ্রি হোম ডেলিভারি সুবিধা রয়েছে। এছাড়া একসাথে ২ ফাইল অর্ডার করলে বিশেষ ছাড় পাবেন।',
      custom_price: existing.custom_price || '৩,৫০০',
      discount_price: existing.discount_price || '২,৯০০',
      stock_status: existing.stock_status || 'in_stock',
      stock_count: existing.stock_count || '50',
      custom_pitch: existing.custom_pitch || (name + '-এর শক্তিশালী ও পার্শ্বপ্রতিক্রিয়ামুক্ত প্রাকৃতিক সমাধান।'),
      last_updated: existing.last_updated || new Date().toLocaleString('bn-BD')
    };
  }
}

// Save to social-inbox
fs.writeFileSync(editsPath, JSON.stringify(fullEdits, null, 2), 'utf8');
console.log(`[SUCCESS] Saved complete price database for all ${Object.keys(fullEdits).length} medicines in social-inbox!`);

// Save to Data Deshbord as well if exists
try {
  if (fs.existsSync(path.dirname(dataDeshbordEditsPath))) {
    fs.writeFileSync(dataDeshbordEditsPath, JSON.stringify(fullEdits, null, 2), 'utf8');
    console.log(`[SUCCESS] Synchronized all ${Object.keys(fullEdits).length} medicines with Data Deshbord!`);
  }
} catch (err) {
  console.warn('[WARN] Data Deshbord sync:', err.message);
}
