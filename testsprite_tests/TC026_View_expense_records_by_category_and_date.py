import asyncio
import re
import time
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

        # Open Expenses page
        await page.goto("http://localhost:3000/acme-corp/finance/expenses")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Create an expense with UTILITIES category so we have data to filter
        await page.locator('[id="log-expense-btn"]').click(timeout=10000)
        payee_name = f"Vendor_{int(time.time())}"
        category_select = page.locator("form select").first
        await category_select.wait_for(state="visible", timeout=10000)
        await category_select.select_option("UTILITIES")
        await page.get_by_placeholder('e.g. AWS, Office Depot, Landlord Inc.').fill(payee_name)
        amount_input = page.locator("form input[type='number']").first
        await amount_input.fill("75.00")
        await page.locator("form button[type='submit']").click(timeout=10000)

        # Verify the expense was created
        row = page.locator("table tbody tr", has_text=payee_name)
        await expect(row).to_be_visible(timeout=15000)

        # Filter by UTILITIES category
        # Find category select (in the filter bar, not form)
        cat_filter = page.locator("div:has(> span:has-text('Category:')) select, select[id*='category'], main select").first
        if await cat_filter.is_visible():
            await cat_filter.select_option("UTILITIES")
            # Verify row remains visible after filter
            await expect(row).to_be_visible(timeout=10000)

        # Search by payee
        search = page.get_by_placeholder('Search by expense #, payee, reference, notes...')
        if await search.is_visible():
            await search.fill(payee_name)
            await expect(row).to_be_visible(timeout=10000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())