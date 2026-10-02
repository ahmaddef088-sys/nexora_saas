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

        # Open Invoices page
        await page.goto("http://localhost:3000/acme-corp/finance/invoices")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Create a fresh draft invoice to guarantee an un-issued invoice
        await page.locator('[id="create-invoice-btn"]').click(timeout=10000)
        customer_select = page.locator("form select").first
        await customer_select.wait_for(state="visible", timeout=10000)
        await customer_select.select_option(index=1)
        await page.get_by_role('button', name='Create Draft Invoice', exact=True).click(timeout=10000)

        # Open invoice details of the newly created draft invoice (top row)
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)
        await first_row.locator("a[title='View Invoice Details']").click(timeout=10000)

        # Step: Send / Issue the invoice
        issue_btn = page.get_by_role('button', name='Issue Invoice', exact=True)
        await expect(issue_btn).to_be_visible(timeout=15000)
        await issue_btn.click(timeout=10000)

        confirm_issue_btn = page.locator("button:has-text('Confirm — Issue Invoice'), button:has-text('Issue Invoice')").last
        await expect(confirm_issue_btn).to_be_visible(timeout=10000)
        await confirm_issue_btn.click(timeout=10000)

        # Verify status is now Issued
        await expect(page.locator("text=Issued").first).to_be_visible(timeout=15000)

        # Step: Record payment
        await page.goto("http://localhost:3000/acme-corp/finance/payments")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        await page.locator('[id="record-payment-btn"]').click(timeout=10000)

        # Select the newly issued open invoice
        inv_select = page.locator("form select").first
        await inv_select.wait_for(state="visible", timeout=10000)
        await inv_select.select_option(index=1)

        # Submit payment
        await page.locator("form button[type='submit']").click(timeout=10000)

        # Click the invoice link from the first payment row to go back to invoice detail
        payment_first_row = page.locator("table tbody tr").first
        await expect(payment_first_row).to_be_visible(timeout=15000)
        await payment_first_row.locator("a[href*='/finance/invoices/']").first.click(timeout=10000)

        # Verify invoice status is Paid and Outstanding Balance is $0.00
        await expect(page.locator("text=Paid").first).to_be_visible(timeout=15000)
        await expect(page.locator("text=$0.00").first).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())