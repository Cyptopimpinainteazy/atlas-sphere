from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Initialize the browser (make sure you have the driver installed, e.g., chromedriver)
driver = webdriver.Chrome()

# Navigate to the page (you'll need to log in manually or automate login)
driver.get("https://dashboard.hackenproof.com/user/programs/unitus-v2-smart-contracts/reports/new")

# Wait for the page to load (adjust the element as needed)
WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, "#vue_create_new_report div._categoryList_1bn7w_98")))

# Find all span elements under the category labels
spans = driver.find_elements(By.CSS_SELECTOR, "#vue_create_new_report div._categoryList_1bn7w_98 div._label_15e6w_17 div span")

# Extract text from each span
categories = [span.text.strip() for span in spans if span.text.strip()]

print("Categories found:")
for category in categories:
    print(f"- {category}")

# Close the browser
driver.quit()</content>
<parameter name="filePath">/home/lojak/Desktop/x3-chain-master/llm-endpoint-checker/extract_categories.py