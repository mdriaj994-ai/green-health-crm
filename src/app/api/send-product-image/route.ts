import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '';

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  "gl ton":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2026/04/GL-Ton.webp",
  "respirex":      "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%B0%E0%A7%87%E0%A6%B8%E0%A6%AA%E0%A6%BF%E0%A6%B0%E0%A7%87%E0%A6%95%E0%A7%8D%E0%A6%B8.webp",
  "diania":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%A1%E0%A6%BE%E0%A7%9F%E0%A6%BE%E0%A6%A8%E0%A6%BF%E0%A7%9F%E0%A6%BE.webp",
  "rheumarex":     "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%B0%E0%A6%BF%E0%A6%89%E0%A6%AE%E0%A6%BE%E0%A6%B0%E0%A7%87%E0%A6%95%E0%A7%8D%E0%A6%B8.webp",
  "mobic":         "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Movic.webp",
  "mensoton":      "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%AE%E0%A7%87%E0%A6%A8%E0%A6%B8%E0%A7%8B%E0%A6%9F%E0%A6%A8.webp",
  "janasin":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Janasin.webp",
  "gfal":          "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/GFAL-1.webp",
  "zymoliv":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%9C%E0%A6%BE%E0%A6%87%E0%A6%AE%E0%A7%8B%E0%A6%B2%E0%A6%BF%E0%A6%AD.webp",
  "pudina":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Pudina.webp",
  "golap chandan": "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Golap-Chandan.webp",
  "glvit":         "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/GLvit.webp",
  "pepto":         "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Pepto-G.webp",
  "apple":         "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Apple-G.webp",
  "feroxel":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Feroxel.webp",
  "cofton":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/COFTON.webp",
  "alkogen":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Alkogen-1.webp",
  "amloki":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/11/Amloki-plus.webp",
  "gmovit":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2026/04/GL-Ton.webp",
  "lafi":          "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Pepto-G.webp",
  "rubatid":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Pepto-G.webp",
  "ziacap":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%A1%E0%A6%BE%E0%A7%9F%E0%A6%BE%E0%A6%A8%E0%A6%BF%E0%A7%9F%E0%A6%BE.webp",
  "ginecea":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%AE%E0%A7%87%E0%A6%A8%E0%A6%B8%E0%A7%8B%E0%A6%9F%E0%A6%A8.webp",
  "gspiru":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/GLvit.webp"
};

export async function POST(req: NextRequest) {
  try {
    const { senderId, productKey } = await req.json();

    if (!senderId) {
      return NextResponse.json({ error: 'senderId is required' }, { status: 400 });
    }

    const key = (productKey || 'gl ton').toLowerCase().trim();
    const cdnUrl = PRODUCT_IMAGE_MAP[key] || PRODUCT_IMAGE_MAP['gl ton'];

    console.log(`[SEND_IMAGE] Fetching image for ${key}: ${cdnUrl}`);

    const res = await fetch(cdnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      return NextResponse.json({ error: `CDN fetch failed: ${res.status}` }, { status: 502 });
    }

    const webpBuf = Buffer.from(await res.arrayBuffer());

    // Convert WebP to standard JPEG so Facebook attachment upload always succeeds
    const jpgBuf = await sharp(webpBuf).jpeg({ quality: 90 }).toBuffer();

    const blob = new Blob([jpgBuf], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('recipient', JSON.stringify({ id: senderId }));
    formData.append('message', JSON.stringify({ attachment: { type: 'image', payload: {} } }));
    formData.append('filedata', blob, 'product.jpg');

    const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      body: formData
    });

    const fbData = await fbRes.json();
    console.log(`[SEND_IMAGE] Facebook response:`, fbData);

    if (fbData.error) {
      return NextResponse.json({ error: fbData.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...fbData });
  } catch (err: any) {
    console.error('[SEND_IMAGE_ERROR]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
