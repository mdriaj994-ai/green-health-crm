import { NextRequest, NextResponse } from 'next/server';

// Map product keys to their image URLs on the CDN
const PRODUCT_IMAGE_MAP: Record<string, string> = {
  "gl-ton":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2026/04/GL-Ton.webp",
  "respirex":     "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%B0%E0%A7%87%E0%A6%B8%E0%A6%AA%E0%A6%BF%E0%A6%B0%E0%A7%87%E0%A6%95%E0%A7%8D%E0%A6%B8.webp",
  "diania":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%A1%E0%A6%BE%E0%A7%9F%E0%A6%BE%E0%A6%A8%E0%A6%BF%E0%A7%9F%E0%A6%BE.webp",
  "rheumarex":    "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%B0%E0%A6%BF%E0%A6%89%E0%A6%AE%E0%A6%BE%E0%A6%B0%E0%A7%87%E0%A6%95%E0%A7%8D%E0%A6%B8.webp",
  "mobic":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Movic.webp",
  "mensoton":     "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%AE%E0%A7%87%E0%A6%A8%E0%A6%B8%E0%A7%8B%E0%A6%9F%E0%A6%A8.webp",
  "janasin":      "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Janasin.webp",
  "gfal":         "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/GFAL-1.webp",
  "zymoliv":      "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%9C%E0%A6%BE%E0%A6%87%E0%A6%AE%E0%A7%8B%E0%A6%B2%E0%A6%BF%E0%A6%AD.webp",
  "pudina":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Pudina.webp",
  "golap-chandan":"https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Golap-Chandan.webp",
  "glvit":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/GLvit.webp",
  "pepto":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Pepto-G.webp",
  "apple":        "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Apple-G.webp",
  "feroxel":      "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Feroxel.webp",
  "cofton":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/COFTON.webp",
  "alkogen":      "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Alkogen-1.webp",
  "amloki":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/11/Amloki-plus.webp",
  "gmovit":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2026/04/GL-Ton.webp",
  "lafi":         "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Pepto-G.webp",
  "rubatid":      "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/Pepto-G.webp",
  "ziacap":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%A1%E0%A6%BE%E0%A7%9F%E0%A6%BE%E0%A6%A8%E0%A6%BF%E0%A7%9F%E0%A6%BE.webp",
  "ginecea":      "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/%E0%A6%AE%E0%A7%87%E0%A6%A8%E0%A6%B8%E0%A7%8B%E0%A6%9F%E0%A6%A8.webp",
  "gspiru":       "https://galaxylaboratoriesunani.com.bd/wp-content/uploads/2025/12/GLvit.webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ product: string }> }
) {
  const { product } = await params;
  const key = product.toLowerCase();
  const cdnUrl = PRODUCT_IMAGE_MAP[key];

  if (!cdnUrl) {
    return new NextResponse('Product not found', { status: 404 });
  }

  try {
    const upstream = await fetch(cdnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GreenHealthBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return new NextResponse('Image fetch failed', { status: 502 });
    }

    const blob = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'image/webp';

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('product-image proxy error:', err);
    return new NextResponse('Proxy error', { status: 500 });
  }
}
