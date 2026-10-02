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

        # Open Products
        await page.goto("http://localhost:3000/acme-corp/products")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Wait for table to load
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)

        # Extract text from first row to use as dynamic search query
        first_cell_text = await first_row.locator("td").first.inner_text()
        search_term = first_cell_text.split("\n")[0].strip()

        # Search by product name
        search_input = page.get_by_placeholder('Search by product name or SKU...', exact=True)
        await search_input.fill(search_term)

        # Verify results match search term
        matching_rows = page.locator("table tbody tr")
        await expect(matching_rows.first).to_be_visible(timeout=15000)
        await expect(matching_rows.first).to_contain_text(search_term, timeout=15000)

        # Test stock filter
        stock_select = page.locator("div:has(> span:has-text('Stock:')) select")
        await stock_select.wait_for(state="visible", timeout=10000)
        await stock_select.select_option("IN_STOCK")
        await expect(page.locator("table tbody tr").first).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())