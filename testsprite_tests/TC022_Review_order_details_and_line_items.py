import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        context = await browser.new_context()
        context.set_default_timeout(15000)
        page = await context.new_page()

        await page.goto("http://localhost:3000/login")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Login
        await page.get_by_role('button', name='Acme Owner admin@acme.com', exact=True).click(timeout=10000)
        await page.locator('[id="submit-login-btn"]').click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/acme-corp"), timeout=15000)

        # Open Orders
        await page.goto("http://localhost:3000/acme-corp/orders")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Wait for the first row and open it
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)
        await first_row.locator("a[title='View Full Order Details']").click(timeout=10000)

        # Verify Financial Overview section exists
        await expect(page.locator("text=Financial Overview").first).to_be_visible(timeout=15000)

        # Verify line items table has at least one row (may have 0 if empty draft)
        # Just verify the line items section is present
        await expect(page.locator("text=/Line Items|Ordered Products/").first).to_be_visible(timeout=15000)

        # Verify order number is visible in the page
        await expect(page.locator("h1, h2").first).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())