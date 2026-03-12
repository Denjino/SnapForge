import { NextRequest, NextResponse } from 'next/server';
import { chromium, type Browser } from 'playwright';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  browserInstance = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });
  return browserInstance;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url,
      width = 1440,
      height = 900,
      deviceScaleFactor = 1,
      isMobile = false,
      fullPage = true,
      waitTime = 3000,
    } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Validate URL
    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json(
        { error: `Invalid URL: ${url}` },
        { status: 400 }
      );
    }

    const browser = await getBrowser();
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor,
      isMobile,
      userAgent: isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    try {
      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch {
      // Fallback: try with just domcontentloaded
      try {
        await page.goto(normalizedUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
      } catch (e: any) {
        await context.close();
        return NextResponse.json(
          { error: `Failed to load: ${e.message}` },
          { status: 422 }
        );
      }
    }

    // Extra wait for lazy-loaded content / animations
    if (waitTime > 0) {
      await page.waitForTimeout(Math.min(waitTime, 10000));
    }

    // Dismiss common cookie/popup overlays
    try {
      // First, try clicking common dismiss/close buttons
      const dismissSelectors = [
        'button[class*="close"]',
        'button[class*="dismiss"]',
        'button[class*="decline"]',
        'button[class*="reject"]',
        'button[aria-label*="close" i]',
        'button[aria-label*="dismiss" i]',
        '[class*="cookie"] button',
        '[class*="consent"] button:first-of-type',
        '[class*="popup"] button[class*="close"]',
        '[class*="modal"] button[class*="close"]',
        'dialog button[class*="close"]',
      ];
      for (const sel of dismissSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 200 })) {
            await btn.click({ timeout: 500 });
            await page.waitForTimeout(300);
          }
        } catch {
          // Button not found or not clickable, continue
        }
      }

      // Then, force-hide any remaining overlays by CSS patterns
      await page.evaluate(() => {
        const selectors = [
          '[class*="cookie"]',
          '[class*="consent"]',
          '[id*="cookie"]',
          '[id*="consent"]',
          '[class*="popup"]',
          '[class*="modal"]',
          '[class*="overlay"]',
          '[class*="banner"]',
          '[role="dialog"]',
          '[aria-modal="true"]',
        ];
        selectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => {
            const style = window.getComputedStyle(el as Element);
            if (
              style.position === 'fixed' ||
              style.position === 'sticky' ||
              style.position === 'absolute' ||
              parseInt(style.zIndex) > 99
            ) {
              (el as HTMLElement).style.display = 'none';
            }
          });
        });
        // Also remove any backdrop/overlay covering the page
        document.querySelectorAll('[class*="backdrop"], [class*="dimmer"]').forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
      });
    } catch {
      // Ignore overlay dismissal errors
    }

    const screenshot = await page.screenshot({
      fullPage,
      type: 'png',
    });

    await context.close();

    const base64 = Buffer.from(screenshot).toString('base64');

    return NextResponse.json({
      image: base64,
      url: normalizedUrl,
      width,
      height,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Screenshot error:', error);
    // Reset browser on crash so next request gets a fresh instance
    if (browserInstance) {
      try { await browserInstance.close(); } catch {}
      browserInstance = null;
    }
    return NextResponse.json(
      { error: error.message || 'Screenshot failed' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'snapforge' });
}
